/** Confirmação de e-mail do Neon Auth (Better Auth) — **por código**.
 *
 *  Como na recuperação de senha, o cliente `neon-js` NÃO expõe estes
 *  métodos: são chamadas HTTP diretas.
 *
 *  ## Por que código, e não link
 *
 *  A primeira versão (2026-08-12) montou o fluxo de **link**
 *  (`/send-verification-email` + `callbackURL` + `/verify-email?token=`) e o
 *  e-mail que chegou trazia um **código de 6 dígitos** — sem lugar nenhum no
 *  app para digitá-lo. Sondagem de 2026-08-13 contra o servidor real explicou:
 *
 *  - o plugin `email-otp` está ligado do lado da Neon, com
 *    `overrideDefaultEmailVerification`. Isso faz o próprio
 *    `/send-verification-email` **desviar para o envio de OTP** (o código do
 *    plugin é explícito: `init()` reescreve `sendVerificationEmail`), então
 *    aquele `callbackURL` era ignorado e o `/verify-email?token=` nunca
 *    recebia link nenhum — código inalcançável, apesar de testado;
 *  - a documentação da Neon fecha a questão: *"Verification links require a
 *    custom email provider"*. Com o remetente compartilhado
 *    (`auth@mail.myneon.app`, o que está no ar) **só existe código**.
 *
 *  Contrato sondado (2026-08-13):
 *
 *    POST /email-otp/send-verification-otp {email, type:'email-verification'}
 *        → 200 {"success":true}. Limite do servidor: 3 por minuto (429).
 *    POST /email-otp/verify-email  {email, otp}
 *        → 200 {status, token, user} | 400 {"message":"Invalid OTP",
 *          "code":"INVALID_OTP"} — inclusive para e-mail sem conta, que é o
 *          que impede a resposta de revelar cadastro.
 *
 *  Nenhuma função aqui lança. */

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
const authUrl = env.VITE_NEON_AUTH_URL

/** Dígitos do código que o e-mail traz. */
export const TAMANHO_CODIGO = 6

/** `muitas-tentativas` é o 429 do servidor (3 chamadas por minuto em cada um
 *  destes dois caminhos). Separá-lo importa: o conserto é **esperar**, e
 *  chamar isso de "não consegui" mandaria a pessoa procurar defeito onde não
 *  há. */
export type MotivoFalha = 'codigo-invalido' | 'muitas-tentativas' | 'falha'
export type Resultado = { ok: true } | { ok: false; motivo: MotivoFalha }

/** Só os dígitos, no máximo o tamanho do código.
 *
 *  Quem confirma copia o número do e-mail, e o que vem colado junto varia com
 *  o cliente de e-mail: espaço, quebra de linha, hífen. Recusar `008 432`
 *  seria culpar a pessoa por um detalhe que não é dela. */
export function normalizarCodigo(entrada: string): string {
  return entrada.replace(/\D/g, '').slice(0, TAMANHO_CODIGO)
}

async function postar(caminho: string, corpo: unknown): Promise<number | null> {
  try {
    const r = await fetch(`${authUrl}${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
    return r.status
  } catch {
    // Rede fora, DNS, CSP: nada disso distingue um caso do outro para quem
    // está olhando a tela — todos viram `falha`.
    return null
  }
}

/** Dispara o e-mail com o código.
 *
 *  `ok: true` significa "pedido aceito", NUNCA "e-mail entregue": a entrega
 *  depende do remetente da Neon. A UI não pode prometer entrega em cima
 *  disto — por isso o texto pede para conferir a caixa. */
export async function enviarCodigo(email: string): Promise<Resultado> {
  const status = await postar('/email-otp/send-verification-otp', {
    email,
    type: 'email-verification',
  })
  if (status === null) return { ok: false, motivo: 'falha' }
  if (status === 429) return { ok: false, motivo: 'muitas-tentativas' }
  return status >= 200 && status < 300 ? { ok: true } : { ok: false, motivo: 'falha' }
}

/** Confirma a conta com o código que chegou no e-mail. */
export async function confirmarComCodigo(email: string, codigo: string): Promise<Resultado> {
  const status = await postar('/email-otp/verify-email', { email, otp: codigo })
  if (status === null) return { ok: false, motivo: 'falha' }
  if (status === 429) return { ok: false, motivo: 'muitas-tentativas' }
  if (status >= 200 && status < 300) return { ok: true }
  // 400 é o caso comum e tem conserto do lado de quem digita (conferir o
  // número, ou pedir outro porque o anterior expirou). Qualquer outro status
  // não tem, e falar em "código inválido" ali mandaria a pessoa redigitar um
  // código que estava certo.
  return { ok: false, motivo: status === 400 ? 'codigo-invalido' : 'falha' }
}
