import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { DadosProvider } from '../dados/DadosProvider'
import { puxarTudo } from '../aplicacao/consultas/historico'
import { Relatorios } from './Relatorios'

vi.mock('../aplicacao/consultas/historico', () => ({
  puxarTudo: vi.fn(),
  puxarCategoriasUsuario: vi.fn(async () => []),
  puxarSaldos: vi.fn(async () => []),
}))

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
  tx({ description: `MERCADO BAIRRO ${i}`, competencia: '2026-05', date: `2026-05-1${i}`, document_id: 'd0' }))
const JUNHO = [
  tx({ description: 'MERCADO BAIRRO 0', date: '2026-06-03' }),
  tx({ description: 'ATACADAO', date: '2026-06-20', amount_cents: 200000 }),
  tx({ description: 'SALARIO', date: '2026-06-05', amount_cents: -500000, kind: 'income', category_slug: null }),
]

function Endereco() {
  return <output aria-label="Endereço">{useLocation().search}</output>
}

function abrir(lista: ReturnType<typeof tx>[], search = '?janela=3') {
  vi.mocked(puxarTudo).mockResolvedValue(lista as never)
  render(
    <MemoryRouter initialEntries={[`/relatorios${search}`]}>
      <DadosProvider><Relatorios /><Endereco /></DadosProvider>
    </MemoryRouter>,
  )
}

const fatiaDoDonut = () => screen.getByRole('button', { name: /^Supermercado .*do total\. Ver lançamentos\.$/ })
const destinoDoFluxo = () => screen.getByRole('button', { name: /^Supermercado [^d]*Ver lançamentos\.$/ })

beforeEach(() => vi.clearAllMocks())

// Decisão do dono (03/11): nos Relatórios a alternância vale só para o donut.
// O fluxo do período promete que o "Sobrou" é o Resultado, e a compra atípica
// é dinheiro que saiu de verdade.
describe('Relatórios — sem atípicos', () => {
  it('diz quantas compras atípicas o intervalo tem e quanto somam', async () => {
    abrir([...MAIO, ...JUNHO])
    expect(await screen.findByText(/1 compra atípica soma R\$ 2\.000,00 neste período\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sem atípicos' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('tira a atípica só do donut: despesas e fluxo do período continuam com ela', async () => {
    abrir([...MAIO, ...JUNHO])
    await screen.findByRole('button', { name: 'Sem atípicos' })
    expect(fatiaDoDonut()).toHaveAccessibleName(/R\$\s2\.600,00/)

    await userEvent.click(screen.getByRole('button', { name: 'Sem atípicos' }))

    expect(screen.getByRole('button', { name: 'Sem atípicos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Endereço')).toHaveTextContent('atipicos=fora')
    expect(fatiaDoDonut()).toHaveAccessibleName(/R\$\s600,00/)
    expect(screen.getByText(/Fora do gráfico de categorias: 1 compra atípica, R\$ 2\.000,00\./)).toBeInTheDocument()
    expect(destinoDoFluxo()).toHaveAccessibleName(/R\$\s2\.600,00/)
    expect(screen.getByText('Despesas').parentElement).toHaveTextContent('R$ 2.600,00')
  })

  it('o centro do donut não chama de gasto real o total sem atípicos', async () => {
    // Uma categoria só vira o cartão de "dominante", sem anel nem centro.
    const restaurante = tx({ description: 'RESTAURANTE', date: '2026-06-08', amount_cents: 40000, category_slug: 'restaurante' })
    abrir([...MAIO, ...JUNHO, restaurante], '?janela=3&atipicos=fora')
    expect(await screen.findByRole('button', { name: 'Sem atípicos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: /^Gasto por categoria, total R\$\s1\.000,00$/ })).toBeInTheDocument()
    expect(screen.getByText('sem atípicos')).toBeInTheDocument()
  })

  it('sem atípicos no intervalo, a alternância não aparece e o pedido da URL não vale', async () => {
    const restaurante = tx({ description: 'RESTAURANTE', date: '2026-06-08', amount_cents: 40000, category_slug: 'restaurante' })
    abrir([...MAIO, JUNHO[0], restaurante], '?janela=3&atipicos=fora')
    await screen.findByText('2 faturas')
    expect(screen.queryByRole('button', { name: 'Sem atípicos' })).not.toBeInTheDocument()
    expect(fatiaDoDonut()).toHaveAccessibleName(/R\$\s600,00/)
    expect(screen.queryByText('sem atípicos')).not.toBeInTheDocument()
  })
})
