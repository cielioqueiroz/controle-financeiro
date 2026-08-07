import { describe, it, expect } from 'vitest'
import { ehFalhaDeChunk } from './chunk'

describe('ehFalhaDeChunk', () => {
  // As três mensagens reais que os navegadores usam quando o arquivo do
  // chunk sumiu (deploy novo com hash diferente).
  it('reconhece a mensagem do Chrome/Edge', () => {
    const e = new TypeError(
      'Failed to fetch dynamically imported module: https://x.app/assets/jspdf-abc.js',
    )
    expect(ehFalhaDeChunk(e)).toBe(true)
  })

  it('reconhece a mensagem do Firefox', () => {
    expect(ehFalhaDeChunk(new TypeError('error loading dynamically imported module'))).toBe(true)
  })

  it('reconhece a mensagem do Safari', () => {
    expect(ehFalhaDeChunk(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  // Não pode confundir um defeito de verdade na geração com aba velha:
  // seriam diagnósticos (e mensagens ao usuário) opostos.
  it('não confunde com erro comum de execução', () => {
    expect(ehFalhaDeChunk(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(ehFalhaDeChunk(new Error('Falha ao salvar.'))).toBe(false)
  })

  it('aguenta valores que não são Error', () => {
    expect(ehFalhaDeChunk(null)).toBe(false)
    expect(ehFalhaDeChunk(undefined)).toBe(false)
    expect(ehFalhaDeChunk('Failed to fetch dynamically imported module')).toBe(true)
  })
})
