import { describe, expect, it } from 'vitest'
import { analisarTrajetoria, taxasFinanceiras } from './trajetoria'

describe('trajetória e taxas', () => {
  it('distingue melhor resultado de maior gasto e ignora vínculos nos totais', () => {
    const base = { date: '2026-01-10', category_slug: 'outros' }
    const dados = analisarTrajetoria([
      { ...base, competencia: '2026-01', kind: 'income', amount_cents: -10000 },
      { ...base, competencia: '2026-01', kind: 'expense', amount_cents: 9000 },
      { ...base, competencia: '2026-01', kind: 'card_payment', amount_cents: 50000 },
      { ...base, competencia: '2026-03', kind: 'income', amount_cents: -10000 },
      { ...base, competencia: '2026-03', kind: 'expense', amount_cents: 5000 },
    ])
    expect(dados.melhorMes?.competencia).toBe('2026-03')
    expect(dados.mesMaisCaro?.competencia).toBe('2026-01')
    expect(dados.categoriasMesMaisCaro[0].totalCents).toBe(9000)
    expect(dados.serie.map((ponto) => ponto.competencia)).toEqual(['2026-01', '2026-03'])
  })
  it('não inventa destaques no histórico vazio', () => {
    expect(analisarTrajetoria([])).toEqual({ serie: [], melhorMes: null, mesMaisCaro: null, categoriasMesMaisCaro: [] })
  })
  it('não calcula taxas sem entradas e mantém consumo acima de 100%', () => {
    expect(taxasFinanceiras(0, 100)).toEqual({ consumoPct: null, economiaPct: null })
    expect(taxasFinanceiras(10000, 17000)).toEqual({ consumoPct: 170, economiaPct: -70 })
    expect(taxasFinanceiras(10000, 0)).toEqual({ consumoPct: 0, economiaPct: 100 })
  })
})
