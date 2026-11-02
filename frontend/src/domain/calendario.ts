import { projecaoFutura, type ItemFuturo, type TxParcela } from './agrupar'
import { competenciaMaisRecente, detectarRecorrencias, type TxRecorrente } from './recorrencias'

/** O calendário do próximo mês: o que deve cair, dia a dia.
 *
 *  Item 2.6 da auditoria de 30/10. É projeção, como o compromisso futuro:
 *  nunca é gravado, sai inteiro do histórico importado e se refaz a cada
 *  documento novo. Junta as duas previsões que o app já sabe fazer — as
 *  recorrências, no dia em que costumam cair, e as parcelas, no vencimento
 *  da fatura que as cobra.
 *
 *  Puro: sem React, sem rede. */

export type TxCalendario = TxRecorrente & TxParcela

/** O que o calendário precisa de um documento: de que banco é, se é fatura
 *  e quando vence. */
export type DocVencimento = { bank: string; doc_type: string; period_end: string | null }

export type ItemDoDia =
  | {
      tipo: 'recorrencia'
      chave: string
      descricao: string
      sentido: 'saida' | 'entrada'
      valorCents: number
      /** `variavel`: luz, água — o valor é a mediana, não uma promessa. */
      variacao: 'fixo' | 'variavel'
    }
  | { tipo: 'parcelas'; bank: string; valorCents: number; parcelas: ItemFuturo[] }

/** `dia: null` reúne o que não tem dia conhecido: as parcelas de um cartão
 *  cuja fatura nunca foi importada. Fica no fim. */
export type DiaDoCalendario = { dia: number | null; itens: ItemDoDia[] }

export type CalendarioDoMes = {
  competencia: string // YYYY-MM
  dias: DiaDoCalendario[]
  saidaCents: number
  entradaCents: number
}

/** Quantos meses a recorrência pode ter faltado e ainda entrar. Um: a
 *  competência mais recente costuma ser a da fatura, que vence no mês
 *  seguinte ao último extrato, e o aluguel e o salário ainda não chegaram
 *  nela. Dois já é o alerta de "sumiu" falando (`alertasDe`). */
const ATRASO_TOLERADO = 1

function somarMeses(comp: string, k: number): string {
  const [y, m] = comp.split('-').map(Number)
  const d = new Date(y, m - 1 + k, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function mesesEntre(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

function diasNoMes(comp: string): number {
  const [y, m] = comp.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** O dia de vencimento de cada cartão, pela fatura mais recente dele. */
function vencimentoPorBanco(docs: DocVencimento[]): Map<string, number> {
  const ultima = new Map<string, string>()
  for (const d of docs) {
    if (d.doc_type !== 'fatura' || !d.period_end) continue
    const atual = ultima.get(d.bank)
    if (!atual || d.period_end > atual) ultima.set(d.bank, d.period_end)
  }
  return new Map([...ultima].map(([bank, fim]) => [bank, Number(fim.slice(8, 10))]))
}

/** O mês seguinte à competência mais recente com dado — a mesma régua dos
 *  alertas de recorrência, e não o relógio: o calendário de quem importou
 *  até agosto é o de setembro, em qualquer dia em que for aberto.
 *
 *  Recorrência no dia típico (o 31 vira o último dia de um mês curto);
 *  parcelas somadas por cartão, no dia de vencimento da última fatura dele.
 *  Recorrência exclui parcela (`detectarRecorrencias`), então nada aparece
 *  duas vezes. Sem nada previsto, devolve `null`. */
export function calendarioDoProximoMes(txs: TxCalendario[], docs: DocVencimento[]): CalendarioDoMes | null {
  const atual = competenciaMaisRecente(txs)
  if (!atual) return null
  const competencia = somarMeses(atual, 1)
  const ultimoDia = diasNoMes(competencia)

  const porDia = new Map<number | null, ItemDoDia[]>()
  const adicionar = (dia: number | null, item: ItemDoDia) => {
    const itens = porDia.get(dia)
    if (itens) itens.push(item)
    else porDia.set(dia, [item])
  }
  let saidaCents = 0
  let entradaCents = 0

  for (const r of detectarRecorrencias(txs)) {
    if (mesesEntre(r.ultimaCompetencia, atual) > ATRASO_TOLERADO) continue
    adicionar(Math.min(r.diaTipico, ultimoDia), {
      tipo: 'recorrencia',
      chave: `${r.tipo}|${r.chave}`,
      descricao: r.descricao,
      sentido: r.tipo,
      valorCents: r.valorTipicoCents,
      variacao: r.variacao,
    })
    if (r.tipo === 'entrada') entradaCents += r.valorTipicoCents
    else saidaCents += r.valorTipicoCents
  }

  const vencimentos = vencimentoPorBanco(docs)
  const mes = projecaoFutura(txs).find((m) => m.competencia === competencia)
  for (const { bank, totalCents } of mes?.porBanco ?? []) {
    const dia = vencimentos.get(bank)
    adicionar(dia === undefined ? null : Math.min(dia, ultimoDia), {
      tipo: 'parcelas',
      bank,
      valorCents: totalCents,
      parcelas: mes!.itens.filter((it) => it.bank === bank),
    })
    saidaCents += totalCents
  }

  if (porDia.size === 0) return null
  const dias = [...porDia]
    .map(([dia, itens]) => ({ dia, itens: itens.sort((a, b) => b.valorCents - a.valorCents) }))
    .sort((a, b) => (a.dia ?? Infinity) - (b.dia ?? Infinity))
  return { competencia, dias, saidaCents, entradaCents }
}
