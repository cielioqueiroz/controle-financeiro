/** Perfil leve do usuário no navegador: o apelido de como quer ser chamado
 *  e o flag de "já viu o tutorial". O nome completo vai no `name` do Better
 *  Auth (servidor); o apelido é preferência local — suficiente para uso
 *  pessoal e sem exigir tabela nova. */

const CHAVE_APELIDO = 'cf:apelido'
const CHAVE_TUTORIAL = 'cf:tutorial-visto'

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
