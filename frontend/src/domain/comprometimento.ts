import { ehDivida } from './categorize/categorias'

export type TxComprometimento = {
  amount_cents: number
  kind: string
  category_slug: string | null
  installment: { current: number; total: number } | null
}

export type FaixaComprometimento = 'saudavel' | 'atencao' | 'elevado'

export type Comprometimento = {
  parcelasCents: number
  dividasCents: number
  entradasCents: number
  /** Fração: 0.24 = 24%. */
  pct: number
  faixa: FaixaComprometimento
}

/** Faixas de educação financeira, não norma do Banco Central — e a tela
 *  tem que dizer isso. A FGV propõe outros cortes (20% para dívida cara sem
 *  garantia, 35% no total). Fonte: auditoria de 30/10, item 2.3. */
export const FAIXAS_COMPROMETIMENTO = { saudavel: 0.3, atencao: 0.4 } as const

/** Quanto das entradas do recorte foi para parcelas de compra e dívidas.
 *
 *  Parcela é a compra parcelada que caiu no recorte; dívida é a categoria
 *  `dividas`. A dívida que vem com número de parcela conta só como dívida.
 *  Mede o que já saiu, no mesmo recorte das entradas: misturar com a
 *  projeção do mês seguinte dividiria dinheiro de um mês pela renda de
 *  outro.
 *
 *  `null` sem entradas: sem renda não há fração, e zero seria inventado. */
export function comprometimentoDeRenda(txs: TxComprometimento[]): Comprometimento | null {
  let parcelasCents = 0
  let dividasCents = 0
  let entradasCents = 0
  for (const t of txs) {
    if (t.kind === 'income') entradasCents += Math.abs(t.amount_cents)
    if (t.kind !== 'expense') continue
    if (ehDivida(t.category_slug)) dividasCents += t.amount_cents
    else if (t.installment && t.installment.total > 1) parcelasCents += t.amount_cents
  }
  if (entradasCents <= 0) return null

  const pct = (parcelasCents + dividasCents) / entradasCents
  const faixa: FaixaComprometimento = pct <= FAIXAS_COMPROMETIMENTO.saudavel ? 'saudavel'
    : pct <= FAIXAS_COMPROMETIMENTO.atencao ? 'atencao'
    : 'elevado'
  return { parcelasCents, dividasCents, entradasCents, pct, faixa }
}
