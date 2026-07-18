import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from './lines'
import { detectDocument } from './detect'
import type { TextItem } from './types'

const linhasDe = (nome: string) =>
  buildLines(
    JSON.parse(readFileSync(`tests/fixtures/${nome}.items.json`, 'utf-8')) as TextItem[],
  )

describe('detectDocument', () => {
  it('reconhece a fatura do Bradesco', () => {
    expect(detectDocument(linhasDe('bradesco-fatura'))).toEqual({
      bank: 'bradesco',
      docType: 'fatura',
    })
  })

  it('reconhece o extrato do Bradesco', () => {
    expect(detectDocument(linhasDe('bradesco-extrato'))).toEqual({
      bank: 'bradesco',
      docType: 'extrato',
    })
  })

  it('reconhece a fatura do Nubank', () => {
    expect(detectDocument(linhasDe('nubank-fatura'))).toEqual({
      bank: 'nubank',
      docType: 'fatura',
    })
  })

  it('reconhece o extrato do Nubank', () => {
    expect(detectDocument(linhasDe('nubank-extrato'))).toEqual({
      bank: 'nubank',
      docType: 'extrato',
    })
  })

  it('devolve desconhecido para documento não reconhecido', () => {
    const lines = buildLines([
      { text: 'BANCO INVENTADO S.A.', x: 50, y: 700, width: 100, height: 10, page: 1 },
      { text: 'Extrato mensal', x: 50, y: 680, width: 60, height: 10, page: 1 },
    ])
    expect(detectDocument(lines)).toEqual({
      bank: 'desconhecido',
      docType: 'desconhecido',
    })
  })

  it('devolve desconhecido para documento vazio', () => {
    expect(detectDocument([])).toEqual({
      bank: 'desconhecido',
      docType: 'desconhecido',
    })
  })
})
