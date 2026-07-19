import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TelaAcesso } from './TelaAcesso'

describe('TelaAcesso', () => {
  it('mostra a frase da tela deslogada e o card que recebe', () => {
    render(
      <TelaAcesso>
        <p>CARD_STUB</p>
      </TelaAcesso>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Seu extrato vira gráfico, em menos de um minuto.',
    )
    expect(screen.getByText('CARD_STUB')).toBeInTheDocument()
  })
})
