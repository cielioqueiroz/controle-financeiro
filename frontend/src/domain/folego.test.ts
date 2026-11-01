import { describe, it, expect } from 'vitest'
import { diasDeFolego, liquidoCurtoPrazo } from './folego'
import type { FaturaAberta } from './aberto'
import type { SaldoConta } from './saldos'

function gasto(date: string, amount_cents: number, kind = 'expense') {
  return { date, competencia: date.slice(0, 7), amount_cents, kind, category_slug: 'outros' }
}

/** R$ 100 por dia, todo dia, de `inicio` a `fim`. */
function diario(inicio: string, fim: string, cents = 10000) {
  const out = []
  for (let d = new Date(`${inicio}T00:00:00Z`); d <= new Date(`${fim}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(gasto(d.toISOString().slice(0, 10), cents))
  }
  return out
}

describe('diasDeFolego', () => {
  it('saldo ÷ gasto real médio por dia dos últimos 90 dias', () => {
    const txs = diario('2026-03-01', '2026-06-30')
    const f = diasDeFolego(450000, '2026-06-30', txs)!
    expect(f.janelaDias).toBe(90)
    expect(f.gastoDiarioCents).toBe(10000)
    expect(f.dias).toBe(45)
  })

  it('ignora o que veio depois da data do saldo', () => {
    const txs = [...diario('2026-03-01', '2026-06-30'), gasto('2026-07-05', 9_000_000)]
    expect(diasDeFolego(450000, '2026-06-30', txs)!.dias).toBe(45)
  })

  it('vínculo e entrada não são gasto; estorno abate', () => {
    const txs = [
      ...diario('2026-04-01', '2026-06-29'),
      gasto('2026-06-10', 500000, 'card_payment'),
      gasto('2026-06-11', -800000, 'income'),
      gasto('2026-06-12', -90000),
    ]
    // 90 dias × R$ 100 − R$ 900 de estorno = R$ 8.100 → R$ 90/dia.
    expect(diasDeFolego(90000, '2026-06-29', txs)!.gastoDiarioCents).toBe(9000)
  })

  it('com menos de 90 dias de histórico, divide pelos dias que existem', () => {
    // Dividir por 90 com 40 dias importados faria o gasto parecer menor e o
    // fôlego, maior do que é.
    const txs = diario('2026-05-22', '2026-06-30')
    const f = diasDeFolego(400000, '2026-06-30', txs)!
    expect(f.janelaDias).toBe(40)
    expect(f.dias).toBe(40)
  })

  it('cala com menos de 30 dias de histórico', () => {
    expect(diasDeFolego(400000, '2026-06-30', diario('2026-06-02', '2026-06-30'))).toBeNull()
  })

  it('cala sem gasto na janela', () => {
    expect(diasDeFolego(400000, '2026-06-30', [gasto('2026-01-01', 5000)])).toBeNull()
  })

  it('saldo zerado ou negativo é zero dia', () => {
    const txs = diario('2026-03-01', '2026-06-30')
    expect(diasDeFolego(0, '2026-06-30', txs)!.dias).toBe(0)
    expect(diasDeFolego(-50000, '2026-06-30', txs)!.dias).toBe(0)
  })

  it('arredonda os dias para baixo', () => {
    const txs = diario('2026-03-01', '2026-06-30')
    expect(diasDeFolego(459999, '2026-06-30', txs)!.dias).toBe(45)
  })
})

function saldo(bank: string, balanceCents: number, date = '2026-06-30'): SaldoConta {
  return { accountId: bank, bank, balanceCents, date }
}

function aberta(bank: string, abertoCents: number | null, futurasCents: number | null = null): FaturaAberta {
  return { accountId: bank, bank, abertoCents, proximaCents: null, futurasCents, proximoFechamento: null, date: '2026-06-20' }
}

describe('liquidoCurtoPrazo', () => {
  it('saldos menos o em aberto declarado dos cartões', () => {
    const l = liquidoCurtoPrazo([saldo('bb', 300000), saldo('sicredi', 100000)], [aberta('nubank', 150000)])!
    expect(l).toEqual({ seuCents: 400000, deveCents: 150000, liquidoCents: 250000, semAberto: [] })
  })

  it('cartão que só declara parcelas futuras não entra, e é nomeado', () => {
    // Parcela futura não vence agora: subtraí-la diria que o dinheiro de
    // hoje já está gasto com o que só cai daqui a meses.
    const l = liquidoCurtoPrazo([saldo('bb', 300000)], [aberta('nubank', 50000), aberta('bradesco', null, 900000)])!
    expect(l.deveCents).toBe(50000)
    expect(l.semAberto).toEqual(['bradesco'])
  })

  it('cala sem saldo ou sem nenhum em aberto declarado', () => {
    expect(liquidoCurtoPrazo([], [aberta('nubank', 50000)])).toBeNull()
    expect(liquidoCurtoPrazo([saldo('bb', 300000)], [])).toBeNull()
    expect(liquidoCurtoPrazo([saldo('bb', 300000)], [aberta('bradesco', null, 900000)])).toBeNull()
  })
})
