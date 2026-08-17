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
  // vivia lá dentro. A tela de acesso ficou sem o lema e sem a assinatura.
  // O rodapé agora é próprio da TelaAcesso, não emprestado do <main>.
  it('mostra o rodapé, com o lema e a assinatura', () => {
    render(
      <TelaAcesso>
        <p>CARD_STUB</p>
      </TelaAcesso>,
    )

    expect(screen.getByRole('contentinfo')).toHaveTextContent(/cada centavo no lugar certo/)
    expect(
      screen.getByRole('link', { name: 'Cielio Queiroz' }),
    ).toHaveAttribute('href', 'https://cielio-portfolio.vercel.app/')
  })

  // O seletor de idioma saiu da interface a pedido do usuário. O mecanismo
  // de i18n INTEIRO continua no lugar (IdiomaProvider, dicionários pt/en/es,
  // useT e o próprio SeletorIdioma com seu teste) — só não é mais montado.
  //
  // Os botões do seletor têm aria-label com o nome do idioma por extenso
  // (SeletorIdioma.tsx:16), não a sigla que aparece no texto. Procurar por
  // /EN/ passaria também com o seletor na tela, já que nada mais na página
  // tem esse nome acessível — seria teste que passa dos dois jeitos.
  it('não oferece troca de idioma', () => {
    render(
      <TelaAcesso>
        <p>CARD_STUB</p>
      </TelaAcesso>,
    )

    for (const idioma of ['Português', 'English', 'Español']) {
      expect(screen.queryByRole('button', { name: idioma })).toBeNull()
    }
  })
})
