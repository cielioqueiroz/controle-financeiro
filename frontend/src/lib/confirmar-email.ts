/** Confirmação de e-mail do Neon Auth (Better Auth).
 *
 *  Como na recuperação de senha, o cliente `neon-js` NÃO expõe estes
 *  métodos — são chamadas HTTP diretas. Sondagem de 2026-08-12 contra o
 *  servidor real (é assim que se descobre o contrato aqui: sondando, não
 *  supondo):
 *
 *    POST /send-verification-email  {email, callbackURL}
 *        → 200 {"status":true} SEMPRE, inclusive para e-mail sem conta.
 *          Mesma política do reset: não revela quem tem cadastro.
 *    GET  /verify-email?token=…&callbackURL=…
 *        → 302 para o callbackURL. Token ruim volta com `error=INVALID_TOKEN`
 *          ANEXADO (com & se o callbackURL já tem query, o que é o caso
 *          aqui). Sucesso volta com o callbackURL intacto.
 *    GET  /verify-email?token=… (sem callbackURL)
 *        → 401 com JSON. Por isso o callbackURL não é opcional.
 *
 *  Nenhuma função aqui lança. */

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
const authUrl = env.VITE_NEON_AUTH_URL

/** Marca que o app põe no callbackURL para reconhecer, ao carregar, que
 *  aquela visita veio de um clique no link do e-mail. Sem ela não haveria
 *  como distinguir "confirmou agora" de "abriu o site" — o sucesso volta sem
 *  nenhum parâmetro próprio. */
export const PARAM_CONFIRMADO = 'confirmado'
const PARAM_ERRO = 'error'

export type ResultadoEnvio = { ok: true } | { ok: false }

/** O destino do link do e-mail: esta mesma origem, marcada. */
export function urlDeRetorno(origem: string): string {
  return `${origem.replace(/\/$/, '')}/?${PARAM_CONFIRMADO}=1`
}

/** Dispara o e-mail com o link de confirmação.
 *
 *  `ok: true` significa "pedido aceito", NUNCA "e-mail entregue" — o
 *  servidor responde 200 mesmo para endereço sem conta. A UI não pode
 *  prometer entrega em cima disto. */
export async function enviarConfirmacao(
  email: string,
  callbackURL: string,
): Promise<ResultadoEnvio> {
  try {
    const r = await fetch(`${authUrl}/send-verification-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, callbackURL }),
    })
    return r.ok ? { ok: true } : { ok: false }
  } catch {
    return { ok: false }
  }
}

export type Confirmacao = 'confirmado' | 'link-invalido' | null

/** O que a URL de chegada diz sobre a confirmação. Puro, testável sem
 *  navegador.
 *
 *  Só responde quando a marca própria está presente: um `?error=` de
 *  qualquer outra origem (um OAuth cancelado, por exemplo) não pode virar
 *  "seu link de confirmação expirou", que mandaria a pessoa procurar
 *  problema onde não há. */
export function lerConfirmacaoDaUrl(search: string): Confirmacao {
  const p = new URLSearchParams(search)
  if (p.get(PARAM_CONFIRMADO) !== '1') return null
  return p.get(PARAM_ERRO) ? 'link-invalido' : 'confirmado'
}

/** Tira as marcas da barra de endereços sem recarregar. Sem isto, um F5
 *  repetiria o toast de "e-mail confirmado" para sempre. */
export function limparConfirmacaoDaUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete(PARAM_CONFIRMADO)
  url.searchParams.delete(PARAM_ERRO)
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}
