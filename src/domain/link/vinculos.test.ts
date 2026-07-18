import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parse } from '../parsers'
import { vincular, paraVincular, gastoReal, type DocParaVincular } from './vinculos'
import type { TextItem } from '../pdf/types'

function carregar(): DocParaVincular[] {
  const specs: Array<[string, 'fatura' | 'extrato']> = [
    ['nubank-fatura', 'fatura'],
    ['nubank-extrato', 'extrato'],
    ['bradesco-fatura', 'fatura'],
    ['bradesco-extrato', 'extrato'],
  ]
  return specs.map(([f, docType]) => {
    const lines = buildLines(
      JSON.parse(readFileSync(`tests/fixtures/${f}.items.json`, 'utf-8')) as TextItem[],
    )
    const { result } = parse(lines)
    return paraVincular(result, `${f}`, docType)
  })
}

const docs = carregar()
const linked = vincular(docs)

describe('vincular — pagamento de fatura vira quitação', () => {
  it('o pagamento de 8.324,24 no extrato Nubank liga à fatura Nubank', () => {
    const pag = linked.find(
      (t) => Math.abs(t.amountCents) === 832424 && /Pagamento de fatura/i.test(t.description),
    )
    expect(pag).toBeDefined()
    expect(pag!.link).toBe('card_payment')
  })

  it('o GASTOS CARTAO de 5.529,44 no extrato Bradesco liga à fatura Bradesco', () => {
    const pag = linked.find(
      (t) => Math.abs(t.amountCents) === 552944 && /GASTOS CARTAO/i.test(t.description),
    )
    expect(pag).toBeDefined()
    expect(pag!.link).toBe('card_payment')
  })
})

describe('vincular — transferências entre contas próprias', () => {
  it('os PIX de 5.300 e 3.000 para o próprio titular viram transferência interna', () => {
    const grandes = linked.filter(
      (t) =>
        (Math.abs(t.amountCents) === 530000 || Math.abs(t.amountCents) === 300000) &&
        t.link === 'internal_transfer',
    )
    // Aparecem no Bradesco (enviado) e no Nubank (recebido) = 4 lados
    expect(grandes.length).toBeGreaterThanOrEqual(2)
  })
})

describe('vincular — o gasto real não conta o dinheiro duas vezes', () => {
  it('exclui pagamentos de fatura e transferências internas do total', () => {
    const real = gastoReal(linked)

    // Soma ingênua de todas as saídas (o número inflado)
    const ingenuo = linked
      .filter((t) => t.amountCents > 0)
      .reduce((a, t) => a + t.amountCents, 0)

    // O gasto real é significativamente menor que a soma ingênua, porque
    // remove os pagamentos de fatura (8.324,24 + 5.529,44) e as
    // transferências internas.
    expect(real).toBeLessThan(ingenuo)
    expect(ingenuo - real).toBeGreaterThan(1300000) // > R$ 13 mil de dupla contagem removida
  })

  it('nenhum pagamento de fatura sobra no gasto real', () => {
    const real = linked.filter((t) => t.link === null && t.amountCents > 0)
    expect(real.some((t) => /Pagamento de fatura|GASTOS CARTAO/i.test(t.description))).toBe(false)
  })
})
