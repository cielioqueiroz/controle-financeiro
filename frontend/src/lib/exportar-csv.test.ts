import { describe, it, expect } from 'vitest'
import { centavosParaCsv, transacoesParaCsv, type LinhaExportavel } from './exportar-csv'

const base: LinhaExportavel = {
  date: '2026-10-05',
  competencia: '2026-10',
  bank: 'nubank',
  doc_type: 'fatura',
  description: 'PADARIA DO ZE',
  label: null,
  category_slug: 'alimentacao',
  kind: 'expense',
  amount_cents: 1234,
  installment: null,
}

const linhas = (csv: string) => csv.replace(/^﻿/, '').trimEnd().split('\r\n')

describe('centavosParaCsv', () => {
  it.each([
    [1234, '12,34'],
    [5, '0,05'],
    [100, '1,00'],
    [-250, '-2,50'],
    [123456789, '1234567,89'],
  ])('%i → %s', (c, s) => expect(centavosParaCsv(c)).toBe(s))
})

describe('transacoesParaCsv', () => {
  it('começa com BOM e cabeçalho separado por ponto e vírgula', () => {
    const csv = transacoesParaCsv([])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(linhas(csv)).toEqual(['data;competencia;banco;documento;descricao;rotulo;categoria;natureza;parcela;valor'])
  })

  it('uma linha por transação, em ordem de data', () => {
    const csv = transacoesParaCsv([
      { ...base, date: '2026-10-09', description: 'B' },
      { ...base, date: '2026-10-01', description: 'A', installment: { current: 2, total: 6 } },
    ])
    expect(linhas(csv).slice(1)).toEqual([
      '2026-10-01;2026-10;nubank;fatura;A;;alimentacao;expense;2/6;12,34',
      '2026-10-09;2026-10;nubank;fatura;B;;alimentacao;expense;;12,34',
    ])
  })

  it('aspas e ponto e vírgula no texto ficam entre aspas', () => {
    const csv = transacoesParaCsv([{ ...base, description: 'LOJA "X"; CENTRO' }])
    expect(linhas(csv)[1]).toContain(';"LOJA ""X""; CENTRO";')
  })

  /** Descrição vem do PDF do banco: não pode virar fórmula na planilha. */
  it('texto que começa com = + - @ é neutralizado', () => {
    const csv = transacoesParaCsv([{ ...base, description: '=HYPERLINK("x")', label: '-SAQUE' }])
    expect(linhas(csv)[1]).toContain(`;"'=HYPERLINK(""x"")";'-SAQUE;`)
  })

  it('valor negativo (entrada) não é neutralizado', () => {
    const csv = transacoesParaCsv([{ ...base, amount_cents: -50000, kind: 'income' }])
    expect(linhas(csv)[1].endsWith(';-500,00')).toBe(true)
  })
})
