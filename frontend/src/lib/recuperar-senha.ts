/** Recuperação de senha do Neon Auth (Better Auth).
 *
 *  O cliente neon-js NÃO expõe estes métodos, então são chamadas HTTP
 *  diretas. Sondagem de 2026-07-18 contra o servidor real:
 *    POST /forget-password        → 404, não existe
 *    POST /request-password-reset → 200 sempre, mesmo para e-mail sem conta
 *    POST /reset-password         → exige { token, newPassword }
 *
 *  Nenhuma função aqui lança: todas devolvem ResultadoReset com a chave de
 *  tradução adequada, para o componente só exibir. */

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
const authUrl = env.VITE_NEON_AUTH_URL

/** `erro` é uma CHAVE de tradução (a UI faz t(erro)); a mensagem em si vive
 *  nos dicionários i18n. */
export type ChaveErroReset =
  | 'recuperar.erro.rede'
  | 'recuperar.erro.servidor'
  | 'recuperar.erro.token'
export type ResultadoReset =
  | { ok: true }
  | { ok: false; erro: ChaveErroReset; motivo: 'token' | 'rede' | 'servidor' }

const ERRO_REDE: ChaveErroReset = 'recuperar.erro.rede'
const ERRO_SERVIDOR: ChaveErroReset = 'recuperar.erro.servidor'
const ERRO_TOKEN: ChaveErroReset = 'recuperar.erro.token'

async function codigoDoErro(r: Response): Promise<string | null> {
  try {
    const corpo: unknown = await r.json()
    if (typeof corpo !== 'object' || corpo === null || !('code' in corpo)) return null
    return typeof corpo.code === 'string' ? corpo.code : null
  } catch {
    return null
  }
}

async function postar(caminho: string, corpo: unknown): Promise<Response> {
  return fetch(`${authUrl}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

/** Pede o e-mail com o link. O servidor responde 200 mesmo quando a conta
 *  não existe — de propósito, para não revelar quem tem cadastro. Portanto
 *  ok:true significa "pedido aceito", NUNCA "e-mail enviado". */
export async function pedirLink(email: string, redirectTo: string): Promise<ResultadoReset> {
  try {
    const r = await postar('/request-password-reset', { email, redirectTo })
    if (!r.ok) return { ok: false, erro: ERRO_SERVIDOR, motivo: 'servidor' }
    return { ok: true }
  } catch {
    return { ok: false, erro: ERRO_REDE, motivo: 'rede' }
  }
}

/** Troca a senha usando o token do e-mail. Só INVALID_TOKEN significa que o
 *  link expirou ou foi usado; erros HTTP diferentes não devem inutilizá-lo. */
export async function redefinirSenha(
  token: string,
  novaSenha: string,
): Promise<ResultadoReset> {
  try {
    const r = await postar('/reset-password', { token, newPassword: novaSenha })
    if (!r.ok) {
      if ((await codigoDoErro(r)) === 'INVALID_TOKEN') {
        return { ok: false, erro: ERRO_TOKEN, motivo: 'token' }
      }
      return { ok: false, erro: ERRO_SERVIDOR, motivo: 'servidor' }
    }
    return { ok: true }
  } catch {
    return { ok: false, erro: ERRO_REDE, motivo: 'rede' }
  }
}
