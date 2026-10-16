import '@testing-library/jest-dom/vitest'
import { it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { DocumentoSalvo } from '../aplicacao/consultas/documentos'
import { DocumentoImportado } from './DocumentoImportado'

const documento: DocumentoSalvo = {
  id: 'doc', bank: 'nubank', doc_type: 'fatura',
  period_start: '2026-05-10', period_end: '2026-06-10',
  imported_at: '2026-06-12T12:00:00Z', filename: 'fatura-junho.pdf',
  declared_total: 10000, declared_income: null, declared_expense: null,
}

it('distingue o gasto real salvo do gabarito sem inventar uma conferência', () => {
  render(<ul><DocumentoImportado documento={documento} contagem={{ qtd: 2, totalCents: 8000 }} onApagar={vi.fn()} /></ul>)
  expect(screen.getByText(/Gasto real salvo: R\$ 80,00/)).toBeVisible()
  fireEvent.click(screen.getByText('Ver dados do documento'))
  expect(screen.getByText('fatura-junho.pdf')).toBeVisible()
  expect(screen.getByText('10/05/2026 – 10/06/2026')).toBeVisible()
  expect(screen.getByText('R$ 100,00')).toBeVisible()
  expect(screen.getByText(/O histórico não guarda o resultado da conferência/)).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('não transforma a contagem indisponível em zero', () => {
  render(<ul><DocumentoImportado documento={documento} contagem={null} onApagar={vi.fn()} /></ul>)
  expect(screen.getByText('Contagem e gasto real indisponíveis no momento.')).toBeVisible()
  expect(screen.queryByText(/0 lançamentos|Gasto real salvo/)).not.toBeInTheDocument()
})

it('explica documento sem transações e preserva um gabarito zero real', () => {
  render(<ul><DocumentoImportado documento={{ ...documento, declared_total: 0 }} contagem={{ qtd: 0, totalCents: 0 }} onApagar={vi.fn()} /></ul>)
  expect(screen.getByText(/Sem transações vinculadas a este documento/)).toBeVisible()
  expect(screen.queryByText(/Gasto real salvo/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Ver dados do documento'))
  expect(screen.getByText('R$ 0,00')).toBeVisible()
})
