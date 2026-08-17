import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Auth } from './Auth'
import type { Resultado } from '../../lib/confirmar-email'
import { Notificacoes } from '../Notificacoes'

// O cadastro precisa de um Neon de mentira: o de verdade criaria conta.
const signUp = vi.fn(async () => ({ error: null }))
vi.mock('../lib/neon', () => ({
  neonConfigurado: true,
  neon: { auth: { signUp: { email: (...a: unknown[]) => signUp(...(a as [])) } } },
}))

// Tipado pelo retorno REAL (Resultado), não por `ok: true as const`: com o
// literal, `mockResolvedValue({ ok: false, motivo: 'falha' })` não compila — e
// o erro só apareceria no `tsc` do build, porque o Vitest não checa tipos.
const enviarCodigo = vi.fn<(email: string) => Promise<Resultado>>(async () => ({ ok: true }))
vi.mock('../lib/confirmar-email', async (original) => {
  const real = await original<typeof import('../../lib/confirmar-email')>()
  // Só o envio é dublado; o resto do módulo continua o de verdade.
  return { ...real, enviarCodigo: (email: string) => enviarCodigo(email) }
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
    enviarCodigo.mockResolvedValue({ ok: true })
  })

  // O envio automático no cadastro é uma chave do servidor da Neon, que este
  // app não controla. Pedir o código explicitamente é o que garante o e-mail
  // seja qual for o estado daquela chave — e é justamente isso que este teste
  // pina: sem a chamada, o cadastro continuaria "funcionando" em silêncio,
  // sem e-mail nenhum, e ninguém notaria até alguém esquecer a senha.
  it('pede o código de confirmação para o endereço cadastrado', async () => {
    const user = userEvent.setup()
    render(<Auth onAutenticado={vi.fn()} />)

    await criarConta(user)

    await waitFor(() => expect(enviarCodigo).toHaveBeenCalledTimes(1))
    expect(enviarCodigo.mock.calls[0][0]).toBe('ana@exemplo.com')
  })

  // O e-mail traz um código, e quem acabou de se cadastrar precisa saber que
  // existe um lugar para digitá-lo — senão fica com o número na mão e a
  // sensação de que o app está pela metade, que foi o defeito relatado.
  it('conta o que aconteceu: diz que veio um código e onde usá-lo', async () => {
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

    expect(await screen.findByText(/código de 6 dígitos para ana@exemplo.com/i)).toBeInTheDocument()
    expect(screen.getByText(/aviso do topo/i)).toBeInTheDocument()
  })

  // A conta já existe neste ponto. Derrubar a entrada porque o e-mail não
  // saiu puniria a pessoa por uma falha que não é dela — e outro código pode
  // ser pedido depois pelo aviso do topo.
  it('e-mail que não sai não desfaz o cadastro nem impede a entrada', async () => {
    enviarCodigo.mockResolvedValue({ ok: false, motivo: 'falha' })
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
    expect(await screen.findByText(/não consegui enviar o código/i)).toBeInTheDocument()
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
    expect(enviarCodigo).not.toHaveBeenCalled()
  })
})
