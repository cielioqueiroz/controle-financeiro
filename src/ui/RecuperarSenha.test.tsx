import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecuperarSenha } from './RecuperarSenha'
import { Notificacoes } from './Notificacoes'
import { lerEmailReset } from '../lib/perfil'

vi.mock('../lib/neon', () => ({ neon: null, neonConfigurado: false }))
vi.mock('../lib/recuperar-senha', () => ({
  pedirLink: vi.fn(),
  redefinirSenha: vi.fn(),
}))
vi.mock('../lib/url-token', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/url-token')>()
  return { ...real, limparTokenDaUrl: vi.fn() }
})

const { pedirLink, redefinirSenha } = await import('../lib/recuperar-senha')
const { limparTokenDaUrl } = await import('../lib/url-token')

function montar(token: string | null = null) {
  return render(
    <>
      <Notificacoes />
      <RecuperarSenha token={token} onVoltar={() => {}} />
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

    // A subtitle passa a usar a mesma frase condicional do toast (C4), então
    // o texto aparece duas vezes na tela — aqui o alvo é o toast mesmo.
    expect(
      await screen.findByText(/se houver conta com esse e-mail/i, { selector: '[data-title]' }),
    ).toBeInTheDocument()
    // Garantir que a afirmação de envio não está presente (F2).
    expect(screen.queryByText(/^Enviamos/, { selector: '[data-title]' })).not.toBeInTheDocument()
  })

  it('guarda o e-mail no localStorage ao pedir o link', async () => {
    const usuario = userEvent.setup()
    vi.mocked(pedirLink).mockResolvedValue({ ok: true })
    montar()

    await usuario.type(screen.getByPlaceholderText('seu@email.com'), 'alguem@exemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))

    await screen.findByText(/se houver conta com esse e-mail/i, { selector: '[data-title]' })
    // Lido via lerEmailReset (não a chave crua): a partir do F2 o valor
    // guardado é um envelope { email, ts }, não mais o e-mail puro.
    expect(lerEmailReset()).toBe('alguem@exemplo.com')
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
      motivo: 'token',
    })
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByText('Este link expirou ou já foi usado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pedir um novo link' })).toBeInTheDocument()
  })

  it('token expirado limpa o e-mail guardado (F1: impede vazamento entre usuários)', async () => {
    const usuario = userEvent.setup()
    // Simular pessoa A que pediu um link e foi embora.
    localStorage.setItem('cf:email-reset', 'pessoaA@exemplo.com')

    vi.mocked(redefinirSenha).mockResolvedValue({
      ok: false,
      erro: 'Este link expirou ou já foi usado.',
      motivo: 'token',
    })
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    await screen.findByText('Este link expirou ou já foi usado.')
    // O e-mail guardado foi limpo para não vazar.
    expect(localStorage.getItem('cf:email-reset')).toBeNull()
  })

  it('erro de rede não marca o token como morto', async () => {
    const usuario = userEvent.setup()
    vi.mocked(redefinirSenha).mockResolvedValue({
      ok: false,
      erro: 'Não consegui falar com o servidor. Tente de novo.',
      motivo: 'rede',
    })
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByText('Não consegui falar com o servidor. Tente de novo.')).toBeInTheDocument()
    // Continua no formulário de nova senha — não caiu para o pedido de link.
    expect(screen.getByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument()
  })

  // O olho é type="button": clicar não pode submeter o formulário. Os dois
  // campos precisam estar preenchidos com uma senha válida ANTES do clique
  // — senão a validação de campo vazio barraria o submit de qualquer jeito
  // e o teste passaria mesmo com um type="submit" indevido no olho.
  it('o olho de revelar não submete o formulário', async () => {
    const usuario = userEvent.setup()
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    await usuario.click(screen.getAllByRole('button', { name: 'Mostrar senha' })[0])

    await new Promise((r) => setTimeout(r, 100))
    expect(redefinirSenha).not.toHaveBeenCalled()
  })
})

describe('RecuperarSenha — depois de trocar a senha', () => {
  it('sem e-mail guardado (link aberto em outro aparelho): troca com sucesso, volta ao login e libera o botão', async () => {
    const usuario = userEvent.setup()
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    const onVoltar = vi.fn()
    render(
      <>
        <Notificacoes />
        <RecuperarSenha token="tok123" onVoltar={onVoltar} />
      </>,
    )

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    const botao = screen.getByRole('button', { name: 'Salvar nova senha' })
    await usuario.click(botao)

    await screen.findByText('Senha alterada. Entre com a senha nova.')
    expect(onVoltar).toHaveBeenCalledWith(undefined)
    expect(botao).not.toBeDisabled()
  })

  it('limpa o token da URL após redefinir a senha com sucesso', async () => {
    const usuario = userEvent.setup()
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    await screen.findByText('Senha alterada. Entre com a senha nova.')
    expect(limparTokenDaUrl).toHaveBeenCalled()
  })

  it('limpa o token da URL quando o token está expirado', async () => {
    const usuario = userEvent.setup()
    vi.mocked(redefinirSenha).mockResolvedValue({
      ok: false,
      erro: 'Este link expirou ou já foi usado.',
      motivo: 'token',
    })
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    await screen.findByText('Este link expirou ou já foi usado.')
    expect(limparTokenDaUrl).toHaveBeenCalled()
  })
})
