import { describe, expect, it } from 'vitest'
import { analisarRelatorio } from './relatorios'
import type { TxAgrupavel } from './agrupar'

function tx(competencia: string, over: Partial<TxAgrupavel> = {}): TxAgrupavel {
  return { competencia, date: `${competencia}-10`, amount_cents: 10000,
    kind: 'expense', category_slug: 'outros', ...over }
}

describe('Relatórios — janelas de calendário', () => {
  it('não inventa um resumo quando não há histórico', () => {
    expect(analisarRelatorio([], 3)).toBeNull()
  })

  it('não puxa meses antigos para completar lacunas', () => {
    const r = analisarRelatorio([tx('2026-01'), tx('2026-05'), tx('2026-07')], 3)!
    expect(r.atual.inicio).toBe('2026-05')
    expect(r.atual.fim).toBe('2026-07')
    expect(r.atual.meses.map((mes) => mes.resumo?.gastoCents ?? null)).toEqual([10000, null, 10000])
    expect(r.atual.resumo?.gastoCents).toBe(20000)
    expect(r.comparavel).toBe(false)
    expect(r.variacaoGastoPct).toBeNull()
  })

  it('não compara três meses contra só um mês anterior', () => {
    const r = analisarRelatorio(['2026-04', '2026-05', '2026-06', '2026-07'].map((m) => tx(m)), 3)!
    expect(r.atual.mesesComDados).toBe(3)
    expect(r.anterior.mesesComDados).toBe(1)
    expect(r.variacaoGastoPct).toBeNull()
    expect(r.taxaEconomiaAnteriorPct).toBeNull()
  })

  it('compara intervalos adjacentes de mesma duração inclusive na virada do ano', () => {
    const anterior = ['2025-09', '2025-10', '2025-11'].map((m) => tx(m))
    const atual = ['2025-12', '2026-01', '2026-02'].flatMap((m) => [
      tx(m, { amount_cents: 15000 }), tx(m, { kind: 'income', amount_cents: -30000 }),
    ])
    const r = analisarRelatorio([...atual, ...anterior].reverse(), 3)!
    expect(r.anterior.inicio).toBe('2025-09')
    expect(r.anterior.fim).toBe('2025-11')
    expect(r.atual.inicio).toBe('2025-12')
    expect(r.comparavel).toBe(true)
    expect(r.variacaoGastoPct).toBe(50)
    expect(r.taxaEconomiaAtualPct).toBe(50)
    expect(r.taxaEconomiaAnteriorPct).toBeNull()
  })

  it.each([6, 12] as const)('preserva %i meses de calendário com histórico curto', (janela) => {
    const r = analisarRelatorio([tx('2026-02')], janela)!
    expect(r.atual.meses).toHaveLength(janela)
    expect(r.atual.mesesComDados).toBe(1)
    expect(r.anterior.resumo).toBeNull()
    expect(r.atual.inicio).toBe(janela === 6 ? '2025-09' : '2025-03')
  })

  it('distingue mês só com vínculos de mês ausente sem contar vínculos como gasto', () => {
    const r = analisarRelatorio([
      tx('2026-05', { kind: 'card_payment' }),
      tx('2026-07', { kind: 'internal_transfer' }),
    ], 3)!
    expect(r.atual.meses[0].resumo?.gastoCents).toBe(0)
    expect(r.atual.meses[1].resumo).toBeNull()
    expect(r.atual.meses[2].resumo?.gastoCents).toBe(0)
    expect(r.taxaEconomiaAtualPct).toBeNull()
  })

  it('não divide por zero quando o período anterior não tem gasto real', () => {
    const meses = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
    const r = analisarRelatorio(meses.map((m) => tx(m, { kind: 'income', amount_cents: -10000 })), 3)!
    expect(r.comparavel).toBe(true)
    expect(r.variacaoGastoPct).toBeNull()
    expect(r.taxaEconomiaAnteriorPct).toBe(100)
  })
})
