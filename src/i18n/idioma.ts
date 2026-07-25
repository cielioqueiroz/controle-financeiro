export type Idioma = 'pt' | 'en' | 'es'
export const IDIOMAS = ['pt', 'en', 'es'] as const

const CHAVE = 'cf:idioma'

function ehIdioma(v: unknown): v is Idioma {
  return v === 'pt' || v === 'en' || v === 'es'
}

/** pt/en/es pelo prefixo de navigator.language; qualquer outro → pt. */
export function detectarIdioma(): Idioma {
  const pref = (navigator?.language ?? 'pt').slice(0, 2).toLowerCase()
  return ehIdioma(pref) ? pref : 'pt'
}

/** Idioma salvo pelo usuário; sem escolha (ou storage indisponível/ inválido),
 *  cai na detecção pelo navegador. Nunca lança. */
export function lerIdioma(): Idioma {
  try {
    const v = localStorage.getItem(CHAVE)
    if (ehIdioma(v)) return v
  } catch {
    /* storage indisponível */
  }
  return detectarIdioma()
}

export function salvarIdioma(id: Idioma): void {
  try {
    localStorage.setItem(CHAVE, id)
  } catch {
    /* ignora */
  }
}
