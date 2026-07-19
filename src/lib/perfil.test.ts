import { describe, it, expect, beforeEach } from 'vitest'
import { guardarEmailReset, lerEmailReset, esquecerEmailReset } from './perfil'

beforeEach(() => {
  localStorage.clear()
})

describe('e-mail do pedido de reset', () => {
  it('devolve null quando nada foi guardado', () => {
    expect(lerEmailReset()).toBeNull()
  })

  it('guarda e devolve o e-mail', () => {
    guardarEmailReset('alguem@exemplo.com')
    expect(lerEmailReset()).toBe('alguem@exemplo.com')
  })

  it('apara espaços ao guardar', () => {
    guardarEmailReset('  alguem@exemplo.com  ')
    expect(lerEmailReset()).toBe('alguem@exemplo.com')
  })

  it('esquece o e-mail', () => {
    guardarEmailReset('alguem@exemplo.com')
    esquecerEmailReset()
    expect(lerEmailReset()).toBeNull()
  })

  it('guardar vazio não deixa lixo', () => {
    guardarEmailReset('   ')
    expect(lerEmailReset()).toBeNull()
  })
})
