import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseBBExtrato } from './bb-extrato'
import { detectDocument } from '../pdf/detect'
import { validar } from '../validate/checksum'
import type { TextItem } from '../pdf/types'

const lines = buildLines(
  JSON.parse(readFileSync('tests/fixtures/bb-extrato.items.json', 'utf-8')) as TextItem[],
)
const r = parseBBExtrato(lines)

describe('detecção do BB', () => {
  it('reconhece o extrato de conta corrente do BB', () => {
    expect(detectDocument(lines)).toEqual({ bank: 'bb', docType: 'extrato' })
  })
})

describe('parseBBExtrato — gabarito por saldo', () => {
  it('lê o saldo inicial e o final', () => {
    // A conta varre tudo para aplicação automática todo dia: saldo 0→0.
    expect(r.balance).toEqual({ initial: 0, final: 0 })
  })

  it('a soma com sinal fecha com a variação de saldo (confere ao centavo)', () => {
    const soma = r.transactions.reduce((a, t) => a + t.amountCents, 0)
    const esperado = r.balance!.initial - r.balance!.final
    expect(soma).toBe(esperado)
  })

  it('a validação confere', () => {
    expect(validar(r).status).toBe('confere')
  })

  it('não declara totais (o BB não tem linha Total)', () => {
    expect(r.declaredIncome).toBeNull()
    expect(r.declaredExpense).toBeNull()
  })
})

describe('parseBBExtrato — leitura das linhas', () => {
  it('extrai lançamentos', () => {
    expect(r.transactions.length).toBeGreaterThan(10)
  })

  it('crédito (C) vira entrada (negativo) e débito (D) vira saída (positivo)', () => {
    expect(r.transactions.some((t) => t.amountCents < 0)).toBe(true)
    expect(r.transactions.some((t) => t.amountCents > 0)).toBe(true)
  })

  it('PIX enviado é saída', () => {
    const pix = r.transactions.find((t) => /Pix - Enviado/i.test(t.description))
    expect(pix).toBeDefined()
    expect(pix!.amountCents).toBeGreaterThan(0)
  })

  it('junta a contraparte do PIX/TED (linha de detalhe) na descrição', () => {
    const comDetalhe = r.transactions.find((t) => /Pix - Enviado.+\d{2}:\d{2}/i.test(t.description))
    expect(comDetalhe).toBeDefined()
  })

  it('lê o período do extrato', () => {
    expect(r.period).not.toBeNull()
    expect(r.period!.start.getMonth()).toBe(7) // agosto (0-based)
  })

  it('não conta as linhas de saldo como transação', () => {
    expect(r.transactions.some((t) => /S\s*A\s*L\s*D\s*O|Saldo Anterior/i.test(t.description))).toBe(
      false,
    )
  })
})
