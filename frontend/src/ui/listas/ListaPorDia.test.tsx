import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ListaPorDia } from './ListaPorDia'
import type { GrupoDia } from '../../domain/agrupar'
import type { TransacaoSalva } from '../../aplicacao/consultas/historico'

const tx = (over: Partial<TransacaoSalva> = {}): TransacaoSalva => ({
  id: 'x',
  date: '2026-06-05',
  competencia: '2026-06',
  description: 'PADARIA DO ZE',
  label: null,
  amount_cents: 1250,
  kind: 'expense',
  category_slug: 'alimentacao',
  bank: 'nubank',
  doc_type: 'extrato',
  document_id: 'd1',
  installment: null,
  ...over,
})

const dia = (over: Partial<GrupoDia<TransacaoSalva>> = {}): GrupoDia<TransacaoSalva> => ({
  dia: '2026-06-05',
  gastoCents: 1250,
  entradasCents: 0,
  itens: [tx()],
  ...over,
})

describe('ListaPorDia', () => {
  it('avisa quando o período não tem lançamento nenhum', () => {
    render(<ListaPorDia grupos={[]} onEditar={() => {}} />)
    expect(screen.getByText(/Sem lançamentos neste período/)).toBeInTheDocument()
  })

  // 2026-06-05 é uma sexta-feira. O cabeçalho é montado com `new Date(y, m-1, d)`
  // — componentes locais, não `new Date(iso)`, que seria UTC e mostraria o dia
  // anterior a oeste de Greenwich.
  it('escreve o dia da semana e a data do grupo', () => {
    render(<ListaPorDia grupos={[dia()]} onEditar={() => {}} />)
    expect(screen.getByText('sex, 5 jun')).toBeInTheDocument()
  })

  it('desenha uma seção por dia, na ordem recebida', () => {
    render(
      <ListaPorDia
        grupos={[
          dia({ dia: '2026-06-06', itens: [tx({ id: 'a', description: 'MERCADO' })] }),
          dia({ dia: '2026-06-05', itens: [tx({ id: 'b', description: 'PADARIA DO ZE' })] }),
        ]}
        onEditar={() => {}}
      />,
    )

    const cabecalhos = screen.getAllByText(/, \d+ jun$/).map((e) => e.textContent)
    expect(cabecalhos).toEqual(['sáb, 6 jun', 'sex, 5 jun'])
  })

  /** O subtotal do dia separa o que saiu do que entrou, com sinal. Somar os
   *  dois num número só faria um dia de salário parecer um dia sem gasto. */
  it('mostra gasto e entrada do dia com sinais opostos', () => {
    render(<ListaPorDia grupos={[dia({ gastoCents: 1250, entradasCents: 300000 })]} onEditar={() => {}} />)

    expect(screen.getByText('+R$ 3.000,00')).toBeInTheDocument()
    expect(screen.getByText('−R$ 12,50')).toBeInTheDocument()
  })

  // Zero não é informação: a linha de entradas de um dia comum só polui o
  // cabeçalho, e some.
  it('omite a entrada quando o dia não teve nenhuma', () => {
    render(<ListaPorDia grupos={[dia({ entradasCents: 0 })]} onEditar={() => {}} />)
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument()
  })

  it('omite o gasto quando o dia só teve entrada', () => {
    render(
      <ListaPorDia
        grupos={[dia({ gastoCents: 0, entradasCents: 300000, itens: [tx({ kind: 'income' })] })]}
        onEditar={() => {}}
      />,
    )
    expect(screen.queryByText(/^−/)).not.toBeInTheDocument()
  })

  it('lista as transações do dia', () => {
    render(
      <ListaPorDia
        grupos={[dia({ itens: [tx({ id: 'a' }), tx({ id: 'b', description: 'FARMACIA' })] })]}
        onEditar={() => {}}
      />,
    )

    const dias = screen.getAllByRole('listitem')
    expect(dias).toHaveLength(2)
    expect(within(dias[0]).getByText('PADARIA DO ZE')).toBeInTheDocument()
    expect(within(dias[1]).getByText('FARMACIA')).toBeInTheDocument()
  })

  it('leva a transação clicada para a edição', async () => {
    const usuario = userEvent.setup()
    const editar = vi.fn()
    const alvo = tx({ id: 'alvo' })
    render(<ListaPorDia grupos={[dia({ itens: [alvo] })]} onEditar={editar} />)

    await usuario.click(screen.getAllByRole('button')[0])

    expect(editar).toHaveBeenCalledWith(alvo)
  })
})
