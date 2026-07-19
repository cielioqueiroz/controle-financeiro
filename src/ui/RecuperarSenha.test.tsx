import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecuperarSenha } from './RecuperarSenha'
import { Notificacoes } from './Notificacoes'

vi.mock('../lib/neon', () => ({ neon: null, neonConfigurado: false }))
vi.mock('../lib/recuperar-senha', () => ({
  pedirLink: vi.fn(),
  redefinirSenha: vi.fn(),
}))

const { pedirLink, redefinirSenha } = await import('../lib/recuperar-senha')

function montar(token: string | null = null) {
  return render(
    <>
      <Notificacoes />
      <RecuperarSenha token={token} onVoltar={() => {}} onAutenticado={() => {}} />
    </>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('RecuperarSenha — pedir o link', () => {
  it('não chama a rede com e-mail vazio', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByText(/preencha seu e-mail/i)).toBeInTheDocument()
    expect(pedirLink).not.toHaveBeenCalled()
  })

  it('não chama a rede com e-mail malformado', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.type(screen.getByPlaceholderText('seu@email.com'), 'nao-e-email')
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByText(/não parece válido/i)).toBeInTheDocument()
    expect(pedirLink).not.toHaveBeenCalled()
  })

  // O endpoint responde 200 mesmo sem conta. Confirmar o envio revelaria
  // quem tem cadastro — a mensagem tem que ser condicional.
  it('após enviar, não afirma que o e-mail existe', async () => {
    const usuario = userEvent.setup()
    vi.mocked(pedirLink).mockResolvedValue({ ok: true })
    montar()

    await usuario.type(screen.getByPlaceholderText('seu@email.com'), 'alguem@exemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByText(/se houver conta com esse e-mail/i)).toBeInTheDocument()
  })

  it('guarda o e-mail no localStorage ao pedir o link', async () => {
    const usuario = userEvent.setup()
    vi.mocked(pedirLink).mockResolvedValue({ ok: true })
    montar()

    await usuario.type(screen.getByPlaceholderText('seu@email.com'), 'alguem@exemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))

    await screen.findByText(/se houver conta com esse e-mail/i)
    expect(localStorage.getItem('cf:email-reset')).toBe('alguem@exemplo.com')
  })
})

describe('RecuperarSenha — definir a nova senha', () => {
  it('com token, mostra os dois campos de senha', () => {
    montar('tok123')

    expect(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('repita a nova senha')).toBeInTheDocument()
  })

  it('não chama a rede quando as senhas diferem', async () => {
    const usuario = userEvent.setup()
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa124')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument()
    expect(redefinirSenha).not.toHaveBeenCalled()
  })

  it('envia token e senha quando o formulário está válido', async () => {
    const usuario = userEvent.setup()
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(redefinirSenha).toHaveBeenCalledWith('tok123', 'senhaboa123')
  })

  it('token expirado mostra o convite a pedir outro link', async () => {
    const usuario = userEvent.setup()
    vi.mocked(redefinirSenha).mockResolvedValue({
      ok: false,
      erro: 'Este link expirou ou já foi usado.',
    })
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByText('Este link expirou ou já foi usado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pedir um novo link' })).toBeInTheDocument()
  })

  // O olho é type="button": clicar não pode submeter o formulário.
  it('o olho de revelar não submete o formulário', async () => {
    const usuario = userEvent.setup()
    montar('tok123')

    await usuario.click(screen.getAllByRole('button', { name: 'Mostrar senha' })[0])

    await new Promise((r) => setTimeout(r, 100))
    expect(redefinirSenha).not.toHaveBeenCalled()
  })
})
