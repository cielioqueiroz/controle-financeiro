import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecuperarSenha } from './RecuperarSenha'
import { Notificacoes } from './Notificacoes'
import { guardarEmailReset } from '../lib/perfil'

// Este arquivo cobre o ramo de login automático (e-mail salvo + neon
// configurado), separado de RecuperarSenha.test.tsx porque ali `neon` é
// mockado como null no topo do arquivo — aqui ele precisa ser um objeto
// com signIn.email controlável por teste.
const signInEmail = vi.fn()
vi.mock('../lib/neon', () => ({
  neon: { auth: { signIn: { email: (...args: unknown[]) => signInEmail(...args) } } },
  neonConfigurado: true,
}))
vi.mock('../lib/recuperar-senha', () => ({
  pedirLink: vi.fn(),
  redefinirSenha: vi.fn(),
}))
vi.mock('../lib/url-token', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/url-token')>()
  return { ...real, limparTokenDaUrl: vi.fn() }
})

const { redefinirSenha } = await import('../lib/recuperar-senha')

function montar(props: Partial<Parameters<typeof RecuperarSenha>[0]> = {}) {
  return render(
    <>
      <Notificacoes />
      <RecuperarSenha
        token="tok123"
        onVoltar={props.onVoltar ?? (() => {})}
        onAutenticado={props.onAutenticado ?? (() => {})}
      />
    </>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

async function preencherEEnviar(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
  await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
  await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
}

describe('RecuperarSenha — login automático após trocar a senha', () => {
  it('sucesso: entra direto e chama onAutenticado', async () => {
    const usuario = userEvent.setup()
    guardarEmailReset('alguem@exemplo.com')
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    signInEmail.mockResolvedValue({ error: null })
    const onAutenticado = vi.fn()
    montar({ onAutenticado })

    await preencherEEnviar(usuario)

    await screen.findByText('Senha alterada. Bem-vindo de volta.')
    expect(onAutenticado).toHaveBeenCalled()
    // F3: o e-mail guardado tem que sumir assim que o reset conclui, com
    // ou sem login automático — senão ele sobrevive para um pedido futuro
    // de outra conta usar (F2).
    expect(localStorage.getItem('cf:email-reset')).toBeNull()
  })

  it('signIn.email devolve erro: senha trocada mesmo assim, manda para o login', async () => {
    const usuario = userEvent.setup()
    guardarEmailReset('alguem@exemplo.com')
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    signInEmail.mockResolvedValue({ error: { message: 'falhou' } })
    const onVoltar = vi.fn()
    montar({ onVoltar })

    await preencherEEnviar(usuario)

    await screen.findByText('Senha alterada. Entre com a senha nova.')
    expect(onVoltar).toHaveBeenCalledWith('alguem@exemplo.com')
  })

  // Trava o fix do C1: se signIn.email REJEITAR em vez de devolver um
  // { error }, o usuário não pode ficar preso com o botão travado, e a
  // troca de senha (que JÁ aconteceu no servidor) não pode ser relatada
  // como falha.
  it('signIn.email rejeita: ainda assim reporta sucesso, volta ao login e libera o botão', async () => {
    const usuario = userEvent.setup()
    guardarEmailReset('alguem@exemplo.com')
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    signInEmail.mockRejectedValue(new Error('rede caiu'))
    const onVoltar = vi.fn()
    montar({ onVoltar })

    const botao = screen.getByRole('button', { name: 'Salvar nova senha' })
    await preencherEEnviar(usuario)

    await screen.findByText('Senha alterada. Entre com a senha nova.')
    expect(onVoltar).toHaveBeenCalledWith('alguem@exemplo.com')
    expect(botao).not.toBeDisabled()
    // F3: mesmo no caminho em que o login automático falhou (não a troca de
    // senha), o e-mail guardado precisa ser esquecido.
    expect(localStorage.getItem('cf:email-reset')).toBeNull()
  })
})
