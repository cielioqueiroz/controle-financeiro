import { describe, it, expect } from 'vitest'
import {
  faturasQuitadas,
  type FaturaParaQuitacao,
  type PagamentoParaQuitacao,
} from './quitacao'

const NUBANK: FaturaParaQuitacao = { id: 'f-nu', declared_total: 832424, period_end: '2026-06-20' }
const BRADESCO: FaturaParaQuitacao = { id: 'f-bra', declared_total: 552944, period_end: '2026-06-10' }

const pg = (over: Partial<PagamentoParaQuitacao>): PagamentoParaQuitacao => ({
  id: 'p1',
  date: '2026-06-20',
  amount_cents: -832424,
  kind: 'card_payment',
  ...over,
})

describe('faturasQuitadas', () => {
  it('marca a fatura cujo total bate com um pagamento', () => {
    expect(faturasQuitadas([NUBANK], [pg({})])).toEqual(new Set(['f-nu']))
  })

  it('casa independente do sinal do lançamento', () => {
    expect(faturasQuitadas([NUBANK], [pg({ amount_cents: 832424 })])).toEqual(new Set(['f-nu']))
  })

  it('não marca quando não há pagamento de valor igual', () => {
    expect(faturasQuitadas([NUBANK], [pg({ amount_cents: -1000 })])).toEqual(new Set())
  })

  it('ignora lançamentos que não são pagamento de fatura', () => {
    expect(faturasQuitadas([NUBANK], [pg({ kind: 'expense' })])).toEqual(new Set())
  })

  it('um pagamento quita uma só fatura, e é a que casa exatamente', () => {
    // Mesmo valor, meses diferentes. O pagamento cai em 20/jun — o
    // vencimento EXATO da de junho. Asseverar só `size === 1` deixaria passar
    // a implementação que dá o pagamento para a de maio (que já foi um bug
    // real aqui): o teste tem que nomear a fatura certa.
    const gemea: FaturaParaQuitacao = { id: 'f-gemea', declared_total: 832424, period_end: '2026-05-20' }
    expect(faturasQuitadas([NUBANK, gemea], [pg({})])).toEqual(new Set(['f-nu']))
  })

  it('dois pagamentos iguais quitam as duas faturas de mesmo valor', () => {
    const gemea: FaturaParaQuitacao = { id: 'f-gemea', declared_total: 832424, period_end: '2026-05-20' }
    const pagamentos = [pg({ id: 'p-jun', date: '2026-06-20' }), pg({ id: 'p-mai', date: '2026-05-20' })]
    expect(faturasQuitadas([NUBANK, gemea], pagamentos)).toEqual(
      new Set(['f-nu', 'f-gemea']),
    )
  })

  it('uma fatura não é quitada duas vezes pelo mesmo valor pago em dobro', () => {
    const pagamentos = [pg({ id: 'p1' }), pg({ id: 'p2' })]
    expect(faturasQuitadas([NUBANK], pagamentos)).toEqual(new Set(['f-nu']))
  })

  it('entre faturas de mesmo total, quita a mais próxima do pagamento', () => {
    const maio: FaturaParaQuitacao = { id: 'f-maio', declared_total: 832424, period_end: '2026-05-20' }
    // Pagamento em 21/mai casa com a de maio, não com a de junho.
    const r = faturasQuitadas([NUBANK, maio], [pg({ date: '2026-05-21' })])
    expect(r).toEqual(new Set(['f-maio']))
  })

  it('pagamento fora da janela de 45 dias não quita', () => {
    const r = faturasQuitadas([NUBANK], [pg({ date: '2024-01-15' })])
    expect(r).toEqual(new Set())
  })

  it('duas faturas de bancos diferentes, dois pagamentos', () => {
    const pagamentos = [
      pg({ id: 'p1', amount_cents: -832424, date: '2026-06-20' }),
      pg({ id: 'p2', amount_cents: -552944, date: '2026-06-10' }),
    ]
    expect(faturasQuitadas([NUBANK, BRADESCO], pagamentos)).toEqual(
      new Set(['f-nu', 'f-bra']),
    )
  })

  it('ignora fatura sem total declarado ou sem period_end', () => {
    const semTotal: FaturaParaQuitacao = { id: 'x', declared_total: null, period_end: '2026-06-20' }
    const semData: FaturaParaQuitacao = { id: 'y', declared_total: 832424, period_end: null }
    expect(faturasQuitadas([semTotal, semData], [pg({})])).toEqual(new Set())
  })

  it('é determinístico: a ordem da entrada não muda o resultado', () => {
    const maio: FaturaParaQuitacao = { id: 'f-maio', declared_total: 832424, period_end: '2026-05-20' }
    const a = faturasQuitadas([NUBANK, maio], [pg({ date: '2026-05-21' })])
    const b = faturasQuitadas([maio, NUBANK], [pg({ date: '2026-05-21' })])
    expect(a).toEqual(b)
  })
})
