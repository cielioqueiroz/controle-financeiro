import { neon } from '../lib/neon'
import { competenciaDe } from './agrupar'

export type { Periodo } from './agrupar'

export type TransacaoSalva = {
  id: string
  date: string // data real da compra/débito
  competencia: string // mês de referência (fatura), YYYY-MM
  description: string
  label: string | null
  amount_cents: number
  kind: string
  category_slug: string | null
  bank: string
  doc_type: string
  document_id: string
  installment: { current: number; total: number } | null
}

/** Puxa TODAS as transações do usuário de uma vez, já com a competência
 *  calculada (mês do vencimento da fatura, ou do período do extrato). O
 *  dashboard fatia por dia/semana/mês/ano no cliente — os volumes são
 *  pequenos (uso pessoal) e assim navegar entre períodos é instantâneo,
 *  além de habilitar tabelas por categoria e o detalhe por dia sem novas
 *  idas ao banco. RLS garante que só vêm as transações do próprio usuário. */
export async function puxarTudo(): Promise<TransacaoSalva[]> {
  if (!neon) return []
  const { data, error } = await neon
    .from('transactions')
    .select(
      'id, date, description, label, amount_cents, kind, category_slug, installment, document_id, accounts(bank), documents(doc_type, period_end)',
    )
    .order('date', { ascending: false })

  if (error) throw error

  return (data ?? []).map((r: Record<string, unknown>) => {
    const doc = r.documents as { doc_type?: string; period_end?: string } | null
    const date = r.date as string
    return {
      id: r.id as string,
      date,
      competencia: competenciaDe(doc?.period_end ?? null, date),
      description: r.description as string,
      label: (r.label as string) ?? null,
      amount_cents: r.amount_cents as number,
      kind: r.kind as string,
      category_slug: (r.category_slug as string) ?? null,
      bank: (r.accounts as { bank?: string } | null)?.bank ?? 'desconhecido',
      doc_type: doc?.doc_type ?? 'desconhecido',
      document_id: r.document_id as string,
      installment: (r.installment as { current: number; total: number }) ?? null,
    }
  })
}
