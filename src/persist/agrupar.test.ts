import { describe, it, expect } from 'vitest'
import { competenciaDe, pertence, filtrar, agregar, type TxAgrupavel } from './agrupar'

const tx = (over: Partial<TxAgrupavel>): TxAgrupavel => ({
  date: '2026-06-15',
  competencia: '2026-06',
  amount_cents: 1000,
  kind: 'expense',
  category_slug: 'supermercado',
  ...over,
})

describe('competenciaDe', () => {
  it('usa o mês do period_end (fatura) quando existe', () => {
    // compra de 20/mai numa fatura que vence 28/jun conta em junho
    expect(competenciaDe('2026-06-28', '2026-05-20')).toBe('2026-06')
  })
  it('cai na data da compra quando não há period_end', () => {
    expect(competenciaDe(null, '2026-05-20')).toBe('2026-05')
  })
})

describe('pertence', () => {
  const ref = new Date(2026, 5, 15) // 15 jun 2026, local

  it('mês agrupa por competência, não pela data real', () => {
    // compra feita em maio mas na fatura de junho: entra no mês de junho
    const maiNaFaturaJun = tx({ date: '2026-05-20', competencia: '2026-06' })
    expect(pertence(maiNaFaturaJun, 'mes', ref)).toBe(true)
  })
  it('dia usa a data real', () => {
    const dia15 = new Date(2026, 5, 15)
    expect(pertence(tx({ date: '2026-06-15' }), 'dia', dia15)).toBe(true)
    expect(pertence(tx({ date: '2026-06-16' }), 'dia', dia15)).toBe(false)
  })
  it('semana cobre segunda a domingo pela data real', () => {
    // 15/jun/2026 é uma segunda; a semana vai 15→21
    expect(pertence(tx({ date: '2026-06-21' }), 'semana', ref)).toBe(true)
    expect(pertence(tx({ date: '2026-06-22' }), 'semana', ref)).toBe(false)
  })
  it('ano agrupa por competência', () => {
    expect(pertence(tx({ competencia: '2026-01' }), 'ano', ref)).toBe(true)
    expect(pertence(tx({ competencia: '2025-12' }), 'ano', ref)).toBe(false)
  })
})

describe('agregar', () => {
  it('soma o supermercado da fatura inteira num só mês', () => {
    const txs = [
      tx({ date: '2026-05-20', competencia: '2026-06', amount_cents: 63051 }),
      tx({ date: '2026-06-10', competencia: '2026-06', amount_cents: 28795 }),
    ]
    const r = agregar(txs)
    expect(r.gastoCents).toBe(91846) // R$ 918,46 — o "quase mil" do usuário
    expect(r.porCategoria[0].cat.slug).toBe('supermercado')
    expect(r.porCategoria[0].totalCents).toBe(91846)
  })
  it('exclui vínculos e conta entradas à parte', () => {
    const txs = [
      tx({ amount_cents: 5000, kind: 'expense' }),
      tx({ amount_cents: -2000, kind: 'income' }),
      tx({ amount_cents: 100000, kind: 'card_payment' }),
      tx({ amount_cents: 30000, kind: 'internal_transfer' }),
    ]
    const r = agregar(txs)
    expect(r.gastoCents).toBe(5000)
    expect(r.entradasCents).toBe(2000)
  })
})

describe('filtrar', () => {
  it('devolve só as do período', () => {
    const ref = new Date(2026, 5, 15)
    const txs = [
      tx({ competencia: '2026-06' }),
      tx({ competencia: '2026-05' }),
      tx({ competencia: '2026-06' }),
    ]
    expect(filtrar(txs, 'mes', ref)).toHaveLength(2)
  })
})
