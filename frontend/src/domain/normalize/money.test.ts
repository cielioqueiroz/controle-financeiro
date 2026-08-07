import { describe, it, expect, afterEach } from 'vitest'
import { parseBRL, formatBRL } from './money'
import { definirLocale } from './locale'

describe('formatBRL', () => {
  afterEach(() => definirLocale('pt-BR'))

  it('formata em pt-BR por padrão', () => {
    expect(formatBRL(123456)).toMatch(/1\.234,56/)
  })

  it('segue a locale ativa mantendo BRL (en-US)', () => {
    definirLocale('en-US')
    expect(formatBRL(123456)).toMatch(/1,234\.56/)
  })
})

describe('parseBRL', () => {
  it('converte valor simples para centavos', () => {
    expect(parseBRL('599,75')).toBe(59975)
  })

  it('converte valor com separador de milhar', () => {
    expect(parseBRL('1.277,68')).toBe(127768)
  })

  it('converte valor com prefixo R$', () => {
    expect(parseBRL('R$ 8.324,24')).toBe(832424)
  })

  it('trata sufixo hífen do Bradesco como crédito (negativo)', () => {
    expect(parseBRL('4.782,64 -')).toBe(-478264)
  })

  it('trata estorno do Bradesco como crédito', () => {
    expect(parseBRL('56,79 -')).toBe(-5679)
  })

  it('trata MINUS SIGN U+2212 do Nubank como negativo', () => {
    expect(parseBRL('−R$ 3.644,97')).toBe(-364497)
  })

  it('trata hífen ASCII prefixado como negativo', () => {
    expect(parseBRL('-R$ 3.644,97')).toBe(-364497)
  })

  it('converte zero', () => {
    expect(parseBRL('0,00')).toBe(0)
  })

  it('trata o "+" de crédito do resumo Nubank como positivo', () => {
    expect(parseBRL('+8.531,25')).toBe(853125)
  })

  it('não perde precisão em valor grande', () => {
    expect(parseBRL('17.410,00')).toBe(1741000)
  })

  it('lança em valor inválido', () => {
    expect(() => parseBRL('abc')).toThrow('Valor monetário inválido')
  })

  it('lança em string vazia', () => {
    expect(() => parseBRL('')).toThrow('Valor monetário inválido')
  })
})
