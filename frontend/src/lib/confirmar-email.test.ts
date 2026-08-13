import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  enviarConfirmacao,
  lerConfirmacaoDaUrl,
  urlDeRetorno,
  PARAM_CONFIRMADO,
} from './confirmar-email'

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

describe('enviarConfirmacao', () => {
  it('faz POST em /send-verification-email com email e callbackURL', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(200, { status: true }))

    const r = await enviarConfirmacao('alguem@exemplo.com', 'https://app.test/?confirmado=1')

    expect(r.ok).toBe(true)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toMatch(/^https?:\/\/.+\/send-verification-email$/)
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'alguem@exemplo.com',
      callbackURL: 'https://app.test/?confirmado=1',
    })
  })

  it('não lança quando a rede cai', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(enviarConfirmacao('a@b.com', 'https://app.test/')).resolves.toEqual({ ok: false })
  })

  it('resposta não-2xx vira ok:false, sem exceção', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(500))
    await expect(enviarConfirmacao('a@b.com', 'https://app.test/')).resolves.toEqual({ ok: false })
  })
})

describe('urlDeRetorno', () => {
  it('marca a origem, sem duplicar a barra', () => {
    expect(urlDeRetorno('https://app.test')).toBe(`https://app.test/?${PARAM_CONFIRMADO}=1`)
    expect(urlDeRetorno('https://app.test/')).toBe(`https://app.test/?${PARAM_CONFIRMADO}=1`)
  })
})

describe('lerConfirmacaoDaUrl', () => {
  it('sem marca nenhuma, não diz nada', () => {
    expect(lerConfirmacaoDaUrl('')).toBeNull()
    expect(lerConfirmacaoDaUrl('?p=mes&ref=2026-07')).toBeNull()
  })

  it('a marca sozinha significa confirmado — o sucesso volta sem parâmetro próprio', () => {
    expect(lerConfirmacaoDaUrl('?confirmado=1')).toBe('confirmado')
  })

  it('a marca com error é o link gasto (o servidor anexa error=INVALID_TOKEN)', () => {
    expect(lerConfirmacaoDaUrl('?confirmado=1&error=INVALID_TOKEN')).toBe('link-invalido')
  })

  // Um ?error= de OUTRA origem (um login social cancelado, por exemplo) não
  // pode virar "seu link de confirmação expirou": mandaria a pessoa procurar
  // problema onde não há. Só a marca própria autoriza a leitura.
  it('error sem a marca não é assunto desta função', () => {
    expect(lerConfirmacaoDaUrl('?error=INVALID_TOKEN')).toBeNull()
    expect(lerConfirmacaoDaUrl('?error=ACCESS_DENIED&state=xyz')).toBeNull()
  })
})
