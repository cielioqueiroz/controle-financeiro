import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

const salario = tx({
  description: 'SALARIO EMPRESA',
  amount_cents: -600000,
  kind: 'income',
  category_slug: null,
  bank: 'bradesco',
  doc_type: 'extrato',
  document_id: 'd2',
})
// Vínculo: a quitação da fatura no extrato não é gasto, nem entrada.
const quitacao = tx({
  description: 'PAGTO FATURA NUBANK',
  amount_cents: 30000,
  kind: 'card_payment',
  category_slug: null,
  bank: 'bradesco',
  doc_type: 'extrato',
  document_id: 'd2',
})

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

function detalhe() {
  return screen.getByText('Transações e documentos deste valor').closest('[data-prova="detalhe-relatorio"]') as HTMLElement
}

beforeEach(() => vi.clearAllMocks())

// Auditoria de 30/10, item U7: o detalhe "transações e documentos deste
// valor" dos Relatórios chega aos três números do cabeçalho do Painel.
describe('Painel — de onde vem cada número do cabeçalho', () => {
  it('o gasto real abre só as despesas, sem o vínculo e sem a entrada', async () => {
    abrirEmJunho([tx(), salario, quitacao])
    await userEvent.click(await screen.findByRole('button', { name: 'De onde vem: Gasto real' }))

    const painel = detalhe()
    expect(within(painel).getByRole('heading', { name: 'Gasto real' })).toHaveFocus()
    expect(within(painel).getByText('Mercado')).toBeInTheDocument()
    expect(within(painel).queryByText('Salario Empresa')).not.toBeInTheDocument()
    expect(within(painel).queryByText('Pagto Fatura Nubank')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'De onde vem: Gasto real' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('as entradas aparecem positivas, como no número', async () => {
    abrirEmJunho([tx(), salario, quitacao])
    await userEvent.click(await screen.findByRole('button', { name: 'De onde vem: Entradas' }))

    const painel = detalhe()
    expect(within(painel).getByText('Salario Empresa')).toBeInTheDocument()
    expect(within(painel).getAllByText('R$ 6.000,00').length).toBeGreaterThan(0)
    expect(within(painel).queryByText('Mercado')).not.toBeInTheDocument()
  })

  it('o resultado soma as entradas e subtrai as despesas', async () => {
    abrirEmJunho([tx(), salario, quitacao])
    await userEvent.click(await screen.findByRole('button', { name: 'De onde vem: Resultado' }))

    const painel = detalhe()
    expect(within(painel).getByText('Salario Empresa')).toBeInTheDocument()
    expect(within(painel).getByText('Mercado')).toBeInTheDocument()
    expect(within(painel).queryByText('Pagto Fatura Nubank')).not.toBeInTheDocument()
    // Total do cabeçalho do detalhe = 6.000 − 300.
    expect(within(painel).getByText('R$ 5.700,00')).toBeInTheDocument()
  })

  it('Fechar devolve o foco ao botão que abriu', async () => {
    abrirEmJunho([tx(), salario])
    const gatilho = await screen.findByRole('button', { name: 'De onde vem: Gasto real' })
    await userEvent.click(gatilho)
    await userEvent.click(within(detalhe()).getByRole('button', { name: 'Fechar' }))

    expect(screen.queryByText('Transações e documentos deste valor')).not.toBeInTheDocument()
    expect(gatilho).toHaveFocus()
    expect(gatilho).toHaveAttribute('aria-expanded', 'false')
  })

  it('o mesmo botão abre e fecha', async () => {
    abrirEmJunho([tx(), salario])
    const gatilho = await screen.findByRole('button', { name: 'De onde vem: Entradas' })
    await userEvent.click(gatilho)
    expect(screen.getByText('Transações e documentos deste valor')).toBeInTheDocument()
    await userEvent.click(gatilho)
    expect(screen.queryByText('Transações e documentos deste valor')).not.toBeInTheDocument()
  })

  it('sem entradas no recorte, o número não ganha botão', async () => {
    abrirEmJunho([tx()])
    expect(await screen.findByRole('button', { name: 'De onde vem: Gasto real' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'De onde vem: Entradas' })).not.toBeInTheDocument()
  })
})
