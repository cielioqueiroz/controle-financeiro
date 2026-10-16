import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseNubankFatura } from '../parsers/nubank-fatura'
import { compararGabaritos, validar } from './checksum'
import type { ParseResult } from '../parsers/types'
import type { TextItem } from '../pdf/types'

const faturaNubank = (): ParseResult =>
  parseNubankFatura(
    buildLines(
      JSON.parse(readFileSync('tests/fixtures/nubank-fatura.items.json', 'utf-8')) as TextItem[],
    ),
  )

describe('validar', () => {
  it('confere a fatura Nubank ao centavo', () => {
    const v = validar(faturaNubank())
    expect(v.status).toBe('confere')
    expect(v.diferenca).toBe(0)
    expect(v.somaExtraida).toBe(832424)
  })

  it('reporta contagem de lançamentos', () => {
    expect(validar(faturaNubank()).contagem).toBe(78)
  })

  it('acusa divergência quando falta uma compra', () => {
    const r = faturaNubank()
    // Remove uma COMPRA (que entra na soma da fatura). Remover um
    // pagamento não mexeria no total — ele não compõe o "Total a pagar".
    const i = r.transactions.findIndex((t) => t.kind === 'compra')
    r.transactions.splice(i, 1)
    const v = validar(r)
    expect(v.status).toBe('diverge')
    expect(v.diferenca).not.toBe(0)
  })

  it('reporta sem-gabarito quando o documento não declara total', () => {
    const r = faturaNubank()
    r.declaredTotal = null
    expect(validar(r).status).toBe('sem-gabarito')
  })

  it('expõe diferenças opostas dos dois fluxos sem aprovar o documento', () => {
    const r = faturaNubank()
    r.declaredIncome = 10000
    r.declaredExpense = 10000
    r.transactions = [
      { ...r.transactions[0], amountCents: -11000, kind: 'entrada' },
      { ...r.transactions[0], amountCents: 9000, kind: 'compra' },
    ]
    expect(compararGabaritos(r)).toEqual([
      { criterio: 'entradas', gabaritoCents: 10000, extraidoCents: 11000, diferencaCents: 1000 },
      { criterio: 'saidas', gabaritoCents: 10000, extraidoCents: 9000, diferencaCents: -1000 },
    ])
    expect(validar(r).status).toBe('diverge')
  })

  it('confere a variação do saldo com entradas negativas e saídas positivas', () => {
    const r = faturaNubank()
    r.balance = { initial: 10000, final: 12000 }
    r.transactions = [
      { ...r.transactions[0], amountCents: -5000, kind: 'entrada' },
      { ...r.transactions[0], amountCents: 3000, kind: 'compra' },
    ]
    expect(compararGabaritos(r)).toEqual([
      { criterio: 'variacao-saldo', gabaritoCents: -2000, extraidoCents: -2000, diferencaCents: 0 },
    ])
    expect(validar(r).status).toBe('confere')
  })

  it('distingue gabarito zero de gabarito ausente', () => {
    const r = faturaNubank()
    r.transactions = []
    r.declaredTotal = 0
    expect(compararGabaritos(r)[0].gabaritoCents).toBe(0)
    expect(validar(r).status).toBe('confere')
    r.declaredTotal = null
    expect(compararGabaritos(r)).toEqual([])
    expect(validar(r).status).toBe('sem-gabarito')
  })
})
