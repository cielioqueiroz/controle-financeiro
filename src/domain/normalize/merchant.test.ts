import { describe, it, expect } from 'vitest'
import { normalizeMerchant } from './merchant'

describe('normalizeMerchant', () => {
  it('descasca a adquirente HNA e revela O Boticário', () => {
    expect(normalizeMerchant('Hna*Oboticario - Parcela 1/2')).toBe('OBOTICARIO')
  })

  it('descasca o Mercado Pago', () => {
    expect(normalizeMerchant('Mp *Cristilene')).toBe('CRISTILENE')
  })

  it('descasca a EBN e revela o Spotify', () => {
    expect(normalizeMerchant('EBN*SPOTIFY')).toBe('SPOTIFY')
  })

  it('descasca a Paygo', () => {
    expect(normalizeMerchant('Paygo*Ga Glesia Artes')).toBe('GA GLESIA ARTES')
  })

  it('remove parcela grudada do Bradesco', () => {
    expect(normalizeMerchant('ARAI KAMINISHI COS02/06')).toBe('ARAI KAMINISHI COS')
  })

  it('remove código de loja entre arrobas', () => {
    expect(normalizeMerchant('PAGUE MENOS @0756@ 02/03')).toBe('PAGUE MENOS')
  })

  it('remove acentos e normaliza caixa', () => {
    expect(normalizeMerchant('Panificadora Farturão')).toBe('PANIFICADORA FARTURAO')
  })

  it('mantém merchant simples intacto', () => {
    expect(normalizeMerchant('Ofertao Supermercado')).toBe('OFERTAO SUPERMERCADO')
  })

  it('colapsa espaços múltiplos', () => {
    expect(normalizeMerchant('MERCADO    JOSIAS')).toBe('MERCADO JOSIAS')
  })

  it('agrupa as duas grafias do Ofertão', () => {
    expect(normalizeMerchant('Ofertao Supermercado')).toBe('OFERTAO SUPERMERCADO')
    expect(normalizeMerchant('Supermercado Ofertao')).toBe('SUPERMERCADO OFERTAO')
  })
})
