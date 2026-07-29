import { pt, type Dicionario } from './dicionarios/pt'
import { en } from './dicionarios/en'
import { es } from './dicionarios/es'
import { type Idioma, lerIdioma } from './idioma'

export const DICTS: Record<Idioma, Dicionario> = { pt, en, es }

/** Tradução pura, sem React. `{param}` é interpolado; chave ausente no
 *  idioma cai no pt (nunca undefined em runtime). */
export function traduzir(
  idioma: Idioma,
  chave: keyof Dicionario,
  params?: Record<string, string | number>,
): string {
  const bruto = DICTS[idioma][chave] ?? pt[chave]
  if (!params) return bruto
  return bruto.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

/** t para código fora do React (ex.: geração de PDF): resolve o idioma
 *  persistido/detectado no momento da chamada. Dentro de componentes,
 *  prefira `useT` — este helper não re-renderiza na troca de idioma. */
export function tAtual(
  chave: keyof Dicionario,
  params?: Record<string, string | number>,
): string {
  return traduzir(lerIdioma(), chave, params)
}
