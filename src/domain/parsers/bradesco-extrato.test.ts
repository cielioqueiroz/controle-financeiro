import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseBradescoExtrato } from './bradesco-extrato'
import { validar } from '../validate/checksum'
import type { TextItem } from '../pdf/types'

const r = parseBradescoExtrato(
  buildLines(
    JSON.parse(readFileSync('tests/fixtures/bradesco-extrato.items.json', 'utf-8')) as TextItem[],
  ),
)

const entradas = () =>
  r.transactions.filter((t) => t.amountCents < 0).reduce((a, t) => a - t.amountCents, 0)
const saidas = () =>
  r.transactions.filter((t) => t.amountCents > 0).reduce((a, t) => a + t.amountCents, 0)

describe('parseBradescoExtrato — gabarito', () => {
  it('lê os totais declarados na linha Total', () => {
    expect(r.declaredIncome).toBe(3326553) // 33.265,53
    expect(r.declaredExpense).toBe(4184165) // 41.841,65
  })

  it('a soma dos créditos bate ao centavo', () => {
    expect(entradas()).toBe(3326553)
  })

  it('a soma dos débitos bate ao centavo', () => {
    expect(saidas()).toBe(4184165)
  })

  it('a validação confere os dois fluxos', () => {
    expect(validar(r).status).toBe('confere')
  })
})

describe('parseBradescoExtrato — colunas por coordenada', () => {
  it('distingue crédito de débito com o mesmo valor 10.000,00', () => {
    // 10.000,00 aparece como PIX enviado (débito) e recebido (crédito)
    const dezMil = r.transactions.filter((t) => Math.abs(t.amountCents) === 1000000)
    expect(dezMil.length).toBeGreaterThanOrEqual(2)
    expect(dezMil.some((t) => t.amountCents > 0)).toBe(true) // enviado = saída
    expect(dezMil.some((t) => t.amountCents < 0)).toBe(true) // recebido = entrada
  })

  it('lê rendimento (crédito) como entrada', () => {
    const rend = r.transactions.find((t) => /RENDIMENTOS/i.test(t.description))
    expect(rend).toBeDefined()
    expect(rend!.amountCents).toBe(-29856) // 298,56 crédito
  })
})

describe('parseBradescoExtrato — estrutura de 3 linhas', () => {
  it('junta tipo (acima) e detalhe (abaixo) na descrição', () => {
    const pix = r.transactions.find((t) => /Beatriz Costa Lima/i.test(t.description))
    expect(pix).toBeDefined()
    expect(pix!.description).toMatch(/PIX ENVIADO/)
    expect(pix!.description).toMatch(/DES:/)
    expect(pix!.amountCents).toBe(30000) // 300,00 débito
  })

  it('lê tipo inline (IOF) sem linha de detalhe', () => {
    const iof = r.transactions.find((t) => /IOF S\/ UTILIZACAO/i.test(t.description))
    expect(iof).toBeDefined()
    expect(iof!.amountCents).toBe(921) // 9,21
  })

  it('herda a data quando a âncora não a traz', () => {
    // Recarga pré-pago (25,00) não tem data própria — herda de 08/06
    const recarga = r.transactions.find(
      (t) => /RECARGA PRE PAGO/i.test(t.description) && t.amountCents === 2500,
    )
    expect(recarga).toBeDefined()
    expect(recarga!.date).toEqual(new Date(2026, 5, 8))
  })

  it('ignora o saldo inicial (COD. LANC) como transação', () => {
    const cod = r.transactions.filter((t) => /COD\. LANC/i.test(t.description))
    expect(cod).toHaveLength(0)
  })
})

describe('parseBradescoExtrato — período de julho ignorado', () => {
  it('não inclui transações de julho (página 3, outro período)', () => {
    const julho = r.transactions.filter((t) => t.date.getMonth() === 6) // julho = 6
    expect(julho).toHaveLength(0)
  })

  it('lê o período de junho', () => {
    expect(r.period).toEqual({
      start: new Date(2026, 5, 1),
      end: new Date(2026, 5, 30),
    })
  })
})

describe('parseBradescoExtrato — metadados', () => {
  it('lê agência e conta', () => {
    expect(r.account.agency).toBe('111')
    expect(r.account.number).toBe('1234-5')
  })

  it('identifica como conta corrente do Bradesco', () => {
    expect(r.account.bank).toBe('bradesco')
    expect(r.account.type).toBe('checking')
  })
})
