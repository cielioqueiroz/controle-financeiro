import { describe, it, expect } from 'vitest'
import { gastosAtipicos, type TxAtipicavel } from './atipicos'

let seq = 0
function tx(over: Partial<TxAtipicavel> = {}): TxAtipicavel {
  seq += 1
  return {
    id: `t${seq}`,
    date: '2026-06-10',
    competencia: '2026-06',
    description: `MERCADO ${seq}`,
    label: null,
    amount_cents: 10000,
    kind: 'expense',
    category_slug: 'supermercado',
    installment: null,
    ...over,
  }
}

/** Cinco compras de R$ 100 em supermercado, em lojas diferentes. */
const rotina = () => Array.from({ length: 5 }, (_, i) => tx({ description: `MERCADO BAIRRO ${i}` }))

describe('gastosAtipicos', () => {
  it('a compra de 5× a mediana da categoria, e acima do piso, é atípica', () => {
    const grande = tx({ description: 'ATACADAO', amount_cents: 80000 })
    const recorte = [...rotina(), grande]
    expect(gastosAtipicos(recorte, recorte)).toEqual([grande])
  })

  it('abaixo de 5× a mediana não é atípica', () => {
    const recorte = [...rotina(), tx({ amount_cents: 40000 })]
    expect(gastosAtipicos(recorte, recorte)).toEqual([])
  })

  it('abaixo do piso de R$ 300 não é atípica, por maior que seja a proporção', () => {
    const farmacia = Array.from({ length: 5 }, (_, i) =>
      tx({ description: `DROGARIA ${i}`, category_slug: 'farmacia', amount_cents: 1000 }))
    const recorte = [...farmacia, tx({ description: 'DROGARIA X', category_slug: 'farmacia', amount_cents: 25000 })]
    expect(gastosAtipicos(recorte, recorte)).toEqual([])
  })

  it('com menos de cinco outras compras na categoria, cala', () => {
    const poucas = rotina().slice(0, 4)
    const recorte = [...poucas, tx({ amount_cents: 80000 })]
    expect(gastosAtipicos(recorte, recorte)).toEqual([])
  })

  it('a régua é o histórico, e o resultado é só do recorte', () => {
    const passado = rotina().map((t) => ({ ...t, competencia: '2026-05', date: '2026-05-10' }))
    const grande = tx({ amount_cents: 80000 })
    expect(gastosAtipicos([grande], [...passado, grande])).toEqual([grande])
    expect(gastosAtipicos([], [...passado, grande])).toEqual([])
  })

  it('parcela, dívida, estorno, entrada e vínculo nunca são atípicos', () => {
    const fora = [
      tx({ amount_cents: 80000, installment: { current: 1, total: 10 } }),
      tx({ amount_cents: 4165385, category_slug: 'dividas' }),
      tx({ amount_cents: -80000 }),
      tx({ amount_cents: -80000, kind: 'income' }),
      tx({ amount_cents: 80000, kind: 'card_payment' }),
    ]
    const recorte = [...rotina(), ...fora]
    expect(gastosAtipicos(recorte, recorte)).toEqual([])
  })

  it('recorrência não é atípica: o aluguel é rotina, por maior que seja', () => {
    const material = Array.from({ length: 5 }, (_, i) =>
      tx({ description: `MATERIAL ${i}`, category_slug: 'moradia', amount_cents: 5000 }))
    const aluguel = ['2026-04', '2026-05', '2026-06'].map((c) =>
      tx({ description: 'ALUGUEL APTO', category_slug: 'moradia', amount_cents: 200000, competencia: c, date: `${c}-05` }))
    const historico = [...material, ...aluguel]
    expect(gastosAtipicos(historico, historico)).toEqual([])
  })

  it('a parcela e a dívida não entram na régua da categoria', () => {
    // Com as parcelas de R$ 800 na régua, a mediana subiria e a compra
    // grande deixaria de ser atípica.
    const parcelas = Array.from({ length: 6 }, (_, i) =>
      tx({ description: 'TV', amount_cents: 80000, installment: { current: i + 1, total: 10 } }))
    const grande = tx({ description: 'ATACADAO', amount_cents: 80000 })
    const recorte = [...rotina(), ...parcelas, grande]
    expect(gastosAtipicos(recorte, recorte)).toEqual([grande])
  })
})
