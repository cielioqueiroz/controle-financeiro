import { describe, expect, it } from 'vitest'
import { construirInsights } from './insights'
import { agregar } from './agrupar'
import type { ParseResult, RawTransaction } from './parsers/types'

function transacao(over: Partial<RawTransaction> = {}): RawTransaction {
  return { date: new Date(2026, 5, 10), description: 'SUPERMERCADO FAMA', amountCents: 10000,
    installment: null, card: null, fx: null, kind: 'compra', raw: '', ...over }
}

function documento(transactions: RawTransaction[]): ParseResult {
  return { transactions, declaredTotal: 8000, declaredIncome: null, declaredExpense: null,
    period: { start: new Date(2026, 5, 1), end: new Date(2026, 5, 30) },
    account: { bank: 'nubank', type: 'credit_card', last4: '1234', agency: null, number: null, holderName: null },
    forward: { nextCloseDate: null, nextInvoiceBalance: null, totalOpenBalance: null, futureInstallmentsTotal: null } }
}

const fatura = { bank: 'nubank', docType: 'fatura' } as const

describe('insights da prévia', () => {
  it('abate estorno no gasto e na categoria, sem inventar entrada ou dupla contagem', () => {
    const result = documento([transacao(), transacao({ amountCents: -2000 })])
    const insights = construirInsights(result, fatura)
    const salvo = agregar(result.transactions.map((tx) => ({
      date: '2026-06-10', competencia: '2026-06', amount_cents: tx.amountCents,
      kind: 'expense', category_slug: 'supermercado',
    })))
    expect(insights.gastoRealCents).toBe(8000)
    expect(insights.gastoIngenuoCents).toBe(8000)
    expect(insights.totalEntradasCents).toBe(0)
    expect(insights.porCategoria).toEqual(salvo.porCategoria)
    expect(insights.gastoRealCents).toBe(salvo.gastoCents)
  })

  it('preserva categoria que terminou negativa por estorno', () => {
    const insights = construirInsights(documento([transacao({ amountCents: -2000 })]), fatura)
    expect(insights.gastoRealCents).toBe(-2000)
    expect(insights.porCategoria[0].totalCents).toBe(-2000)
    expect(insights.totalEntradasCents).toBe(0)
  })

  it('pagamento anterior positivo não é gasto mesmo com valor diferente da fatura atual', () => {
    const insights = construirInsights(documento([
      transacao({ amountCents: 8000 }),
      transacao({ description: 'PAGAMENTO ANTERIOR', amountCents: 20000, kind: 'pagamento' }),
    ]), fatura)
    expect(insights.gastoRealCents).toBe(8000)
    expect(insights.gastoIngenuoCents).toBe(28000)
    expect(insights.porCategoria[0].totalCents).toBe(8000)
  })

  it('pagamento anterior negativo não vira entrada', () => {
    const insights = construirInsights(documento([
      transacao({ amountCents: 8000 }),
      transacao({ description: 'PAGAMENTO ANTERIOR', amountCents: -20000, kind: 'pagamento' }),
    ]), fatura)
    expect(insights.gastoRealCents).toBe(8000)
    expect(insights.totalEntradasCents).toBe(0)
  })

  it('separa entradas de transferências internas e mantém encargos no gasto', () => {
    const insights = construirInsights(documento([
      transacao({ description: 'SALARIO', amountCents: -50000, kind: 'entrada' }),
      transacao({ description: 'Resgate Autom', amountCents: -30000, kind: 'entrada' }),
      transacao({ description: 'Aplicacao BB', amountCents: 30000 }),
      transacao({ description: 'IOF', amountCents: 1000, kind: 'encargo' }),
    ]), { bank: 'nubank', docType: 'extrato' })
    expect(insights.gastoRealCents).toBe(1000)
    expect(insights.gastoIngenuoCents).toBe(31000)
    expect(insights.totalEntradasCents).toBe(50000)
    expect(insights.porCategoria.map((c) => [c.cat.slug, c.totalCents])).toEqual([['taxas', 1000]])
  })
})
