import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseNubankExtrato } from './nubank-extrato'
import { validar } from '../validate/checksum'
import type { TextItem } from '../pdf/types'

const lines = buildLines(
  JSON.parse(readFileSync('tests/fixtures/nubank-extrato.items.json', 'utf-8')) as TextItem[],
)
const r = parseNubankExtrato(lines)

const entradas = () =>
  r.transactions.filter((t) => t.amountCents < 0).reduce((a, t) => a - t.amountCents, 0)
const saidas = () =>
  r.transactions.filter((t) => t.amountCents > 0).reduce((a, t) => a + t.amountCents, 0)

describe('parseNubankExtrato — gabarito', () => {
  it('lê os totais declarados de entradas e saídas', () => {
    expect(r.declaredIncome).toBe(853125) // +8.531,25
    expect(r.declaredExpense).toBe(861381) // -8.613,81
  })

  it('a soma das entradas bate com o declarado', () => {
    expect(entradas()).toBe(853125)
  })

  it('a soma das saídas bate com o declarado', () => {
    expect(saidas()).toBe(861381)
  })

  it('a validação confere os dois fluxos', () => {
    const v = validar(r)
    expect(v.status).toBe('confere')
    expect(v.diferenca).toBe(0)
  })
})

describe('parseNubankExtrato — sinais e estrutura', () => {
  it('herda o sinal do grupo — entrada é negativa', () => {
    const recebido = r.transactions.find((t) =>
      /Transfer[êe]ncia Recebida/i.test(t.description) || t.raw.includes('50,00'),
    )
    expect(recebido).toBeDefined()
    expect(recebido!.amountCents).toBeLessThan(0)
  })

  it('a compra no débito é saída (positiva)', () => {
    const farmacia = r.transactions.find((t) => /FARMACIA BOM PRECO/i.test(t.description))
    expect(farmacia).toBeDefined()
    expect(farmacia!.amountCents).toBe(1000) // R$ 10,00, saída
  })

  it('classifica pagamento de fatura como kind pagamento', () => {
    const pag = r.transactions.find((t) => /Pagamento de fatura/i.test(t.raw))
    expect(pag).toBeDefined()
    expect(pag!.kind).toBe('pagamento')
    expect(pag!.amountCents).toBe(832424) // R$ 8.324,24, saída
  })

  it('captura os dois PIX de 29 JUN para o próprio titular (transferência)', () => {
    const grandes = r.transactions.filter(
      (t) => t.amountCents < 0 && (t.amountCents === -530000 || t.amountCents === -300000),
    )
    expect(grandes.length).toBe(2) // R$ 5.300 e R$ 3.000 recebidos do Bradesco
  })

  it('junta descrição multi-linha do contraparte', () => {
    const ifood = r.transactions.find((t) => /IFOOD/i.test(t.description))
    expect(ifood).toBeDefined()
    expect(ifood!.description).toMatch(/14\.380\.200/) // CNPJ na 2ª linha
  })

  it('lê o período do extrato', () => {
    expect(r.period).toEqual({
      start: new Date(2026, 5, 1), // 01 JUN 2026
      end: new Date(2026, 5, 30), // 30 JUN 2026
    })
  })

  it('identifica como conta corrente do Nubank', () => {
    expect(r.account.bank).toBe('nubank')
    expect(r.account.type).toBe('checking')
  })
})
