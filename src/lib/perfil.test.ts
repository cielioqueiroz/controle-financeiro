import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

// F2: o e-mail guardado é entrada não verificada para o signIn.email
// automático — precisa expirar junto com o token (1h, validade real do
// Neon), senão um pedido abandonado deixa o e-mail vivo para sempre, pronto
// para vazar num login automático de um pedido de OUTRA conta feito depois
// no mesmo navegador.
describe('expiração do e-mail de reset (F2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('registro recente (dentro de 1h) continua legível', () => {
    guardarEmailReset('alguem@exemplo.com')
    vi.setSystemTime(new Date('2026-07-19T10:59:59Z')) // 59min59s depois
    expect(lerEmailReset()).toBe('alguem@exemplo.com')
  })

  it('registro com mais de 1h expira e devolve null', () => {
    guardarEmailReset('alguem@exemplo.com')
    vi.setSystemTime(new Date('2026-07-19T11:00:01Z')) // 1h e 1s depois
    expect(lerEmailReset()).toBeNull()
  })

  it('valor no formato antigo (string simples, sem timestamp) não crasha — tratado como ausente', () => {
    // Formato anterior ao F2: só o e-mail, sem envelope { email, ts }.
    localStorage.setItem('cf:email-reset', 'alguem@exemplo.com')
    expect(lerEmailReset()).toBeNull()
  })

  it('valor malformado (JSON inválido) não crasha — tratado como ausente', () => {
    localStorage.setItem('cf:email-reset', '{isso não é json')
    expect(lerEmailReset()).toBeNull()
  })

  it('JSON válido mas sem os campos esperados é tratado como ausente', () => {
    localStorage.setItem('cf:email-reset', JSON.stringify({ foo: 'bar' }))
    expect(lerEmailReset()).toBeNull()
  })
})
