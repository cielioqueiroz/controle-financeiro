import { describe, it, expect } from 'vitest'
import { comprometimentoDeRenda, type TxComprometimento } from './comprometimento'

const tx = (over: Partial<TxComprometimento> = {}): TxComprometimento => ({
  amount_cents: 10000,
  kind: 'expense',
  category_slug: 'supermercado',
  installment: null,
  ...over,
})

const salario = tx({ amount_cents: -500000, kind: 'income', category_slug: null })
const parcela = (amount_cents: number) => tx({ amount_cents, category_slug: 'eletronicos', installment: { current: 3, total: 10 } })
const emprestimo = (amount_cents: number) => tx({ amount_cents, category_slug: 'dividas' })

// Auditoria de 30/10, item 2.3: (parcelas + dívidas) ÷ entradas do mês.
describe('comprometimentoDeRenda', () => {
  it('soma parcelas e dívidas e divide pelas entradas', () => {
    expect(comprometimentoDeRenda([salario, parcela(50000), emprestimo(70000), tx()])).toEqual({
      parcelasCents: 50000,
      dividasCents: 70000,
      entradasCents: 500000,
      pct: 0.24,
      faixa: 'saudavel',
    })
  })

  it.each([
    [150000, 'saudavel'],
    [150001, 'atencao'],
    [200000, 'atencao'],
    [200001, 'elevado'],
  ] as const)('%i de 500000 cai na faixa %s', (cents, faixa) => {
    expect(comprometimentoDeRenda([salario, emprestimo(cents)])?.faixa).toBe(faixa)
  })

  // A parcela de um empréstimo pode vir com número de parcela. Ela é uma
  // dívida, e contá-la nas duas somas dobraria o número.
  it('não conta duas vezes a dívida parcelada', () => {
    const c = comprometimentoDeRenda([salario, tx({ amount_cents: 70000, category_slug: 'dividas', installment: { current: 2, total: 24 } })])
    expect(c).toMatchObject({ parcelasCents: 0, dividasCents: 70000 })
  })

  it('compra à vista não compromete nada', () => {
    expect(comprometimentoDeRenda([salario, tx({ amount_cents: 300000 })])).toMatchObject({ pct: 0 })
  })

  // Sem entrada no recorte não há renda a comprometer. Zero por cento
  // seria um número inventado — a tela não mostra nada.
  it('sem entradas devolve null', () => {
    expect(comprometimentoDeRenda([parcela(50000), emprestimo(70000)])).toBeNull()
  })

  it('vínculo não é dívida nem entrada', () => {
    const c = comprometimentoDeRenda([
      salario,
      tx({ amount_cents: 400000, kind: 'card_payment', category_slug: 'transferencia' }),
      tx({ amount_cents: -400000, kind: 'internal_transfer', category_slug: 'transferencia' }),
    ])
    expect(c).toMatchObject({ parcelasCents: 0, dividasCents: 0, entradasCents: 500000 })
  })

  it('estorno de parcela abate', () => {
    expect(comprometimentoDeRenda([salario, parcela(50000), parcela(-50000)])).toMatchObject({ parcelasCents: 0 })
  })
})
