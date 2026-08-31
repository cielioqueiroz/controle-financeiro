import { describe, it, expect, vi, afterEach } from 'vitest'
import { sessaoAindaVale } from './sessao-remota'

/** A pergunta que o SDK não sabe responder.
 *
 *  O `getSession` do neon-js responde do cache em memória, com TTL igual à
 *  validade do JWT: depois de um logout feito noutro lugar, ele repete
 *  "logado". Esta função vai ao servidor. */

/** `texto` e o que o servidor devolve no corpo, cru — e cru de proposito:
 *  e a diferenca entre "sem sessao" e "nao consegui ler" que decide se o
 *  app desloga alguem. */
const respondendo = (init: { status?: number; texto?: string; erro?: boolean }) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    if (init.erro) throw new TypeError('Failed to fetch')
    return {
      ok: (init.status ?? 200) < 400,
      status: init.status ?? 200,
      text: async () => init.texto ?? '',
    } as Response
  })

afterEach(() => vi.restoreAllMocks())

describe('sessaoAindaVale', () => {
  it('sessão viva: o servidor devolve a sessão', async () => {
    respondendo({ texto: JSON.stringify({ session: { id: 'x' }, user: { email: 'a@b.c' } }) })
    expect(await sessaoAindaVale()).toBe(true)
  })

  it('corpo "null" é como o Neon Auth diz "sem sessão"', async () => {
    respondendo({ texto: 'null' })
    expect(await sessaoAindaVale()).toBe(false)
  })

  it('corpo vazio também é "sem sessão"', async () => {
    respondendo({ texto: '' })
    expect(await sessaoAindaVale()).toBe(false)
  })

  it('401 é veredito: não há sessão', async () => {
    respondendo({ status: 401 })
    expect(await sessaoAindaVale()).toBe(false)
  })

  // ⚠️ O caso que decide se a correção ajuda ou atrapalha. Rede fora não é
  // "você foi deslogado" — deslogar quem está sem internet trocaria um
  // defeito por outro pior. `null` é "não sei", e quem chama não derruba.
  it('rede fora devolve "não sei", nunca "não há sessão"', async () => {
    respondendo({ erro: true })
    expect(await sessaoAindaVale()).toBeNull()
  })

  it('erro do servidor também é "não sei"', async () => {
    respondendo({ status: 503 })
    expect(await sessaoAindaVale()).toBeNull()
  })

  // ⚠️ O caso que eu tinha errado na primeira escrita: com `r.json()` e um
  // `.catch(() => null)`, HTML de página de erro chegava indistinguível do
  // `null` que significa "sem sessão" — e um soluço do servidor de auth
  // derrubaria a sessão de quem estava trabalhando.
  it('corpo ilegível é "não sei", NÃO "sem sessão"', async () => {
    respondendo({ texto: '<!doctype html><title>502 Bad Gateway</title>' })
    expect(await sessaoAindaVale()).toBeNull()
  })

  // O cookie é o que carrega a sessão: sem `credentials`, o servidor
  // responderia "sem sessão" para TODO MUNDO e o app deslogaria sozinho.
  it('manda o cookie da sessão junto', async () => {
    const f = respondendo({ texto: JSON.stringify({ session: {} }) })
    await sessaoAindaVale()
    expect(f).toHaveBeenCalledWith(
      expect.stringContaining('/get-session'),
      expect.objectContaining({ credentials: 'include' }),
    )
  })
})
