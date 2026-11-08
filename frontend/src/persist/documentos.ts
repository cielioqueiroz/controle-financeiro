import { obterNeon } from '../lib/neon'
import type { DocParaSaldo } from '../domain/saldos'
import type { DocParaAberto } from '../domain/aberto'
import type { DocParaQuitacao } from '../domain/link/quitacao-parcial'
import { lerConferenciaSalva, type ConferenciaSalva } from '../domain/validate/conferencia-salva'
import { RecorteIncompletoError } from './puxar'

function exigirRespostaCompleta<T>(data: T[] | null, count: number | null): T[] {
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new RecorteIncompletoError('o banco não informou uma contagem exata válida dos documentos')
  }
  const linhas = data ?? []
  if (linhas.length !== count) {
    throw new RecorteIncompletoError(
      `o banco tem ${count} documentos e a resposta trouxe ${linhas.length}`,
    )
  }
  return linhas
}

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
  const { data, error, count } = await neon
    .from('documents')
    .select('id, bank, doc_type, period_start, period_end, filename, imported_at, declared_total, declared_income, declared_expense, conferencia', { count: 'exact' })
    .order('imported_at', { ascending: false })
  if (error) throw error
  const documentos = exigirRespostaCompleta(data, count) as Array<Omit<DocumentoSalvo, 'conferencia'> & { conferencia?: unknown }>
  return documentos.map((d) => ({ ...d, conferencia: lerConferenciaSalva(d.conferencia) }))
}

/** Uma linha de `documents` com tudo que o painel deriva dela: o saldo final
 *  do extrato (`saldos.ts`), o saldo em aberto da fatura (`aberto.ts`) e o
 *  total que a quitação precisa alcançar (`quitacao-parcial.ts`). */
export type DocDoPainel = DocParaSaldo & DocParaAberto & DocParaQuitacao

/** Documentos que sustentam saldos e valores em aberto. Falhas sobem ao
 * provider, que pode mostrar o histórico e avisar que esta parte falhou. */
export async function puxarSaldos(): Promise<DocDoPainel[]> {
  const neon = await obterNeon()
  if (!neon) return []
  const { data, error, count } = await neon
      .from('documents')
      .select(
        'id, bank, account_id, doc_type, period_end, declared_total, end_balance_cents, total_open_balance, next_invoice_balance, next_close_date, future_installments_total',
        { count: 'exact' },
      )
  if (error) throw error
  return exigirRespostaCompleta(data, count) as DocDoPainel[]
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
