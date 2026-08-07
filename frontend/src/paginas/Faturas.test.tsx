import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Faturas } from './Faturas'
import { DadosProvider } from '../dados/DadosProvider'

vi.mock('../persist/puxar', () => ({
  puxarTudo: vi.fn(() =>
    Promise.resolve([
      {
        id: 't1',
        date: '2026-06-20',
        competencia: '2026-06',
        description: 'PAGAMENTO FATURA',
        label: null,
        amount_cents: -50000,
        kind: 'card_payment',
        category_slug: null,
        bank: 'nubank',
        doc_type: 'extrato',
        document_id: 'doc-2',
        installment: null,
      },
      {
        id: 't2',
        date: '2026-06-05',
        competencia: '2026-06',
        description: 'MERCADO',
        label: null,
        amount_cents: 12000,
        kind: 'expense',
        category_slug: 'supermercado',
        bank: 'nubank',
        doc_type: 'fatura',
        document_id: 'doc-1',
        installment: null,
      },
    ]),
  ),
}))
vi.mock('../persist/categoriasUsuario', () => ({
  puxarCategoriasUsuario: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../persist/documentos', () => ({
  puxarSaldos: vi.fn(() => Promise.resolve([])),
  puxarDocumentos: vi.fn(() =>
    Promise.resolve([
      {
        id: 'doc-1',
        bank: 'nubank',
        doc_type: 'fatura',
        period_start: '2026-05-10',
        period_end: '2026-06-10',
        declared_total: 12000,
        imported_at: '2026-06-15T10:00:00Z',
      },
    ]),
  ),
  apagarDocumento: vi.fn(),
  apagarTudo: vi.fn(),
}))

function montar() {
  return render(
    <DadosProvider>
      <Faturas />
    </DadosProvider>,
  )
}

describe('página Faturas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lista os documentos importados', async () => {
    montar()
    expect(await screen.findByText(/nubank/i)).toBeInTheDocument()
  })

  // Era um modal. Numa página, travar a rolagem do body congelaria a página
  // inteira — o `useTravarRolagem` foi descartado junto com o invólucro, não
  // adaptado.
  it('não trava a rolagem do body — isso era comportamento de modal', async () => {
    montar()
    await screen.findByText(/nubank/i)
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  // A lista tinha `max-h-[55vh] overflow-y-auto` para caber no card do modal.
  // Numa página que já rola, isso é a barra dupla que o usuário reclamou:
  // conteúdo preso atrás de uma segunda barra de rolagem.
  it('não cria barra de rolagem própria dentro da página', async () => {
    const { container } = montar()
    await screen.findByText(/nubank/i)
    expect(container.querySelector('.overflow-y-auto')).toBeNull()
    expect(container.innerHTML).not.toContain('max-h-[55vh]')
  })

  // Sem botão de fechar: quem sai daqui usa a barra de navegação. Um "✕"
  // numa página não teria o que fechar.
  it('não oferece botão de fechar', async () => {
    montar()
    await screen.findByText(/nubank/i)
    expect(screen.queryByRole('button', { name: /fechar/i })).toBeNull()
  })
})
