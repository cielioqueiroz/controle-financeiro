import { agregar, evolucaoMensal, type PontoMes, type TxAgrupavel } from './agrupar'

export function resultadoMensal(ponto: PontoMes): number {
  return ponto.entradasCents - ponto.gastoCents
}

export function taxasFinanceiras(entradasCents: number, gastoCents: number) {
  if (entradasCents <= 0) return { consumoPct: null, economiaPct: null }
  return {
    consumoPct: gastoCents / entradasCents * 100,
    economiaPct: (entradasCents - gastoCents) / entradasCents * 100,
  }
}

export function analisarTrajetoria(transacoes: TxAgrupavel[]) {
  const serie = evolucaoMensal(transacoes)
  let melhorMes: PontoMes | null = null
  let mesMaisCaro: PontoMes | null = null
  for (const ponto of serie) {
    if (!melhorMes || resultadoMensal(ponto) > resultadoMensal(melhorMes)) melhorMes = ponto
    if (!mesMaisCaro || ponto.gastoCents > mesMaisCaro.gastoCents) mesMaisCaro = ponto
  }
  return { serie, melhorMes, mesMaisCaro,
    categoriasMesMaisCaro: mesMaisCaro
      ? agregar(transacoes.filter((tx) => tx.competencia === mesMaisCaro.competencia)).porCategoria.slice(0, 4)
      : [],
  }
}
