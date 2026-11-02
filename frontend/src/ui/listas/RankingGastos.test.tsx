import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RankingGastos } from './RankingGastos'
import type { TransacaoSalva } from '../../persist/puxar'

const tx = (over: Partial<TransacaoSalva>): TransacaoSalva => ({
  id: 'x',
  date: '2026-06-05',
  competencia: '2026-06',
  description: 'GELADEIRA',
  label: null,
  amount_cents: 300000,
  kind: 'expense',
  category_slug: 'casa',
  bank: 'nubank',
  doc_type: 'fatura',
  document_id: 'd1',
  installment: null,
  ...over,
})

const estabelecimentos = [
  { merchant: 'PADARIA CENTRAL', rotulo: 'PADARIA CENTRAL', totalCents: 320000, contagem: 40 },
]

function desenhar() {
  render(
    <RankingGastos
      maiores={[tx({})]}
      estabelecimentos={estabelecimentos}
      onEditar={() => {}}
      onAbrirEstabelecimento={() => {}}
    />,
  )
}

// U6 da auditoria de 30/10: os dois rankings lado a lado repetiam o mesmo
// primeiro lugar. Agora é um só, com as duas perguntas na alternância.
describe('RankingGastos', () => {
  it('começa por estabelecimento, que soma as compras repetidas', () => {
    desenhar()
    expect(screen.getByRole('button', { name: 'Por estabelecimento' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('PADARIA CENTRAL')).toBeInTheDocument()
    expect(screen.queryByText('Geladeira')).not.toBeInTheDocument()
  })

  it('alterna para a maior compra', async () => {
    desenhar()
    await userEvent.click(screen.getByRole('button', { name: 'Por compra' }))
    expect(screen.getByRole('button', { name: 'Por compra' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Geladeira')).toBeInTheDocument()
    expect(screen.queryByText('PADARIA CENTRAL')).not.toBeInTheDocument()
  })

  it('não desenha nada sem gasto', () => {
    const { container } = render(
      <RankingGastos maiores={[]} estabelecimentos={[]} onEditar={() => {}} onAbrirEstabelecimento={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
