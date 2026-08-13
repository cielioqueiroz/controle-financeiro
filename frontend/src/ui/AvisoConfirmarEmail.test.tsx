import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AvisoConfirmarEmail } from './AvisoConfirmarEmail'

// O componente conversa com o servidor de auth por `fetch` (via
// lib/confirmar-email). Mockar o fetch, e não o módulo, deixa o código real de
// montar a chamada e ler a resposta rodar dentro deste teste — é ele que
// traduz 400 em "código errado" e 429 em "espere um pouco".
function respostaFake(status: number, corpo: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
afterEach(() => vi.unstubAllGlobals())

function abrirAviso() {
  const onConfirmado = vi.fn()
  render(<AvisoConfirmarEmail email="alguem@exemplo.com" onConfirmado={onConfirmado} />)
  return { onConfirmado, usuario: userEvent.setup() }
}

describe('AvisoConfirmarEmail', () => {
  it('nomeia o e-mail que precisa de confirmação', () => {
    abrirAviso()
    expect(screen.getByText(/alguem@exemplo\.com/)).toBeInTheDocument()
  })

  // O defeito que originou esta tela: o e-mail manda um código de 6 dígitos e
  // o app não tinha onde digitá-lo. O campo é a razão de o aviso existir.
  it('abre o campo do código ao pedir para confirmar', async () => {
    const { usuario } = abrirAviso()
    expect(screen.queryByLabelText(/código/i)).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /confirmar/i }))

    expect(screen.getByLabelText(/código/i)).toBeInTheDocument()
  })

  it('confirma com o código digitado e avisa quem chamou', async () => {
    const { usuario, onConfirmado } = abrirAviso()
    vi.mocked(fetch).mockResolvedValue(respostaFake(200, { status: true }))

    await usuario.click(screen.getByRole('button', { name: /confirmar/i }))
    await usuario.type(screen.getByLabelText(/código/i), '008432')
    await usuario.click(screen.getByRole('button', { name: /^confirmar$/i }))

    await waitFor(() => expect(onConfirmado).toHaveBeenCalled())
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toMatch(/\/email-otp\/verify-email$/)
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'alguem@exemplo.com',
      otp: '008432',
    })
  })

  // Código errado não pode dar a mesma cara de sucesso: o campo continua na
  // tela, com o que a pessoa digitou, para ela conferir dígito a dígito.
  it('código recusado não fecha o campo nem avisa confirmação', async () => {
    const { usuario, onConfirmado } = abrirAviso()
    vi.mocked(fetch).mockResolvedValue(respostaFake(400, { code: 'INVALID_OTP' }))

    await usuario.click(screen.getByRole('button', { name: /confirmar/i }))
    await usuario.type(screen.getByLabelText(/código/i), '000000')
    await usuario.click(screen.getByRole('button', { name: /^confirmar$/i }))

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    expect(onConfirmado).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/código/i)).toHaveValue('000000')
  })

  // Sem os 6 dígitos não há o que enviar: gastaria uma das 3 tentativas por
  // minuto que o servidor concede para receber um "código inválido" certo.
  it('não deixa confirmar com o código incompleto', async () => {
    const { usuario } = abrirAviso()
    await usuario.click(screen.getByRole('button', { name: /confirmar/i }))
    await usuario.type(screen.getByLabelText(/código/i), '008')

    expect(screen.getByRole('button', { name: /^confirmar$/i })).toBeDisabled()
  })

  it('aceita o código colado com espaços, como ele vem do e-mail', async () => {
    const { usuario } = abrirAviso()
    await usuario.click(screen.getByRole('button', { name: /confirmar/i }))
    await usuario.type(screen.getByLabelText(/código/i), ' 008 432 ')

    expect(screen.getByLabelText(/código/i)).toHaveValue('008432')
    expect(screen.getByRole('button', { name: /^confirmar$/i })).toBeEnabled()
  })

  it('pede outro código pelo endpoint de envio', async () => {
    const { usuario } = abrirAviso()
    vi.mocked(fetch).mockResolvedValue(respostaFake(200, { success: true }))

    await usuario.click(screen.getByRole('button', { name: /confirmar/i }))
    await usuario.click(screen.getByRole('button', { name: /enviar.*código|reenviar/i }))

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled())
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toMatch(/\/email-otp\/send-verification-otp$/)
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'alguem@exemplo.com',
      type: 'email-verification',
    })
  })
})
