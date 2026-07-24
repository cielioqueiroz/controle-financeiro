export type SaldoLinha = { bank: string; balanceCents: number; date: string }
export type CategoriaLinha = { nome: string; valorCents: number; pct: number }

export type DadosRelatorio = {
  periodoLabel: string
  agrupamento: string
  geradoEm: Date
  entradasCents: number
  saidasCents: number
  saldoPeriodoCents: number
  saldos: SaldoLinha[]
  categorias: CategoriaLinha[]
}

export type EntradaRelatorio = {
  periodoLabel: string
  agrupamento: string
  geradoEm?: Date
  resumo: {
    gastoCents: number
    entradasCents: number
    porCategoria: { cat: { nome: string }; totalCents: number }[]
  }
  saldos: SaldoLinha[]
}

/** Molda os números já em memória no dashboard para o relatório. Pura —
 *  separada da geração do PDF para poder ser testada sem jsPDF. */
export function montarDadosRelatorio(e: EntradaRelatorio): DadosRelatorio {
  const { gastoCents, entradasCents, porCategoria } = e.resumo
  const categorias: CategoriaLinha[] = porCategoria.map((c) => ({
    nome: c.cat.nome,
    valorCents: c.totalCents,
    pct: gastoCents > 0 ? (c.totalCents / gastoCents) * 100 : 0,
  }))
  return {
    periodoLabel: e.periodoLabel,
    agrupamento: e.agrupamento,
    geradoEm: e.geradoEm ?? new Date(),
    entradasCents,
    saidasCents: gastoCents,
    saldoPeriodoCents: entradasCents - gastoCents,
    saldos: e.saldos,
    categorias,
  }
}
