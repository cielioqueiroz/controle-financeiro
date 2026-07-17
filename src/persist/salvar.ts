import { supabase } from '../lib/supabase'
import type { ParseResult, RawTransaction } from '../parsers/types'
import type { DocKind } from '../pdf/detect'
import { hashDocumento, chaveTransacao } from '../dedupe/hash'
import { categoriaDe } from '../categorize/regras'
import { vincular, paraVincular } from '../link/vinculos'

export type ResultadoSalvar =
  | { status: 'salvo'; documentId: string; inseridas: number; jaExistiam: number }
  | { status: 'documento-duplicado'; importadoEm: string }
  | { status: 'sem-persistencia' }

const accountKey = (result: ParseResult, kind: DocKind): string =>
  `${kind.bank}-${kind.docType}-${result.account.last4 ?? result.account.number ?? 'x'}`

/** Salva um documento importado e suas transações.
 *
 *  - Barra o documento se o hash do arquivo já foi importado.
 *  - Cria/reusa a conta bancária.
 *  - Insere transações que ainda não existem (dedup por hash de transação);
 *    as que já existem são puladas silenciosamente e contadas.
 *
 *  Não recebe o PDF — recebe o resultado já parseado e o hash do arquivo,
 *  calculado no navegador. O PDF nunca sai do dispositivo. */
export async function salvarDocumento(
  result: ParseResult,
  kind: DocKind,
  fileBytes: ArrayBuffer,
  filename: string,
): Promise<ResultadoSalvar> {
  if (!supabase) return { status: 'sem-persistencia' }

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Faça login para salvar.')

  const fileHash = await hashDocumento(fileBytes)

  // 1. Documento já importado? (hash único por usuário)
  const { data: existente } = await supabase
    .from('documents')
    .select('imported_at')
    .eq('user_id', userId)
    .eq('file_hash', fileHash)
    .maybeSingle()

  if (existente) {
    return { status: 'documento-duplicado', importadoEm: existente.imported_at }
  }

  // 2. Conta bancária (cria ou reusa)
  const accountId = await upsertAccount(userId, result, kind)

  // 3. Documento
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
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

  if (docErr || !doc) throw docErr ?? new Error('Falha ao salvar o documento')

  // 4. Transações — vincula, categoriza, deduplica
  const key = accountKey(result, kind)
  const linked = vincular([paraVincular(result, key, kind.docType)])

  const rows = await Promise.all(
    linked.map(async (t) => ({
      user_id: userId,
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
      hash: await hashTransacaoHex(t, key),
      raw: t.raw,
    })),
  )

  // upsert com ignoreDuplicates: pula transações que já existiam (hash único)
  const { data: inseridas, error: txErr } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'user_id,hash', ignoreDuplicates: true })
    .select('id')

  if (txErr) throw txErr

  const nInseridas = inseridas?.length ?? 0
  return {
    status: 'salvo',
    documentId: doc.id,
    inseridas: nInseridas,
    jaExistiam: rows.length - nInseridas,
  }
}

async function upsertAccount(
  userId: string,
  result: ParseResult,
  kind: DocKind,
): Promise<string> {
  const { account } = result
  const { data, error } = await supabase!
    .from('accounts')
    .upsert(
      {
        user_id: userId,
        bank: kind.bank,
        type: account.type,
        last4: account.last4,
        agency: account.agency,
        number: account.number,
        holder_name: account.holderName,
      },
      { onConflict: 'user_id,bank,type,last4,number', ignoreDuplicates: false },
    )
    .select('id')
    .single()
  if (error || !data) throw error ?? new Error('Falha ao salvar a conta')
  return data.id
}

/** kind interno + vínculo → kind do banco. */
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

async function hashTransacaoHex(t: RawTransaction, key: string): Promise<string> {
  const { sha256 } = await import('../dedupe/hash')
  return sha256(chaveTransacao(t, key))
}
