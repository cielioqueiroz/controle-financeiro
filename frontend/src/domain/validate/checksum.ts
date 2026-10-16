import type { ParseResult } from '../parsers/types'

export type ValidacaoStatus = 'confere' | 'diverge' | 'sem-gabarito'

export type Validacao = {
  status: ValidacaoStatus
  contagem: number
  /** Soma que o parser extraiu (centavos), na convenção do documento. */
  somaExtraida: number
  /** Diferença extraído − declarado. Null quando não há gabarito. */
  diferenca: number | null
}

export type ComparacaoGabarito = {
  criterio: 'entradas' | 'saidas' | 'variacao-saldo' | 'total-fatura'
  gabaritoCents: number
  extraidoCents: number
  diferencaCents: number
}

/** Os fluxos são confrontados separadamente: diferenças opostas não se anulam. */
export function compararGabaritos(result: ParseResult): ComparacaoGabarito[] {
  const { transactions, declaredTotal, declaredIncome, declaredExpense } = result
  const comparar = (
    criterio: ComparacaoGabarito['criterio'],
    gabaritoCents: number,
    extraidoCents: number,
  ): ComparacaoGabarito => ({ criterio, gabaritoCents, extraidoCents, diferencaCents: extraidoCents - gabaritoCents })

  if (declaredIncome != null && declaredExpense != null) {
    return [
      comparar('entradas', declaredIncome, transactions.reduce((s, t) => s + Math.max(-t.amountCents, 0), 0)),
      comparar('saidas', declaredExpense, transactions.reduce((s, t) => s + Math.max(t.amountCents, 0), 0)),
    ]
  }
  if (result.balance != null) {
    // Saída é positiva: saldo inicial − saldo final = soma das transações.
    return [comparar('variacao-saldo', result.balance.initial - result.balance.final,
      transactions.reduce((s, t) => s + t.amountCents, 0))]
  }
  if (declaredTotal != null) {
    return [comparar('total-fatura', declaredTotal, transactions
      .filter((t) => t.kind === 'compra' || t.kind === 'encargo')
      .reduce((s, t) => s + t.amountCents, 0))]
  }
  return []
}

/** Tolerância zero: todas as comparações precisam bater ao centavo.
 *  A diferença agregada mantém o contrato antigo; isolada, ela não prova
 *  conferência porque diferenças entre entradas e saídas podem se anular. */
export function validar(result: ParseResult): Validacao {
  const { transactions } = result
  const contagem = transactions.length
  const comparacoes = compararGabaritos(result)
  if (comparacoes.length > 0) {
    return {
      status: comparacoes.every((c) => c.diferencaCents === 0) ? 'confere' : 'diverge',
      contagem,
      somaExtraida: comparacoes.reduce((s, c) => s + c.extraidoCents, 0),
      diferenca: comparacoes.reduce((s, c) => s + c.diferencaCents, 0),
    }
  }

  return {
    status: 'sem-gabarito',
    contagem,
    somaExtraida: transactions.reduce((a, t) => a + t.amountCents, 0),
    diferenca: null,
  }
}
