import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseSicrediExtrato } from './sicredi-extrato'
import { detectDocument } from '../pdf/detect'
import { validar } from '../validate/checksum'
import type { TextItem } from '../pdf/types'

const lines = buildLines(
  JSON.parse(readFileSync('tests/fixtures/sicredi-extrato.items.json', 'utf-8')) as TextItem[],
)
const r = parseSicrediExtrato(lines)

describe('detecção do Sicredi', () => {
  it('reconhece o extrato do Sicredi', () => {
    expect(detectDocument(lines)).toEqual({ bank: 'sicredi', docType: 'extrato' })
  })
})

describe('parseSicrediExtrato — gabarito por saldo', () => {
  it('lê o saldo inicial e o final', () => {
    expect(r.balance).not.toBeNull()
    expect(r.balance!.initial).toBe(9960755) // 99.607,55
    expect(r.balance!.final).toBe(7449462) // 74.494,62 — alimenta o saldo por conta
  })

  it('a soma com sinal fecha com a variação de saldo (confere ao centavo)', () => {
    const soma = r.transactions.reduce((a, t) => a + t.amountCents, 0)
    expect(soma).toBe(r.balance!.initial - r.balance!.final)
  })

  it('a validação confere', () => {
    expect(validar(r).status).toBe('confere')
  })
})

describe('parseSicrediExtrato — sinal e leitura', () => {
  it('débito (valor com menos) vira saída (positivo)', () => {
    const pix = r.transactions.find((t) => /PAGAMENTO PIX/i.test(t.description))
    expect(pix).toBeDefined()
    expect(pix!.amountCents).toBeGreaterThan(0)
  })

  it('crédito (valor sem menos) vira entrada (negativo)', () => {
    // O TED recebido de 221.174,00 é a única entrada da amostra.
    const ted = r.transactions.find((t) => t.amountCents < 0)
    expect(ted).toBeDefined()
    expect(ted!.amountCents).toBe(-22117400)
  })

  it('não conta a linha SALDO como transação', () => {
    expect(r.transactions.some((t) => /^SALDO$/i.test(t.description))).toBe(false)
  })

  it('lê o período e a conta', () => {
    expect(r.period).not.toBeNull()
    expect(r.account.number).toBe('12345-6')
  })

  it('extrai vários lançamentos', () => {
    expect(r.transactions.length).toBeGreaterThan(15)
  })
})
