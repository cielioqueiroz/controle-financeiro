import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { categoria } from '../../domain/categorize/categorias'
import { GraficoCategorias } from './GraficoCategorias'

function Endereco() {
  const { pathname, search } = useLocation()
  return <output data-testid="endereco">{pathname + search}</output>
}

describe('Onde você gastou', () => {
  it('abre os lançamentos da categoria preservando o recorte', async () => {
    render(<MemoryRouter initialEntries={['/?ref=2026-06&banco=nubank']}>
      <GraficoCategorias formato="barras" totalCents={100000} categorias={[
        { cat: categoria('supermercado'), totalCents: 60000, contagem: 8 },
        { cat: categoria('transporte'), totalCents: 40000, contagem: 3 },
      ]} />
      <Endereco />
    </MemoryRouter>)
    expect(screen.getByText('Onde você gastou')).toBeInTheDocument()
    const botao = screen.getByRole('button', { name: /^Supermercado R\$\s600,00 60% do total/ })
    await userEvent.click(botao)
    const endereco = screen.getByTestId('endereco').textContent ?? ''
    expect(endereco).toContain('/lancamentos?')
    expect(endereco).toContain('cat=supermercado')
    expect(endereco).toContain('ref=2026-06')
    expect(endereco).toContain('banco=nubank')
  })

  it('mantém os estornos separados e o gasto real líquido, inclusive quando zera', () => {
    render(<MemoryRouter><GraficoCategorias formato="barras" totalCents={0} categorias={[
      { cat: categoria('supermercado'), totalCents: 10000, contagem: 1 },
      { cat: categoria('farmacia'), totalCents: -10000, contagem: 1 },
    ]} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /^Supermercado.*100%/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Farmácia.*-R\$\s100,00.*Estorno/ })).toBeInTheDocument()
    expect(screen.getByText(/Gasto real após estornos.*R\$\s0,00/)).toBeInTheDocument()
  })

  it('mantém o percentual real quando uma dívida domina e explica o corte da barra', () => {
    render(<MemoryRouter><GraficoCategorias formato="barras" totalCents={1000000} categorias={[
      { cat: categoria('dividas'), totalCents: 950000, contagem: 1 },
      { cat: categoria('supermercado'), totalCents: 20000, contagem: 5 },
      { cat: categoria('transporte'), totalCents: 15000, contagem: 3 },
      { cat: categoria('farmacia'), totalCents: 10000, contagem: 2 },
      { cat: categoria('padaria'), totalCents: 5000, contagem: 2 },
    ]} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /^Dívidas.*95%/ })).toBeInTheDocument()
    expect(screen.getByText(/1 categoria acima/)).toBeInTheDocument()
  })
})
