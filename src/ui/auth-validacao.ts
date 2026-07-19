/** Validação do formulário de acesso, separada do componente para ser
 *  testável sem renderizar React. */

export type ModoAcesso = 'entrar' | 'criar'
export type CampoAcesso = 'nome' | 'email' | 'senha'
export type CamposAcesso = { nome: string; email: string; senha: string }

const ROTULO: Record<CampoAcesso, string> = {
  nome: 'nome',
  email: 'e-mail',
  senha: 'senha',
}

const POSSESSIVO: Record<CampoAcesso, string> = {
  nome: 'seu nome',
  email: 'seu e-mail',
  senha: 'sua senha',
}

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

/** "a", "a e b", "a, b e c" */
function ligar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? ''
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

export function mensagemCamposFaltando(modo: ModoAcesso, faltando: CampoAcesso[]): string {
  // Hoje inalcançável (todo chamador guarda com faltando.length > 0), mas
  // sem isso a lista vazia geraria "Preencha  para entrar." com espaço duplo.
  if (faltando.length === 0) return ''
  const fim = modo === 'criar' ? 'para criar sua conta' : 'para entrar'
  const lista =
    faltando.length === 1
      ? POSSESSIVO[faltando[0]]
      : ligar(faltando.map((c) => ROTULO[c]))
  return `Preencha ${lista} ${fim}.`
}

/** Valida o par senha/confirmação da redefinição. Devolve a mensagem de erro
 *  ou null. A ordem importa: vazia vence curta, que vence divergente — uma
 *  queixa por vez, sempre a mais fundamental. A senha não é aparada, porque
 *  espaço é caractere válido. */
export function validarNovaSenha(senha: string, confirmacao: string): string | null {
  if (!senha) return 'Digite a nova senha.'
  if (senha.length < 8) return 'A senha precisa ter ao menos 8 caracteres.'
  if (!confirmacao) return 'Repita a nova senha para confirmar.'
  if (senha !== confirmacao) return 'As senhas não coincidem.'
  return null
}

/** Formato de e-mail aceito no acesso. Deliberadamente frouxo: a validação
 *  que vale é o e-mail chegar: só barramos o que claramente não é endereço. */
export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
