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

/** Confere a soma do parser contra o total declarado pelo documento.
 *
 *  Este é o mecanismo de confiança do sistema: se bate, o parse está
 *  completo; se não bate, o app avisa em vez de mostrar número errado.
 *  Tolerância zero — os gabaritos batem ao centavo (spec, "Validação").
 *
 *  Convenção de soma por tipo de documento:
 *  - Fatura: compras + encargos (o que compõe o "Total a pagar").
 *    Pagamentos e estornos não entram no total da fatura.
 *  - Extrato: tratado pelo próprio parser via saldo; aqui só há gabarito
 *    quando declaredTotal é fornecido. */
export function validar(result: ParseResult): Validacao {
  const { transactions, declaredTotal, declaredIncome, declaredExpense } = result
  const contagem = transactions.length

  // Dois fluxos: confere entradas E saídas contra os declarados. Cobre
  // extratos e a fatura Bradesco (cujo "Resumo" declara créditos e
  // débitos). Mais preciso que um total único. amountCents: saída
  // positiva, entrada negativa (ver types).
  if (declaredIncome != null && declaredExpense != null) {
    const saidas = transactions
      .filter((t) => t.amountCents > 0)
      .reduce((a, t) => a + t.amountCents, 0)
    const entradas = transactions
      .filter((t) => t.amountCents < 0)
      .reduce((a, t) => a - t.amountCents, 0)
    const difSaidas = saidas - declaredExpense
    const difEntradas = entradas - declaredIncome
    const diferenca = difSaidas + difEntradas
    return {
      status: difSaidas === 0 && difEntradas === 0 ? 'confere' : 'diverge',
      contagem,
      somaExtraida: saidas + entradas,
      diferenca,
    }
  }

  // Fatura Nubank: soma compras + encargos = "Total a pagar".
  if (declaredTotal != null) {
    const somaExtraida = transactions
      .filter((t) => t.kind === 'compra' || t.kind === 'encargo')
      .reduce((a, t) => a + t.amountCents, 0)
    const diferenca = somaExtraida - declaredTotal
    return {
      status: diferenca === 0 ? 'confere' : 'diverge',
      contagem,
      somaExtraida,
      diferenca,
    }
  }

  return {
    status: 'sem-gabarito',
    contagem,
    somaExtraida: transactions.reduce((a, t) => a + t.amountCents, 0),
    diferenca: null,
  }
}
