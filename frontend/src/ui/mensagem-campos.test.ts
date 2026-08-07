import { describe, it, expect } from 'vitest'
import { juntarCampos } from './mensagem-campos'

describe('juntarCampos', () => {
  it('junta com "e" em pt (mantém o texto do login atual)', () => {
    expect(juntarCampos(['nome', 'e-mail', 'senha'], 'pt-BR')).toBe('nome, e-mail e senha')
  })

  it('junta com "and" em en', () => {
    expect(juntarCampos(['name', 'email', 'password'], 'en-US')).toBe('name, email, and password')
  })

  it('um só item volta sem conjunção', () => {
    expect(juntarCampos(['e-mail'], 'pt-BR')).toBe('e-mail')
  })
})
