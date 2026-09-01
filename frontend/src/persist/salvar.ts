import { neon } from '../lib/neon'
import type { ParseResult, RawTransaction } from '../domain/parsers/types'
import type { DocKind } from '../domain/pdf/detect'
import { hashConteudoDocumento, hashDocumento, chaveTransacao, sha256 } from '../domain/dedupe/hash'
import { categoriaDe, REGRAS_GLOBAIS, type Regra } from '../domain/categorize/regras'
import { mesclarRegras } from '../domain/categorize/aprendizado'
import { vincular, paraVincular } from '../domain/link/vinculos'

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
  /** Regras aprendidas com as correções do usuário. **Obrigatório de
   *  propósito**: com valor padrão, um ponto de chamada esquecido voltaria
   *  em silêncio a categorizar só pelas globais — que foi exatamente o bug
   *  (o app tinha o aprendizado pronto e nunca o usava). Passe `[]` quando
   *  de fato não houver regras. */
  regrasUsuario: Regra[],
): Promise<ResultadoSalvar> {
  if (!neon) return { status: 'sem-persistencia' }

  const regras = mesclarRegras(regrasUsuario, REGRAS_GLOBAIS)

  const { data: sess } = await neon.auth.getSession()
  if (!sess?.session) throw new Error('Faça login para salvar.')

  const fileHash = await hashDocumento(fileBytes)
  const contentHash = await hashConteudoDocumento(result, kind)

  // 1. Documento já importado? (RLS já escopa ao usuário)
  const camposDocumento =
    'imported_at, content_hash, bank, doc_type, period_start, period_end, declared_total, declared_income, declared_expense, next_close_date, next_invoice_balance, total_open_balance, future_installments_total, accounts(bank, type, last4, agency, number), transactions(date, description, amount_cents, installment, fx)'
  let consultaDuplicata = await neon
    .from('documents')
    .select(camposDocumento)
    // Inclui os Documentos antigos (content_hash NULL) para a migração não
    // deixar passar uma duplicata já existente no histórico.
    .or(`file_hash.eq.${fileHash},content_hash.eq.${contentHash},content_hash.is.null`)
  // Permite que o app continue funcionando enquanto a migração é aplicada;
  // sem content_hash, ainda há a comparação de conteúdo dos Documentos antigos.
  if (consultaDuplicata.error && /content_hash/i.test(consultaDuplicata.error.message)) {
    consultaDuplicata = await neon.from('documents').select(camposDocumento.replace('content_hash, ', ''))
  }
  if (consultaDuplicata.error) throw new Error(consultaDuplicata.error.message)
  const docsExistentes = (consultaDuplicata.data ?? []) as DocumentoExistente[]
  let duplicado = docsExistentes.find(
    (doc) => doc.content_hash === contentHash || doc.file_hash === fileHash,
  )
  // Documentos anteriores à 0005 não têm content_hash. Comparamos seus
  // dados persistidos para que a correção também cubra o histórico existente.
  if (!duplicado) {
    for (const doc of docsExistentes) {
      if (!doc.content_hash && (await hashPersistido(doc)) === contentHash) {
        duplicado = doc
        break
      }
    }
  }
  if (duplicado) {
    return { status: 'documento-duplicado', importadoEm: duplicado.imported_at }
  }

  // 2. Conta bancária: busca-ou-cria (sem upsert)
  const accountId = await acharOuCriarConta(result, kind)

  // 3. Documento
  const docBase = {
    account_id: accountId,
    file_hash: fileHash,
    content_hash: contentHash,
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
  }
  // Saldo final do extrato (fatura não tem). Alimenta o saldo por conta.
  // DEFENSIVO: se a migração 0002 ainda não rodou, a coluna não existe e o
  // insert erra citando `end_balance_cents` — nesse caso refazemos sem ela,
  // para importar nunca quebrar antes da migração. Some sozinho depois.
  let insercao = await neon
    .from('documents')
    .insert({ ...docBase, end_balance_cents: result.balance?.final ?? null })
    .select('id')
    .single()
  if (insercao.error && /end_balance_cents/i.test(insercao.error.message)) {
    insercao = await neon.from('documents').insert(docBase).select('id').single()
  }
  if (insercao.error && /content_hash/i.test(insercao.error.message)) {
    const { content_hash: _contentHash, ...semHashDeConteudo } = docBase
    insercao = await neon
      .from('documents')
      .insert({ ...semHashDeConteudo, end_balance_cents: result.balance?.final ?? null })
      .select('id')
      .single()
    if (insercao.error && /end_balance_cents/i.test(insercao.error.message)) {
      insercao = await neon.from('documents').insert(semHashDeConteudo).select('id').single()
    }
  }
  const doc = insercao.data
  if (insercao.error || !doc) throw new Error(insercao.error?.message ?? 'Falha ao salvar o documento')

  // 4. Transações — vincula, categoriza, deduplica por hash
  const key = accountKey(result, kind)
  const linked = vincular([paraVincular(result, key, kind.docType)])

  // Duas transações idênticas no MESMO documento (ex.: dois pães de R$5 no
  // mesmo dia) geram o mesmo hash. Ambas são reais — perder uma faria o
  // total salvo divergir do banco. Damos um sufixo de ocorrência à
  // repetida para o hash ficar único sem descartar a linha. Loop
  // sequencial: o contador precisa da ordem.
  const ocorrencias = new Map<string, number>()
  const comHash: Array<{ hash: string; row: Record<string, unknown> }> = []
  for (const t of linked) {
    const base = await sha256(chaveTransacao(t, key))
    const n = (ocorrencias.get(base) ?? 0) + 1
    ocorrencias.set(base, n)
    const hash = n === 1 ? base : `${base}#${n}`
    comHash.push({
      hash,
      row: {
        account_id: accountId,
        document_id: doc.id,
        date: t.date.toISOString().slice(0, 10),
        description: t.description,
        amount_cents: t.amountCents,
        direction: t.amountCents >= 0 ? 'out' : 'in',
        kind: kindParaBanco(t.kind, t.link),
        category_slug: categoriaDe(t, regras),
        installment: t.installment,
        fx: t.fx,
        hash,
        raw: t.raw,
      },
    })
  }

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

type DocumentoExistente = {
  imported_at: string
  file_hash?: string
  content_hash?: string | null
  bank: string
  doc_type: DocKind['docType']
  period_start: string | null
  period_end: string | null
  declared_total: number | null
  declared_income: number | null
  declared_expense: number | null
  next_close_date: string | null
  next_invoice_balance: number | null
  total_open_balance: number | null
  future_installments_total: number | null
  accounts: { bank?: string; type?: 'checking' | 'credit_card'; last4?: string | null; agency?: string | null; number?: string | null } | null
  transactions: Array<{ date: string; description: string; amount_cents: number; installment: RawTransaction['installment']; fx: RawTransaction['fx'] }>
}

function hashPersistido(doc: DocumentoExistente): Promise<string> {
  return hashConteudoDocumento(
    {
      transactions: doc.transactions.map((tx) => ({
        date: new Date(tx.date),
        description: tx.description,
        amountCents: tx.amount_cents,
        installment: tx.installment,
        card: null,
        fx: tx.fx,
        kind: 'compra',
        raw: tx.description,
      })),
      declaredTotal: doc.declared_total,
      declaredIncome: doc.declared_income,
      declaredExpense: doc.declared_expense,
      period: doc.period_start && doc.period_end ? { start: new Date(doc.period_start), end: new Date(doc.period_end) } : null,
      account: {
        bank: (doc.accounts?.bank ?? doc.bank) as ParseResult['account']['bank'],
        type: doc.accounts?.type ?? 'checking',
        last4: doc.accounts?.last4 ?? null,
        agency: doc.accounts?.agency ?? null,
        number: doc.accounts?.number ?? null,
        holderName: null,
      },
      forward: {
        nextCloseDate: doc.next_close_date ? new Date(doc.next_close_date) : null,
        nextInvoiceBalance: doc.next_invoice_balance,
        totalOpenBalance: doc.total_open_balance,
        futureInstallmentsTotal: doc.future_installments_total,
      },
    },
    { bank: doc.bank as DocKind['bank'], docType: doc.doc_type },
  )
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
