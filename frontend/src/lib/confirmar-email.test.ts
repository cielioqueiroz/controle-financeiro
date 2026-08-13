import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enviarCodigo, confirmarComCodigo, normalizarCodigo, TAMANHO_CODIGO } from './confirmar-email'

// A URL base vem de import.meta.env, que o vi.stubEnv não alcança neste setup
// (armadilha registrada no ESTADO-ATUAL) — então, como no teste do
// recuperar-senha, o que se assevera aqui é a FORMA da chamada: URL absoluta
// mais o caminho certo.

function respostaFake(status: number, corpo: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
afterEach(() => vi.unstubAllGlobals())

describe('enviarCodigo', () => {
  it('faz POST em /email-otp/send-verification-otp com o tipo de verificação', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(200, { success: true }))

    const r = await enviarCodigo('alguem@exemplo.com')

    expect(r).toEqual({ ok: true })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toMatch(/^https?:\/\/.+\/email-otp\/send-verification-otp$/)
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'alguem@exemplo.com',
      type: 'email-verification',
    })
  })

  it('não lança quando a rede cai', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(enviarCodigo('a@b.com')).resolves.toEqual({ ok: false, motivo: 'falha' })
  })

  // O servidor limita este endpoint a 3 envios por minuto. Sem separar o 429
  // dos demais, quem clicasse "reenviar" três vezes veria "não consegui
  // enviar" e concluiria que o app está quebrado, quando o conserto é esperar.
  it('429 vira motivo próprio: é espera, não falha', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(429, { message: 'Too many requests' }))
    await expect(enviarCodigo('a@b.com')).resolves.toEqual({
      ok: false,
      motivo: 'muitas-tentativas',
    })
  })

  it('outro erro do servidor vira falha genérica, sem exceção', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(500))
    await expect(enviarCodigo('a@b.com')).resolves.toEqual({ ok: false, motivo: 'falha' })
  })
})

describe('confirmarComCodigo', () => {
  it('faz POST em /email-otp/verify-email com email e otp', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(200, { status: true, token: null, user: {} }))

    const r = await confirmarComCodigo('alguem@exemplo.com', '008432')

    expect(r).toEqual({ ok: true })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toMatch(/^https?:\/\/.+\/email-otp\/verify-email$/)
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'alguem@exemplo.com',
      otp: '008432',
    })
  })

  // Sondado contra o servidor real em 2026-08-13: código errado responde
  // 400 {"message":"Invalid OTP","code":"INVALID_OTP"}. É o caso mais comum
  // do fluxo (digitou errado, ou o código expirou) e merece mensagem própria.
  it('400 é código errado ou expirado', async () => {
    vi.mocked(fetch).mockResolvedValue(
      respostaFake(400, { message: 'Invalid OTP', code: 'INVALID_OTP' }),
    )
    await expect(confirmarComCodigo('a@b.com', '000000')).resolves.toEqual({
      ok: false,
      motivo: 'codigo-invalido',
    })
  })

  it('429 é espera, não código errado', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(429))
    await expect(confirmarComCodigo('a@b.com', '000000')).resolves.toEqual({
      ok: false,
      motivo: 'muitas-tentativas',
    })
  })

  it('não lança quando a rede cai', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(confirmarComCodigo('a@b.com', '008432')).resolves.toEqual({
      ok: false,
      motivo: 'falha',
    })
  })
})

describe('normalizarCodigo', () => {
  // Quem recebe o código copia do e-mail, e o que vem junto varia: espaço,
  // quebra de linha, o texto ao redor. Recusar "008 432" seria culpar a
  // pessoa por um detalhe do cliente de e-mail dela.
  it('fica só com os dígitos', () => {
    expect(normalizarCodigo(' 008 432 ')).toBe('008432')
    expect(normalizarCodigo('008-432')).toBe('008432')
    expect(normalizarCodigo('abc')).toBe('')
  })

  it('não passa do tamanho do código', () => {
    expect(normalizarCodigo('00843212345')).toBe('008432')
    expect(normalizarCodigo('008432').length).toBe(TAMANHO_CODIGO)
  })
})
