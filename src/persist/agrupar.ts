import { categoria, type Categoria } from '../categorize/categorias'
import type { CategoriaResumo } from '../insights'

export type Periodo = 'dia' | 'semana' | 'mes' | 'ano'

/** O mínimo que o agrupamento precisa de uma transação. TransacaoSalva
 *  satisfaz esta forma. */
export type TxAgrupavel = {
  date: string // data real da compra/débito, YYYY-MM-DD
  competencia: string // mês de referência (fatura), YYYY-MM
  amount_cents: number
  kind: string
  category_slug: string | null
}

/** Competência = mês em que o lançamento "conta". Para fatura é o mês do
 *  vencimento (period_end); para extrato, o mês do próprio período. Assim
 *  uma compra de 20/mai que veio na fatura de junho conta em JUNHO — o
 *  jeito que o usuário pensa ("o que veio na fatura desse mês"). */
export function competenciaDe(periodEnd: string | null | undefined, date: string): string {
  return (periodEnd ?? date).slice(0, 7)
}

/** YYYY-MM-DD no fuso local (a `ref` do dashboard é uma Date local). */
function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

/** Intervalo [início, fim] da semana (segunda a domingo) que contém `ref`. */
function semana(ref: Date): { ini: string; fim: string } {
  const dow = (ref.getDay() + 6) % 7 // segunda = 0
  const ini = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - dow)
  const fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6)
  return { ini: isoLocal(ini), fim: isoLocal(fim) }
}

/** A transação pertence ao período ancorado em `ref`?
 *  Dia/Semana usam a DATA REAL (quando a compra aconteceu); Mês/Ano usam a
 *  COMPETÊNCIA (a fatura). Ver decisão do usuário em 2026-07. */
export function pertence(tx: TxAgrupavel, periodo: Periodo, ref: Date): boolean {
  switch (periodo) {
    case 'dia':
      return tx.date === isoLocal(ref)
    case 'semana': {
      const { ini, fim } = semana(ref)
      return tx.date >= ini && tx.date <= fim
    }
    case 'mes':
      return tx.competencia === isoLocal(ref).slice(0, 7)
    case 'ano':
      return tx.competencia.slice(0, 4) === String(ref.getFullYear())
  }
}

export function filtrar<T extends TxAgrupavel>(txs: T[], periodo: Periodo, ref: Date): T[] {
  return txs.filter((t) => pertence(t, periodo, ref))
}

export type Resumo = {
  gastoCents: number
  entradasCents: number
  contagem: number
  porCategoria: CategoriaResumo[]
}

/** Agrega em números de dashboard. Gasto = despesas (kind 'expense');
 *  entradas = 'income'; vínculos (internal_transfer/card_payment) ficam de
 *  fora do gasto para não contar o mesmo dinheiro duas vezes. */
export function agregar(txs: TxAgrupavel[]): Resumo {
  let gastoCents = 0
  let entradasCents = 0
  const mapa = new Map<string, CategoriaResumo & { cat: Categoria }>()

  for (const t of txs) {
    if (t.kind === 'income') {
      entradasCents += Math.abs(t.amount_cents)
      continue
    }
    if (t.kind !== 'expense') continue
    gastoCents += t.amount_cents
    const slug = t.category_slug ?? 'outros'
    const atual = mapa.get(slug) ?? { cat: categoria(slug), totalCents: 0, contagem: 0 }
    atual.totalCents += t.amount_cents
    atual.contagem += 1
    mapa.set(slug, atual)
  }

  return {
    gastoCents,
    entradasCents,
    contagem: txs.length,
    porCategoria: [...mapa.values()].sort((a, b) => b.totalCents - a.totalCents),
  }
}
