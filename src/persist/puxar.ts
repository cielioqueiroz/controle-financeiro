import { neon } from '../lib/neon'

export type TransacaoSalva = {
  id: string
  date: string
  description: string
  label: string | null
  amount_cents: number
  kind: string
  category_slug: string | null
  bank: string
  installment: { current: number; total: number } | null
}

export type Periodo = 'dia' | 'semana' | 'mes' | 'ano'

/** Intervalo [início, fim] para um período âncorado numa data. */
export function intervalo(periodo: Periodo, ref: Date): { de: string; ate: string } {
  const d = new Date(ref)
  let inicio: Date
  let fim: Date
  switch (periodo) {
    case 'dia':
      inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      fim = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      break
    case 'semana': {
      const diaSemana = (d.getDay() + 6) % 7 // segunda = 0
      inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diaSemana)
      fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 6)
      break
    }
    case 'mes':
      inicio = new Date(d.getFullYear(), d.getMonth(), 1)
      fim = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      break
    case 'ano':
      inicio = new Date(d.getFullYear(), 0, 1)
      fim = new Date(d.getFullYear(), 11, 31)
      break
  }
  const iso = (x: Date) => x.toISOString().slice(0, 10)
  return { de: iso(inicio), ate: iso(fim) }
}

/** Puxa as transações salvas de um período. É o que sustenta a visão por
 *  dia/semana/mês/ano — os dados ficam no banco e o usuário puxa quando
 *  quiser (ver spec da Fundação). RLS garante que só vêm as dele. */
export async function puxarTransacoes(
  periodo: Periodo,
  ref: Date,
): Promise<TransacaoSalva[]> {
  if (!neon) return []
  const { de, ate } = intervalo(periodo, ref)

  const { data, error } = await neon
    .from('transactions')
    .select('id, date, description, label, amount_cents, kind, category_slug, installment, accounts(bank)')
    .gte('date', de)
    .lte('date', ate)
    .order('date', { ascending: false })

  if (error) throw error

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    date: r.date as string,
    description: r.description as string,
    label: (r.label as string) ?? null,
    amount_cents: r.amount_cents as number,
    kind: r.kind as string,
    category_slug: (r.category_slug as string) ?? null,
    bank:
      (r.accounts as { bank?: string } | null)?.bank ?? 'desconhecido',
    installment: (r.installment as { current: number; total: number }) ?? null,
  }))
}
