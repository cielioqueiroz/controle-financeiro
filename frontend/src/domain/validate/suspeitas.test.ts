import { describe, it, expect } from 'vitest'
import type { ParseResult, RawTransaction } from '../parsers/types'
import { compararGabaritos } from './checksum'
import { linhasSuspeitas } from './suspeitas'

function tx(description: string, amountCents: number, kind: RawTransaction['kind'] = 'compra'): RawTransaction {
  return { date: new Date(2026, 8, 16), description, amountCents, kind, installment: null, card: null, fx: null, raw: '' }
}

function resultado(over: Partial<ParseResult>): ParseResult {
  return {
    transactions: [],
    declaredTotal: null, declaredIncome: null, declaredExpense: null, period: null,
    account: { bank: 'mercadopago', type: 'credit_card', last4: null, agency: null, number: null, holderName: null },
    forward: { nextCloseDate: null, nextInvoiceBalance: null, totalOpenBalance: null, futureInstallmentsTotal: null },
    ...over,
  }
}

/** As suspeitas da primeira comparação do resultado. */
function suspeitas(r: ParseResult) {
  return linhasSuspeitas(r, compararGabaritos(r)[0]).map((s) => `${s.tipo}: ${s.transacao.description}`)
}

describe('linhasSuspeitas', () => {
  // O caso que originou a regra: a fatura do Mercado Pago de outubro/2026
  // divergia em R$ 820,76, exatamente o pagamento da fatura de setembro,
  // lido como compra.
  it('aponta a linha cujo valor é exatamente a diferença', () => {
    const r = resultado({
      declaredTotal: 86779,
      transactions: [tx('MERCADOLIVRE*LOJA', 86779), tx('Pagamento da fatura de setembro/2026', 82076)],
    })
    expect(suspeitas(r)).toEqual(['igual: Pagamento da fatura de setembro/2026'])
  })

  it('a linha que vale metade da diferença tem o sinal trocado', () => {
    // Estorno de R$ 50 lido como compra: entra +50 em vez de −50, e a soma
    // passa do total em R$ 100.
    const r = resultado({
      declaredTotal: 25000,
      transactions: [tx('LOJA', 30000), tx('ESTORNO LOJA', 5000)],
    })
    expect(suspeitas(r)).toEqual(['dobro: ESTORNO LOJA'])
  })

  it('só olha as linhas que entram na soma: pagamento fora do total não é suspeito', () => {
    const r = resultado({
      declaredTotal: 10000,
      // Mesmo valor da diferença (R$ 50), mas o pagamento não entra no total.
      transactions: [tx('LOJA', 15000), tx('Pagamento recebido', 5000, 'pagamento')],
    })
    expect(suspeitas(r)).toEqual([])
  })

  it('no saldo do extrato, a entrada a mais também é apontada', () => {
    const r = resultado({
      balance: { initial: 100000, final: 90000 },
      transactions: [tx('MERCADO', 10000), tx('PIX RECEBIDO', -3000, 'entrada')],
    })
    expect(suspeitas(r)).toEqual(['igual: PIX RECEBIDO'])
  })

  it('nas saídas, a linha a mais é apontada', () => {
    const r = resultado({
      declaredIncome: 0, declaredExpense: 10000,
      transactions: [tx('MERCADO', 10000), tx('TARIFA', 1290)],
    })
    const [, saidas] = compararGabaritos(r)
    expect(linhasSuspeitas(r, saidas).map((s) => s.transacao.description)).toEqual(['TARIFA'])
  })

  it('nas entradas, a entrada a mais é apontada', () => {
    const r = resultado({
      declaredIncome: 2000, declaredExpense: 0,
      transactions: [tx('PIX RECEBIDO', -2000, 'entrada'), tx('RENDIMENTO', -1000, 'entrada')],
    })
    expect(suspeitas(r)).toEqual(['igual: RENDIMENTO'])
  })

  // Entradas e saídas somam um sinal só: uma linha com sinal trocado sai de
  // uma soma e entra na outra, e cada lado a acusa como "igual".
  it('nas entradas não existe sinal trocado', () => {
    const r = resultado({
      declaredIncome: 2000, declaredExpense: 0,
      transactions: [tx('PIX', -2000, 'entrada'), tx('A', -1500, 'entrada'), tx('B', -1500, 'entrada')],
    })
    expect(suspeitas(r)).toEqual([])
  })

  // Faltou ler uma linha: ela não está no resultado, e não há o que apontar.
  it('diferença para menos nas entradas não aponta nada', () => {
    const r = resultado({
      declaredIncome: 5000, declaredExpense: 0,
      transactions: [tx('PIX RECEBIDO', -3000, 'entrada')],
    })
    expect(suspeitas(r)).toEqual([])
  })

  it('mais de três candidatas é chute: não aponta nenhuma', () => {
    // Diferença de R$ 10, e quatro linhas de R$ 10.
    const r = resultado({
      declaredTotal: 13000,
      transactions: [tx('A', 10000), tx('B', 1000), tx('C', 1000), tx('D', 1000), tx('E', 1000)],
    })
    expect(suspeitas(r)).toEqual([])
  })

  it('até três candidatas aparecem todas', () => {
    const r = resultado({
      declaredTotal: 10000,
      transactions: [tx('A', 10000), tx('B', 1000), tx('C', 1000)],
    })
    // Diferença de R$ 20: nenhuma vale 20, e B e C valem a metade.
    expect(suspeitas(r)).toEqual(['dobro: B', 'dobro: C'])
  })

  it('sem diferença, nada é suspeito — nem a linha de R$ 0,00', () => {
    const r = resultado({ declaredTotal: 10000, transactions: [tx('A', 10000), tx('IOF', 0, 'encargo')] })
    expect(suspeitas(r)).toEqual([])
  })

  it('diferença ímpar não tem metade inteira', () => {
    const r = resultado({ declaredTotal: 10000, transactions: [tx('A', 10000), tx('B', 1)] })
    expect(suspeitas(r)).toEqual(['igual: B'])
  })
})
