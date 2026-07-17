/** Converte valor monetário brasileiro para centavos (inteiro).
 *
 *  Centavos em vez de float: 0.1 + 0.2 !== 0.3 em ponto flutuante, e um
 *  centavo perdido por transação quebra a conferência contra o total
 *  declarado pelo banco — que é o mecanismo de confiança do parser.
 *
 *  Negativo = crédito. Os dois bancos marcam de formas diferentes:
 *  o Bradesco põe hífen no FIM ("56,79 -"), o Nubank usa MINUS SIGN
 *  U+2212 no início ("−R$ 3.644,97"). */
export function parseBRL(raw: string): number {
  const trimmed = raw.trim()
  const negative = /-\s*$/.test(trimmed) || /^[−-]/.test(trimmed)

  const digits = trimmed.replace(/[R$\s−-]/g, '')
  if (!/^\d{1,3}(\.\d{3})*,\d{2}$|^\d+,\d{2}$|^\d+$/.test(digits)) {
    throw new Error(`Valor monetário inválido: ${raw}`)
  }

  const normalized = digits.replace(/\./g, '').replace(',', '.')
  const value = Math.round(Number(normalized) * 100)
  if (!Number.isFinite(value)) {
    throw new Error(`Valor monetário inválido: ${raw}`)
  }

  return negative ? -value : value
}

/** Formata centavos para exibição em real. */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
