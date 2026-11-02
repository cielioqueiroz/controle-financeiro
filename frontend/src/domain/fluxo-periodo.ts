import { categoria, type Categoria } from './categorize/categorias'
import type { TxAgrupavel } from './agrupar'

export type TxFluxo = TxAgrupavel & { bank: string }

export type Origem =
  | { tipo: 'banco'; bank: string; valorCents: number }
  | { tipo: 'estornos'; valorCents: number; slugs: string[] }
  | { tipo: 'faltou'; valorCents: number }

export type Destino =
  | { tipo: 'categoria'; cat: Categoria; valorCents: number }
  | { tipo: 'outras'; slugs: string[]; valorCents: number }
  | { tipo: 'sobrou'; valorCents: number }

export type FluxoDoPeriodo = {
  origens: Origem[]
  destinos: Destino[]
  /** O que cada lado soma. É o mesmo dos dois lados por construção. */
  totalCents: number
}

export const CATEGORIAS_NO_FLUXO = 8

/** O fluxo do período: de onde veio o dinheiro e para onde foi.
 *
 *  Segue a regra de `agregar` — entradas são `income`, gasto é `expense`, e
 *  vínculo não entra. A categoria que o estorno deixou negativa não pode ser
 *  faixa de largura negativa: o que ela devolveu passa para o lado das
 *  origens, como estornos. Assim entradas + estornos + faltou = categorias
 *  positivas + sobrou, e o sobrou é o `saldoCents` do mesmo recorte. */
export function fluxoDoPeriodo(txs: TxFluxo[]): FluxoDoPeriodo | null {
  const porBanco = new Map<string, number>()
  const porCategoria = new Map<string, number>()

  for (const t of txs) {
    if (t.kind === 'income') {
      porBanco.set(t.bank, (porBanco.get(t.bank) ?? 0) + Math.abs(t.amount_cents))
    } else if (t.kind === 'expense') {
      const slug = t.category_slug ?? 'outros'
      porCategoria.set(slug, (porCategoria.get(slug) ?? 0) + t.amount_cents)
    }
  }

  const bancos = [...porBanco]
    .filter(([, valor]) => valor > 0)
    .sort(([a, va], [b, vb]) => vb - va || a.localeCompare(b))
  const categorias = [...porCategoria].sort(([a, va], [b, vb]) => vb - va || a.localeCompare(b))
  const positivas = categorias.filter(([, valor]) => valor > 0)
  const negativas = categorias.filter(([, valor]) => valor < 0)

  const entradasCents = bancos.reduce((s, [, valor]) => s + valor, 0)
  const estornosCents = negativas.reduce((s, [, valor]) => s - valor, 0)
  const gastoCents = positivas.reduce((s, [, valor]) => s + valor, 0)
  const disponivelCents = entradasCents + estornosCents
  const totalCents = Math.max(disponivelCents, gastoCents)
  if (totalCents === 0) return null

  const origens: Origem[] = bancos.map(([bank, valorCents]) => ({ tipo: 'banco', bank, valorCents }))
  if (estornosCents > 0) origens.push({ tipo: 'estornos', valorCents: estornosCents, slugs: negativas.map(([slug]) => slug) })
  if (gastoCents > disponivelCents) origens.push({ tipo: 'faltou', valorCents: gastoCents - disponivelCents })

  // "Outras" com uma categoria só esconderia um nome sem economizar linha.
  const visiveis = positivas.length > CATEGORIAS_NO_FLUXO + 1 ? positivas.slice(0, CATEGORIAS_NO_FLUXO) : positivas
  const resto = positivas.slice(visiveis.length)
  const destinos: Destino[] = visiveis.map(([slug, valorCents]) => ({ tipo: 'categoria', cat: categoria(slug), valorCents }))
  if (resto.length > 0) {
    destinos.push({ tipo: 'outras', slugs: resto.map(([slug]) => slug), valorCents: resto.reduce((s, [, valor]) => s + valor, 0) })
  }
  if (disponivelCents > gastoCents) destinos.push({ tipo: 'sobrou', valorCents: disponivelCents - gastoCents })

  return { origens, destinos, totalCents }
}
