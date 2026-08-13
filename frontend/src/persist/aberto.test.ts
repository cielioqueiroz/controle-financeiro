import { describe, it, expect } from 'vitest'
import { faturasAbertas, type DocParaAberto } from './aberto'

const base: DocParaAberto = {
  bank: 'nubank',
  account_id: 'c1',
  doc_type: 'fatura',
  period_end: '2026-06-20',
  total_open_balance: 268823,
  next_invoice_balance: 127016,
  next_close_date: '2026-07-20',
  future_installments_total: null,
}

describe('faturasAbertas', () => {
  it('escolhe a fatura de maior period_end por conta', () => {
    const docs: DocParaAberto[] = [
      { ...base, period_end: '2026-05-20', total_open_balance: 100000 },
      { ...base, period_end: '2026-06-20', total_open_balance: 268823 },
    ]
    expect(faturasAbertas(docs)).toEqual([
      {
        accountId: 'c1',
        bank: 'nubank',
        abertoCents: 268823,
        proximaCents: 127016,
        futurasCents: null,
        proximoFechamento: '2026-07-20',
        date: '2026-06-20',
      },
    ])
  })

  it('ignora extratos (só fatura declara saldo em aberto)', () => {
    expect(faturasAbertas([{ ...base, doc_type: 'extrato' }])).toEqual([])
  })

  it('ignora fatura que não declara NADA olhando para a frente', () => {
    expect(
      faturasAbertas([
        { ...base, total_open_balance: null, future_installments_total: null },
      ]),
    ).toEqual([])
  })

  // O Bradesco não declara saldo em aberto — a fatura dele não traz o quanto
  // já foi gasto no ciclo que ainda vai fechar. Exigir esse campo o deixava
  // fora da fileira INTEIRA, e a tela mostrava "em aberto" só do Nubank, sem
  // nada explicando a ausência do outro. Ele declara o total das próximas
  // faturas, que é outro número — e entra com o rótulo dele.
  it('aceita fatura que declara só o total das próximas faturas (Bradesco)', () => {
    const bradesco: DocParaAberto = {
      bank: 'bradesco',
      account_id: 'b1',
      doc_type: 'fatura',
      period_end: '2026-06-28',
      total_open_balance: null,
      next_invoice_balance: null,
      next_close_date: '2026-07-16',
      future_installments_total: 557834,
    }
    expect(faturasAbertas([bradesco])).toEqual([
      {
        accountId: 'b1',
        bank: 'bradesco',
        abertoCents: null,
        proximaCents: null,
        futurasCents: 557834,
        proximoFechamento: '2026-07-16',
        date: '2026-06-28',
      },
    ])
  })

  it('ignora fatura sem period_end (não há como saber qual é a mais nova)', () => {
    expect(faturasAbertas([{ ...base, period_end: null }])).toEqual([])
  })

  it('aceita fatura sem próximo fechamento (Bradesco não declara)', () => {
    const docs: DocParaAberto[] = [
      { ...base, next_invoice_balance: null, next_close_date: null },
    ]
    expect(faturasAbertas(docs)[0]).toMatchObject({
      abertoCents: 268823,
      proximaCents: null,
      proximoFechamento: null,
    })
  })

  it('uma linha por conta, várias contas coexistem', () => {
    const docs: DocParaAberto[] = [
      { ...base, account_id: 'c1', bank: 'nubank' },
      { ...base, account_id: 'c2', bank: 'bradesco' },
    ]
    expect(faturasAbertas(docs)).toHaveLength(2)
  })

  it('agrupa por banco quando a fatura não tem account_id', () => {
    const docs: DocParaAberto[] = [
      { ...base, account_id: null, bank: 'nubank', period_end: '2026-05-20' },
      { ...base, account_id: null, bank: 'nubank', period_end: '2026-06-20' },
    ]
    const r = faturasAbertas(docs)
    expect(r).toHaveLength(1)
    expect(r[0].date).toBe('2026-06-20')
  })
})
