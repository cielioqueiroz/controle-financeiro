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
import { puxarSaldos } from '../persist/documentos'

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
    document_id: 'fat-jun',
    installment: null,
    ...over,
  }
}

const doc = (over: Record<string, unknown>) => ({
  bank: 'nubank', account_id: 'cartao', doc_type: 'fatura', period_end: '2026-06-10', declared_total: null,
  end_balance_cents: null, total_open_balance: null, next_invoice_balance: null, next_close_date: null,
  future_installments_total: null, ...over,
})

function abrir(lista: ReturnType<typeof tx>[], docs: ReturnType<typeof doc>[] = [], url = '/?ref=2026-06-15&p=mes') {
  vi.mocked(puxarTudo).mockResolvedValue(lista as never)
  vi.mocked(puxarSaldos).mockResolvedValue(docs as never)
  render(
    <MemoryRouter initialEntries={[url]}>
      <DadosProvider>
        <Painel />
      </DadosProvider>
    </MemoryRouter>,
  )
}

const salario = tx({ description: 'SALARIO', kind: 'income', amount_cents: -500000, doc_type: 'extrato', bank: 'bradesco', document_id: 'ext-jun' })
const emprestimo = tx({ description: 'PAGAMENTO EMPRESTIMO', amount_cents: 225000, category_slug: 'dividas', doc_type: 'extrato', bank: 'bradesco', document_id: 'ext-jun' })

beforeEach(() => vi.clearAllMocks())

// Auditoria de 30/10, item 2.3.
describe('Painel — alertas que o documento já permite', () => {
  it('acusa a fatura paga a menor, com o que sobrou para o rotativo', async () => {
    abrir(
      [tx(), tx({ description: 'PAGTO FATURA NUBANK', kind: 'card_payment', amount_cents: 80000, doc_type: 'extrato', bank: 'bradesco', document_id: 'ext-jun' })],
      [
        doc({ id: 'fat-jun', declared_total: 200000 }),
        doc({ id: 'ext-jun', bank: 'bradesco', account_id: 'conta', doc_type: 'extrato', period_end: '2026-06-30' }),
      ],
    )
    expect(await screen.findByText('Fatura paga a menor')).toBeInTheDocument()
    expect(screen.getByText(/era de R\$ 2\.000,00, e o pagamento encontrado nos seus documentos foi de R\$ 800,00\. Os R\$ 1\.200,00 restantes vão para o rotativo/))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ver faturas/ })).toBeInTheDocument()
  })

  it('diz o comprometimento e que a faixa não é norma do Banco Central', async () => {
    abrir([tx(), salario, emprestimo])
    expect(await screen.findByText('Comprometimento de renda')).toBeInTheDocument()
    const texto = screen.getByText(/levaram 45% das entradas/)
    expect(texto).toHaveTextContent('faixa elevada')
    expect(texto).toHaveTextContent('Não é norma do Banco Central.')
  })

  it('cala o comprometimento sem entradas no recorte', async () => {
    abrir([tx(), emprestimo])
    expect((await screen.findAllByText('R$ 2.550,00')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Comprometimento de renda')).not.toBeInTheDocument()
  })

  it('cala o comprometimento num recorte de semana', async () => {
    abrir([tx(), salario, emprestimo], [], '/?ref=2026-06-10&p=semana')
    expect((await screen.findAllByText('R$ 2.550,00')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Comprometimento de renda')).not.toBeInTheDocument()
  })
})
