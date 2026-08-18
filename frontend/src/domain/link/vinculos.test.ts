import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parse } from '../parsers'
import { vincular, paraVincular, gastoReal, type DocParaVincular, ehVinculo, kindComVinculo } from './vinculos'
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

describe('vínculo marcado à mão pelo usuário', () => {
  it('reconhece os dois vínculos, e só eles', () => {
    expect(ehVinculo('internal_transfer')).toBe(true)
    expect(ehVinculo('card_payment')).toBe(true)
    expect(ehVinculo('expense')).toBe(false)
    expect(ehVinculo('income')).toBe(false)
  })

  it('marcar grava internal_transfer, seja saída ou entrada', () => {
    expect(kindComVinculo(true, 12300)).toBe('internal_transfer')
    expect(kindComVinculo(true, -12300)).toBe('internal_transfer')
  })

  it('desmarcar devolve o kind pelo SINAL do valor', () => {
    // Não dá para "lembrar" o kind anterior: a coluna guarda um valor só, e
    // o sinal é a única informação que sobrevive. Positivo saiu, negativo
    // entrou — é a mesma convenção de `kindParaBanco` na importação.
    expect(kindComVinculo(false, 12300)).toBe('expense')
    expect(kindComVinculo(false, -12300)).toBe('income')
  })

  it('desmarcar um card_payment devolve expense, não card_payment', () => {
    // Um falso positivo da heurística de quitação tem que ter volta. Os dois
    // vínculos são equivalentes rio abaixo (agrupar exclui os dois igual), e
    // linkNote nem é coluna — então nada se perde ao voltar por expense.
    expect(kindComVinculo(false, 45000)).toBe('expense')
  })
})
