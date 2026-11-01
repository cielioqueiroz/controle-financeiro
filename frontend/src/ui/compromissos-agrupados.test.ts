import { describe, it, expect } from 'vitest'
import { agruparMesesIguais } from './compromissos-agrupados'
import type { ItemFuturo, MesFuturo } from '../domain/agrupar'

const item = (over: Partial<ItemFuturo> = {}): ItemFuturo => ({
  descricao: 'GELADEIRA', parcela: 3, total: 10, amountCents: 45000, bank: 'nubank', ...over,
})

const mes = (competencia: string, itens: ItemFuturo[]): MesFuturo => ({
  competencia,
  totalCents: itens.reduce((a, i) => a + i.amountCents, 0),
  itens,
  porBanco: [],
})

/** A mesma série projetada mês a mês: a parcela anda, o resto não. */
const serie = (inicio: number, comps: string[], over: Partial<ItemFuturo> = {}) =>
  comps.map((c, k) => mes(c, [item({ parcela: inicio + k, ...over })]))

// Auditoria de 30/10, U5: seis linhas iguais ("1× R$ 450,00") contam a mesma
// coisa seis vezes. Meses seguidos com as mesmas parcelas viram uma linha.
describe('agruparMesesIguais', () => {
  it('junta meses seguidos com as mesmas parcelas', () => {
    const grupos = agruparMesesIguais(serie(4, ['2026-11', '2026-12', '2027-01']))
    expect(grupos).toHaveLength(1)
    expect(grupos[0]).toMatchObject({ inicio: '2026-11', fim: '2027-01' })
    expect(grupos[0].meses).toHaveLength(3)
  })

  it('separa quando uma série termina', () => {
    const meses = [
      mes('2026-11', [item({ parcela: 9 }), item({ descricao: 'SOFÁ', parcela: 2, amountCents: 10000 })]),
      mes('2026-12', [item({ parcela: 10 }), item({ descricao: 'SOFÁ', parcela: 3, amountCents: 10000 })]),
      mes('2027-01', [item({ descricao: 'SOFÁ', parcela: 4, amountCents: 10000 })]),
    ]
    expect(agruparMesesIguais(meses).map((g) => [g.inicio, g.fim]))
      .toEqual([['2026-11', '2026-12'], ['2027-01', '2027-01']])
  })

  it('não junta através de um mês sem parcela', () => {
    const meses = [...serie(4, ['2026-11']), ...serie(6, ['2027-01'])]
    expect(agruparMesesIguais(meses)).toHaveLength(2)
  })

  it('não junta valores diferentes da mesma loja', () => {
    const meses = [mes('2026-11', [item()]), mes('2026-12', [item({ parcela: 4, amountCents: 50000 })])]
    expect(agruparMesesIguais(meses)).toHaveLength(2)
  })

  it('não junta a mesma compra em cartões diferentes', () => {
    const meses = [mes('2026-11', [item()]), mes('2026-12', [item({ parcela: 4, bank: 'bradesco' })])]
    expect(agruparMesesIguais(meses)).toHaveLength(2)
  })

  it('dá a faixa de parcelas de cada série no grupo', () => {
    const [grupo] = agruparMesesIguais(serie(4, ['2026-11', '2026-12', '2027-01']))
    expect(grupo.itens).toEqual([
      { descricao: 'GELADEIRA', bank: 'nubank', total: 10, amountCents: 45000, de: 4, ate: 6 },
    ])
  })
})
