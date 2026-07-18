import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from '../pdf/lines'
import { parseNubankFatura } from '../parsers/nubank-fatura'
import { validar } from './checksum'
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
})
