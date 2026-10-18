import { it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { ParseResult, RawTransaction } from '../domain/parsers/types'
import { ConferenciaDocumento } from './ConferenciaDocumento'

const transacao: RawTransaction = {
  date: new Date(2026, 5, 10), description: 'EXEMPLO', amountCents: 9000,
  kind: 'compra', installment: null, card: null, fx: null, raw: '',
}
const resultado: ParseResult = {
  transactions: [transacao, { ...transacao, kind: 'entrada', amountCents: -11000 }],
  declaredTotal: null, declaredIncome: 10000, declaredExpense: 10000,
  period: null,
  account: { bank: 'nubank', type: 'checking', last4: null, agency: null, number: null, holderName: null },
  forward: { nextCloseDate: null, nextInvoiceBalance: null, totalOpenBalance: null, futureInstallmentsTotal: null },
}

it('mostra as duas diferenças opostas e não anuncia diferença zero no carimbo', () => {
  render(<ConferenciaDocumento result={resultado} />)
  expect(screen.getByRole('status')).toHaveTextContent('Entradas e saídas divergem')
  expect(screen.getByRole('status')).not.toHaveTextContent('0,00')
  const entradas = screen.getByRole('heading', { name: 'Entradas' }).closest('li')!
  const saidas = screen.getByRole('heading', { name: 'Saídas' }).closest('li')!
  expect(within(entradas).getByText('R$ 10,00')).toBeVisible()
  expect(within(saidas).getByText('-R$ 10,00')).toBeVisible()
  expect(screen.getByText(/Compare os valores abaixo com o PDF antes de salvar/)).toBeVisible()
})

it('sem gabarito não fabrica uma comparação com zero', () => {
  render(<ConferenciaDocumento result={{ ...resultado, declaredIncome: null, declaredExpense: null }} />)
  expect(screen.getByText(/não há gabarito suficiente/)).toBeVisible()
  expect(screen.queryByText('No documento')).not.toBeInTheDocument()
})

it('explica o alcance de uma conferência que bateu', () => {
  render(<ConferenciaDocumento result={{ ...resultado, declaredIncome: 11000, declaredExpense: 9000 }} />)
  expect(screen.getByText('Confere com o banco')).toBeVisible()
  expect(screen.getByText(/não confirma que todos os documentos/)).toBeVisible()
})
