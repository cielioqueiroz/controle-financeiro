import { taxasFinanceiras } from './trajetoria'
import { agregar, type Resumo, type TxAgrupavel } from './agrupar'

export type JanelaRelatorio = 3 | 6 | 12

export type MesRelatorio<T> = {
  competencia: string
  transacoes: T[]
  resumo: Resumo | null
}

export type PeriodoRelatorio<T> = {
  inicio: string
  fim: string
  meses: MesRelatorio<T>[]
  transacoes: T[]
  resumo: Resumo | null
  mesesComDados: number
}

function deslocarCompetencia(competencia: string, deslocamento: number): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const indice = ano * 12 + mes - 1 + deslocamento
  return `${Math.floor(indice / 12)}-${String(((indice % 12) + 12) % 12 + 1).padStart(2, '0')}`
}

function periodo<T extends TxAgrupavel>(
  porCompetencia: Map<string, T[]>, fim: string, janela: JanelaRelatorio,
): PeriodoRelatorio<T> {
  const meses = Array.from({ length: janela }, (_, i) => {
    const competencia = deslocarCompetencia(fim, i - janela + 1)
    const transacoes = porCompetencia.get(competencia) ?? []
    return { competencia, transacoes, resumo: transacoes.length ? agregar(transacoes) : null }
  })
  const transacoes = meses.flatMap((mes) => mes.transacoes)
  return {
    inicio: meses[0].competencia,
    fim,
    meses,
    transacoes,
    resumo: transacoes.length ? agregar(transacoes) : null,
    mesesComDados: meses.filter((mes) => mes.resumo !== null).length,
  }
}

function taxaEconomia(resumo: Resumo | null): number | null {
  if (!resumo || resumo.entradasCents <= 0) return null
  return taxasFinanceiras(resumo.entradasCents, resumo.gastoCents).economiaPct
}

/** Presença de transações permite comparar durações iguais, mas não prova
 * que todos os documentos de cada conta foram importados. */
export function analisarRelatorio<T extends TxAgrupavel>(historico: T[], janela: JanelaRelatorio) {
  if (historico.length === 0) return null
  const porCompetencia = new Map<string, T[]>()
  for (const tx of historico) {
    const transacoes = porCompetencia.get(tx.competencia) ?? []
    transacoes.push(tx)
    porCompetencia.set(tx.competencia, transacoes)
  }
  const fim = [...porCompetencia.keys()].sort().at(-1)!
  const atual = periodo(porCompetencia, fim, janela)
  const anterior = periodo(porCompetencia, deslocarCompetencia(fim, -janela), janela)
  const comparavel = atual.mesesComDados === janela && anterior.mesesComDados === janela
  const gastoAnterior = anterior.resumo?.gastoCents ?? null
  return {
    atual,
    anterior,
    comparavel,
    variacaoGastoPct: comparavel && gastoAnterior !== null && gastoAnterior > 0
      ? ((atual.resumo!.gastoCents - gastoAnterior) / gastoAnterior) * 100
      : null,
    taxaEconomiaAtualPct: taxaEconomia(atual.resumo),
    taxaEconomiaAnteriorPct: comparavel ? taxaEconomia(anterior.resumo) : null,
  }
}
