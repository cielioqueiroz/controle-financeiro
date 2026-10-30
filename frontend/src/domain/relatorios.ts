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

/** Banco e tipo de documento: a fonte de que uma competência depende. */
export type FonteDocumento = { bank: string; docType: string }

export type CompetenciaForaDaJanela = { competencia: string; faltam: FonteDocumento[] }

type TxRelatorio = TxAgrupavel & { bank?: string; doc_type?: string }

const chaveFonte = (tx: TxRelatorio): string | null =>
  tx.bank && tx.doc_type ? `${tx.bank}|${tx.doc_type}` : null

/** As competências do fim do histórico que não podem fechar a janela.
 *
 *  A fatura conta no mês do vencimento (ADR-0001), e a última importada
 *  costuma vencer no mês seguinte ao último extrato. Esse mês tem o gasto do
 *  cartão e não tem as entradas. Se fechasse a janela, a taxa de economia
 *  despencaria sem nada ter mudado.
 *
 *  A régua é o mês imediatamente anterior: falta no último uma fonte que o
 *  anterior tinha, o último sai e o teste se repete um mês antes. Uma conta
 *  encerrada atrasa a janela só até o mês seguinte chegar, porque aí o
 *  anterior também já não a tem. Através de uma lacuna de calendário não há
 *  com que comparar, e nada sai. */
function competenciasForaDaJanela<T extends TxRelatorio>(
  porCompetencia: Map<string, T[]>, ordenadas: string[],
): CompetenciaForaDaJanela[] {
  const fontes = (competencia: string) =>
    new Set((porCompetencia.get(competencia) ?? []).map(chaveFonte).filter((f): f is string => f !== null))
  const fora: CompetenciaForaDaJanela[] = []
  for (let i = ordenadas.length - 1; i > 0; i--) {
    const competencia = ordenadas[i]
    const anterior = ordenadas[i - 1]
    if (anterior !== deslocarCompetencia(competencia, -1)) break
    const presentes = fontes(competencia)
    const faltam = [...fontes(anterior)].filter((f) => !presentes.has(f)).sort()
    if (faltam.length === 0) break
    fora.push({
      competencia,
      faltam: faltam.map((f) => {
        const [bank, docType] = f.split('|')
        return { bank, docType }
      }),
    })
  }
  return fora
}

/** Presença de transações permite comparar durações iguais, mas não prova
 * que todos os documentos de cada conta foram importados. O que o histórico
 * consegue provar — a fonte que sumiu no último mês — fica fora da janela e
 * volta em `foraDaJanela`, para a tela dizer o que falta importar. */
export function analisarRelatorio<T extends TxRelatorio>(historico: T[], janela: JanelaRelatorio) {
  if (historico.length === 0) return null
  const porCompetencia = new Map<string, T[]>()
  for (const tx of historico) {
    const transacoes = porCompetencia.get(tx.competencia) ?? []
    transacoes.push(tx)
    porCompetencia.set(tx.competencia, transacoes)
  }
  const ordenadas = [...porCompetencia.keys()].sort()
  const foraDaJanela = competenciasForaDaJanela(porCompetencia, ordenadas)
  const fim = ordenadas[ordenadas.length - 1 - foraDaJanela.length]
  const atual = periodo(porCompetencia, fim, janela)
  const anterior = periodo(porCompetencia, deslocarCompetencia(fim, -janela), janela)
  const comparavel = atual.mesesComDados === janela && anterior.mesesComDados === janela
  const gastoAnterior = anterior.resumo?.gastoCents ?? null
  return {
    atual,
    anterior,
    foraDaJanela,
    comparavel,
    variacaoGastoPct: comparavel && gastoAnterior !== null && gastoAnterior > 0
      ? ((atual.resumo!.gastoCents - gastoAnterior) / gastoAnterior) * 100
      : null,
    taxaEconomiaAtualPct: taxaEconomia(atual.resumo),
    taxaEconomiaAnteriorPct: comparavel ? taxaEconomia(anterior.resumo) : null,
  }
}
