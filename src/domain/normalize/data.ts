import { localeAtual } from './locale'

/** Mês abreviado na locale ativa (ex.: pt "mai", en "May"). Remove o ponto
 *  que algumas locales (pt) põem no fim, para o rótulo ficar limpo. */
export function mesAbrev(d: Date): string {
  return new Intl.DateTimeFormat(localeAtual(), { month: 'short' }).format(d).replace('.', '')
}

/** Data curta numérica (dd/mm/aaaa conforme a locale) de um Date. */
export function dataLongaDe(d: Date): string {
  return new Intl.DateTimeFormat(localeAtual(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** Como `dataLongaDe`, mas a partir de um ISO YYYY-MM-DD. Constrói a data em
 *  horário local para não escorregar de fuso. */
export function dataLonga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return dataLongaDe(new Date(y, (m ?? 1) - 1, d))
}
