import { describe, expect, it } from 'vitest'
import { hashConteudoDocumento, hashDocumento } from './hash'
import type { ParseResult } from '../parsers/types'
import type { DocKind } from '../pdf/detect'

const kind: DocKind = { bank: 'nubank', docType: 'fatura' }

const resultado = (descricao = 'PAG*LOJA') : ParseResult => ({
  transactions: [{
    date: new Date('2026-08-10T12:00:00Z'),
    description: descricao,
    amountCents: 1234,
    installment: null,
    card: null,
    fx: null,
    kind: 'compra',
    raw: `${descricao} 12,34`,
  }],
  declaredTotal: 1234,
  declaredIncome: null,
  declaredExpense: null,
  period: { start: new Date('2026-07-18T00:00:00Z'), end: new Date('2026-08-17T00:00:00Z') },
  account: { bank: 'nubank', type: 'credit_card', last4: '1234', agency: null, number: null, holderName: 'Titular' },
  forward: { nextCloseDate: null, nextInvoiceBalance: null, totalOpenBalance: null, futureInstallmentsTotal: null },
})

describe('identidade de Documento', () => {
  it('ignora nome do PDF, metadados e espaçamento da descrição', async () => {
    const primeiro = await hashConteudoDocumento(resultado('PAG*LOJA'), kind)
    const exportadoDeNovo = await hashConteudoDocumento(resultado('  PAG*LOJA   '), kind)
    expect(exportadoDeNovo).toBe(primeiro)
  })

  it('não confunde Documentos com conteúdo financeiro diferente', async () => {
    expect(await hashConteudoDocumento(resultado('PAG*OUTRA'), kind)).not.toBe(
      await hashConteudoDocumento(resultado('PAG*LOJA'), kind),
    )
  })

  it('mantém o hash bruto independente do hash de conteúdo', async () => {
    expect(await hashDocumento(new TextEncoder().encode('a').buffer)).not.toBe(
      await hashDocumento(new TextEncoder().encode('b').buffer),
    )
  })
})
