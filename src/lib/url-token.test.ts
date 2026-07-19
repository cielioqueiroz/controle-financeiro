import { describe, it, expect } from 'vitest'
import { lerTokenDaUrl } from './url-token'

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
