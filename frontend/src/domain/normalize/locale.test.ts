import { describe, it, expect, afterEach } from 'vitest'
import { definirLocale, localeAtual } from './locale'

afterEach(() => definirLocale('pt-BR'))

describe('locale', () => {
  it('default pt-BR; definirLocale troca', () => {
    expect(localeAtual()).toBe('pt-BR')
    definirLocale('en-US')
    expect(localeAtual()).toBe('en-US')
  })
})
