/** Perfil leve do usuário no navegador: o apelido de como quer ser chamado
 *  e o flag de "já viu o tutorial". O nome completo vai no `name` do Better
 *  Auth (servidor); o apelido é preferência local — suficiente para uso
 *  pessoal e sem exigir tabela nova. */

const CHAVE_APELIDO = 'cf:apelido'
const CHAVE_TUTORIAL = 'cf:tutorial-visto'
const CHAVE_EMAIL_RESET = 'cf:email-reset'

export function salvarApelido(apelido: string | null | undefined): void {
  const a = apelido?.trim()
  if (a) localStorage.setItem(CHAVE_APELIDO, a)
  else localStorage.removeItem(CHAVE_APELIDO)
}

export function lerApelido(): string | null {
  return localStorage.getItem(CHAVE_APELIDO)
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function primeiroNome(nome?: string | null): string | null {
  if (!nome) return null
  const n = nome.trim().split(/\s+/)[0]
  return n ? capitalizar(n) : null
}

/** Como chamar o usuário: apelido salvo → 1º nome do cadastro → prefixo do
 *  e-mail → "você". Nunca vazio. */
export function comoChamar(nome?: string | null, email?: string | null): string {
  const apelido = lerApelido()
  if (apelido) return apelido
  const pn = primeiroNome(nome)
  if (pn) return pn
  const prefixo = email?.split('@')[0]
  return prefixo ? capitalizar(prefixo) : 'você'
}

export function tutorialPendente(): boolean {
  return localStorage.getItem(CHAVE_TUTORIAL) !== '1'
}

export function marcarTutorialVisto(): void {
  localStorage.setItem(CHAVE_TUTORIAL, '1')
}

/** Reabre o tutorial na próxima renderização (usado pelo "ver de novo"). */
export function reabrirTutorial(): void {
  localStorage.removeItem(CHAVE_TUTORIAL)
}

/** Quem pede o link de redefinição fica anotado aqui, porque o link do
 *  e-mail traz só o token — sem o e-mail não dá para fazer o login
 *  automático depois. Quem abrir o link em OUTRO aparelho não terá esta
 *  anotação, e cairá no login normal; é o limite do protocolo, não um bug.
 *
 *  Guardado com timestamp (F2): o e-mail é uma entrada não verificada para
 *  o signIn.email automático — nada garante que corresponde ao token que
 *  acabou de ser consumido. Um pedido abandonado deixaria o e-mail vivo
 *  para sempre, pronto para ser usado por um login automático de OUTRO
 *  pedido de reset feito depois, no mesmo navegador. Expira junto com o
 *  próprio token: 1h é a validade real, confirmada no e-mail do Neon. */
const EXPIRACAO_EMAIL_RESET_MS = 60 * 60 * 1000

type RegistroEmailReset = { email: string; ts: number }

export function guardarEmailReset(email: string): void {
  const e = email.trim()
  if (e) {
    const registro: RegistroEmailReset = { email: e, ts: Date.now() }
    localStorage.setItem(CHAVE_EMAIL_RESET, JSON.stringify(registro))
  } else {
    localStorage.removeItem(CHAVE_EMAIL_RESET)
  }
}

/** Devolve o e-mail guardado, ou null se não houver, se o registro passou
 *  de 1h (o token já teria expirado de qualquer forma), ou se o valor não
 *  for o formato esperado — incluindo o formato antigo (string simples),
 *  que deve ser tratado como ausente, nunca causar exceção. */
export function lerEmailReset(): string | null {
  const bruto = localStorage.getItem(CHAVE_EMAIL_RESET)
  if (!bruto) return null
  try {
    const registro = JSON.parse(bruto) as Partial<RegistroEmailReset>
    if (typeof registro.email !== 'string' || typeof registro.ts !== 'number') return null
    if (Date.now() - registro.ts > EXPIRACAO_EMAIL_RESET_MS) return null
    return registro.email
  } catch {
    return null
  }
}

export function esquecerEmailReset(): void {
  localStorage.removeItem(CHAVE_EMAIL_RESET)
}
