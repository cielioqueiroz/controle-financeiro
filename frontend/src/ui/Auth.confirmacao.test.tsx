import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Auth } from './Auth'
import type { ResultadoEnvio } from '../lib/confirmar-email'
import { Notificacoes } from './Notificacoes'

// O cadastro precisa de um Neon de mentira: o de verdade criaria conta.
const signUp = vi.fn(async () => ({ error: null }))
vi.mock('../lib/neon', () => ({
  neonConfigurado: true,
  neon: { auth: { signUp: { email: (...a: unknown[]) => signUp(...(a as [])) } } },
}))

// Tipado pelo retorno REAL (ResultadoEnvio), não por `ok: true as const`:
// com o literal, `mockResolvedValue({ ok: false })` não compila — e o erro só
// aparece no `tsc` do build, porque o Vitest não checa tipos.
const enviarConfirmacao = vi.fn<(email: string, callbackURL: string) => Promise<ResultadoEnvio>>(
  async () => ({ ok: true }),
)
vi.mock('../lib/confirmar-email', async (original) => {
  const real = await original<typeof import('../lib/confirmar-email')>()
  // Só o envio é dublado: `urlDeRetorno` continua o de verdade, porque é
  // exatamente a URL que ele monta que o primeiro teste assevera.
  return {
    ...real,
    enviarConfirmacao: (email: string, callbackURL: string) =>
      enviarConfirmacao(email, callbackURL),
  }
})

async function criarConta(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Não tem conta? Criar uma' }))
  await user.type(screen.getByLabelText('Nome completo'), 'Ana Souza')
  await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com')
  await user.type(screen.getByLabelText('Senha'), 'senha-bem-grande')
  await user.click(screen.getByRole('button', { name: 'Criar conta' }))
}

describe('Auth — confirmação de e-mail no cadastro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signUp.mockResolvedValue({ error: null })
    enviarConfirmacao.mockResolvedValue({ ok: true })
  })

  // O envio automático no cadastro é uma chave do servidor da Neon, que este
  // app não controla. Pedir o e-mail explicitamente é o que garante o link
  // seja qual for o estado daquela chave — e é justamente isso que este teste
  // pina: sem a chamada, o cadastro continuaria "funcionando" em silêncio,
  // sem e-mail nenhum, e ninguém notaria até alguém esquecer a senha.
  it('pede o e-mail de confirmação para o endereço cadastrado', async () => {
    const user = userEvent.setup()
    render(<Auth onAutenticado={vi.fn()} />)

    await criarConta(user)

    await waitFor(() => expect(enviarConfirmacao).toHaveBeenCalledTimes(1))
    const [email, callback] = enviarConfirmacao.mock.calls[0]
    expect(email).toBe('ana@exemplo.com')
    // O link do e-mail tem que voltar para ESTA origem, marcada — é a marca
    // que faz a tela saber que a visita veio de uma confirmação.
    expect(callback).toBe(`${window.location.origin}/?confirmado=1`)
  })

  it('conta o que aconteceu: diz para onde o link foi', async () => {
    const user = userEvent.setup()
    // O <Toaster/> mora no App, fora do Auth: sem ele o toast não chega ao
    // DOM e o teste procuraria um texto que nunca é renderizado.
    render(
      <>
        <Notificacoes />
        <Auth onAutenticado={vi.fn()} />
      </>,
    )

    await criarConta(user)

    expect(await screen.findByText(/link de confirmação para ana@exemplo.com/i)).toBeInTheDocument()
  })

  // A conta já existe neste ponto. Derrubar a entrada porque o e-mail não
  // saiu puniria a pessoa por uma falha que não é dela — e o link pode ser
  // reenviado depois pelo aviso do topo.
  it('e-mail que não sai não desfaz o cadastro nem impede a entrada', async () => {
    enviarConfirmacao.mockResolvedValue({ ok: false })
    const onAutenticado = vi.fn()
    const user = userEvent.setup()
    render(
      <>
        <Notificacoes />
        <Auth onAutenticado={onAutenticado} />
      </>,
    )

    await criarConta(user)

    await waitFor(() => expect(onAutenticado).toHaveBeenCalled())
    expect(await screen.findByText(/não consegui enviar o e-mail/i)).toBeInTheDocument()
  })

  it('cadastro que falha não dispara e-mail nenhum', async () => {
    signUp.mockResolvedValue({ error: { message: 'User already exists' } } as never)
    const user = userEvent.setup()
    render(
      <>
        <Notificacoes />
        <Auth onAutenticado={vi.fn()} />
      </>,
    )

    await criarConta(user)

    await screen.findByText('Este e-mail já tem conta.')
    expect(enviarConfirmacao).not.toHaveBeenCalled()
  })
})
