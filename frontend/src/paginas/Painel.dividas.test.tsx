import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    amount_cents: 30000,
    kind: 'expense',
    category_slug: 'supermercado',
    bank: 'nubank',
    doc_type: 'fatura',
    document_id: 'd1',
    installment: null,
    ...over,
  }
}

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

const emprestimo = tx({
  description: 'PAGAMENTO EMPRESTIMO',
  amount_cents: 4165385,
  category_slug: 'dividas',
  bank: 'bradesco',
  doc_type: 'extrato',
  document_id: 'd2',
})

beforeEach(() => vi.clearAllMocks())

// Auditoria de 30/10, item 1.4: a parcela de um empréstimo era 91% do mês e
// falava por ele inteiro. O total continua o mesmo; o que muda é que ele
// passa a dizer de que é feito.
describe('Painel — gasto real em consumo e dívidas', () => {
  it('abre o gasto real nas duas parcelas', async () => {
    abrirEmJunho([tx(), emprestimo])
    expect((await screen.findAllByText('R$ 41.953,85')).length).toBeGreaterThan(0)
    expect(screen.getByText('Consumo').parentElement).toHaveTextContent('R$ 300,00')
    expect(screen.getByText('Dívidas', { selector: 'dt' }).parentElement)
      .toHaveTextContent('R$ 41.653,85')
  })

  it('não abre nada quando não há dívida', async () => {
    abrirEmJunho([tx()])
    expect((await screen.findAllByText('R$ 300,00')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Consumo')).not.toBeInTheDocument()
  })

  it('a maior categoria é a de consumo, não a dívida', async () => {
    abrirEmJunho([tx(), emprestimo])
    expect(await screen.findByText('Supermercado concentrou 100% do consumo (R$ 300,00).'))
      .toBeInTheDocument()
  })
})
