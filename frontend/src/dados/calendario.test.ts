import { describe, it, expect } from 'vitest'
import { diasDoMes } from './calendario'
import type { Recorrencia } from '../domain/recorrencias'

function rec(over: Partial<Recorrencia> = {}): Recorrencia {
  return {
    chave: 'x',
    descricao: 'Assinatura',
    categoriaSlug: 'servicos',
    tipo: 'saida',
    valorTipicoCents: 5000,
    valorAnteriorCents: 5000,
    diaTipico: 10,
    variacao: 'fixo',
    competencias: ['2026-06', '2026-07'],
    ultimoValorCents: 5000,
    ultimaCompetencia: '2026-07',
    ...over,
  } as Recorrencia
}

describe('diasDoMes', () => {
  it('agrupa recorrências pelo dia típico', () => {
    const dias = diasDoMes(
      [rec({ diaTipico: 5 }), rec({ diaTipico: 5 }), rec({ diaTipico: 20 })],
      2026,
      8,
    )
    expect(dias.find((d) => d.dia === 5)?.itens).toHaveLength(2)
    expect(dias.find((d) => d.dia === 20)?.itens).toHaveLength(1)
  })

  it('devolve o mês inteiro, inclusive os dias sem nada', () => {
    const dias = diasDoMes([rec({ diaTipico: 5 })], 2026, 8) // agosto: 31 dias
    expect(dias).toHaveLength(31)
    expect(dias.every((d) => Array.isArray(d.itens))).toBe(true)
  })

  it('conhece o tamanho de cada mês', () => {
    expect(diasDoMes([], 2026, 2)).toHaveLength(28)
    expect(diasDoMes([], 2024, 2)).toHaveLength(29) // bissexto
    expect(diasDoMes([], 2026, 4)).toHaveLength(30)
  })

  // Fevereiro não tem dia 30. Uma série com diaTipico 30 não pode sumir da
  // tela nem criar um dia que não existe: encaixa no último dia do mês, que
  // é quando a cobrança de fato cai.
  it('encaixa dia 30 em fevereiro no último dia do mês', () => {
    const dias = diasDoMes([rec({ diaTipico: 30 })], 2026, 2)
    expect(dias).toHaveLength(28)
    expect(dias.find((d) => d.itens.length > 0)?.dia).toBe(28)
  })

  it('não perde a série quando o dia típico é 31 num mês de 30', () => {
    const dias = diasDoMes([rec({ diaTipico: 31 })], 2026, 4)
    expect(dias.find((d) => d.itens.length > 0)?.dia).toBe(30)
  })

  it('separa entradas de saídas no mesmo dia', () => {
    const dias = diasDoMes(
      [rec({ diaTipico: 15, tipo: 'entrada' }), rec({ diaTipico: 15, tipo: 'saida' })],
      2026,
      8,
    )
    const dia15 = dias.find((d) => d.dia === 15)
    expect(dia15?.itens).toHaveLength(2)
    expect(dia15?.entradasCents).toBe(5000)
    expect(dia15?.saidasCents).toBe(5000)
  })
})
