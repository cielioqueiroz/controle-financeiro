import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { Diagnosticos } from './Diagnosticos'
import type { Diagnostico } from '../domain/diagnosticos'

const outros: Diagnostico = { tipo: 'muito-em-outros', pct: 0.31, totalCents: 42000 }
const concentracao: Diagnostico = {
  tipo: 'concentracao',
  rotulo: 'Mercado',
  pct: 0.42,
  totalCents: 91500,
}
const taxas: Diagnostico = { tipo: 'taxas-altas', pct: 0.07, totalCents: 8300 }

describe('Diagnosticos', () => {
  /** A regra que o componente documenta e que nenhum teste cobria: a faixa
   *  SOME quando não há achado. Uma faixa permanente escrevendo "está tudo
   *  bem" vira ruído que se aprende a pular — e aí o dia em que ela tem
   *  conteúdo passa junto. */
  it('não desenha nada quando não há achado', () => {
    const { container } = render(<Diagnosticos itens={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('escreve a frase do achado com o percentual e o valor', () => {
    render(<Diagnosticos itens={[concentracao]} />)
    expect(
      screen.getByText(/Mercado concentra 42% do gasto do período \(R\$ 915,00\)/),
    ).toBeInTheDocument()
  })

  // O domínio devolve fração (0.31) e a tela mostra inteiro. Sem arredondar,
  // a frase sairia com "31.000000000000004%" — o tipo de defeito que só
  // aparece com o número errado.
  it('arredonda a fração para percentual inteiro', () => {
    render(<Diagnosticos itens={[outros]} />)
    expect(screen.getByText(/^31% do gasto/)).toBeInTheDocument()
  })

  it('desenha uma linha por achado', () => {
    render(<Diagnosticos itens={[outros, concentracao, taxas]} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  /** Só o diagnóstico de "Outros" leva a algum lugar. Os outros dois
   *  descrevem um fato do mês, e um botão que não leva a lugar nenhum ensina
   *  a não clicar — inclusive no que leva. */
  it('só o achado de "Outros" é acionável', () => {
    render(<Diagnosticos itens={[outros, concentracao, taxas]} onVerSemCategoria={() => {}} />)

    const botoes = screen.getAllByRole('button')
    expect(botoes).toHaveLength(1)
    expect(botoes[0]).toHaveTextContent(/sem categoria/)
  })

  it('abre os lançamentos sem categoria ao clicar', async () => {
    const usuario = userEvent.setup()
    const verSemCategoria = vi.fn()
    render(<Diagnosticos itens={[outros]} onVerSemCategoria={verSemCategoria} />)

    await usuario.click(screen.getByRole('button'))

    expect(verSemCategoria).toHaveBeenCalledOnce()
  })

  // Sem para onde ir, o achado continua sendo dito — só deixa de fingir que
  // é clicável.
  it('sem destino, o achado de "Outros" vira texto', () => {
    render(<Diagnosticos itens={[outros]} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/sem categoria/)).toBeInTheDocument()
  })
})
