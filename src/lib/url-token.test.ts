import { describe, it, expect, afterEach } from 'vitest'
import { lerTokenDaUrl, limparTokenDaUrl } from './url-token'

describe('lerTokenDaUrl', () => {
  it('extrai o token da query string', () => {
    expect(lerTokenDaUrl('?token=abc123')).toBe('abc123')
  })

  it('extrai o token quando há outros parâmetros', () => {
    expect(lerTokenDaUrl('?foo=1&token=abc123&bar=2')).toBe('abc123')
  })

  it('funciona sem a interrogação inicial', () => {
    expect(lerTokenDaUrl('token=abc123')).toBe('abc123')
  })

  it('devolve null quando não há token', () => {
    expect(lerTokenDaUrl('?foo=1')).toBeNull()
  })

  it('devolve null com query vazia', () => {
    expect(lerTokenDaUrl('')).toBeNull()
    expect(lerTokenDaUrl('?')).toBeNull()
  })

  // ?token= sem valor é lixo, não um token: não pode abrir o formulário.
  it('devolve null quando o token está vazio', () => {
    expect(lerTokenDaUrl('?token=')).toBeNull()
    expect(lerTokenDaUrl('?token=%20')).toBeNull()
  })

  it('decodifica valor percent-encoded', () => {
    expect(lerTokenDaUrl('?token=a%2Bb')).toBe('a+b')
  })
})

// É a função cujo defeito reenviaria um token gasto num F5 — merece teste
// direto, não só o indireto via App.test (que nunca conferia a URL depois).
describe('limparTokenDaUrl', () => {
  afterEach(() => window.history.replaceState({}, '', '/'))

  it('remove o token e preserva os outros parâmetros e o hash', () => {
    window.history.replaceState({}, '', '/?foo=1&token=abc123&bar=2#topo')
    limparTokenDaUrl()
    expect(window.location.search).toBe('?foo=1&bar=2')
    expect(window.location.hash).toBe('#topo')
    expect(window.location.pathname).toBe('/')
  })

  it('token único: a query some por inteiro', () => {
    window.history.replaceState({}, '', '/?token=abc123')
    limparTokenDaUrl()
    expect(window.location.search).toBe('')
    expect(lerTokenDaUrl(window.location.search)).toBeNull()
  })

  it('sem token na URL, não altera nada', () => {
    window.history.replaceState({}, '', '/?foo=1')
    limparTokenDaUrl()
    expect(window.location.search).toBe('?foo=1')
  })
})
