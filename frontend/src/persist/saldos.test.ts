import { describe, it, expect } from 'vitest'
import { saldosPorConta, type DocParaSaldo } from './saldos'

const base: DocParaSaldo = {
  bank: 'nubank',
  account_id: 'a1',
  doc_type: 'extrato',
  period_end: '2026-06-30',
  end_balance_cents: 100000,
}

describe('saldosPorConta', () => {
  it('escolhe o extrato de maior period_end por conta', () => {
    const docs: DocParaSaldo[] = [
      { ...base, period_end: '2026-05-31', end_balance_cents: 50000 },
      { ...base, period_end: '2026-06-30', end_balance_cents: 120000 },
    ]
    expect(saldosPorConta(docs)).toEqual([
      { accountId: 'a1', bank: 'nubank', balanceCents: 120000, date: '2026-06-30' },
    ])
  })

  it('ignora faturas', () => {
    const docs: DocParaSaldo[] = [{ ...base, doc_type: 'fatura' }]
    expect(saldosPorConta(docs)).toEqual([])
  })

  it('ignora documentos sem saldo', () => {
    const docs: DocParaSaldo[] = [{ ...base, end_balance_cents: null }]
    expect(saldosPorConta(docs)).toEqual([])
  })

  it('ignora documentos sem period_end', () => {
    const docs: DocParaSaldo[] = [{ ...base, period_end: null }]
    expect(saldosPorConta(docs)).toEqual([])
  })

  it('aceita saldo negativo (conta devedora)', () => {
    const docs: DocParaSaldo[] = [{ ...base, end_balance_cents: -3500 }]
    expect(saldosPorConta(docs)[0].balanceCents).toBe(-3500)
  })

  it('uma linha por conta, várias contas coexistem', () => {
    const docs: DocParaSaldo[] = [
      { ...base, account_id: 'a1', bank: 'nubank', end_balance_cents: 100000 },
      { ...base, account_id: 'a2', bank: 'bb', end_balance_cents: 200000 },
    ]
    expect(saldosPorConta(docs)).toHaveLength(2)
  })
})
