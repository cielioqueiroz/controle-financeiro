import { neon } from '../lib/neon'
import type { DocParaSaldo } from './saldos'

export type DocumentoSalvo = {
  id: string
  bank: string
  doc_type: string
  period_start: string | null
  period_end: string | null
  filename: string | null
  imported_at: string
  declared_total: number | null
}

/** Lista os documentos importados do usuário (RLS escopa aos dele). */
export async function puxarDocumentos(): Promise<DocumentoSalvo[]> {
  if (!neon) return []
  const { data, error } = await neon
    .from('documents')
    .select('id, bank, doc_type, period_start, period_end, filename, imported_at, declared_total')
    .order('imported_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DocumentoSalvo[]
}

/** Documentos com os campos que alimentam o saldo por conta. Query SEPARADA
 *  (não o `puxarDocumentos` do painel) e DEFENSIVA: se a migração 0002 ainda
 *  não rodou, a coluna `end_balance_cents` não existe e o select erra — aqui
 *  isso vira lista vazia (a fileira de saldo simplesmente não aparece), sem
 *  contaminar o resto do dashboard. */
export async function puxarSaldos(): Promise<DocParaSaldo[]> {
  if (!neon) return []
  try {
    const { data, error } = await neon
      .from('documents')
      .select('bank, account_id, doc_type, period_end, end_balance_cents')
    if (error) return []
    return (data ?? []) as DocParaSaldo[]
  } catch {
    return []
  }
}

/** Apaga um documento. As transações caem junto por ON DELETE CASCADE
 *  (ver schema) — então some da fatura inteira de uma vez. */
export async function apagarDocumento(id: string): Promise<void> {
  if (!neon) return
  const { error } = await neon.from('documents').delete().eq('id', id)
  if (error) throw error
}

/** Apaga TUDO do usuário: documentos (cascateia transações) e contas.
 *  Irreversível — a UI confirma antes. RLS garante que só apaga o dele. */
export async function apagarTudo(): Promise<void> {
  if (!neon) return
  // Filtro "id não é nulo" = todas as linhas visíveis (o RLS já limita ao
  // usuário); o PostgREST exige um filtro para não apagar sem querer.
  const { error: e1 } = await neon.from('documents').delete().not('id', 'is', null)
  if (e1) throw e1
  const { error: e2 } = await neon.from('accounts').delete().not('id', 'is', null)
  if (e2) throw e2
}
