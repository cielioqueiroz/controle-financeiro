import { localeAtual } from './locale'

/** Número com uma casa decimal, no separador da locale ativa.
 *
 *  `toFixed(1).replace('.', ',')` fixava a vírgula: em inglês a tela dizia
 *  "66,7%" ao lado de "R$20,000.00", onde a vírgula é separador de milhar. */
export function formatarDecimal(valor: number): string {
  return valor.toLocaleString(localeAtual(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function formatarPct(valor: number): string {
  return `${formatarDecimal(valor)}%`
}
