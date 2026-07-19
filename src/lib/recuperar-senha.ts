/** Recuperação de senha do Neon Auth (Better Auth).
 *
 *  O cliente neon-js NÃO expõe estes métodos, então são chamadas HTTP
 *  diretas. Sondagem de 2026-07-18 contra o servidor real:
 *    POST /forget-password        → 404, não existe
 *    POST /request-password-reset → 200 sempre, mesmo para e-mail sem conta
 *    POST /reset-password         → exige { token, newPassword }
 *
 *  Nenhuma função aqui lança: todas devolvem ResultadoReset com a mensagem
 *  já em português, para o componente só exibir. */

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
const authUrl = env.VITE_NEON_AUTH_URL

export type ResultadoReset =
  | { ok: true }
  | { ok: false; erro: string; motivo: 'token' | 'rede' }

const ERRO_REDE = 'Não consegui falar com o servidor. Tente de novo.'
const ERRO_TOKEN = 'Este link expirou ou já foi usado.'

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
    if (!r.ok) return { ok: false, erro: ERRO_REDE, motivo: 'rede' }
    return { ok: true }
  } catch {
    return { ok: false, erro: ERRO_REDE, motivo: 'rede' }
  }
}

/** Troca a senha usando o token do e-mail. 400 aqui é token gasto ou
 *  expirado — a saída é pedir outro link, não repetir a tentativa. */
export async function redefinirSenha(
  token: string,
  novaSenha: string,
): Promise<ResultadoReset> {
  try {
    const r = await postar('/reset-password', { token, newPassword: novaSenha })
    if (r.status === 400) return { ok: false, erro: ERRO_TOKEN, motivo: 'token' }
    if (!r.ok) return { ok: false, erro: ERRO_REDE, motivo: 'rede' }
    return { ok: true }
  } catch {
    return { ok: false, erro: ERRO_REDE, motivo: 'rede' }
  }
}
