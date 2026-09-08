import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { CompromissosFuturos } from './CompromissosFuturos'
import type { ItemFuturo, MesFuturo } from '../domain/agrupar'

const item = (over: Partial<ItemFuturo> = {}): ItemFuturo => ({
  descricao: 'GELADEIRA BRASTEMP',
  parcela: 3,
  total: 10,
  amountCents: 25000,
  bank: 'nubank',
  ...over,
})

const mes = (over: Partial<MesFuturo> = {}): MesFuturo => ({
  competencia: '2026-07',
  totalCents: 25000,
  itens: [item()],
  porBanco: [{ bank: 'nubank', totalCents: 25000 }],
  ...over,
})

/** Na tela o mês aberto é controlado de fora, porque o gráfico ao lado abre o
 *  mês clicado nesta lista. Este arnês faz o papel da página: guarda o estado
 *  e deixa os testes exercitarem o clique de quem usa, em vez do formato dos
 *  props. */
function Card({ meses }: { meses: MesFuturo[] }) {
  const [aberto, setAberto] = useState<string | null>(null)
  return <CompromissosFuturos meses={meses} aberto={aberto} onAlternar={setAberto} />
}

describe('CompromissosFuturos', () => {
  // Projeção sem nada a projetar não é um card vazio: é card nenhum.
  it('não desenha nada sem meses futuros', () => {
    const { container } = render(<CompromissosFuturos meses={[]} aberto={null} onAlternar={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('soma o total e conta as parcelas de todos os meses', () => {
    render(
      <Card
        meses={[
          mes({ competencia: '2026-07', totalCents: 25000, itens: [item()] }),
          mes({
            competencia: '2026-08',
            totalCents: 40000,
            itens: [item({ parcela: 4 }), item({ descricao: 'SOFÁ', amountCents: 15000 })],
          }),
        ]}
      />,
    )

    expect(screen.getByText('R$ 650,00')).toBeInTheDocument()
    expect(screen.getByText('3 parcelas a vencer')).toBeInTheDocument()
  })

  // Uma parcela não pode virar "1 parcelas a vencer".
  it('usa o singular quando há uma parcela só', () => {
    render(<Card meses={[mes()]} />)
    expect(screen.getByText('1 parcela a vencer')).toBeInTheDocument()
  })

  it('mostra o mês por extenso, com o ano', () => {
    render(<Card meses={[mes({ competencia: '2026-07' })]} />)
    expect(screen.getByRole('button', { name: /jul/i })).toHaveTextContent('2026')
  })

  /** O detalhe do mês nasce fechado: são as parcelas de um mês que ainda não
   *  chegou, e abrir tudo de uma vez transforma uma projeção de seis meses
   *  numa parede de texto. */
  it('começa fechado e abre o mês clicado', async () => {
    const usuario = userEvent.setup()
    render(<Card meses={[mes()]} />)

    expect(screen.queryByText('GELADEIRA BRASTEMP')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /jul/i }))

    expect(await screen.findByText('GELADEIRA BRASTEMP')).toBeInTheDocument()
    expect(screen.getByText('3/10')).toBeInTheDocument()
  })

  it('fecha o mês que já estava aberto', async () => {
    const usuario = userEvent.setup()
    const alternar = vi.fn()
    render(<CompromissosFuturos meses={[mes()]} aberto="2026-07" onAlternar={alternar} />)

    await usuario.click(screen.getByRole('button', { name: /jul/i }))

    // `null` é "nenhum mês aberto" — clicar de novo no aberto tem que fechar,
    // e não reabrir o mesmo.
    expect(alternar).toHaveBeenCalledWith(null)
  })

  it('abre só o mês clicado, não os outros', async () => {
    const usuario = userEvent.setup()
    render(
      <Card
        meses={[
          mes({ competencia: '2026-07', itens: [item({ descricao: 'GELADEIRA' })] }),
          mes({ competencia: '2026-08', itens: [item({ descricao: 'SOFÁ' })] }),
        ]}
      />,
    )

    await usuario.click(screen.getByRole('button', { name: /ago/i }))

    expect(await screen.findByText('SOFÁ')).toBeInTheDocument()
    expect(screen.queryByText('GELADEIRA')).not.toBeInTheDocument()
  })

  it('conta quantas parcelas caem em cada mês', () => {
    render(<Card meses={[mes({ itens: [item(), item({ descricao: 'SOFÁ' })] })]} />)
    expect(screen.getByText('2×')).toBeInTheDocument()
  })
})
