import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseMercadoPagoFatura } from './mercadopago-fatura'
import { detectDocument } from '../pdf/detect'
import { validar } from '../validate/checksum'
import type { TextItem } from '../pdf/types'

const lines = buildLines(
  JSON.parse(readFileSync('tests/fixtures/mercadopago-fatura.items.json', 'utf-8')) as TextItem[],
)
const r = parseMercadoPagoFatura(lines)

describe('detecção do Mercado Pago', () => {
  it('reconhece a fatura', () => {
    expect(detectDocument(lines)).toEqual({ bank: 'mercadopago', docType: 'fatura' })
  })
})

describe('parseMercadoPagoFatura — gabarito', () => {
  it('lê o "Total" do Resumo da fatura, não o dos lançamentos futuros', () => {
    // A palavra "Total" aparece três vezes no documento, em páginas
    // diferentes: 621,34 (p.1 e 2) é a fatura; 711,89 (p.4) é o que ainda
    // vai vencer. Ler o segundo faria o gabarito conferir contra o número
    // errado — e conferir errado é pior que não conferir.
    expect(r.declaredTotal).toBe(62134)
  })

  it('a soma das compras fecha com o total declarado, ao centavo', () => {
    expect(validar(r).status).toBe('confere')
    expect(validar(r).diferenca).toBe(0)
  })

  it('extrai as nove linhas de consumo', () => {
    expect(r.transactions).toHaveLength(9)
  })
})

describe('parseMercadoPagoFatura — a data sem ano', () => {
  it('completa o ano a partir do fechamento', () => {
    const primeira = r.transactions[0]
    expect(primeira.date.getFullYear()).toBe(2026)
    expect(primeira.date.getMonth()).toBe(6) // julho
    expect(primeira.date.getDate()).toBe(16)
  })

  it('o período TERMINA no vencimento, não no fechamento', () => {
    // É daqui que sai a competência da fatura (ADR-0001): mês do
    // vencimento. O documento diz que fechou em 11/08 e vence em 17/08 —
    // gravar o fechamento jogaria a fatura para a competência errada
    // sempre que os dois caíssem em meses diferentes.
    expect(r.period!.end.getDate()).toBe(17)
    expect(r.period!.end.getMonth()).toBe(7) // agosto
  })
})

describe('parseMercadoPagoFatura — parcela e câmbio', () => {
  it('lê "Parcela 1 de 4" e tira a parcela da descrição', () => {
    const p = r.transactions.find((t) => t.description.includes('LOJAUMLTDA'))
    expect(p!.installment).toEqual({ current: 1, total: 4 })
    expect(p!.description).not.toMatch(/Parcela/i)
  })

  it('lê o câmbio quando a linha de conversão está bem formada', () => {
    const fx = r.transactions.filter((t) => t.fx !== null)
    expect(fx).toHaveLength(1)
    expect(fx[0].fx).toEqual({ currency: 'USD', amount: 500, rate: 509 })
  })

  // O documento também produz "BRL 0 = USD 1 = R$ 0 BRL 50.00", com cotação
  // zerada e a moeda não fechando dos dois lados. Ali o câmbio fica null:
  // melhor sem o dado do que com um que diz que o dólar custa zero.
  it('recusa a linha de câmbio malformada em vez de inventar cotação', () => {
    const semFx = r.transactions.filter((t) => /internacional/i.test(t.description) && !t.fx)
    expect(semFx).toHaveLength(2)
  })

  // A linha de conversão não tem data e não pode virar lançamento — se
  // virasse, o gabarito deixaria de conferir, mas com nove transações
  // certas e uma a mais o erro seria difícil de ler.
  it('a linha de conversão não vira transação', () => {
    expect(r.transactions.some((t) => /^BRL|^USD/.test(t.description))).toBe(false)
  })
})

describe('parseMercadoPagoFatura — conta e compromisso futuro', () => {
  it('identifica o cartão e o titular', () => {
    expect(r.account.bank).toBe('mercadopago')
    expect(r.account.type).toBe('credit_card')
    expect(r.account.last4).toBe('9012')
  })

  it('lê o total de lançamentos futuros e o próximo fechamento', () => {
    expect(r.forward.futureInstallmentsTotal).toBe(71189)
    expect(r.forward.nextCloseDate!.getMonth()).toBe(8) // setembro
    expect(r.forward.nextCloseDate!.getDate()).toBe(11)
  })

  // O Mercado Pago não declara quanto já foi gasto no ciclo aberto — o
  // "Limite utilizado" soma o desta fatura com o que ainda vem, e derivar
  // dali seria inventar. Mesmo caso do Bradesco.
  it('não inventa saldo em aberto', () => {
    expect(r.forward.totalOpenBalance).toBeNull()
  })
})
