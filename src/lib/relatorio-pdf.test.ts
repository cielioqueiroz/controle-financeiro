import { describe, it, expect } from 'vitest'
import { montarDadosRelatorio } from './relatorio-pdf'

const entrada = {
  periodoLabel: 'Junho 2026',
  agrupamento: 'por fatura',
  geradoEm: new Date('2026-07-24T12:00:00'),
  resumo: {
    gastoCents: 10000,
    entradasCents: 30000,
    porCategoria: [
      { cat: { nome: 'Supermercado' }, totalCents: 7000 },
      { cat: { nome: 'Transporte' }, totalCents: 3000 },
    ],
  },
  saldos: [{ bank: 'nubank', balanceCents: 250000, date: '2026-06-30' }],
}

describe('montarDadosRelatorio', () => {
  it('mapeia totais e saldo do período', () => {
    const d = montarDadosRelatorio(entrada)
    expect(d.entradasCents).toBe(30000)
    expect(d.saidasCents).toBe(10000)
    expect(d.saldoPeriodoCents).toBe(20000)
  })

  it('calcula % por categoria e preserva a ordem', () => {
    const d = montarDadosRelatorio(entrada)
    expect(d.categorias[0]).toEqual({ nome: 'Supermercado', valorCents: 7000, pct: 70 })
    expect(d.categorias[1]).toEqual({ nome: 'Transporte', valorCents: 3000, pct: 30 })
  })

  it('não divide por zero quando não há gasto', () => {
    const d = montarDadosRelatorio({
      ...entrada,
      resumo: { gastoCents: 0, entradasCents: 0, porCategoria: [] },
    })
    expect(d.categorias).toEqual([])
    expect(d.saldoPeriodoCents).toBe(0)
  })

  it('repassa os saldos por conta', () => {
    const d = montarDadosRelatorio(entrada)
    expect(d.saldos).toEqual([{ bank: 'nubank', balanceCents: 250000, date: '2026-06-30' }])
  })
})
