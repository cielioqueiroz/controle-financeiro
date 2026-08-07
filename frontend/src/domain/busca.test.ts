import { describe, it, expect } from 'vitest'
import { normalizarBusca, casaTermo, buscar, type TxBuscavel } from './busca'

const tx = (over: Partial<TxBuscavel>): TxBuscavel => ({
  description: 'DROGARIA SAO PAULO',
  label: null,
  category_slug: 'farmacia',
  ...over,
})

describe('normalizarBusca', () => {
  it('tira acento e caixa', () => {
    expect(normalizarBusca('FARMÁCIA')).toBe('farmacia')
  })

  it('colapsa espaços e apara as pontas', () => {
    expect(normalizarBusca('  posto   ipiranga ')).toBe('posto ipiranga')
  })
})

describe('casaTermo', () => {
  it('casa ignorando acento e caixa nos dois lados', () => {
    expect(casaTermo(tx({ description: 'FARMÁCIA PAGUE MENOS' }), 'farmacia')).toBe(true)
    expect(casaTermo(tx({ description: 'FARMACIA PAGUE MENOS' }), normalizarBusca('Farmácia'))).toBe(
      true,
    )
  })

  it('casa por pedaço no meio da descrição', () => {
    expect(casaTermo(tx({}), 'sao paulo')).toBe(true)
  })

  it('enxerga o rótulo do usuário, não só a descrição do banco', () => {
    expect(casaTermo(tx({ description: 'PAG*JOAO', label: 'Pedreiro' }), 'pedreiro')).toBe(true)
  })

  it('continua achando pela descrição original depois de renomeada', () => {
    expect(casaTermo(tx({ description: 'PAG*JOAO', label: 'Pedreiro' }), 'pag*joao')).toBe(true)
  })

  it('termo vazio casa com tudo', () => {
    expect(casaTermo(tx({}), '')).toBe(true)
  })

  it('não casa o que não está lá', () => {
    expect(casaTermo(tx({}), 'uber')).toBe(false)
  })
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

  it('não muta a lista recebida', () => {
    const copia = [...lista]
    buscar(lista, 'droga', null)
    expect(lista).toEqual(copia)
  })
})
