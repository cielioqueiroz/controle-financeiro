import { describe, it, expect } from 'vitest'
import { extractInstallment } from './installment'

describe('extractInstallment', () => {
  it('extrai parcela explícita do Nubank', () => {
    expect(extractInstallment('Dias Gomes Comercio - Parcela 5/8')).toEqual({
      installment: { current: 5, total: 8 },
      clean: 'Dias Gomes Comercio',
    })
  })

  it('extrai parcela grudada do Bradesco', () => {
    expect(extractInstallment('ARAI KAMINISHI COS02/06')).toEqual({
      installment: { current: 2, total: 6 },
      clean: 'ARAI KAMINISHI COS',
    })
  })

  it('extrai parcela com espaço do Bradesco', () => {
    expect(extractInstallment('GOT SERVICOS ADMI 02/02')).toEqual({
      installment: { current: 2, total: 2 },
      clean: 'GOT SERVICOS ADMI',
    })
  })

  it('extrai parcela de linha remendada do Bradesco', () => {
    // "MERCADOLIVRE*MERCADO03/0" + "4" já unidos pela reconstrução de linhas
    expect(extractInstallment('MERCADOLIVRE*MERCADO03/04')).toEqual({
      installment: { current: 3, total: 4 },
      clean: 'MERCADOLIVRE*MERCADO',
    })
  })

  it('extrai parcela da anuidade', () => {
    expect(extractInstallment('ANUIDADE DIFERENCIADA 10/12')).toEqual({
      installment: { current: 10, total: 12 },
      clean: 'ANUIDADE DIFERENCIADA',
    })
  })

  it('devolve null quando não há parcela', () => {
    expect(extractInstallment('Ofertao Supermercado')).toEqual({
      installment: null,
      clean: 'Ofertao Supermercado',
    })
  })

  it('não confunde número de loja com parcela', () => {
    expect(extractInstallment('AUTO POSTO SANTANA 2')).toEqual({
      installment: null,
      clean: 'AUTO POSTO SANTANA 2',
    })
  })

  it('rejeita parcela atual maior que o total', () => {
    expect(extractInstallment('LOJA 09/03')).toEqual({
      installment: null,
      clean: 'LOJA 09/03',
    })
  })

  it('rejeita total acima de 24', () => {
    expect(extractInstallment('LOJA 01/48')).toEqual({
      installment: null,
      clean: 'LOJA 01/48',
    })
  })

  it('preserva descrição do Nubank sem parcela', () => {
    expect(extractInstallment('Anthropic* Claude Sub')).toEqual({
      installment: null,
      clean: 'Anthropic* Claude Sub',
    })
  })
})
