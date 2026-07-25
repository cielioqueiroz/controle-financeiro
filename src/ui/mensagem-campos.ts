/** Junta rótulos de campo com a conjunção correta da locale
 *  ("a, b e c" em pt; "a, b, and c" em en; "a, b y c" em es), via Intl. */
export function juntarCampos(rotulos: string[], locale: string): string {
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(rotulos)
}
