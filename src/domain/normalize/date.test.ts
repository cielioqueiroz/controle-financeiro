import { describe, it, expect } from 'vitest'
import { inferYear, parseMesAbreviado } from './date'

describe('inferYear', () => {
  it('atribui o ano da referência quando a data é anterior', () => {
    // Fatura Bradesco vence 28/06/2026; transação em 08/04
    expect(inferYear(8, 4, new Date(2026, 5, 28))).toEqual(new Date(2026, 3, 8))
  })

  it('atribui o ano da referência quando a data é o próprio vencimento', () => {
    expect(inferYear(28, 6, new Date(2026, 5, 28))).toEqual(new Date(2026, 5, 28))
  })

  it('subtrai um ano na virada — dezembro numa fatura de janeiro', () => {
    // Fatura vence 10/01/2027; transação em 28/12 é de 2026
    expect(inferYear(28, 12, new Date(2027, 0, 10))).toEqual(new Date(2026, 11, 28))
  })

  it('trata 20 MAI numa fatura de 29 JUN 2026', () => {
    expect(inferYear(20, 5, new Date(2026, 5, 29))).toEqual(new Date(2026, 4, 20))
  })
})

describe('parseMesAbreviado', () => {
  it('converte MAI para 5', () => {
    expect(parseMesAbreviado('MAI')).toBe(5)
  })

  it('converte JUN para 6', () => {
    expect(parseMesAbreviado('JUN')).toBe(6)
  })

  it('é insensível a caixa', () => {
    expect(parseMesAbreviado('dez')).toBe(12)
  })

  it('lança em mês inválido', () => {
    expect(() => parseMesAbreviado('XYZ')).toThrow('Mês inválido')
  })
})
