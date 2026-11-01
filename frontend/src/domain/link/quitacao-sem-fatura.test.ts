import { describe, it, expect } from 'vitest'
import { quitacoesSemFatura, type TxQuitacao } from './quitacao-sem-fatura'

const tx = (over: Partial<TxQuitacao> = {}): TxQuitacao => ({
  amount_cents: 150000,
  kind: 'card_payment',
  doc_type: 'extrato',
  vinculo_document_id: null,
  ...over,
})

// Auditoria de 30/10, item 1.5: com só o extrato importado, a quitação sai
// da soma (certo, contra a dupla contagem), mas as compras daquela fatura
// também não estão nela. O gasto real fica menor, e a tela não dizia nada.
describe('quitacoesSemFatura', () => {
  it('soma a quitação do extrato que não achou a fatura', () => {
    expect(quitacoesSemFatura([tx(), tx({ amount_cents: 50000 })]))
      .toEqual({ contagem: 2, totalCents: 200000 })
  })

  it('ignora a quitação que achou a fatura', () => {
    expect(quitacoesSemFatura([tx({ vinculo_document_id: 'fatura-1' })]))
      .toEqual({ contagem: 0, totalCents: 0 })
  })

  // O pagamento lançado dentro da própria fatura não esconde compra
  // nenhuma: as compras estão naquele documento.
  it('ignora o pagamento registrado na fatura', () => {
    expect(quitacoesSemFatura([tx({ doc_type: 'fatura' })]).contagem).toBe(0)
  })

  it('ignora o que não é quitação', () => {
    expect(quitacoesSemFatura([
      tx({ kind: 'expense' }),
      tx({ kind: 'internal_transfer' }),
      tx({ kind: 'income', amount_cents: -150000 }),
    ]).contagem).toBe(0)
  })

  it('sem o campo de evidência conta como sem fatura', () => {
    const { vinculo_document_id: _, ...semCampo } = tx()
    expect(quitacoesSemFatura([semCampo]).contagem).toBe(1)
  })
})
