import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { DadosProvider } from '../dados/DadosProvider'
import { Painel } from './Painel'

vi.mock('../persist/puxar', () => ({ puxarTudo: vi.fn(() => Promise.resolve([])) }))
vi.mock('../persist/categoriasUsuario', () => ({
  puxarCategoriasUsuario: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../persist/documentos', () => ({ puxarSaldos: vi.fn(() => Promise.resolve([])) }))
vi.mock('../lib/relatorio-pdf', () => ({ gerarRelatorioPdf: vi.fn() }))

import { puxarTudo } from '../persist/puxar'

function tx(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: crypto.randomUUID(),
    date: '2026-06-10',
    competencia: '2026-06',
    description: 'MERCADO',
    label: null,
    amount_cents: 10000,
    kind: 'expense',
    category_slug: 'supermercado',
    bank: 'nubank',
    doc_type: 'fatura',
    document_id: 'd1',
    installment: null,
    ...over,
  }
}

/** Cinco compras de R$ 100 em maio: a rotina do supermercado. */
const MAIO = Array.from({ length: 5 }, (_, i) =>
  tx({ description: `MERCADO BAIRRO ${i}`, competencia: '2026-05', date: `2026-05-1${i}` }))
const JUNHO = [
  tx({ description: 'MERCADO BAIRRO 0', date: '2026-06-03' }),
  tx({ description: 'ATACADAO', date: '2026-06-20', amount_cents: 200000 }),
]

function abrirEmJunho(lista: ReturnType<typeof tx>[]) {
  vi.mocked(puxarTudo).mockResolvedValue(lista as never)
  render(
    <MemoryRouter initialEntries={['/?ref=2026-06-15&p=mes']}>
      <DadosProvider>
        <Painel />
      </DadosProvider>
    </MemoryRouter>,
  )
}

async function expandirAnalise() {
  fireEvent.click(await screen.findByText('Explorar o período'))
}

beforeEach(() => vi.clearAllMocks())

// Auditoria de 30/10, item 2.2: a compra atípica sai dos gráficos do período
// quando a pessoa pede, e o gasto real do topo continua com ela.
describe('Painel — sem atípicos', () => {
  it('diz quantas compras atípicas o período tem e quanto somam', async () => {
    abrirEmJunho([...MAIO, ...JUNHO])
    await expandirAnalise()
    expect(await screen.findByText(/1 compra atípica soma R\$ 2\.000,00 neste período\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sem atípicos' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('tira a atípica do gráfico de categorias e mantém o gasto real do topo', async () => {
    abrirEmJunho([...MAIO, ...JUNHO])
    await expandirAnalise()
    const categoria = () => screen.getByRole('button', { name: /^Supermercado R\$.*do total/ })
    expect(categoria()).toHaveAccessibleName(/R\$\s2\.100,00/)

    await userEvent.click(screen.getByRole('button', { name: 'Sem atípicos' }))

    expect(screen.getByRole('button', { name: 'Sem atípicos' })).toHaveAttribute('aria-pressed', 'true')
    expect(categoria()).toHaveAccessibleName(/R\$\s100,00/)
    expect(screen.getByText(/Fora dos gráficos: 1 compra atípica, R\$ 2\.000,00\./)).toBeInTheDocument()
    expect((await screen.findAllByText('R$ 2.100,00')).length).toBeGreaterThan(0)
  })

  it('tira a atípica do ritmo diário', async () => {
    abrirEmJunho([...MAIO, ...JUNHO])
    await expandirAnalise()
    expect(await screen.findByRole('button', { name: /20\/jun/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sem atípicos' }))
    expect(screen.queryByRole('button', { name: /20\/jun/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /3\/jun/ })).toBeInTheDocument()
  })

  it('sem atípicos no período, a alternância não aparece', async () => {
    abrirEmJunho([...MAIO, JUNHO[0]])
    await expandirAnalise()
    expect(await screen.findByRole('button', { name: /3\/jun/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sem atípicos' })).not.toBeInTheDocument()
  })
})
