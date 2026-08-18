import { describe, it, expect } from 'vitest'
import { categoriaDe, REGRAS_GLOBAIS } from './regras'
import { regraDaCorrecao, mesclarRegras, alcancadasPelaRegra } from './aprendizado'
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

describe('alcancadasPelaRegra — a correção alcança o histórico já salvo', () => {
  const salva = (id: string, description: string, category_slug: string | null, label: string | null = null) => ({
    id,
    description,
    label,
    category_slug,
  })

  it('acha as outras ocorrências já gravadas do mesmo estabelecimento', () => {
    const regra = regraDaCorrecao(tx('Atacadao Palmas'), 'supermercado')
    const historico = [
      salva('1', 'Atacadao Palmas', 'outros'),
      salva('2', 'Atacadao Palmas', 'outros'),
      salva('3', 'Farmacia Bom Preco', 'farmacia'),
    ]
    expect(alcancadasPelaRegra(regra, historico, '1').map((t) => t.id)).toEqual(['2'])
  })

  it('não devolve a transação que está sendo editada', () => {
    const regra = regraDaCorrecao(tx('Atacadao Palmas'), 'supermercado')
    const historico = [salva('1', 'Atacadao Palmas', 'outros')]
    expect(alcancadasPelaRegra(regra, historico, '1')).toEqual([])
  })

  it('ignora quem JÁ está na categoria certa — nada a corrigir', () => {
    const regra = regraDaCorrecao(tx('Atacadao Palmas'), 'supermercado')
    const historico = [
      salva('2', 'Atacadao Palmas', 'supermercado'),
      salva('3', 'Atacadao Palmas', 'outros'),
    ]
    expect(alcancadasPelaRegra(regra, historico, '1').map((t) => t.id)).toEqual(['3'])
  })

  it('a regra aprendida é ESTREITA: outra loja da rede não é alcançada', () => {
    // normalizeMerchant não descarta a cidade, então a chave de "Atacadao
    // Palmas" não casa com "Atacadao Araguaina". É de propósito: reclassificar
    // em massa a loja de outra cidade seria supor mais do que o usuário disse.
    const regra = regraDaCorrecao(tx('Atacadao Palmas'), 'supermercado')
    const historico = [salva('2', 'Atacadao Araguaina', 'outros')]
    expect(alcancadasPelaRegra(regra, historico, '1')).toEqual([])
  })

  it('regra por CNPJ alcança mesmo com a descrição escrita diferente', () => {
    const regra = regraDaCorrecao(tx('IFOOD *PEDIDO - 14.380.200/0001-21 - ITAU'), 'delivery')
    expect(regra.tipo).toBe('cnpj')
    const historico = [salva('2', 'IFD CLUB 14380200000121 SAO PAULO', 'outros')]
    expect(alcancadasPelaRegra(regra, historico, '1').map((t) => t.id)).toEqual(['2'])
  })

  it('casa pela DESCRIÇÃO do banco, nunca pelo rótulo do usuário', () => {
    // CONTEXT.md: renomear uma compra não pode partir um grupo em dois — nem
    // juntar dois que o banco escreveu diferente.
    const regra = regraDaCorrecao(tx('Mp *Cristilene'), 'padaria')
    const historico = [
      salva('2', 'Mp *Cristilene', 'outros', 'Padaria da Cris'),
      salva('3', 'Posto Ipiranga', 'outros', 'Mp *Cristilene'),
    ]
    expect(alcancadasPelaRegra(regra, historico, '1').map((t) => t.id)).toEqual(['2'])
  })
})
