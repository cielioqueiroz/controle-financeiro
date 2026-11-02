import { describe, it, expect } from 'vitest'
import { caixaDeTitulo, nomeExibido } from './descricao'

describe('caixaDeTitulo', () => {
  it('desce a caixa alta do banco para caixa de título', () => {
    expect(caixaDeTitulo('SUPERMERCADO BOM PRECO')).toBe('Supermercado Bom Preco')
    expect(caixaDeTitulo('AÇAÍ DA PRAÇA')).toBe('Açaí da Praça')
  })

  it('não toca texto que já tem minúscula', () => {
    expect(caixaDeTitulo('Hna*Oboticario')).toBe('Hna*Oboticario')
    expect(caixaDeTitulo('Transferência recebida pelo Pix')).toBe('Transferência recebida pelo Pix')
  })

  it('deixa conectivos em minúscula, menos na primeira palavra', () => {
    expect(caixaDeTitulo('PADARIA DO JOAO E FILHOS')).toBe('Padaria do Joao e Filhos')
    expect(caixaDeTitulo('O BOTICARIO')).toBe('O Boticario')
  })

  it('mantém em caixa alta o que não tem vogal e as siglas conhecidas', () => {
    expect(caixaDeTitulo('MP *LOJA SP BR')).toBe('MP *Loja SP BR')
    expect(caixaDeTitulo('TED ENVIADA')).toBe('TED Enviada')
    expect(caixaDeTitulo('IOF COMPRA INTERNACIONAL')).toBe('IOF Compra Internacional')
    expect(caixaDeTitulo('S/A')).toBe('S/A')
  })

  it('separa as palavras coladas por asterisco, ponto ou barra', () => {
    expect(caixaDeTitulo('PAG*IFOOD')).toBe('Pag*Ifood')
    expect(caixaDeTitulo('DL*GOOGLE YOUTUBE')).toBe('DL*Google Youtube')
  })

  it('escreve endereço em minúscula depois do ponto, mas não a sigla', () => {
    expect(caixaDeTitulo('AMAZON.COM.BR')).toBe('Amazon.com.br')
    expect(caixaDeTitulo('MERCADO S.A.')).toBe('Mercado S.A.')
  })

  it('não mexe em palavra com dígito, que costuma ser código', () => {
    expect(caixaDeTitulo('IFOOD *7X3KA9 LOJA')).toBe('Ifood *7X3KA9 Loja')
    expect(caixaDeTitulo('PARCELA 03/10')).toBe('Parcela 03/10')
  })

  it("trata o apóstrofo: D'AVILA e DONALD'S", () => {
    expect(caixaDeTitulo("PADARIA D'AVILA")).toBe("Padaria D'Avila")
    expect(caixaDeTitulo("DONALD'S")).toBe("Donald's")
  })

  it('preserva os espaços e o texto vazio', () => {
    expect(caixaDeTitulo('')).toBe('')
    expect(caixaDeTitulo('POSTO  IPIRANGA')).toBe('Posto  Ipiranga')
  })
})

describe('nomeExibido', () => {
  it('mostra o rótulo do usuário como ele escreveu', () => {
    expect(nomeExibido({ label: 'NETFLIX DA FAMÍLIA', description: 'NETFLIX.COM' })).toBe('NETFLIX DA FAMÍLIA')
  })

  it('sem rótulo, mostra a descrição em caixa de título', () => {
    expect(nomeExibido({ label: null, description: 'NETFLIX.COM' })).toBe('Netflix.com')
  })
})
