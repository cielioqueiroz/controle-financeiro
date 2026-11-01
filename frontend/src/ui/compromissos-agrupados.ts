import type { MesFuturo } from '../domain/agrupar'

export type ItemDoGrupo = {
  descricao: string
  bank: string
  total: number
  amountCents: number
  /** Parcela no primeiro e no último mês do grupo. */
  de: number
  ate: number
}

export type GrupoMeses = {
  inicio: string
  fim: string
  meses: MesFuturo[]
  itens: ItemDoGrupo[]
}

function seguinte(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`
}

/** O que um mês cobra, sem o número da parcela: é ele que anda de um mês
 *  para o outro, e é o resto que precisa ser igual. */
function assinatura(m: MesFuturo): string {
  return m.itens.map((i) => `${i.bank}|${i.descricao}|${i.total}|${i.amountCents}`).join('\n')
}

/** Recolhe meses seguidos que cobram as mesmas parcelas.
 *
 *  Uma compra em 10× projeta seis linhas idênticas, e seis linhas iguais
 *  dizem a mesma coisa seis vezes. Junta só o que é igual de fato: mesmo
 *  cartão, mesma descrição, mesmo total de parcelas e mesmo valor, em
 *  meses colados. Um mês sem parcela no meio corta o grupo.
 *
 *  As séries do mês saem de `projecaoFutura` na mesma ordem todo mês, então
 *  com assinaturas iguais o item `i` do primeiro mês é a mesma série do item
 *  `i` do último — é o que dá a faixa "4–6/10" sem casar por chave. */
export function agruparMesesIguais(meses: MesFuturo[]): GrupoMeses[] {
  const grupos: GrupoMeses[] = []
  for (const m of meses) {
    const atual = grupos[grupos.length - 1]
    if (atual && m.competencia === seguinte(atual.fim) && assinatura(m) === assinatura(atual.meses[0])) {
      atual.meses.push(m)
      atual.fim = m.competencia
    } else {
      grupos.push({ inicio: m.competencia, fim: m.competencia, meses: [m], itens: [] })
    }
  }
  for (const g of grupos) {
    const ultimo = g.meses[g.meses.length - 1]
    g.itens = g.meses[0].itens.map((i, k) => ({
      descricao: i.descricao, bank: i.bank, total: i.total, amountCents: i.amountCents,
      de: i.parcela, ate: ultimo.itens[k].parcela,
    }))
  }
  return grupos
}
