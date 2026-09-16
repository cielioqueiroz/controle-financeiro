import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LeiturasFinanceiras } from './LeiturasFinanceiras'

describe('LeiturasFinanceiras', () => {
  it('renderiza os cards e encaminha uma leitura acionável', () => {
    const onAbrir = vi.fn()
    render(
      <LeiturasFinanceiras
        itens={[
          {
            id: 'categoria',
            titulo: 'Maior categoria',
            texto: 'Aluguel concentrou 34% do gasto.',
            tom: 'alerta',
            onAbrir,
            rotuloAcao: 'Ver lançamentos',
          },
          {
            id: 'economia',
            titulo: 'Taxa de economia',
            texto: 'Sobrou R$ 759,50.',
            tom: 'positivo',
          },
        ]}
      />,
    )

    expect(screen.getByText('Leituras do período')).toBeInTheDocument()
    expect(screen.getByText('Aluguel concentrou 34% do gasto.')).toBeInTheDocument()
    expect(screen.getByText('Sobrou R$ 759,50.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /aluguel concentrou/i }))
    expect(onAbrir).toHaveBeenCalledOnce()
  })

  it('não renderiza uma seção vazia', () => {
    const { container } = render(<LeiturasFinanceiras itens={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
