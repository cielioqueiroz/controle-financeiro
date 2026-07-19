import { describe, it, expect } from 'vitest'
import { camposFaltando, mensagemCamposFaltando, validarNovaSenha } from './auth-validacao'

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

describe('mensagemCamposFaltando', () => {
  it('lista os três campos com vírgula e "e"', () => {
    expect(mensagemCamposFaltando('criar', ['nome', 'email', 'senha']))
      .toBe('Preencha nome, e-mail e senha para criar sua conta.')
  })

  it('liga dois campos com "e"', () => {
    expect(mensagemCamposFaltando('entrar', ['email', 'senha']))
      .toBe('Preencha e-mail e senha para entrar.')
  })

  it('usa possessivo quando falta só um campo', () => {
    expect(mensagemCamposFaltando('criar', ['nome']))
      .toBe('Preencha seu nome para criar sua conta.')
    expect(mensagemCamposFaltando('entrar', ['senha']))
      .toBe('Preencha sua senha para entrar.')
    expect(mensagemCamposFaltando('entrar', ['email']))
      .toBe('Preencha seu e-mail para entrar.')
  })

  it('retorna string vazia para lista vazia, em vez de frase com espaço duplo', () => {
    expect(mensagemCamposFaltando('criar', [])).toBe('')
    expect(mensagemCamposFaltando('entrar', [])).toBe('')
  })
})

describe('validarNovaSenha', () => {
  it('recusa senha vazia', () => {
    expect(validarNovaSenha('', '')).toBe('Digite a nova senha.')
  })

  it('recusa senha com menos de 8 caracteres', () => {
    expect(validarNovaSenha('abc123', 'abc123')).toBe(
      'A senha precisa ter ao menos 8 caracteres.',
    )
  })

  it('recusa confirmação vazia quando a senha foi preenchida', () => {
    expect(validarNovaSenha('senhaboa123', '')).toBe('Repita a nova senha para confirmar.')
  })

  it('recusa senhas diferentes', () => {
    expect(validarNovaSenha('senhaboa123', 'senhaboa124')).toBe('As senhas não coincidem.')
  })

  // Espaço é caractere válido de senha: não aparar.
  it('trata espaço como caractere significativo', () => {
    expect(validarNovaSenha('senha com espaco', 'senha com espaco')).toBeNull()
    expect(validarNovaSenha(' 12345678', '12345678')).toBe('As senhas não coincidem.')
  })

  it('aceita senhas iguais com 8 caracteres ou mais', () => {
    expect(validarNovaSenha('senhaboa123', 'senhaboa123')).toBeNull()
  })

  // Vazio vence curta, que vence divergente: uma mensagem de cada vez,
  // sempre a mais fundamental, como já faz camposFaltando.
  it('prioriza vazia sobre curta', () => {
    expect(validarNovaSenha('', 'abc')).toBe('Digite a nova senha.')
  })
})
