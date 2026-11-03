import { describe, expect, it } from 'vitest'
import { analisarRelatorio } from './relatorios'
import type { TxAgrupavel } from './agrupar'

type TxComFonte = TxAgrupavel & { bank?: string; doc_type?: string }

function tx(competencia: string, over: Partial<TxComFonte> = {}): TxComFonte {
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

// A fatura conta no mês do vencimento (ADR-0001), e a última importada
// costuma vencer no mês seguinte ao último extrato. Esse mês entrava na
// janela só com o gasto do cartão e sem as entradas: a economia "caía" de
// 33% para 4% sem nada ter mudado.
describe('Relatórios — mês final incompleto', () => {
  const doc = (bank: string, doc_type: string) => ({ bank, doc_type })
  const extrato = doc('bb', 'extrato')
  const fatura = doc('nubank', 'fatura')

  function seisMesesCompletos() {
    return ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'].flatMap((m) => [
      tx(m, { amount_cents: 400000, ...fatura }),
      tx(m, { kind: 'income', amount_cents: -600000, ...extrato }),
    ])
  }

  it('deixa de fora o mês que só tem a fatura que vence adiante', () => {
    const r = analisarRelatorio([...seisMesesCompletos(), tx('2026-11', { amount_cents: 350000, ...fatura })], 3)!
    expect(r.atual.fim).toBe('2026-10')
    expect(r.atual.inicio).toBe('2026-08')
    expect(r.taxaEconomiaAtualPct).toBeCloseTo(33.33, 1)
    expect(r.variacaoGastoPct).toBe(0)
    expect(r.foraDaJanela).toEqual([{ competencia: '2026-11', faltam: [{ bank: 'bb', docType: 'extrato' }] }])
  })

  it('o mês volta para a janela quando o documento que faltava chega', () => {
    const r = analisarRelatorio([
      ...seisMesesCompletos(),
      tx('2026-11', { amount_cents: 350000, ...fatura }),
      tx('2026-11', { kind: 'income', amount_cents: -600000, ...extrato }),
    ], 3)!
    expect(r.atual.fim).toBe('2026-11')
    expect(r.foraDaJanela).toEqual([])
  })

  it('conta encerrada atrasa só um mês: o seguinte já é comparado com o mês sem ela', () => {
    const r = analisarRelatorio([
      ...seisMesesCompletos(),
      tx('2026-11', fatura),
      tx('2026-12', fatura),
    ], 3)!
    expect(r.atual.fim).toBe('2026-12')
    expect(r.foraDaJanela).toEqual([])
  })

  it('não julga através de uma lacuna de calendário', () => {
    const r = analisarRelatorio([
      tx('2026-08', extrato), tx('2026-08', fatura),
      tx('2026-10', fatura),
    ], 3)!
    expect(r.atual.fim).toBe('2026-10')
    expect(r.foraDaJanela).toEqual([])
  })

  // 03/11/2026: o extrato do Mercado Pago de outubro foi importado sem
  // nenhuma transação (conta parada). Pelas transações, a fonte "sumiu" de
  // outubro, e o mês inteiro saiu da janela — Relatórios, Situação e a
  // linha do tempo ficaram em setembro. O documento importado é a prova de
  // que a fonte está lá.
  describe('documento importado sem transações', () => {
    const mp = doc('mercadopago', 'extrato')
    const historico = [
      ...['2026-08', '2026-09'].flatMap((m) => [tx(m, fatura), tx(m, { ...mp, kind: 'income', amount_cents: -5000 })]),
      tx('2026-10', fatura),
    ]
    const documentos = [
      { ...mp, period_end: '2026-09-30' },
      { ...mp, period_end: '2026-10-31' },
      { ...fatura, period_end: '2026-10-20' },
    ]

    it('o mês fica na janela', () => {
      const r = analisarRelatorio(historico, 3, documentos)!
      expect(r.atual.fim).toBe('2026-10')
      expect(r.foraDaJanela).toEqual([])
    })

    it('sem o documento, o mês continua de fora', () => {
      const r = analisarRelatorio(historico, 3, documentos.filter((d) => d.period_end !== '2026-10-31'))!
      expect(r.atual.fim).toBe('2026-09')
      expect(r.foraDaJanela).toEqual([{ competencia: '2026-10', faltam: [{ bank: 'mercadopago', docType: 'extrato' }] }])
    })

    it('documento sem período não conta para mês nenhum', () => {
      const r = analisarRelatorio(historico, 3, [{ ...mp, period_end: null }])!
      expect(r.atual.fim).toBe('2026-09')
    })
  })

  it('sem banco e tipo de documento nada é deixado de fora', () => {
    const r = analisarRelatorio([tx('2026-09'), tx('2026-10', { kind: 'income', amount_cents: -1 })], 3)!
    expect(r.atual.fim).toBe('2026-10')
    expect(r.foraDaJanela).toEqual([])
  })
})
