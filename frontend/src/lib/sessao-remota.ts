const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
const authUrl = env.VITE_NEON_AUTH_URL

/** Pergunta ao SERVIDOR se a sessão ainda existe, sem passar pelo SDK.
 *
 *  ⚠️ **Por que não `neon.auth.getSession()`.** O SDK guarda a sessão em
 *  memória e responde do cache, sem tocar na rede, com TTL igual à validade
 *  do JWT — a mesma armadilha que fez o aviso de e-mail confirmado não sumir
 *  em 13/08. Para saber se a sessão MORREU, perguntar a ele é inútil: ele
 *  repete o que guardou.
 *
 *  Aqui a pergunta vai direto ao `/get-session` do Neon Auth, com o cookie
 *  da sessão (`credentials: 'include'` — o SDK guarda a sessão em cookie, e
 *  não em `localStorage`, então não há chave para espiar do lado do
 *  navegador).
 *
 *  Isto é a rede de segurança do aviso entre abas
 *  (`sessao-canal.ts`), e cobre o que ele não alcança:
 *
 *  - a aba que o navegador suspendeu e não recebeu a mensagem;
 *  - o logout feito em OUTRO navegador ou OUTRO aparelho, onde não existe
 *    canal comum.
 *
 *  **Só derruba com resposta explícita do servidor.** Rede fora, servidor
 *  intermitente ou CORS mal configurado devolvem `null` — "não sei" —, e não
 *  `false`. Deslogar quem está sem internet seria trocar um defeito por
 *  outro pior. */
export async function sessaoAindaVale(): Promise<boolean | null> {
  if (!authUrl) return null
  try {
    const r = await fetch(`${authUrl.replace(/\/$/, '')}/get-session`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    })
    // 401 é resposta legítima e significa "não há sessão". Outros erros de
    // servidor não são veredito sobre a sessão.
    if (r.status === 401) return false
    if (!r.ok) return null

    // ⚠️ Texto primeiro, e não `r.json()`.
    //
    // O Neon Auth diz "sem sessão" devolvendo `null` — e `r.json()` com
    // `.catch(() => null)` devolve exatamente a mesma coisa para um corpo
    // ILEGÍVEL (HTML de página de erro, resposta cortada no meio de um
    // deploy). As duas viravam `false`, e `false` desloga: um soluço do
    // servidor derrubaria a sessão de quem está trabalhando.
    //
    // Lendo o texto, "vazio" e "null" são o veredito do servidor; qualquer
    // outra coisa que não parseia é "não sei".
    const texto = (await r.text().catch(() => null))?.trim()
    if (texto === null || texto === undefined) return null
    if (texto === '' || texto === 'null') return false

    let corpo: unknown
    try {
      corpo = JSON.parse(texto)
    } catch {
      return null
    }
    if (corpo === null) return false
    const s = corpo as { session?: unknown; user?: unknown }
    return Boolean(s.session ?? s.user)
  } catch {
    return null
  }
}
