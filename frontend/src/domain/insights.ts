import type { ParseResult } from './parsers/types'
import type { LinkKind } from './link/vinculos'
import { categoriaDe, type Regra, REGRAS_GLOBAIS } from './categorize/regras'
import { categoria, type Categoria } from './categorize/categorias'
import { vincular, paraVincular } from './link/vinculos'
import type { DocKind } from './pdf/detect'

/** Transação enriquecida para exibição: categoria, vínculo e rótulo do
 *  usuário sobre a descrição original. */
export type TxView = {
  id: number
  date: Date
  /** Descrição original do banco — imutável. */
  description: string
  /** Rótulo editável do usuário (exibido no lugar da descrição). */
  label: string | null
  amountCents: number
  categoriaSlug: string
  installment: { current: number; total: number } | null
  link: LinkKind
  linkNote: string | null
}

export type CategoriaResumo = {
  cat: Categoria
  totalCents: number
  contagem: number
}

export type Insights = {
  transacoes: TxView[]
  /** Gasto real: exclui vínculos e entradas. O número honesto. */
  gastoRealCents: number
  /** Soma ingênua de saídas, para mostrar o quanto de dupla contagem some. */
  gastoIngenuoCents: number
  totalEntradasCents: number
  porCategoria: CategoriaResumo[]
}

/** Constrói os insights de um único documento importado. Quando houver
 *  persistência (fatia 1), receberá também as transações já salvas para
 *  o cruzamento entre documentos. */
export function construirInsights(
  result: ParseResult,
  kind: DocKind,
  regrasUsuario: Regra[] = [],
): Insights {
  const regras = [...regrasUsuario, ...REGRAS_GLOBAIS]
  const doc = paraVincular(result, `${kind.bank}-${kind.docType}`, kind.docType)
  const linked = vincular([doc])

  const transacoes: TxView[] = linked.map((t, i) => ({
    id: i,
    date: t.date,
    description: t.description,
    label: null,
    amountCents: t.amountCents,
    categoriaSlug: categoriaDe(t, regras),
    installment: t.installment,
    link: t.link,
    linkNote: t.linkNote,
  }))

  // A natureza manda na mesma conta de `salvar`/`agregar`: estorno
  // abate a compra, pagamento não é gasto e vínculo não vira entrada.
  const despesas = linked.filter((t) =>
    t.link === null && (t.kind === 'compra' || t.kind === 'encargo'))
  const gastoRealCents = despesas.reduce((a, t) => a + t.amountCents, 0)

  const gastoIngenuoCents = linked
    .filter((t) => t.kind === 'compra' || t.kind === 'encargo' || (t.kind === 'pagamento' && t.amountCents > 0))
    .reduce((a, t) => a + t.amountCents, 0)

  const totalEntradasCents = linked
    .filter((t) => t.link === null && t.kind === 'entrada')
    .reduce((a, t) => a + Math.abs(t.amountCents), 0)

  const mapa = new Map<string, CategoriaResumo>()
  for (const t of despesas) {
    const slug = categoriaDe(t, regras)
    const atual = mapa.get(slug) ?? { cat: categoria(slug), totalCents: 0, contagem: 0 }
    atual.totalCents += t.amountCents
    atual.contagem += 1
    mapa.set(slug, atual)
  }
  const porCategoria = [...mapa.values()].sort((a, b) => b.totalCents - a.totalCents)

  return {
    transacoes,
    gastoRealCents,
    gastoIngenuoCents,
    totalEntradasCents,
    porCategoria,
  }
}
