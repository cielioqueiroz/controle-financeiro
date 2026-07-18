/** Faturas trazem data sem ano ("08/04", "20 MAI"). Infere o ano a partir
 *  de uma referência (vencimento ou fim do período vigente): se a data
 *  cair depois da referência, é do ano anterior.
 *
 *  Cobre a virada de ano — uma transação de 28/12 numa fatura que vence
 *  em 10/01/2027 é de 2026, não de 2027. */
export function inferYear(day: number, month: number, reference: Date): Date {
  const candidate = new Date(reference.getFullYear(), month - 1, day)
  if (candidate.getTime() > reference.getTime()) {
    return new Date(reference.getFullYear() - 1, month - 1, day)
  }
  return candidate
}

const MESES: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
}

/** Converte mês abreviado do Nubank ("MAI") para número (5). */
export function parseMesAbreviado(abbr: string): number {
  const key = abbr.trim().toUpperCase().slice(0, 3)
  const month = MESES[key]
  if (!month) throw new Error(`Mês inválido: ${abbr}`)
  return month
}
