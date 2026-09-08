import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ListaPorCategoria } from './ListaPorCategoria'
import { categoria } from '../../domain/categorize/categorias'
import type { GrupoCategoria } from '../../domain/agrupar'
import type { TransacaoSalva } from '../../aplicacao/consultas/historico'

const tx = (over: Partial<TransacaoSalva> = {}): TransacaoSalva => ({
  id: 'x',
  date: '2026-06-05',
  competencia: '2026-06',
  description: 'SUPERMERCADO BH',
  label: null,
  amount_cents: 18000,
  kind: 'expense',
  category_slug: 'supermercado',
  bank: 'nubank',
  doc_type: 'extrato',
  document_id: 'd1',
  installment: null,
  ...over,
})

const grupo = (
  slug: string,
  over: Partial<GrupoCategoria<TransacaoSalva>> = {},
): GrupoCategoria<TransacaoSalva> => ({
  slug,
  cat: categoria(slug),
  totalCents: 18000,
  contagem: 1,
  itens: [tx({ category_slug: slug })],
  ...over,
})

describe('ListaPorCategoria', () => {
  it('avisa quando o período não tem despesa', () => {
    render(<ListaPorCategoria grupos={[]} totalCents={0} onEditar={() => {}} />)
    expect(screen.getByText(/Sem despesas neste período/)).toBeInTheDocument()
  })

  it('mostra o nome, o total e a contagem de cada categoria', () => {
    render(
      <ListaPorCategoria
        grupos={[
          grupo('supermercado', {
            totalCents: 18000,
            contagem: 3,
            // Valores diferentes de propósito: com a transação valendo o
            // mesmo que a seção, o teste passaria mesmo se a soma da
            // categoria sumisse da tela.
            itens: [tx({ amount_cents: 5000 })],
          }),
        ]}
        totalCents={18000}
        onEditar={() => {}}
      />,
    )

    expect(screen.getByText('Supermercado')).toBeInTheDocument()
    expect(screen.getByText('R$ 180,00')).toBeInTheDocument()
    expect(screen.getByText(/3 · 100%/)).toBeInTheDocument()
  })

  it('calcula o percentual sobre o total do recorte, não sobre a soma das seções', () => {
    render(
      <ListaPorCategoria
        grupos={[grupo('supermercado', { totalCents: 2500 })]}
        totalCents={10000}
        onEditar={() => {}}
      />,
    )
    expect(screen.getByText(/· 25%/)).toBeInTheDocument()
  })

  /** Divisão por zero daria `NaN%` na tela. Recorte sem gasto é estado
   *  possível — um mês só de entradas —, e o app não pode escrever NaN. */
  it('não escreve NaN quando o total do recorte é zero', () => {
    render(
      <ListaPorCategoria
        grupos={[grupo('supermercado', { totalCents: 0 })]}
        totalCents={0}
        onEditar={() => {}}
      />,
    )

    expect(screen.getByText(/· 0%/)).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  })

  /** A maior categoria já vem aberta: os grupos chegam ordenados por valor,
   *  e abrir a primeira responde de graça a pergunta que traz a pessoa aqui
   *  — "onde foi o dinheiro". */
  it('abre a primeira categoria por padrão, e só ela', () => {
    render(
      <ListaPorCategoria
        grupos={[
          grupo('supermercado', { itens: [tx({ id: 'a', description: 'SUPERMERCADO BH' })] }),
          grupo('farmacia', { itens: [tx({ id: 'b', description: 'DROGARIA SP' })] }),
        ]}
        totalCents={36000}
        onEditar={() => {}}
      />,
    )

    expect(screen.getByText('SUPERMERCADO BH')).toBeInTheDocument()
    expect(screen.queryByText('DROGARIA SP')).not.toBeInTheDocument()
  })

  it('abre a categoria clicada sem fechar a que já estava aberta', async () => {
    const usuario = userEvent.setup()
    render(
      <ListaPorCategoria
        grupos={[
          grupo('supermercado', { itens: [tx({ id: 'a', description: 'SUPERMERCADO BH' })] }),
          grupo('farmacia', { itens: [tx({ id: 'b', description: 'DROGARIA SP' })] }),
        ]}
        totalCents={36000}
        onEditar={() => {}}
      />,
    )

    await usuario.click(screen.getByRole('button', { name: /Farmácia/i }))

    expect(await screen.findByText('DROGARIA SP')).toBeInTheDocument()
    expect(screen.getByText('SUPERMERCADO BH')).toBeInTheDocument()
  })

  it('fecha a categoria aberta ao clicar de novo', async () => {
    const usuario = userEvent.setup()
    render(
      <ListaPorCategoria
        grupos={[grupo('supermercado')]}
        totalCents={18000}
        onEditar={() => {}}
      />,
    )

    expect(screen.getByText('SUPERMERCADO BH')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /Supermercado/i }))

    // O `AnimatePresence` mantém o nó no DOM enquanto ele sai: um
    // `queryByText` logo após o clique ainda o encontra, e o teste passaria
    // igual se o fechamento não existisse.
    await waitForElementToBeRemoved(() => screen.queryByText('SUPERMERCADO BH'))
  })

  it('leva a transação clicada para a edição', async () => {
    const usuario = userEvent.setup()
    const editar = vi.fn()
    const alvo = tx({ id: 'alvo' })
    render(
      <ListaPorCategoria
        grupos={[grupo('supermercado', { itens: [alvo] })]}
        totalCents={18000}
        onEditar={editar}
      />,
    )

    const linha = screen.getByText('SUPERMERCADO BH').closest('li')!
    await usuario.click(within(linha).getByRole('button'))

    expect(editar).toHaveBeenCalledWith(alvo)
  })
})
