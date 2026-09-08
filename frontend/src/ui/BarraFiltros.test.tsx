import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { BarraFiltros } from './BarraFiltros'

/** O que o `useDados` devolve é trocado por caso — é dele que sai a lista de
 *  bancos, e é ela que decide se o filtro de banco aparece. */
let bancos: { bank: string }[] = []
vi.mock('../dados/DadosProvider', () => ({
  useDados: () => ({ todas: bancos }),
}))

/** A URL não é detalhe de implementação aqui: ela **é** o estado do recorte
 *  (ver `useFiltros`). Por isso o `useFiltros` real entra no teste, dentro de
 *  um router de memória, e a sonda lê o endereço resultante — é o que prova
 *  que recarregar mantém o filtro e que mandar a tela para alguém é copiar o
 *  endereço. */
function Endereco() {
  const { search } = useLocation()
  return <output data-testid="url">{search}</output>
}

function montar(props: { mostrarPeriodo?: boolean } = {}, urlInicial = '/') {
  return render(
    <MemoryRouter initialEntries={[urlInicial]}>
      <BarraFiltros {...props} />
      <Endereco />
    </MemoryRouter>,
  )
}

const url = () => screen.getByTestId('url').textContent ?? ''

describe('BarraFiltros', () => {
  beforeEach(() => {
    bancos = [{ bank: 'nubank' }, { bank: 'bradesco' }]
  })

  it('marca o período que veio da URL', () => {
    montar({}, '/?p=semana')
    expect(screen.getByRole('button', { name: 'Semana' })).toBeInTheDocument()
    // O padrão é mês; veio 'semana' na URL, então é 'semana' que manda.
    expect(url()).toContain('p=semana')
  })

  it('escreve o período escolhido na URL', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(screen.getByRole('button', { name: 'Ano' }))

    expect(url()).toContain('p=ano')
  })

  /** Mês e Ano agrupam por **competência** (a fatura em que a compra caiu);
   *  Dia e Semana, pela data real da compra. A legenda existe porque os dois
   *  números divergem de propósito, e sem ela o app pareceria estar errado. */
  it('diz que mês e ano agrupam por fatura', () => {
    montar({}, '/?p=mes')
    expect(screen.getByText('por fatura')).toBeInTheDocument()
  })

  it('diz que dia e semana agrupam pela data da compra', () => {
    montar({}, '/?p=dia')
    expect(screen.getByText('por data da compra')).toBeInTheDocument()
  })

  it('anda para o período anterior e para o próximo', async () => {
    const usuario = userEvent.setup()
    montar({}, '/?p=mes&ref=2026-06')

    await usuario.click(screen.getByRole('button', { name: 'Período anterior' }))
    expect(url()).toContain('ref=2026-05')

    await usuario.click(screen.getByRole('button', { name: 'Próximo período' }))
    expect(url()).toContain('ref=2026-06')
  })

  /** "Senão é um filtro que não filtra": com um banco só, as pílulas seriam
   *  dois botões que sempre mostram o mesmo recorte. */
  it('esconde o filtro de banco quando só há um banco', () => {
    bancos = [{ bank: 'nubank' }, { bank: 'nubank' }]
    montar()

    expect(screen.queryByRole('button', { name: 'Total geral' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nubank/ })).not.toBeInTheDocument()
  })

  it('mostra uma pílula por banco, mais o total geral, a partir de dois', () => {
    montar()

    expect(screen.getByRole('button', { name: 'Total geral' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nubank/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bradesco/ })).toBeInTheDocument()
  })

  it('não repete o banco que aparece em várias transações', () => {
    bancos = [{ bank: 'nubank' }, { bank: 'nubank' }, { bank: 'bradesco' }]
    montar()

    expect(screen.getAllByRole('button', { name: /Nubank/ })).toHaveLength(1)
  })

  it('escreve o banco escolhido na URL', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(screen.getByRole('button', { name: /Bradesco/ }))

    expect(url()).toContain('banco=bradesco')
  })

  /** Recorrências olha o histórico INTEIRO — reconhecer "se repete todo mês"
   *  exige mais de um mês —, então o seletor de período não se aplica ali. Um
   *  controle visível que a página ignora é a mesma mentira do filtro
   *  invisível, com o sinal trocado. */
  it('sem período: some o seletor e a navegação, fica o filtro de banco', () => {
    montar({ mostrarPeriodo: false })

    expect(screen.queryByRole('button', { name: 'Mês' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Período anterior' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Próximo período' })).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Bradesco/ })).toBeInTheDocument()
  })

  // Sem documento importado não há banco nenhum, e o componente não pode
  // quebrar por causa disso — é o estado do primeiro acesso.
  it('aguenta o histórico vazio', () => {
    bancos = []
    montar()
    expect(screen.getByRole('button', { name: 'Mês' })).toBeInTheDocument()
  })
})
