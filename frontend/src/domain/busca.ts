/** Busca textual sobre lançamentos.
 *
 *  Puro e separado da UI para poder ser testado sem renderizar nada — e
 *  porque a regra de "o que casa" tem sutileza: acento e caixa não podem
 *  atrapalhar (ninguém digita "FARMÁCIA" com acento e maiúscula na pressa),
 *  e a busca tem que enxergar o rótulo que o usuário deu à compra, não só a
 *  descrição crua do banco. */

export type TxBuscavel = {
  description: string
  label: string | null
  category_slug: string | null
}

/** Caixa baixa, sem acento, sem espaço sobrando. Aplicado dos dois lados
 *  da comparação. */
export function normalizarBusca(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** O lançamento casa com o termo? Procura no rótulo do usuário E na
 *  descrição original: quem renomeou "PAG*JOAO" para "Pedreiro" pode
 *  procurar por qualquer um dos dois. */
export function casaTermo(tx: TxBuscavel, termoNormalizado: string): boolean {
  if (!termoNormalizado) return true
  const alvo = normalizarBusca(`${tx.label ?? ''} ${tx.description}`)
  return alvo.includes(termoNormalizado)
}

/** Filtra por texto livre e/ou categoria. `categoria` nulo = todas.
 *  Preserva a ordem recebida — quem ordena é quem chama. */
export function buscar<T extends TxBuscavel>(
  txs: T[],
  termo: string,
  categoriaSlug: string | null,
): T[] {
  const termoNorm = normalizarBusca(termo)
  return txs.filter((t) => {
    if (categoriaSlug && (t.category_slug ?? 'outros') !== categoriaSlug) return false
    return casaTermo(t, termoNorm)
  })
}
