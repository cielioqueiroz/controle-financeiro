import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DadosProvider } from '../dados/DadosProvider'
import { Recorrencias } from './Recorrencias'

vi.mock('../persist/puxar', () => ({ puxarTudo: vi.fn(() => Promise.resolve([])) }))
vi.mock('../persist/categoriasUsuario', () => ({
  puxarCategoriasUsuario: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../persist/documentos', () => ({ puxarSaldos: vi.fn(() => Promise.resolve([])) }))

import { puxarTudo } from '../persist/puxar'
import { puxarSaldos } from '../persist/documentos'

function tx(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: crypto.randomUUID(),
    date: '2026-06-05',
    competencia: '2026-06',
    description: 'ALUGUEL APTO',
    label: null,
    amount_cents: 200000,
    kind: 'expense',
    category_slug: 'moradia',
    bank: 'bradesco',
    doc_type: 'extrato',
    document_id: 'd1',
    installment: null,
    ...over,
  }
}

const MESES = ['2026-04', '2026-05', '2026-06']
const ALUGUEL = MESES.map((c) => tx({ competencia: c, date: `${c}-05` }))
const SALARIO = MESES.map((c) => tx({
  competencia: c, date: `${c}-05`, description: 'SALARIO EMPRESA', kind: 'income', amount_cents: -600000, category_slug: 'salario',
}))
const PARCELA = tx({
  description: 'TV', bank: 'nubank', account_id: 'c1', doc_type: 'fatura', amount_cents: 50000, installment: { current: 2, total: 6 }, date: '2026-05-20',
})

function abrir() {
  render(
    <MemoryRouter initialEntries={['/recorrencias']}>
      <DadosProvider>
        <Recorrencias />
      </DadosProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => vi.clearAllMocks())

// Auditoria de 30/10, item 2.6: o que deve cair no mês seguinte ao último
// importado, dia a dia.
describe('Recorrências — calendário do próximo mês', () => {
  it('mostra o mês seguinte com o que deve sair e entrar', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([...ALUGUEL, ...SALARIO] as never)
    abrir()
    const calendario = await screen.findByRole('region', { name: 'O que deve cair em julho de 2026' })
    expect(within(calendario).getByText('Aluguel Apto')).toBeInTheDocument()
    expect(within(calendario).getByText('Salario Empresa')).toBeInTheDocument()
    expect(within(calendario).getByText('Deve sair').nextElementSibling).toHaveTextContent('R$ 2.000,00')
    expect(within(calendario).getByText('Deve entrar').nextElementSibling).toHaveTextContent('R$ 6.000,00')
    expect(within(calendario).getByText('05')).toBeInTheDocument()
  })

  it('as parcelas do cartão caem no vencimento da fatura dele', async () => {
    vi.mocked(puxarTudo).mockResolvedValue([...ALUGUEL, PARCELA] as never)
    vi.mocked(puxarSaldos).mockResolvedValue([
      { id: 'f1', bank: 'nubank', account_id: 'c1', doc_type: 'fatura', period_end: '2026-06-12', declared_total: 50000,
        end_balance_cents: null, total_open_balance: null, next_invoice_balance: null, next_close_date: null, future_installments_total: null },
    ] as never)
    abrir()
    const calendario = await screen.findByRole('region', { name: /O que deve cair em/ })
    const dia = within(calendario).getByText('12').closest('li')!
    expect(dia).toHaveTextContent('Parcelas na fatura Nubank')
    expect(dia).toHaveTextContent('1 parcela')
    expect(dia).toHaveTextContent('TV 3/6')
    expect(within(calendario).getByText('Deve sair').nextElementSibling).toHaveTextContent('R$ 2.500,00')
  })

  it('o aluguel reajustado entra com o valor novo e diz quanto era', async () => {
    const julho = tx({ competencia: '2026-07', date: '2026-07-05', amount_cents: 220000 })
    vi.mocked(puxarTudo).mockResolvedValue([...ALUGUEL, julho] as never)
    abrir()
    const calendario = await screen.findByRole('region', { name: 'O que deve cair em agosto de 2026' })
    expect(within(calendario).getByText('Valor novo do último mês; antes era R$ 2.000,00.')).toBeInTheDocument()
    expect(within(calendario).getByText('Deve sair').nextElementSibling).toHaveTextContent('R$ 2.200,00')
  })

  it('a recorrência que sumiu fica na lista e fora do calendário', async () => {
    // O aluguel parou em junho e o histórico já chega a setembro.
    const setembro = tx({ description: 'LOJA', competencia: '2026-09', date: '2026-09-02', category_slug: 'vestuario', amount_cents: 5000 })
    vi.mocked(puxarTudo).mockResolvedValue([...ALUGUEL, setembro] as never)
    abrir()
    expect(await screen.findByText('Aluguel Apto')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /O que deve cair em/ })).not.toBeInTheDocument()
  })
})
