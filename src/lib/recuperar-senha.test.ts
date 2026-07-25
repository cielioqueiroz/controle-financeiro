import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pedirLink, redefinirSenha } from './recuperar-senha'

// A URL base vem de import.meta.env, que o vi.stubEnv não alcança neste
// setup — então o valor dela é conferido à mão contra o servidor real, não
// aqui. O que estes testes garantem é a FORMA: URL absoluta (http:// ou
// https://) mais o caminho certo. Assim, se alguém trocar a chamada por um
// caminho relativo, sem base, o teste reprova.

function respostaFake(status: number, corpo: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pedirLink', () => {
  it('faz POST em /request-password-reset com email e redirectTo', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(200, { status: true }))

    const r = await pedirLink('alguem@exemplo.com', 'https://app.test/')

    expect(r).toEqual({ ok: true })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toMatch(/^https?:\/\/.+\/request-password-reset$/)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'alguem@exemplo.com',
      redirectTo: 'https://app.test/',
    })
  })

  it('devolve erro amigável quando a rede falha', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const r = await pedirLink('alguem@exemplo.com', 'https://app.test/')

    expect(r).toEqual({
      ok: false,
      erro: 'recuperar.erro.rede',
      motivo: 'rede',
    })
  })

  it('devolve erro quando o servidor recusa', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(500))

    const r = await pedirLink('alguem@exemplo.com', 'https://app.test/')

    expect(r).toEqual({
      ok: false,
      erro: 'recuperar.erro.rede',
      motivo: 'rede',
    })
  })
})

describe('redefinirSenha', () => {
  it('faz POST em /reset-password com token e newPassword', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(200, { status: true }))

    const r = await redefinirSenha('tok123', 'senhaboa123')

    expect(r).toEqual({ ok: true })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toMatch(/^https?:\/\/.+\/reset-password$/)
    expect(JSON.parse(init?.body as string)).toEqual({
      token: 'tok123',
      newPassword: 'senhaboa123',
    })
  })

  // 400 aqui quer dizer token gasto ou expirado. A mensagem precisa dizer
  // isso, porque a saída é pedir outro link — não tentar de novo.
  it('traduz 400 como link expirado ou já usado', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(400))

    const r = await redefinirSenha('tok123', 'senhaboa123')

    expect(r).toEqual({ ok: false, erro: 'recuperar.erro.token', motivo: 'token' })
  })

  it('devolve erro amigável quando a rede falha', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const r = await redefinirSenha('tok123', 'senhaboa123')

    expect(r).toEqual({
      ok: false,
      erro: 'recuperar.erro.rede',
      motivo: 'rede',
    })
  })
})
