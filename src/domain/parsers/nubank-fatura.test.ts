import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseNubankFatura } from './nubank-fatura'
import type { TextItem } from '../pdf/types'

const lines = buildLines(
  JSON.parse(readFileSync('tests/fixtures/nubank-fatura.items.json', 'utf-8')) as TextItem[],
)
const r = parseNubankFatura(lines)

const soma = (kinds: string[]) =>
  r.transactions
    .filter((t) => kinds.includes(t.kind))
    .reduce((acc, t) => acc + t.amountCents, 0)

describe('parseNubankFatura — gabarito', () => {
  it('lê o total declarado pela fatura', () => {
    expect(r.declaredTotal).toBe(832424) // R$ 8.324,24
  })

  it('a soma de compras bate com "Total de compras" declarado', () => {
    expect(soma(['compra'])).toBe(832022) // R$ 8.320,22
  })

  it('a soma do IOF bate com "IOF de compras internacionais" declarado', () => {
    expect(soma(['encargo'])).toBe(402) // R$ 4,02
  })

  it('compras + encargos fecham EXATAMENTE com o total declarado', () => {
    expect(soma(['compra', 'encargo'])).toBe(r.declaredTotal)
  })

  it('lê o pagamento da fatura anterior com o MINUS SIGN U+2212', () => {
    expect(soma(['pagamento'])).toBe(-364497) // −R$ 3.644,97
  })
})

describe('parseNubankFatura — transações', () => {
  it('extrai 78 transações', () => {
    // 80 linhas do PDF têm data + valor, mas duas são "Saldo restante da
    // fatura anterior R$ 0,00" — ruído, descartado.
    expect(r.transactions).toHaveLength(78)
  })

  it('lê a primeira transação com parcela', () => {
    const t = r.transactions[0]
    expect(t.description).toBe('Dias Gomes Comercio')
    expect(t.amountCents).toBe(24950)
    expect(t.installment).toEqual({ current: 5, total: 8 })
    expect(t.card).toBe('7777')
    expect(t.date).toEqual(new Date(2026, 4, 20)) // 20 MAI 2026
  })

  it('infere o ano a partir do vencimento (29 JUN 2026)', () => {
    for (const t of r.transactions) {
      expect(t.date.getFullYear()).toBe(2026)
    }
  })

  it('lê transação sem parcela', () => {
    const t = r.transactions.find((x) => x.description === 'Deposito Expansao')
    expect(t).toBeDefined()
    expect(t!.installment).toBeNull()
    expect(t!.amountCents).toBe(7649)
  })

  it('descarta "Saldo restante da fatura anterior" como ruído', () => {
    const ruido = r.transactions.filter((t) =>
      /Saldo restante/i.test(t.description),
    )
    expect(ruido).toHaveLength(0)
  })

  it('preserva a linha original para auditoria', () => {
    expect(r.transactions[0].raw).toContain('Dias Gomes Comercio')
    expect(r.transactions[0].raw).toContain('249,50')
  })
})

describe('parseNubankFatura — câmbio', () => {
  it('lê a conversão da compra internacional em 3 linhas', () => {
    const t = r.transactions.find((x) => /Anthropic/.test(x.description))
    expect(t).toBeDefined()
    expect(t!.amountCents).toBe(11495) // R$ 114,95
    expect(t!.fx).toEqual({
      currency: 'USD',
      amount: 2157, // USD 21.57
      rate: 532, // R$ 5,32
    })
  })

  it('o IOF da compra internacional é linha separada, sem cartão', () => {
    const iof = r.transactions.find((x) => /^IOF de/.test(x.description))
    expect(iof).toBeDefined()
    expect(iof!.amountCents).toBe(402)
    expect(iof!.card).toBeNull()
    expect(iof!.kind).toBe('encargo')
  })

  it('transação nacional não tem câmbio', () => {
    const t = r.transactions.find((x) => x.description === 'Ofertao Supermercado')
    expect(t!.fx).toBeNull()
  })
})

describe('parseNubankFatura — metadados', () => {
  it('lê o período vigente', () => {
    expect(r.period).toEqual({
      start: new Date(2026, 4, 20), // 20 MAI
      end: new Date(2026, 5, 20), // 20 JUN
    })
  })

  it('identifica a conta como cartão de crédito do Nubank', () => {
    expect(r.account.bank).toBe('nubank')
    expect(r.account.type).toBe('credit_card')
    expect(r.account.last4).toBe('7777')
  })

  it('captura os campos prospectivos para a projeção da fatia 3', () => {
    expect(r.forward.totalOpenBalance).toBe(268823) // R$ 2.688,23
    expect(r.forward.nextInvoiceBalance).toBe(127016) // R$ 1.270,16
    expect(r.forward.nextCloseDate).toEqual(new Date(2026, 6, 20)) // 20 JUL 2026
  })
})
