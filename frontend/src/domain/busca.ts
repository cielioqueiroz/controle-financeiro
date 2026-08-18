import { analisarConsulta, casaConsulta, type TxConsultavel } from './consulta'

/** Busca sobre lançamentos: o texto (com operadores) mais o seletor de
 *  categoria da barra, que é um controle à parte e não se digita.
 *
 *  Quem decide o que casa é `consulta.ts` — este arquivo só compõe. Antes
 *  havia aqui um normalizador e um casador próprios; virariam a segunda
 *  opinião sobre "o que casa" no dia em que a busca ganhasse operadores,
 *  que é exatamente o que aconteceu. */

export type TxBuscavel = TxConsultavel

/** Filtra por consulta e/ou categoria. `categoriaSlug` nulo = todas.
 *  Preserva a ordem recebida — quem ordena é quem chama. */
export function buscar<T extends TxBuscavel>(
  txs: T[],
  termo: string,
  categoriaSlug: string | null,
): T[] {
  const consulta = analisarConsulta(termo)
  return txs.filter((t) => {
    if (categoriaSlug && (t.category_slug ?? 'outros') !== categoriaSlug) return false
    return casaConsulta(t, consulta)
  })
}
