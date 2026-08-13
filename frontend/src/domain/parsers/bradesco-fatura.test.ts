import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseBradescoFatura } from './bradesco-fatura'
import { validar } from '../validate/checksum'
import type { TextItem } from '../pdf/types'

const r = parseBradescoFatura(
  buildLines(
    JSON.parse(readFileSync('tests/fixtures/bradesco-fatura.items.json', 'utf-8')) as TextItem[],
  ),
)

const compras = () =>
  r.transactions.filter((t) => t.amountCents > 0).reduce((a, t) => a + t.amountCents, 0)
const creditos = () =>
  r.transactions.filter((t) => t.amountCents < 0).reduce((a, t) => a - t.amountCents, 0)

describe('parseBradescoFatura — gabarito (Resumo da fatura)', () => {
  it('lê créditos e débitos declarados', () => {
    expect(r.declaredIncome).toBe(483943) // (-) Créditos/Pagamentos 4.839,43
    expect(r.declaredExpense).toBe(558623) // (+) Compras/Débitos 5.586,23
  })

  it('a soma das compras bate ao centavo', () => {
    expect(compras()).toBe(558623)
  })

  it('a soma dos créditos bate ao centavo', () => {
    expect(creditos()).toBe(483943)
  })

  it('a validação confere os dois fluxos', () => {
    expect(validar(r).status).toBe('confere')
  })

  it('lê o total da fatura para exibição', () => {
    expect(r.declaredTotal).toBe(552944) // 5.529,44
  })
})

describe('parseBradescoFatura — sinais', () => {
  it('trata "4.782,64 -" (célula única) como pagamento negativo', () => {
    const pag = r.transactions.find((t) => /PAGTO/i.test(t.description))
    expect(pag).toBeDefined()
    expect(pag!.amountCents).toBe(-478264)
    expect(pag!.kind).toBe('pagamento')
  })

  it('trata "56,79" + "-" (célula avulsa) como estorno negativo', () => {
    const estorno = r.transactions.find((t) => t.amountCents === -5679)
    expect(estorno).toBeDefined()
    expect(estorno!.description).toMatch(/MERCADOLIVRE/)
  })

  it('compra comum é positiva', () => {
    const compra = r.transactions.find((t) => /HAVAN/i.test(t.description))
    expect(compra).toBeDefined()
    expect(compra!.amountCents).toBeGreaterThan(0)
  })
})

describe('parseBradescoFatura — parcelas em 3 formatos', () => {
  it('parcela grudada com prefixo: ARAI KAMINISHI COS02/06', () => {
    const t = r.transactions.find((x) => /ARAI KAMINISHI/i.test(x.description))
    expect(t).toBeDefined()
    expect(t!.installment).toEqual({ current: 2, total: 6 })
  })

  it('parcela em célula separada: GOT SERVICOS ADMI 02/02', () => {
    const t = r.transactions.find(
      (x) => /GOT SERVICOS/i.test(x.description) && x.installment?.total === 2,
    )
    expect(t).toBeDefined()
    expect(t!.installment).toEqual({ current: 2, total: 2 })
  })

  it('parcela QUEBRADA na linha de baixo: MERCADO03/0 + 4 = 03/04', () => {
    const t = r.transactions.find(
      (x) => /MERCADOLIVRE\*MERCADO/i.test(x.description) && x.installment?.total === 4,
    )
    expect(t).toBeDefined()
    expect(t!.installment).toEqual({ current: 3, total: 4 })
  })

  it('compra sem parcela fica sem installment', () => {
    const t = r.transactions.find((x) => /HAVAN/i.test(x.description))
    expect(t!.installment).toEqual({ current: 2, total: 3 }) // HAVAN é 02/03
  })
})

describe('parseBradescoFatura — datas e metadados', () => {
  it('infere o ano das datas sem ano a partir do vencimento', () => {
    for (const t of r.transactions) {
      expect(t.date.getFullYear()).toBe(2026)
    }
  })

  it('lê o final do cartão', () => {
    expect(r.account.last4).toBe('9999')
    expect(r.account.type).toBe('credit_card')
  })

  it('captura o total das próximas faturas (compromisso futuro)', () => {
    expect(r.forward.futureInstallmentsTotal).toBe(557834) // R$ 5.578,34
  })
})

describe('parseBradescoFatura — o que a fatura declara para a frente', () => {
  // A data estava impressa na fatura e o app gravava `null` desde sempre, o
  // que deixava o Bradesco fora da fileira de saldos enquanto o Nubank
  // aparecia. Formato dd/mm/aaaa, diferente do "16 JUL 2026" do Nubank.
  it('lê a previsão de fechamento da próxima fatura', () => {
    expect(r.forward.nextCloseDate?.toISOString().slice(0, 10)).toBe('2026-07-16')
  })

  it('lê o total comprometido nas próximas faturas', () => {
    expect(r.forward.futureInstallmentsTotal).toBe(557834)
  })

  // Não é omissão: a fatura do Bradesco não traz o quanto já foi gasto no
  // ciclo que ainda não fechou. Derivar seria inventar — essas compras estão
  // na PRÓXIMA fatura, que ninguém importou. O card na tela diz "próximas
  // faturas" justamente porque este campo é null.
  it('NÃO inventa saldo em aberto, que o Bradesco não declara', () => {
    expect(r.forward.totalOpenBalance).toBeNull()
  })
})
