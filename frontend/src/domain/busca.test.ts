import { describe, it, expect } from 'vitest'
import { buscar, type TxBuscavel } from './busca'

const tx = (over: Partial<TxBuscavel>): TxBuscavel => ({
  description: 'DROGARIA SAO PAULO',
  label: null,
  category_slug: 'farmacia',
  amount_cents: 5000,
  bank: 'nubank',
  kind: 'expense',
  ...over,
})

describe('buscar', () => {
  const lista = [
    tx({ description: 'DROGARIA SAO PAULO', category_slug: 'farmacia' }),
    tx({ description: 'UBER TRIP', category_slug: 'transporte' }),
    tx({ description: 'DROGASIL', category_slug: 'farmacia' }),
  ]

  it('filtra por texto', () => {
    expect(buscar(lista, 'droga', null)).toHaveLength(2)
  })

  it('filtra por categoria', () => {
    expect(buscar(lista, '', 'transporte')).toHaveLength(1)
  })

  it('combina texto e categoria', () => {
    expect(buscar(lista, 'droga', 'transporte')).toHaveLength(0)
    expect(buscar(lista, 'drogasil', 'farmacia')).toHaveLength(1)
  })

  it('sem filtro nenhum devolve tudo, na mesma ordem', () => {
    expect(buscar(lista, '', null)).toEqual(lista)
  })

  it('categoria nula em transação conta como "outros"', () => {
    const semCat = [tx({ description: 'X', category_slug: null })]
    expect(buscar(semCat, '', 'outros')).toHaveLength(1)
    expect(buscar(semCat, '', 'farmacia')).toHaveLength(0)
  })

  it('os operadores chegam pela mesma porta que o texto', () => {
    // O ponto de integração: é `buscar` que a barra de filtros chama, e é
    // aqui que a consulta com operador tem que valer tanto quanto a antiga.
    const comValores = [
      tx({ description: 'ATACADAO', amount_cents: 15000, bank: 'nubank' }),
      tx({ description: 'ATACADAO', amount_cents: 2000, bank: 'nubank' }),
      tx({ description: 'ATACADAO', amount_cents: 15000, bank: 'bradesco' }),
    ]
    expect(buscar(comValores, 'atacadao >100', null)).toHaveLength(2)
    expect(buscar(comValores, 'atacadao >100 banco:bradesco', null)).toHaveLength(1)
  })

  it('sem:categoria convive com o seletor de categoria', () => {
    const mistas = [
      tx({ description: 'A', category_slug: null }),
      tx({ description: 'B', category_slug: 'farmacia' }),
    ]
    expect(buscar(mistas, 'sem:categoria', null)).toHaveLength(1)
    // O seletor manda junto: pedir farmácia E sem categoria não devolve nada,
    // e é o resultado correto — não um bug de filtro invisível.
    expect(buscar(mistas, 'sem:categoria', 'farmacia')).toHaveLength(0)
  })

  it('não muta a lista recebida', () => {
    const copia = [...lista]
    buscar(lista, 'droga', null)
    expect(lista).toEqual(copia)
  })
})
