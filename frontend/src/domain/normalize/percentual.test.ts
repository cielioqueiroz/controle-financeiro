import { describe, it, expect, afterEach } from 'vitest'
import { definirLocale } from './locale'
import { formatarDecimal, formatarPct } from './percentual'

afterEach(() => definirLocale('pt-BR'))

describe('percentual na locale ativa', () => {
  it('pt-BR usa vírgula decimal', () => {
    expect(formatarPct(66.666)).toBe('66,7%')
    expect(formatarDecimal(-4.25)).toBe('-4,3')
  })

  it('en-US usa ponto decimal', () => {
    definirLocale('en-US')
    expect(formatarPct(66.666)).toBe('66.7%')
  })

  it('es-ES usa vírgula decimal', () => {
    definirLocale('es-ES')
    expect(formatarPct(12)).toBe('12,0%')
  })
})
