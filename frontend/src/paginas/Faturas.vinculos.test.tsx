import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { DadosProvider } from '../dados/DadosProvider'
import { Faturas } from './Faturas'

vi.mock('../aplicacao/consultas/historico', () => ({
  puxarTudo: vi.fn(async () => [{
    id: 'pagamento', date: '2026-06-10', competencia: '2026-06', description: 'Pagamento de fatura',
    label: null, amount_cents: 12500, kind: 'card_payment', category_slug: 'transferencia',
    bank: 'nubank', doc_type: 'extrato', document_id: 'extrato', installment: null,
    vinculo_document_id: 'fatura', vinculo_criterio: 'quitacao-fatura',
  }]),
  puxarCategoriasUsuario: vi.fn(async () => []), puxarSaldos: vi.fn(async () => []),
}))
vi.mock('../aplicacao/consultas/documentos', () => ({
  puxarDocumentos: vi.fn(async () => [
    { id: 'extrato', bank: 'nubank', doc_type: 'extrato', period_start: '2026-06-01', period_end: '2026-06-30',
      filename: 'extrato.pdf', imported_at: '2026-07-01T00:00:00Z', declared_total: null, declared_income: null, declared_expense: null },
    { id: 'fatura', bank: 'bradesco', doc_type: 'fatura', period_start: '2026-05-01', period_end: '2026-06-10',
      filename: 'fatura.pdf', imported_at: '2026-07-01T00:00:00Z', declared_total: 12500, declared_income: null, declared_expense: null },
  ]),
}))
vi.mock('../aplicacao/comandos/documentos', () => ({ apagarDocumento: vi.fn(), apagarTudo: vi.fn() }))

function Local() {
  const local = useLocation()
  return <output aria-label="Local">{local.search}</output>
}

it('abre a contraparte documentada em Faturas, preserva filtros e foca seus dados', async () => {
  const usuario = userEvent.setup()
  render(<MemoryRouter initialEntries={['/faturas?banco=nubank&ref=2026-06&janela=3']}>
    <DadosProvider><Faturas /><Local /></DadosProvider>
  </MemoryRouter>)
  await usuario.click(await screen.findByText('Conferir vínculos entre documentos'))
  await usuario.click((await screen.findAllByRole('button', { name: 'Ver documento importado' }))[1])
  expect(screen.getByLabelText('Local')).toHaveTextContent('documento=fatura')
  expect(screen.getByLabelText('Local')).toHaveTextContent('banco=nubank')
  expect(screen.getByLabelText('Local')).toHaveTextContent('ref=2026-06')
  expect(screen.getByLabelText('Local')).toHaveTextContent('janela=3')
  expect(screen.getAllByText('fatura.pdf')[0]).toBeVisible()
  expect(screen.getAllByText('Ver dados do documento')[1]).toHaveFocus()
})
