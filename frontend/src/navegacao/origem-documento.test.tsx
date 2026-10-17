import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { DadosProvider } from '../dados/DadosProvider'
import { Relatorios } from '../paginas/Relatorios'
import { Faturas } from '../paginas/Faturas'

vi.mock('../aplicacao/consultas/historico', () => ({
  puxarTudo: vi.fn(async () => [{
    id: 'tx-1', date: '2026-07-10', competencia: '2026-07', description: 'MERCADO',
    label: null, amount_cents: 10000, kind: 'expense', category_slug: 'supermercado',
    bank: 'nubank', doc_type: 'fatura', document_id: 'doc-1', installment: null,
  }]),
  puxarCategoriasUsuario: vi.fn(async () => []), puxarSaldos: vi.fn(async () => []),
}))
vi.mock('../aplicacao/consultas/documentos', () => ({
  puxarDocumentos: vi.fn(async () => [{
    id: 'doc-1', bank: 'nubank', doc_type: 'fatura', period_start: '2026-07-01',
    period_end: '2026-07-31', filename: 'fatura-origem.pdf', imported_at: '2026-08-01T00:00:00Z',
    declared_total: 10000, declared_income: null, declared_expense: null,
    conferencia: { versao: 1, status: 'confere', contagem: 1,
      comparacoes: [{ criterio: 'total-fatura', gabaritoCents: 10000, extraidoCents: 10000, diferencaCents: 0 }] },
  }]),
}))
vi.mock('../aplicacao/comandos/documentos', () => ({ apagarDocumento: vi.fn(), apagarTudo: vi.fn() }))

function Navegador() {
  const local = useLocation()
  const navigate = useNavigate()
  return <><output aria-label="Local">{local.pathname}{local.search}</output>
    <button onClick={() => navigate(-1)}>Voltar no navegador</button></>
}

describe('procedência entre Relatórios e Faturas', () => {
  it('abre o documento e volta ao mesmo detalhe com período, banco e janela', async () => {
    const usuario = userEvent.setup()
    render(<MemoryRouter initialEntries={['/relatorios?janela=3&banco=nubank&ref=2026-07']}>
      <DadosProvider><Routes>
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/faturas" element={<Faturas />} />
      </Routes><Navegador /></DadosProvider>
    </MemoryRouter>)
    await usuario.click(await screen.findByRole('button', { name: /Supermercado.*100,00.*Ver lançamentos/ }))
    const detalhe = screen.getByRole('region', { name: 'Supermercado' })
    await usuario.click(within(detalhe).getByText(/Nubank.*2026-07/))
    await usuario.click(within(detalhe).getByRole('button', { name: 'Ver documento importado' }))
    expect(await screen.findByText('fatura-origem.pdf')).toBeVisible()
    expect(screen.getByText('Conferência original')).toBeVisible()
    expect(screen.getByText('Ver dados do documento')).toHaveFocus()
    expect(screen.getByLabelText('Local')).toHaveTextContent('/faturas?')
    expect(screen.getByLabelText('Local')).toHaveTextContent('documento=doc-1')
    expect(screen.getByLabelText('Local')).toHaveTextContent('banco=nubank')
    expect(screen.getByLabelText('Local')).toHaveTextContent('ref=2026-07')
    await usuario.click(screen.getByRole('button', { name: 'Voltar no navegador' }))
    expect(await screen.findByRole('region', { name: 'Supermercado' })).toBeVisible()
    expect(screen.getByLabelText('Local')).toHaveTextContent('/relatorios?')
    expect(screen.getByLabelText('Local')).toHaveTextContent('janela=3')
    expect(screen.getByLabelText('Local')).toHaveTextContent('banco=nubank')
    expect(screen.getByLabelText('Local')).toHaveTextContent('ref=2026-07')
  })
})
