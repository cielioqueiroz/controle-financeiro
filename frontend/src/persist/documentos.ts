import { obterNeon } from '../lib/neon'
import type { DocParaSaldo } from '../domain/saldos'
import type { DocParaAberto } from '../domain/aberto'
import { lerConferenciaSalva, type ConferenciaSalva } from '../domain/validate/conferencia-salva'

export type DocumentoSalvo = {
  id: string
  bank: string
  doc_type: string
  period_start: string | null
  period_end: string | null
  filename: string | null
  imported_at: string
  declared_total: number | null
  declared_income: number | null
  declared_expense: number | null
  conferencia?: ConferenciaSalva | null
}

/** Lista os documentos importados do usuário (RLS escopa aos dele). */
export async function puxarDocumentos(): Promise<DocumentoSalvo[]> {
  const neon = await obterNeon()
  if (!neon) return []
  const { data, error } = await neon
    .from('documents')
    .select('id, bank, doc_type, period_start, period_end, filename, imported_at, declared_total, declared_income, declared_expense, conferencia')
    .order('imported_at', { ascending: false })
  if (error) throw error
  const documentos = (data ?? []) as Array<Omit<DocumentoSalvo, 'conferencia'> & { conferencia?: unknown }>
  return documentos.map((d) => ({ ...d, conferencia: lerConferenciaSalva(d.conferencia) }))
}

/** Uma linha de `documents` com tudo que o painel deriva dela: o saldo final
 *  do extrato (`saldos.ts`) e o saldo em aberto da fatura (`aberto.ts`). */
export type DocDoPainel = DocParaSaldo & DocParaAberto

/** Documentos que sustentam saldos e valores em aberto. Falhas sobem ao
 * provider, que pode mostrar o histórico e avisar que esta parte falhou. */
export async function puxarSaldos(): Promise<DocDoPainel[]> {
  const neon = await obterNeon()
  if (!neon) return []
  const { data, error } = await neon
      .from('documents')
      .select(
        'id, bank, account_id, doc_type, period_end, end_balance_cents, total_open_balance, next_invoice_balance, next_close_date, future_installments_total',
      )
  if (error) throw error
  return (data ?? []) as DocDoPainel[]
}

/** Apaga um documento. As transações caem junto por ON DELETE CASCADE
 *  (ver schema) — então some da fatura inteira de uma vez. */
export async function apagarDocumento(id: string): Promise<void> {
  const neon = await obterNeon()
  if (!neon) return
  const { error } = await neon.from('documents').delete().eq('id', id)
  if (error) throw error
}

/** Apaga TUDO do usuário: documentos (cascateia transações) e contas.
 *  Irreversível — a UI confirma antes. RLS garante que só apaga o dele. */
export async function apagarTudo(): Promise<void> {
  const neon = await obterNeon()
  if (!neon) return
  // Filtro "id não é nulo" = todas as linhas visíveis (o RLS já limita ao
  // usuário); o PostgREST exige um filtro para não apagar sem querer.
  const { error: e1 } = await neon.from('documents').delete().not('id', 'is', null)
  if (e1) throw e1
  const { error: e2 } = await neon.from('accounts').delete().not('id', 'is', null)
  if (e2) throw e2
}
