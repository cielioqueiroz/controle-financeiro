import { describe, it, expect, afterEach } from 'vitest'
import { definirLocale } from './locale'
import { mesAbrev } from './data'

afterEach(() => definirLocale('pt-BR'))

describe('mesAbrev', () => {
  it('mês abreviado na locale ativa', () => {
    const maio = new Date(2026, 4, 15)
    expect(mesAbrev(maio).toLowerCase()).toContain('mai') // pt
    definirLocale('en-US')
    expect(mesAbrev(maio).toLowerCase()).toContain('may') // en
  })

  it('não deixa ponto no fim (pt)', () => {
    const jun = new Date(2026, 5, 15)
    expect(mesAbrev(jun)).not.toContain('.')
  })
})
