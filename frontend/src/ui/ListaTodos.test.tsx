import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ListaTodos } from './ListaTodos'
import type { TransacaoSalva } from '../persist/puxar'

/** A `ListaTodos` é controlada: busca e categoria vêm de fora, porque na tela
 *  elas moram na URL (é o que faz o F5 e o clique no donut funcionarem). Este
 *  arnês faz o papel da página, guardando os dois num estado local, para que
 *  os testes continuem exercitando a interação de quem usa — digitar e
 *  escolher — em vez do formato dos props. */
function Lista({ txs, onEditar = () => {} }: { txs: TransacaoSalva[]; onEditar?: (t: TransacaoSalva) => void }) {
  const [termo, setTermo] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  return (
    <ListaTodos
      txs={txs}
      onEditar={onEditar}
      termo={termo}
      cat={cat}
      onTermo={setTermo}
      onCat={setCat}
    />
  )
}

const tx = (over: Partial<TransacaoSalva>): TransacaoSalva => ({
  id: 'x',
  date: '2026-06-05',
  competencia: '2026-06',
  description: 'DROGARIA SAO PAULO',
  label: null,
  amount_cents: 5000,
  kind: 'expense',
  category_slug: 'farmacia',
  bank: 'nubank',
  doc_type: 'fatura',
  document_id: 'd1',
  installment: null,
  ...over,
})

const lista = [
  tx({ id: 'a', description: 'DROGARIA SAO PAULO', category_slug: 'farmacia', date: '2026-06-05' }),
  tx({ id: 'b', description: 'UBER TRIP', category_slug: 'transporte', date: '2026-06-20' }),
  tx({ id: 'c', description: 'DROGASIL', category_slug: 'farmacia', date: '2026-06-10' }),
]

describe('ListaTodos', () => {
  it('lista tudo por padrão, mais recente primeiro', () => {
    render(<Lista txs={lista} onEditar={() => {}} />)
    expect(screen.getByText(/^3 lançamentos/)).toBeInTheDocument()
    const linhas = screen.getAllByRole('listitem')
    expect(linhas[0]).toHaveTextContent('UBER TRIP')
  })

  it('filtra pela busca de texto', async () => {
    render(<Lista txs={lista} onEditar={() => {}} />)
    await userEvent.type(screen.getByLabelText('Procurar lançamento'), 'droga')
    expect(screen.getByText(/^2 lançamentos/)).toBeInTheDocument()
    expect(screen.queryByText('UBER TRIP')).not.toBeInTheDocument()
  })

  it('busca ignora acento e caixa', async () => {
    const comAcento = [tx({ id: 'z', description: 'FARMÁCIA PAGUE MENOS' })]
    render(<Lista txs={comAcento} onEditar={() => {}} />)
    await userEvent.type(screen.getByLabelText('Procurar lançamento'), 'farmacia')
    expect(screen.getByText(/^1 lançamento/)).toBeInTheDocument()
  })

  it('filtra por categoria', async () => {
    render(<Lista txs={lista} onEditar={() => {}} />)
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'transporte')
    expect(screen.getByText(/^1 lançamento/)).toBeInTheDocument()
    expect(screen.getByText('UBER TRIP')).toBeInTheDocument()
  })

  it('só oferece as categorias presentes nas transações', () => {
    render(<Lista txs={lista} onEditar={() => {}} />)
    const opcoes = screen.getAllByRole('option').map((o) => o.textContent)
    expect(opcoes).toHaveLength(3) // "todas" + farmácia + transporte
    expect(opcoes.some((o) => o?.includes('Supermercado'))).toBe(false)
  })

  it('mostra o estado vazio quando nada casa', async () => {
    render(<Lista txs={lista} onEditar={() => {}} />)
    await userEvent.type(screen.getByLabelText('Procurar lançamento'), 'zzzz')
    expect(screen.getByText('Nada encontrado com esses filtros.')).toBeInTheDocument()
  })

  it('clicar no lápis chama onEditar com a transação', async () => {
    const onEditar = vi.fn()
    render(<Lista txs={[lista[1]]} onEditar={onEditar} />)
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(onEditar).toHaveBeenCalledWith(lista[1])
  })

  it('filtro de categoria que sumiu do período não continua filtrando escondido', async () => {
    // Bug real: ao trocar de mês, a categoria escolhida podia não existir
    // mais. O <select> caía visualmente em "todas" (nenhuma option casava com
    // o value) enquanto o estado seguia filtrando — a tela mostrava 0
    // lançamentos com um filtro que ninguém via.
    const { rerender } = render(<Lista txs={lista} onEditar={() => {}} />)
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'transporte')
    expect(screen.getByText(/^1 lançamento/)).toBeInTheDocument()

    // Novo período, sem nenhuma transação de transporte.
    const outroMes = [tx({ id: 'novo', description: 'DROGASIL', category_slug: 'farmacia' })]
    rerender(<Lista txs={outroMes} onEditar={() => {}} />)

    expect(screen.getByText(/^1 lançamento/)).toBeInTheDocument()
    expect(screen.getByText('DROGASIL')).toBeInTheDocument()
    expect(screen.getByLabelText('Filtrar por categoria')).toHaveValue('')
  })

  it('soma só as despesas no subtotal — a entrada não abate', () => {
    const mix = [
      tx({ id: 'g', amount_cents: 10000, kind: 'expense' }),
      tx({ id: 'e', amount_cents: -90000, kind: 'income' }),
    ]
    render(<Lista txs={mix} onEditar={() => {}} />)
    // O subtotal é R$ 100,00 (só a despesa), não -R$ 800,00 (a soma dos dois).
    expect(screen.getByText(/^2 lançamentos · R\$\s*100,00$/)).toBeInTheDocument()
  })
})
