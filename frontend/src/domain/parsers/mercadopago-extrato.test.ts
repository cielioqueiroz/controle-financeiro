import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseMercadoPagoExtrato } from './mercadopago-extrato'
import { detectDocument } from '../pdf/detect'
import { validar } from '../validate/checksum'
import type { TextItem } from '../pdf/types'

const lines = buildLines(
  JSON.parse(readFileSync('tests/fixtures/mercadopago-extrato.items.json', 'utf-8')) as TextItem[],
)
const r = parseMercadoPagoExtrato(lines)

describe('detecção do Mercado Pago', () => {
  it('reconhece o extrato', () => {
    expect(detectDocument(lines)).toEqual({ bank: 'mercadopago', docType: 'extrato' })
  })
})

describe('parseMercadoPagoExtrato — gabarito', () => {
  it('lê entradas e saídas declaradas como magnitude', () => {
    // O documento escreve a saída com sinal ("Saidas: R$ -135,18"), e
    // `validar` compara contra a soma absoluta.
    expect(r.declaredIncome).toBe(13518)
    expect(r.declaredExpense).toBe(13518)
  })

  it('confere ao centavo nos dois fluxos', () => {
    expect(validar(r).status).toBe('confere')
    expect(validar(r).diferenca).toBe(0)
  })

  it('lê o saldo, que é o que alimenta a fileira de saldo do painel', () => {
    expect(r.balance).toEqual({ initial: 0, final: 0 })
  })

  it('extrai as 21 movimentações', () => {
    expect(r.transactions).toHaveLength(21)
  })
})

describe('parseMercadoPagoExtrato — a descrição em três pedaços', () => {
  // Este é o caso que define o parser: a descrição pode ficar ACIMA e
  // ABAIXO da linha do valor ao mesmo tempo.
  it('junta o prefixo, o meio e o sufixo em uma frase só', () => {
    const pix = r.transactions.find((t) => t.description.startsWith('Pix recebido'))
    expect(pix!.description).toBe('Pix recebido MARIAXXX DA APARECIDA SANTOSS')
  })

  it('junta prefixo e sufixo também quando o meio vem vazio', () => {
    const divida = r.transactions.find((t) => /D[ée]bito por d[íi]vida/i.test(t.description))
    expect(divida!.description).toBe('Débito por dívida Empréstimos Mercado Pago')
  })

  // A prova de que o critério é a DISTÂNCIA e não a vizinhança: sem ela, a
  // linha logo abaixo de um valor seria tomada como sufixo dele, quando na
  // verdade é o prefixo do lançamento seguinte. "Rendimentos" tem a
  // descrição inteira na própria linha e é vizinho de dois lançamentos que
  // usam fragmentos — se o critério estivesse errado, ele apareceria
  // colado a "Débito por dívida".
  it('não rouba o fragmento do lançamento vizinho', () => {
    const rendimentos = r.transactions.filter((t) => t.description === 'Rendimentos')
    expect(rendimentos).toHaveLength(11)
  })

  it('não trata o cabeçalho da tabela como descrição', () => {
    expect(r.transactions.some((t) => /Data\s+Descri/i.test(t.description))).toBe(false)
  })
})

describe('parseMercadoPagoExtrato — sinal e natureza', () => {
  // O documento usa positivo para crédito; o app usa positivo para saída.
  it('inverte o sinal do documento', () => {
    const recebido = r.transactions.find((t) => t.description.startsWith('Pix recebido'))
    expect(recebido!.amountCents).toBe(-10000)
    expect(recebido!.kind).toBe('entrada')

    const enviado = r.transactions.find((t) => t.description.startsWith('Pix enviado X Y'))
    expect(enviado!.amountCents).toBe(4400)
  })

  // ⚠️ Parcela de empréstimo é GASTO, não quitação. `pagamento` vira
  // `card_payment` na gravação, que é vínculo e sairia do gasto real — mas
  // o vínculo existe contra dupla contagem entre fatura e extrato, e esta
  // parcela não está contada em documento nenhum além deste.
  it('parcela de empréstimo é compra, não pagamento', () => {
    const divida = r.transactions.find((t) => /Empr[ée]stimos/i.test(t.description))
    expect(divida!.kind).toBe('compra')
    expect(divida!.amountCents).toBe(7932)
  })

  it('extrato de conta não traz parcela nem cartão', () => {
    expect(r.transactions.every((t) => t.installment === null && t.card === null)).toBe(true)
  })
})

describe('parseMercadoPagoExtrato — período e conta', () => {
  it('lê o período do "De ... al ..." (o "al" é do documento)', () => {
    expect(r.period!.start.getDate()).toBe(1)
    expect(r.period!.start.getMonth()).toBe(7) // agosto
    expect(r.period!.end.getDate()).toBe(30)
  })

  it('identifica a conta como conta corrente', () => {
    expect(r.account.bank).toBe('mercadopago')
    expect(r.account.type).toBe('checking')
    expect(r.account.agency).toBe('1')
  })
})
