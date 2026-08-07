import { describe, it, expect } from 'vitest'
import { camposFaltando, validarNovaSenha, emailValido } from './auth-validacao'

const vazio = { nome: '', email: '', senha: '' }

describe('camposFaltando', () => {
  it('no modo criar, lista nome, email e senha na ordem da tela', () => {
    expect(camposFaltando('criar', vazio)).toEqual(['nome', 'email', 'senha'])
  })

  it('no modo entrar, ignora o campo nome (que nem existe na tela)', () => {
    expect(camposFaltando('entrar', vazio)).toEqual(['email', 'senha'])
  })

  it('no modo entrar, ignora nome mesmo quando preenchido', () => {
    expect(camposFaltando('entrar', { ...vazio, nome: 'Cielio' })).toEqual(['email', 'senha'])
  })

  it('não acusa campo preenchido', () => {
    expect(camposFaltando('criar', { nome: 'Cielio', email: 'a@b.com', senha: 'segredo12' })).toEqual([])
  })

  it('trata espaço em branco como vazio em nome e email', () => {
    expect(camposFaltando('criar', { nome: '   ', email: '  ', senha: 'segredo12' })).toEqual(['nome', 'email'])
  })

  it('NÃO apara a senha — espaço é caractere válido', () => {
    expect(camposFaltando('criar', { nome: 'Cielio', email: 'a@b.com', senha: '   ' })).toEqual([])
  })
})

describe('validarNovaSenha (devolve chave de i18n ou null)', () => {
  it('recusa senha vazia', () => {
    expect(validarNovaSenha('', '')).toBe('recuperar.erro.digite')
  })

  it('recusa senha com menos de 8 caracteres', () => {
    expect(validarNovaSenha('abc123', 'abc123')).toBe('validacao.senhaCurta')
  })

  it('recusa confirmação vazia quando a senha foi preenchida', () => {
    expect(validarNovaSenha('senhaboa123', '')).toBe('recuperar.erro.repita')
  })

  it('recusa senhas diferentes', () => {
    expect(validarNovaSenha('senhaboa123', 'senhaboa124')).toBe('recuperar.erro.naoCoincidem')
  })

  // Espaço é caractere válido de senha: não aparar.
  it('trata espaço como caractere significativo', () => {
    expect(validarNovaSenha('senha com espaco', 'senha com espaco')).toBeNull()
    expect(validarNovaSenha(' 12345678', '12345678')).toBe('recuperar.erro.naoCoincidem')
  })

  it('aceita senhas iguais com 8 caracteres ou mais', () => {
    expect(validarNovaSenha('senhaboa123', 'senhaboa123')).toBeNull()
  })

  it('recusa senha com exatamente 7 caracteres', () => {
    expect(validarNovaSenha('abcdefg', 'abcdefg')).toBe('validacao.senhaCurta')
  })

  it('aceita senha com exatamente 8 caracteres', () => {
    expect(validarNovaSenha('abcdefgh', 'abcdefgh')).toBeNull()
  })

  // Vazio vence curta, que vence divergente: uma queixa de cada vez.
  it('prioriza vazia sobre curta', () => {
    expect(validarNovaSenha('', 'abc')).toBe('recuperar.erro.digite')
  })
})

describe('emailValido', () => {
  it('aceita e-mail comum', () => {
    expect(emailValido('alguem@exemplo.com')).toBe(true)
  })

  it('apara espaços nas bordas antes de validar', () => {
    expect(emailValido('  alguem@exemplo.com  ')).toBe(true)
  })

  it('recusa string vazia', () => {
    expect(emailValido('')).toBe(false)
  })

  it('recusa sem arroba', () => {
    expect(emailValido('alguem.exemplo.com')).toBe(false)
  })

  it('recusa sem domínio depois do ponto', () => {
    expect(emailValido('alguem@exemplo')).toBe(false)
  })

  it('recusa espaço no meio', () => {
    expect(emailValido('alguem @exemplo.com')).toBe(false)
  })
})
