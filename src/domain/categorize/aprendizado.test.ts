import { describe, it, expect } from 'vitest'
import { categoriaDe, REGRAS_GLOBAIS } from './regras'
import { regraDaCorrecao, mesclarRegras } from './aprendizado'
import type { RawTransaction } from '../parsers/types'

const tx = (description: string): RawTransaction => ({
  date: new Date(2026, 5, 1),
  description,
  amountCents: 1000,
  installment: null,
  card: null,
  fx: null,
  kind: 'compra',
  raw: description,
})

describe('aprendizado por correção', () => {
  it('uma correção passa a categorizar ocorrências futuras', () => {
    const t = tx('Mp *Cristilene')
    expect(categoriaDe(t)).toBe('outros') // antes: desconhecido

    const regra = regraDaCorrecao(t, 'padaria') // usuário diz: é a padaria da Cris
    const regras = mesclarRegras([regra], REGRAS_GLOBAIS)

    // Mesma loja, outra ocorrência → já categorizada
    expect(categoriaDe(tx('Mp *Cristilene'), regras)).toBe('padaria')
  })

  it('a regra do usuário vence a global', () => {
    const t = tx('Ofertao Supermercado') // global: supermercado
    const regra = regraDaCorrecao(t, 'padaria')
    const regras = mesclarRegras([regra], REGRAS_GLOBAIS)
    expect(categoriaDe(t, regras)).toBe('padaria')
  })

  it('usa CNPJ quando disponível (chave estável)', () => {
    const t = tx('IFOOD ... - 14.380.200/0001-21 - ITAU')
    const regra = regraDaCorrecao(t, 'delivery')
    expect(regra.tipo).toBe('cnpj')
    expect(regra.padrao).toBe('14380200000121')
  })

  it('uma correção nova substitui a anterior do mesmo padrão', () => {
    const t = tx('Mp *Cristilene')
    const r1 = regraDaCorrecao(t, 'padaria')
    const r2 = regraDaCorrecao(t, 'supermercado')
    const regras = mesclarRegras([r2, r1], REGRAS_GLOBAIS)
    expect(categoriaDe(t, regras)).toBe('supermercado') // a mais recente (primeira na lista)
  })
})
