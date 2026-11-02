import type { Periodo } from '../domain/agrupar'
import type { Idioma } from '../i18n/idioma'

/** As escolhas da pessoa que valem em todo aparelho. Moram em duas casas: a
 *  tabela `preferencias` (migração 0013), que é a verdade, e o
 *  `localStorage`, que é o cache — o tema e o modo discreto precisam valer
 *  ANTES da primeira pintura, e o servidor só responde depois dela.
 *
 *  `null` em qualquer campo é "não escolheu": o app cai no padrão dele.
 *  Nunca um valor inventado no lugar. */
export type Tema = 'dark' | 'light'

export const CORES_AVATAR = [
  'grafite',
  'oceano',
  'floresta',
  'ambar',
  'terracota',
  'vinho',
  'ameixa',
  'petroleo',
] as const
export type CorAvatar = (typeof CORES_AVATAR)[number]

export const PERIODOS_PADRAO: readonly Periodo[] = ['dia', 'semana', 'mes', 'ano']

export type Preferencias = {
  apelido: string | null
  idioma: Idioma | null
  tema: Tema | null
  discreto: boolean | null
  periodoPadrao: Periodo | null
  corAvatar: CorAvatar | null
}

export const SEM_PREFERENCIAS: Preferencias = {
  apelido: null,
  idioma: null,
  tema: null,
  discreto: null,
  periodoPadrao: null,
  corAvatar: null,
}

/** As chaves do `localStorage`. Três delas são ANTERIORES a este módulo e
 *  não podem mudar de nome: o script inline do `index.html` lê `tema`, o
 *  `DiscretoProvider` lê `discreto` e o `IdiomaProvider` lê `cf:idioma`. */
const CHAVES = {
  apelido: 'cf:apelido',
  idioma: 'cf:idioma',
  tema: 'tema',
  discreto: 'discreto',
  periodoPadrao: 'cf:periodo-padrao',
  corAvatar: 'cf:cor-avatar',
} as const

const ehIdioma = (v: unknown): v is Idioma => v === 'pt' || v === 'en' || v === 'es'
const ehTema = (v: unknown): v is Tema => v === 'dark' || v === 'light'
const ehPeriodo = (v: unknown): v is Periodo => PERIODOS_PADRAO.includes(v as Periodo)
const ehCor = (v: unknown): v is CorAvatar => CORES_AVATAR.includes(v as CorAvatar)

function apelidoValido(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const a = v.trim()
  return a ? a.slice(0, 40) : null
}

/** Lê uma linha da tabela. Valor fora do esperado vira `null`, campo a
 *  campo: um idioma que o app ainda não conhece não pode derrubar o tema. */
export function preferenciasDaLinha(linha: unknown): Preferencias {
  if (typeof linha !== 'object' || linha === null) return SEM_PREFERENCIAS
  const l = linha as Record<string, unknown>
  return {
    apelido: apelidoValido(l.apelido),
    idioma: ehIdioma(l.idioma) ? l.idioma : null,
    tema: ehTema(l.tema) ? l.tema : null,
    discreto: typeof l.discreto === 'boolean' ? l.discreto : null,
    periodoPadrao: ehPeriodo(l.periodo_padrao) ? l.periodo_padrao : null,
    corAvatar: ehCor(l.cor_avatar) ? l.cor_avatar : null,
  }
}

export function linhaDasPreferencias(p: Preferencias): Record<string, unknown> {
  return {
    apelido: p.apelido,
    idioma: p.idioma,
    tema: p.tema,
    discreto: p.discreto,
    periodo_padrao: p.periodoPadrao,
    cor_avatar: p.corAvatar,
  }
}

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

function escrever(chave: string, valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(chave)
    else localStorage.setItem(chave, valor)
  } catch {
    /* armazenamento bloqueado: a escolha vale até o F5 */
  }
}

export function lerPreferenciasLocais(): Preferencias {
  const idioma = ler(CHAVES.idioma)
  const tema = ler(CHAVES.tema)
  const discreto = ler(CHAVES.discreto)
  const periodo = ler(CHAVES.periodoPadrao)
  const cor = ler(CHAVES.corAvatar)
  return {
    apelido: apelidoValido(ler(CHAVES.apelido)),
    idioma: ehIdioma(idioma) ? idioma : null,
    tema: ehTema(tema) ? tema : null,
    discreto: discreto === '1' ? true : discreto === '0' ? false : null,
    periodoPadrao: ehPeriodo(periodo) ? periodo : null,
    corAvatar: ehCor(cor) ? cor : null,
  }
}

/** Grava no aparelho. `null` APAGA a chave, para o padrão voltar a valer. */
export function gravarPreferenciasLocais(p: Preferencias): void {
  escrever(CHAVES.apelido, p.apelido)
  escrever(CHAVES.idioma, p.idioma)
  escrever(CHAVES.tema, p.tema)
  escrever(CHAVES.discreto, p.discreto === null ? null : p.discreto ? '1' : '0')
  escrever(CHAVES.periodoPadrao, p.periodoPadrao)
  escrever(CHAVES.corAvatar, p.corAvatar)
}

/** O período com que as telas abrem quando a URL não traz um. */
export function lerPeriodoPadrao(): Periodo {
  const p = ler(CHAVES.periodoPadrao)
  return ehPeriodo(p) ? p : 'mes'
}

export function lerCorAvatar(): CorAvatar | null {
  const c = ler(CHAVES.corAvatar)
  return ehCor(c) ? c : null
}

const CHAVE_SINCRONIZADO = 'cf:preferencias-sincronizadas'

/** Este aparelho já conversou com o servidor alguma vez. */
export function aparelhoSincronizado(): boolean {
  return ler(CHAVE_SINCRONIZADO) === '1'
}

export function marcarAparelhoSincronizado(sim: boolean): void {
  escrever(CHAVE_SINCRONIZADO, sim ? '1' : null)
}

/** ## Quem vence no login
 *
 *  O servidor. A única exceção é a PRIMEIRA conversa deste aparelho com ele:
 *  aí o aparelho preenche o que o servidor não sabe — é o caso de quem já
 *  usava o app antes da 0013, e cujas escolhas moravam só aqui. `enviar`
 *  diz que essas escolhas antigas devem subir, sozinhas, sem a pessoa abrir
 *  o perfil.
 *
 *  ⚠️ **Depois da primeira vez, campo nulo no servidor é escolha, não
 *  ausência.** Quem apagou o apelido no celular quer ser chamado pelo nome
 *  no desktop também; se o aparelho continuasse preenchendo lacunas, o
 *  apelido velho voltaria do cache dele e subiria de novo.
 *
 *  `servidor === null` é "não deu para perguntar" (rede, tabela ausente): aí
 *  nada se mescla e nada se envia — escrever por cima do que não se leu
 *  apagaria a escolha feita noutro aparelho. */
export function mesclarPreferencias(
  servidor: Preferencias | null,
  local: Preferencias,
  jaSincronizado: boolean,
): { valendo: Preferencias; enviar: boolean } {
  if (servidor === null) return { valendo: local, enviar: false }
  if (jaSincronizado) return { valendo: servidor, enviar: false }
  const campos = Object.keys(SEM_PREFERENCIAS) as Array<keyof Preferencias>
  const valendo = { ...servidor }
  let enviar = false
  for (const campo of campos) {
    if (valendo[campo] === null && local[campo] !== null) {
      Object.assign(valendo, { [campo]: local[campo] })
      enviar = true
    }
  }
  return { valendo, enviar }
}
