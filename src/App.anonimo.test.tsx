import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

// Modo "importa e vê" (sem Neon configurado, ver src/lib/neon.ts:10-12): a
// persistência fica desligada e `precisaLogin` é sempre false, então o
// visitante anônimo nunca passa pelo retorno antecipado da TelaAcesso — ele
// cai direto no header do estado "logado". Precisa de arquivo próprio porque
// App.test.tsx já mocka `neonConfigurado: true` para o módulo inteiro (mesmo
// padrão usado em Auth.test.tsx e RecuperarSenha.test.tsx, que mockam
// `neonConfigurado: false`).
vi.mock('./lib/neon', () => ({ neon: null, neonConfigurado: false }))

// pdfjs-dist espera um DOMMatrix que o jsdom não fornece; nada aqui exercita
// import de PDF, só a frase do header.
vi.mock('./domain/pdf/load', () => ({
  loadTextItems: vi.fn(),
  PdfProtegidoError: class PdfProtegidoError extends Error {},
}))

describe('App — visitante anônimo sem Neon configurado', () => {
  it('não sauda quem não entrou: mostra a frase de deslogado, nunca "Olá"', async () => {
    render(<App />)

    // A frase de deslogado é a mesma da TelaAcesso — prova que o header caiu
    // no branch certo mesmo sem passar pelo retorno antecipado.
    expect(
      await screen.findByRole('heading', { level: 1, name: /Seu extrato vira gráfico/ }),
    ).toHaveTextContent('Seu extrato vira gráfico, em menos de um minuto.')

    // A asserção negativa é o ponto do teste: sem ela, uma saudação
    // "Olá, você!" vazando para um visitante anônimo passaria despercebida
    // (foi exatamente o bug que este arquivo existe para pegar).
    expect(screen.queryByText(/^Olá,/)).not.toBeInTheDocument()
  })
})
