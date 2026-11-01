import { describe, it, expect } from 'vitest'
import { faturasPagasAMenor, type DocParaQuitacao, type TxQuitacaoParcial } from './quitacao-parcial'

const fatura = (over: Partial<DocParaQuitacao> = {}): DocParaQuitacao => ({
  id: 'fat-jun',
  bank: 'nubank',
  account_id: 'cartao-nu',
  doc_type: 'fatura',
  period_end: '2026-06-10',
  declared_total: 200000,
  ...over,
})

const extrato = (over: Partial<DocParaQuitacao> = {}): DocParaQuitacao => ({
  id: 'ext-jun',
  bank: 'bradesco',
  account_id: 'conta-bra',
  doc_type: 'extrato',
  period_end: '2026-06-30',
  declared_total: null,
  ...over,
})

const pagamento = (over: Partial<TxQuitacaoParcial> = {}): TxQuitacaoParcial => ({
  date: '2026-06-10',
  amount_cents: 80000,
  kind: 'card_payment',
  doc_type: 'extrato',
  document_id: 'ext-jun',
  vinculo_document_id: null,
  ...over,
})

// Auditoria de 30/10, itens 1.6 e 2.3: a quitação só ganha evidência com o
// valor inteiro (ADR-0021). Pagar parte da fatura não gerava aviso nenhum, e
// o resto ia para o rotativo, com juros na fatura seguinte.
describe('faturasPagasAMenor', () => {
  it('acusa a fatura cujo pagamento do extrato ficou abaixo do total', () => {
    expect(faturasPagasAMenor([pagamento()], [fatura(), extrato()])).toEqual([
      {
        faturaId: 'fat-jun',
        bank: 'nubank',
        vencimento: '2026-06-10',
        competencia: '2026-06',
        totalCents: 200000,
        pagoCents: 80000,
        restanteCents: 120000,
        fonte: 'extrato',
      },
    ])
  })

  it('soma dois pagamentos parciais da mesma fatura', () => {
    const achados = faturasPagasAMenor(
      [pagamento({ amount_cents: 50000 }), pagamento({ date: '2026-06-12', amount_cents: 60000 })],
      [fatura(), extrato()],
    )
    expect(achados.map((a) => [a.pagoCents, a.restanteCents])).toEqual([[110000, 90000]])
  })

  it('cala quando os pagamentos somam o total', () => {
    const txs = [pagamento({ amount_cents: 150000 }), pagamento({ date: '2026-06-05', amount_cents: 50000 })]
    expect(faturasPagasAMenor(txs, [fatura(), extrato()])).toEqual([])
  })

  it('cala quando a fatura já tem quitação reconhecida', () => {
    const txs = [
      pagamento({ amount_cents: 200000, vinculo_document_id: 'fat-jun' }),
      pagamento({ amount_cents: 1000 }),
    ]
    expect(faturasPagasAMenor(txs, [fatura(), extrato()])).toEqual([])
  })

  // Sem pagamento nenhum nos documentos, o app não sabe se a conta que
  // pagou foi importada. Silêncio, e não "você não pagou".
  it('cala quando não acha pagamento nenhum', () => {
    expect(faturasPagasAMenor([], [fatura(), extrato()])).toEqual([])
  })

  // A pergunta que o pagamento no rodapé da fatura seguinte responde melhor
  // que o extrato: é o mesmo cartão dizendo quanto recebeu.
  it('lê o pagamento registrado na fatura seguinte do mesmo cartão', () => {
    const docs = [fatura(), fatura({ id: 'fat-jul', period_end: '2026-07-10', declared_total: 300000 })]
    const txs = [pagamento({ doc_type: 'fatura', document_id: 'fat-jul', amount_cents: -90000, date: '2026-06-09' })]
    expect(faturasPagasAMenor(txs, docs)).toEqual([
      expect.objectContaining({ faturaId: 'fat-jun', pagoCents: 90000, restanteCents: 110000, fonte: 'fatura' }),
    ])
  })

  // Quando os dois existem, o extrato repetiria o mesmo dinheiro.
  it('prefere a fatura seguinte e não soma o extrato junto', () => {
    const docs = [fatura(), fatura({ id: 'fat-jul', period_end: '2026-07-10' }), extrato()]
    const txs = [
      pagamento({ doc_type: 'fatura', document_id: 'fat-jul', amount_cents: -90000, date: '2026-06-09' }),
      pagamento({ amount_cents: 90000, date: '2026-06-09' }),
    ]
    expect(faturasPagasAMenor(txs, docs).map((a) => a.pagoCents)).toEqual([90000])
  })

  it('não lê pagamento de outro cartão como sendo deste', () => {
    const docs = [fatura(), fatura({ id: 'fat-bra', bank: 'bradesco', account_id: 'cartao-bra', period_end: '2026-07-10' })]
    const txs = [pagamento({ doc_type: 'fatura', document_id: 'fat-bra', amount_cents: -90000, date: '2026-06-09' })]
    expect(faturasPagasAMenor(txs, docs)).toEqual([])
  })

  it('não lê o pagamento que está dentro da própria fatura', () => {
    const txs = [pagamento({ doc_type: 'fatura', document_id: 'fat-jun', amount_cents: -90000, date: '2026-06-05' })]
    expect(faturasPagasAMenor(txs, [fatura()])).toEqual([])
  })

  // Mesma regra de unicidade da 0009: com duas faturas em aberto na janela,
  // não dá para saber qual delas o pagamento do extrato quis pagar.
  it('cala quando o pagamento do extrato cabe em duas faturas', () => {
    const docs = [
      fatura(),
      fatura({ id: 'fat-bra', bank: 'bradesco', account_id: 'cartao-bra', period_end: '2026-06-12' }),
      extrato(),
    ]
    expect(faturasPagasAMenor([pagamento()], docs)).toEqual([])
  })

  it('não conta como concorrente a fatura que já foi quitada inteira', () => {
    const docs = [
      fatura(),
      fatura({ id: 'fat-bra', bank: 'bradesco', account_id: 'cartao-bra', period_end: '2026-06-12', declared_total: 50000 }),
      extrato(),
    ]
    const txs = [pagamento(), pagamento({ amount_cents: 50000, vinculo_document_id: 'fat-bra' })]
    expect(faturasPagasAMenor(txs, docs).map((a) => a.faturaId)).toEqual(['fat-jun'])
  })

  // O extrato que termina antes do vencimento pode não ter o resto do
  // pagamento ainda. Acusar ali seria acusar o que não se sabe.
  it('cala quando o extrato do pagamento termina antes do vencimento', () => {
    expect(faturasPagasAMenor([pagamento({ date: '2026-06-06' })], [fatura(), extrato({ period_end: '2026-06-08' })]))
      .toEqual([])
  })

  it('ignora pagamento longe do vencimento', () => {
    expect(faturasPagasAMenor([pagamento({ date: '2026-06-18' })], [fatura(), extrato()])).toEqual([])
    expect(faturasPagasAMenor([pagamento({ date: '2026-05-25' })], [fatura(), extrato()])).toEqual([])
  })

  // Pagar adiantado, depois do fechamento e antes do vencimento, é comum. A
  // janela antes do vencimento é mais larga que a de depois por isso.
  it('aceita pagamento adiantado depois do fechamento', () => {
    expect(faturasPagasAMenor([pagamento({ date: '2026-05-28' })], [fatura(), extrato()]))
      .toHaveLength(1)
  })

  it('ignora fatura sem total declarado', () => {
    expect(faturasPagasAMenor([pagamento()], [fatura({ declared_total: null }), extrato()])).toEqual([])
  })
})
