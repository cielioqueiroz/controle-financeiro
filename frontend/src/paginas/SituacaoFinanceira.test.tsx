import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { DadosProvider } from '../dados/DadosProvider'
import { puxarTudo, puxarSaldos } from '../aplicacao/consultas/historico'
import { SituacaoFinanceira } from './SituacaoFinanceira'

vi.mock('../aplicacao/consultas/historico', () => ({
  puxarTudo: vi.fn(),
  puxarCategoriasUsuario: vi.fn(async () => []),
  puxarSaldos: vi.fn(async () => []),
}))

const base = {
  id: 'tx-1', date: '2026-07-10', competencia: '2026-07',
  description: 'MERCADO', label: null, amount_cents: 10000,
  kind: 'expense', category_slug: 'supermercado', bank: 'nubank' as const,
  doc_type: 'fatura' as const, document_id: 'doc-1', installment: null,
}

function tx(competencia: string, id: string, bank: 'nubank' | 'bradesco' = 'nubank') {
  return { ...base, id, document_id: `doc-${id}`, bank, competencia, date: `${competencia}-10` }
}

function Endereco() {
  return <output aria-label="Endereço">{useLocation().search}</output>
}

function abrir(search = '') {
  return render(<MemoryRouter initialEntries={[`/minha-situacao-financeira${search}`]}>
    <DadosProvider><SituacaoFinanceira /><Endereco /></DadosProvider>
  </MemoryRouter>)
}

describe('Minha situação financeira — histórico por competência', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra carregamento, erro recuperável e vazio sem inventar valores', async () => {
    vi.mocked(puxarTudo).mockReturnValueOnce(new Promise(() => {}))
    const primeira = abrir()
    expect(screen.getByRole('status', { name: /carregando seus dados/i })).toBeVisible()
    expect(screen.queryByText('Saldo atual')).not.toBeInTheDocument()
    primeira.unmount()

    vi.mocked(puxarTudo).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
    abrir()
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao carregar.')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Nada por aqui ainda')).toBeVisible()
    expect(screen.getByRole('link', { name: /importar/i })).toHaveAttribute('href', '/importar')
    expect(screen.queryByText('Saldo atual')).not.toBeInTheDocument()
  })

  it('mantém as lacunas na janela e bloqueia comparação entre bases incompletas', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([
      tx('2026-01', 'jan'), tx('2026-05', 'mai'), tx('2026-07', 'jul'),
    ])
    abrir('?janela=3&comparar=1')
    expect(await screen.findByText('Meses que sustentam sua trajetória')).toBeVisible()
    expect(screen.getAllByText('mai 2026 — jul 2026').length).toBeGreaterThan(0)
    expect(screen.getByText(/A comparação fica indisponível/)).toBeVisible()
    expect(screen.getByText('Histórico insuficiente')).toBeVisible()
    expect(screen.queryByText(/% contra o período anterior/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Ver meses e documentos'))
    const meses = screen.getByRole('list', { name: 'Intervalo atual' })
    const junho = within(meses).getByText('jun 2026').closest('li')!
    expect(junho).toHaveTextContent('Sem transações importadas')
    expect(junho).not.toHaveTextContent('R$')
    expect(screen.getByLabelText('Endereço')).toHaveTextContent('janela=3')
  })

  it('compara intervalos consecutivos na virada do ano e preserva a seleção na URL', async () => {
    vi.mocked(puxarTudo).mockResolvedValue(
      ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']
        .map((mes, i) => tx(mes, String(i))),
    )
    abrir('?janela=3&comparar=1')
    expect(await screen.findByText('Meses que sustentam sua trajetória')).toBeVisible()
    expect(screen.getByText('out 2025 — dez 2025')).toBeVisible()
    expect(screen.getAllByText('jan 2026 — mar 2026').length).toBeGreaterThan(0)
    expect(screen.getByText('Comparação disponível')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: /Selecionar fev 2026/ }))
    expect(screen.getByLabelText('Endereço')).toHaveTextContent('mes=2026-02')
    expect(screen.getByLabelText('Endereço')).toHaveTextContent('comparar=1')
    await userEvent.click(screen.getByRole('button', { name: '6 meses' }))
    expect(screen.getByLabelText('Endereço')).toHaveTextContent('janela=6')
    expect(screen.getByLabelText('Endereço')).not.toHaveTextContent('mes=')
  })

  it('não preenche meses do banco selecionado com transações de outro banco', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([
      tx('2026-07', 'nub'),
      ...['2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
        .map((mes, i) => tx(mes, `bra-${i}`, 'bradesco')),
    ])
    vi.mocked(puxarSaldos).mockResolvedValue(['nubank', 'bradesco'].map((bank, i) => ({
      bank, account_id: `conta-${i}`, doc_type: 'extrato', period_end: '2026-07-31',
      end_balance_cents: i === 0 ? 12300 : 45600, total_open_balance: null,
      next_invoice_balance: null, next_close_date: null, future_installments_total: null,
    })))
    abrir('?janela=3&banco=nubank&comparar=1')
    expect(await screen.findByText('Meses que sustentam sua trajetória')).toBeVisible()
    expect(screen.getAllByText('mai 2026 — jul 2026').length).toBeGreaterThan(0)
    expect(screen.getByText('Histórico insuficiente')).toBeVisible()
    expect(screen.getAllByText('1 de 3 meses com transações').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/123,00/)[0]).toBeVisible()
    expect(screen.queryByText(/456,00/)).not.toBeInTheDocument()
  })
})
