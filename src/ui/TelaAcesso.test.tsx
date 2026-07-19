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

  // Regressão: a Task 4 introduziu o retorno antecipado de App.tsx para
  // `precisaLogin` e ele pulava o <main> inteiro — e com ele o <footer>, que
  // vivia lá dentro. A tela de acesso ficou sem a linha de privacidade (o
  // único sinal de confiança da página) e sem a assinatura. O rodapé agora
  // é próprio da TelaAcesso, não emprestado do <main>.
  it('mostra o rodapé, com a linha de privacidade e a assinatura', () => {
    render(
      <TelaAcesso>
        <p>CARD_STUB</p>
      </TelaAcesso>,
    )

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/Lido no navegador/)
    expect(
      screen.getByRole('link', { name: 'Cielio Queiroz' }),
    ).toHaveAttribute('href', 'https://cielio-portfolio.vercel.app/')
  })
})
