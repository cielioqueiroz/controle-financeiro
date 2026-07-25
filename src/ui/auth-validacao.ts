/** Validação do formulário de acesso, separada do componente para ser
 *  testável sem renderizar React. As MENSAGENS são compostas na UI (i18n):
 *  aqui devolvemos só a estrutura (campos faltando) e chaves de tradução. */

export type ModoAcesso = 'entrar' | 'criar'
export type CampoAcesso = 'nome' | 'email' | 'senha'
export type CamposAcesso = { nome: string; email: string; senha: string }

/** Campos vazios, na ordem em que aparecem na tela.
 *  `nome` só conta no modo criar; `apelido` é opcional e nunca entra.
 *  A senha não é aparada: espaço é caractere válido. */
export function camposFaltando(modo: ModoAcesso, campos: CamposAcesso): CampoAcesso[] {
  const faltando: CampoAcesso[] = []
  if (modo === 'criar' && !campos.nome.trim()) faltando.push('nome')
  if (!campos.email.trim()) faltando.push('email')
  if (!campos.senha) faltando.push('senha')
  return faltando
}

/** Chave de tradução do erro da nova senha (fatia de i18n). */
export type ChaveErroSenha =
  | 'recuperar.erro.digite'
  | 'validacao.senhaCurta'
  | 'recuperar.erro.repita'
  | 'recuperar.erro.naoCoincidem'

/** Valida o par senha/confirmação da redefinição. Devolve a CHAVE de erro
 *  ou null. A ordem importa: vazia vence curta, que vence divergente — uma
 *  queixa por vez, sempre a mais fundamental. A senha não é aparada, porque
 *  espaço é caractere válido. */
export function validarNovaSenha(senha: string, confirmacao: string): ChaveErroSenha | null {
  if (!senha) return 'recuperar.erro.digite'
  if (senha.length < 8) return 'validacao.senhaCurta'
  if (!confirmacao) return 'recuperar.erro.repita'
  if (senha !== confirmacao) return 'recuperar.erro.naoCoincidem'
  return null
}

/** Formato de e-mail aceito no acesso. Deliberadamente frouxo: a validação
 *  que vale é o e-mail chegar: só barramos o que claramente não é endereço. */
export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
