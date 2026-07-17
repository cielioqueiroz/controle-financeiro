import { neon } from '../lib/neon'
import type { ParseResult, RawTransaction } from '../parsers/types'
import type { DocKind } from '../pdf/detect'
import { hashDocumento, chaveTransacao, sha256 } from '../dedupe/hash'
import { categoriaDe } from '../categorize/regras'
import { vincular, paraVincular } from '../link/vinculos'

export type ResultadoSalvar =
  | { status: 'salvo'; documentId: string; inseridas: number; jaExistiam: number }
  | { status: 'documento-duplicado'; importadoEm: string }
  | { status: 'sem-persistencia' }

const accountKey = (result: ParseResult, kind: DocKind): string =>
  `${kind.bank}-${kind.docType}-${result.account.last4 ?? result.account.number ?? 'x'}`

/** Salva um documento importado e suas transações no Neon.
 *
 *  Modelo Neon: o RLS escopa toda query ao usuário logado e o `user_id` é
 *  preenchido pelo default `auth.user_id()` no insert — então não mandamos
 *  user_id nem filtramos por ele. Dedup por hash (documento e transação),
 *  sem depender de upsert (não garantido no neon-js beta): busca-ou-cria a
 *  conta e insere só as transações de hash inédito.
 *
 *  Nunca recebe o PDF — só o resultado já parseado e o hash do arquivo,
 *  calculado no navegador. */
export async function salvarDocumento(
  result: ParseResult,
  kind: DocKind,
  fileBytes: ArrayBuffer,
  filename: string,
): Promise<ResultadoSalvar> {
  if (!neon) return { status: 'sem-persistencia' }

  const { data: sess } = await neon.auth.getSession()
  if (!sess?.session) throw new Error('Faça login para salvar.')

  const fileHash = await hashDocumento(fileBytes)

  // 1. Documento já importado? (RLS já escopa ao usuário)
  const { data: docsExistentes, error: dupErr } = await neon
    .from('documents')
    .select('imported_at')
    .eq('file_hash', fileHash)
    .limit(1)
  if (dupErr) throw new Error(dupErr.message)
  if (docsExistentes && docsExistentes.length > 0) {
    return { status: 'documento-duplicado', importadoEm: docsExistentes[0].imported_at }
  }

  // 2. Conta bancária: busca-ou-cria (sem upsert)
  const accountId = await acharOuCriarConta(result, kind)

  // 3. Documento
  const { data: doc, error: docErr } = await neon
    .from('documents')
    .insert({
      account_id: accountId,
      file_hash: fileHash,
      bank: kind.bank,
      doc_type: kind.docType,
      period_start: result.period?.start.toISOString().slice(0, 10) ?? null,
      period_end: result.period?.end.toISOString().slice(0, 10) ?? null,
      declared_total: result.declaredTotal,
      declared_income: result.declaredIncome,
      declared_expense: result.declaredExpense,
      filename,
      next_close_date: result.forward.nextCloseDate?.toISOString().slice(0, 10) ?? null,
      next_invoice_balance: result.forward.nextInvoiceBalance,
      total_open_balance: result.forward.totalOpenBalance,
      future_installments_total: result.forward.futureInstallmentsTotal,
    })
    .select('id')
    .single()
  if (docErr || !doc) throw new Error(docErr?.message ?? 'Falha ao salvar o documento')

  // 4. Transações — vincula, categoriza, deduplica por hash
  const key = accountKey(result, kind)
  const linked = vincular([paraVincular(result, key, kind.docType)])

  const comHash = await Promise.all(
    linked.map(async (t) => {
      const hash = await sha256(chaveTransacao(t, key))
      return {
        hash,
        row: {
          account_id: accountId,
          document_id: doc.id,
          date: t.date.toISOString().slice(0, 10),
          description: t.description,
          amount_cents: t.amountCents,
          direction: t.amountCents >= 0 ? 'out' : 'in',
          kind: kindParaBanco(t.kind, t.link),
          category_slug: categoriaDe(t),
          installment: t.installment,
          fx: t.fx,
          hash,
          raw: t.raw,
        },
      }
    }),
  )

  // Descobre quais hashes já existem e insere só os inéditos.
  const hashes = comHash.map((c) => c.hash)
  const { data: jaTem, error: hashErr } = await neon
    .from('transactions')
    .select('hash')
    .in('hash', hashes)
  if (hashErr) throw new Error(hashErr.message)
  const existentes = new Set((jaTem ?? []).map((r: { hash: string }) => r.hash))

  const novos = comHash.filter((c) => !existentes.has(c.hash)).map((c) => c.row)

  if (novos.length > 0) {
    const { error: insErr } = await neon.from('transactions').insert(novos)
    if (insErr) throw new Error(insErr.message)
  }

  return {
    status: 'salvo',
    documentId: doc.id,
    inseridas: novos.length,
    jaExistiam: comHash.length - novos.length,
  }
}

/** Busca a conta pelo banco+tipo+final; cria se não existir. Substitui o
 *  upsert com índice de expressão (que o PostgREST não expõe bem). */
async function acharOuCriarConta(result: ParseResult, kind: DocKind): Promise<string> {
  const { account } = result
  const { data: contas, error } = await neon!
    .from('accounts')
    .select('id, last4, number')
    .eq('bank', kind.bank)
    .eq('type', account.type)
  if (error) throw new Error(error.message)

  const igual = (contas ?? []).find(
    (c: { last4: string | null; number: string | null }) =>
      (c.last4 ?? '') === (account.last4 ?? '') &&
      (c.number ?? '') === (account.number ?? ''),
  )
  if (igual) return igual.id as string

  const { data: nova, error: insErr } = await neon!
    .from('accounts')
    .insert({
      bank: kind.bank,
      type: account.type,
      last4: account.last4,
      agency: account.agency,
      number: account.number,
      holder_name: account.holderName,
    })
    .select('id')
    .single()
  if (insErr || !nova) throw new Error(insErr?.message ?? 'Falha ao salvar a conta')
  return nova.id as string
}

function kindParaBanco(
  kind: RawTransaction['kind'],
  link: 'internal_transfer' | 'card_payment' | null,
): string {
  if (link === 'internal_transfer') return 'internal_transfer'
  if (link === 'card_payment') return 'card_payment'
  if (kind === 'entrada') return 'income'
  if (kind === 'pagamento') return 'card_payment'
  return 'expense'
}
