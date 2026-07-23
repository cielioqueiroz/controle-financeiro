import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseSicoobExtrato } from './sicoob-extrato'
import { detectDocument } from '../pdf/detect'
import { validar } from '../validate/checksum'
import type { TextItem } from '../pdf/types'

const lines = buildLines(
  JSON.parse(readFileSync('tests/fixtures/sicoob-extrato.items.json', 'utf-8')) as TextItem[],
)
const r = parseSicoobExtrato(lines)

describe('detecção do Sicoob', () => {
  it('reconhece o extrato do Sicoob (SISBR)', () => {
    expect(detectDocument(lines)).toEqual({ bank: 'sicoob', docType: 'extrato' })
  })
})

describe('parseSicoobExtrato — gabarito por saldo', () => {
  it('lê o saldo anterior (inicial) e o último saldo do dia (final)', () => {
    expect(r.balance).not.toBeNull()
    expect(r.balance!.initial).toBe(18316861) // 183.168,61
    expect(r.balance!.final).toBe(2168668) // 21.686,68
  })

  it('a soma com sinal fecha com a variação de saldo (confere ao centavo)', () => {
    const soma = r.transactions.reduce((a, t) => a + t.amountCents, 0)
    expect(soma).toBe(r.balance!.initial - r.balance!.final)
  })

  it('a validação confere', () => {
    expect(validar(r).status).toBe('confere')
  })
})

describe('parseSicoobExtrato — multi-linha e sinal', () => {
  it('junta as linhas de detalhe (Pagamento Pix, CNPJ, nota) na descrição', () => {
    const pix = r.transactions.find((t) => /PIX EMITIDO OUTRA IF/i.test(t.description))
    expect(pix).toBeDefined()
    expect(pix!.description).toMatch(/Pagamento Pix/i)
    expect(pix!.description).toMatch(/PGTO NF/i)
  })

  it('débito (D) é saída (positivo)', () => {
    const deb = r.transactions.find((t) => /PIX EMITIDO/i.test(t.description))
    expect(deb!.amountCents).toBeGreaterThan(0)
  })

  it('não conta SALDO ANTERIOR, SALDO DO DIA nem saldo bloqueado como transação', () => {
    expect(
      r.transactions.some((t) => /SALDO ANTERIOR|SALDO DO DIA|SALDO BLOQUEADO/i.test(t.description)),
    ).toBe(false)
  })

  it('usa o ano do período nas datas (2025)', () => {
    expect(r.transactions.every((t) => t.date.getFullYear() === 2025)).toBe(true)
  })

  it('extrai vários lançamentos', () => {
    expect(r.transactions.length).toBeGreaterThan(10)
  })
})
