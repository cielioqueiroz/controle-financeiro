import '@testing-library/jest-dom/vitest'
import { afterEach, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { DocumentoSalvo } from '../aplicacao/consultas/documentos'
import { DocumentoImportado } from './DocumentoImportado'
import { definirDiscreto } from '../domain/normalize/money'
import { DiscretoProvider } from '../dados/DiscretoProvider'

afterEach(() => {
  definirDiscreto(false)
  localStorage.removeItem('discreto')
})

const documento: DocumentoSalvo = {
  id: 'doc', bank: 'nubank', doc_type: 'fatura',
  period_start: '2026-05-10', period_end: '2026-06-10',
  imported_at: '2026-06-12T12:00:00Z', filename: 'fatura-junho.pdf',
  declared_total: 10000, declared_income: null, declared_expense: null,
}

it('abre e foca o documento selecionado sem disparar exclusão', () => {
  const apagar = vi.fn()
  render(<ul><DocumentoImportado documento={documento} contagem={null} onApagar={apagar} selecionado /></ul>)
  expect(screen.getByText('fatura-junho.pdf')).toBeVisible()
  expect(screen.getByText('Ver dados do documento')).toHaveFocus()
  expect(apagar).not.toHaveBeenCalled()
})

it('distingue o gasto real salvo do gabarito sem inventar uma conferência', () => {
  render(<ul><DocumentoImportado documento={documento} contagem={{ qtd: 2, totalCents: 8000 }} onApagar={vi.fn()} /></ul>)
  expect(screen.getByText(/Gasto real salvo: R\$ 80,00/)).toBeVisible()
  fireEvent.click(screen.getByText('Ver dados do documento'))
  expect(screen.getByText('fatura-junho.pdf')).toBeVisible()
  expect(screen.getByText('10/05/2026 – 10/06/2026')).toBeVisible()
  expect(screen.getByText('R$ 100,00')).toBeVisible()
  expect(screen.getByText(/O resultado da conferência original deste documento não foi guardado/)).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('mostra a conferência original mesmo quando o gasto salvo mudou pela deduplicação', () => {
  render(<ul><DocumentoImportado documento={{ ...documento, conferencia: {
    versao: 1, status: 'confere', contagem: 4,
    comparacoes: [{ criterio: 'total-fatura', gabaritoCents: 10000, extraidoCents: 10000, diferencaCents: 0 }],
  } }} contagem={{ qtd: 2, totalCents: 8000 }} onApagar={vi.fn()} /></ul>)
  fireEvent.click(screen.getByText('Ver dados do documento'))
  expect(screen.getByRole('heading', { name: 'Conferência original' })).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('Confere')
  expect(screen.getByText('Lido pelo app')).toBeVisible()
  expect(screen.getByText(/4 lançamentos/)).toBeVisible()
  expect(screen.getByText(/Gasto real salvo: R\$ 80,00/)).toBeVisible()
  expect(screen.queryByText(/O histórico não guarda/)).not.toBeInTheDocument()
})

it('documento salvo sem gabarito continua sem carimbo de aprovação', () => {
  render(<ul><DocumentoImportado documento={{ ...documento, conferencia: {
    versao: 1, status: 'sem-gabarito', contagem: 1, comparacoes: [],
  } }} contagem={{ qtd: 1, totalCents: 8000 }} onApagar={vi.fn()} /></ul>)
  fireEvent.click(screen.getByText('Ver dados do documento'))
  expect(screen.getByRole('status')).toHaveTextContent('Sem gabarito')
  expect(screen.queryByText('Lido pelo app')).not.toBeInTheDocument()
})

it('mascara também os valores da conferência original', () => {
  localStorage.setItem('discreto', '1')
  render(<DiscretoProvider><ul><DocumentoImportado documento={{ ...documento, conferencia: {
    versao: 1, status: 'confere', contagem: 1,
    comparacoes: [{ criterio: 'total-fatura', gabaritoCents: 10000, extraidoCents: 10000, diferencaCents: 0 }],
  } }} contagem={{ qtd: 1, totalCents: 10000 }} onApagar={vi.fn()} /></ul></DiscretoProvider>)
  fireEvent.click(screen.getByText('Ver dados do documento'))
  expect(screen.queryAllByText(/100,00|0,00/)).toHaveLength(0)
  expect(screen.getAllByText(/••••/).length).toBeGreaterThan(0)
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
