import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { MaioresSaidas } from './MaioresSaidas'
import type { TransacaoSalva } from '../../persist/puxar'

const tx = (over: Partial<TransacaoSalva>): TransacaoSalva => ({
  id: 'x',
  date: '2026-06-05',
  competencia: '2026-06',
  description: 'ALUGUEL JUNHO',
  label: null,
  amount_cents: 42000,
  kind: 'expense',
  category_slug: 'aluguel',
  bank: 'nubank',
  doc_type: 'extrato',
  document_id: 'd1',
  installment: null,
  ...over,
})

describe('MaioresSaidas', () => {
  it('lista os itens com posição e valor', () => {
    render(<MaioresSaidas itens={[tx({})]} onEditar={() => {}} />)
    expect(screen.getByText('ALUGUEL JUNHO')).toBeInTheDocument()
    expect(screen.getByText(/420,00/)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('prefere o rótulo do usuário à descrição do banco', () => {
    render(<MaioresSaidas itens={[tx({ label: 'Aluguel da casa' })]} onEditar={() => {}} />)
    expect(screen.getByText('Aluguel da casa')).toBeInTheDocument()
    expect(screen.queryByText('ALUGUEL JUNHO')).not.toBeInTheDocument()
  })

  it('mostra o nome da categoria', () => {
    render(<MaioresSaidas itens={[tx({})]} onEditar={() => {}} />)
    expect(screen.getByText('Aluguel')).toBeInTheDocument()
  })

  it('clicar na linha chama onEditar com a transação', async () => {
    const onEditar = vi.fn()
    const item = tx({ id: 'clicavel' })
    render(<MaioresSaidas itens={[item]} onEditar={onEditar} />)
    await userEvent.click(screen.getByRole('button', { name: /ALUGUEL JUNHO/ }))
    expect(onEditar).toHaveBeenCalledWith(item)
  })

  it('mantém a ordem recebida (quem ordena é maioresSaidas)', () => {
    render(
      <MaioresSaidas
        itens={[
          tx({ id: 'a', description: 'MAIOR', amount_cents: 90000 }),
          tx({ id: 'b', description: 'MENOR', amount_cents: 100 }),
        ]}
        onEditar={() => {}}
      />,
    )
    const linhas = screen.getAllByRole('button')
    expect(linhas[0]).toHaveTextContent('MAIOR')
    expect(linhas[1]).toHaveTextContent('MENOR')
  })

  it('não renderiza nada quando não há itens', () => {
    const { container } = render(<MaioresSaidas itens={[]} onEditar={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
