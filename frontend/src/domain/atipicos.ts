import { ehDivida } from './categorize/categorias'
import { normalizeMerchant } from './normalize/merchant'
import { detectarRecorrencias, type TxRecorrente } from './recorrencias'

/** Gasto atípico: a compra isolada que destoa da rotina da categoria.
 *
 *  Item 2.2 da auditoria de 30/10. Um mês com uma geladeira não diz nada
 *  sobre o supermercado se a geladeira estiver no mesmo desenho; separá-la
 *  devolve ao donut e ao ritmo diário a pergunta da rotina. O gasto real
 *  não muda: atípico é leitura, não exclusão.
 *
 *  Puro: sem React, sem rede. */

export type TxAtipicavel = TxRecorrente & { id: string }

/** As duas condições juntas, como nos limiares de `diagnosticos.ts`: só a
 *  proporção faria a farmácia de R$ 60 gritar contra uma mediana de R$ 10, e
 *  só o valor faria toda compra acima de R$ 300 ser atípica no mês de quem
 *  gasta muito. `minimoNaCategoria` é o que torna a mediana uma régua: com
 *  menos compras, ela é o acaso de quais compras foram importadas. */
export const LIMIAR_ATIPICO = { multiplo: 5, pisoCents: 300_00, minimoNaCategoria: 5 } as const

/** Pode compor a rotina de uma categoria — e, por isso, também ser medido
 *  contra ela. Parcela é compromisso futuro, dívida não é consumo, estorno é
 *  a compra voltando, e vínculo e entrada não são gasto. */
function ehCompraAvulsa(t: TxAtipicavel): boolean {
  return t.kind === 'expense' && t.amount_cents > 0 && !t.installment && !ehDivida(t.category_slug)
}

function mediana(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** As compras do `recorte` que são atípicas contra o `historico` inteiro.
 *
 *  A régua de cada compra é a mediana das OUTRAS compras avulsas da mesma
 *  categoria no histórico — não só do recorte, que num mês pode ter duas.
 *  Recorrência nunca é atípica: o aluguel é a rotina por definição, por
 *  maior que seja perto das compras de material da mesma categoria. */
export function gastosAtipicos<T extends TxAtipicavel>(recorte: T[], historico: TxAtipicavel[]): T[] {
  const recorrentes = new Set(
    detectarRecorrencias(historico).filter((r) => r.tipo === 'saida').map((r) => r.chave),
  )
  const porCategoria = new Map<string, TxAtipicavel[]>()
  for (const t of historico) {
    if (!ehCompraAvulsa(t)) continue
    const slug = t.category_slug ?? 'outros'
    const lista = porCategoria.get(slug)
    if (lista) lista.push(t)
    else porCategoria.set(slug, [t])
  }

  return recorte.filter((t) => {
    if (!ehCompraAvulsa(t) || t.amount_cents < LIMIAR_ATIPICO.pisoCents) return false
    if (recorrentes.has(normalizeMerchant(t.description))) return false
    const outras = (porCategoria.get(t.category_slug ?? 'outros') ?? []).filter((o) => o.id !== t.id)
    if (outras.length < LIMIAR_ATIPICO.minimoNaCategoria) return false
    return t.amount_cents >= LIMIAR_ATIPICO.multiplo * mediana(outras.map((o) => o.amount_cents))
  })
}
