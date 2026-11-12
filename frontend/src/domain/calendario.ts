import { projecaoFutura, type ItemFuturo, type TxParcela } from './agrupar'
import { alertasDe, competenciaMaisRecente, detectarRecorrencias, type TxRecorrente } from './recorrencias'

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
export type DocVencimento = {
  bank: string
  account_id?: string | null
  doc_type: string
  period_end: string | null
}

export type ItemDoDia =
  | {
      tipo: 'recorrencia'
      chave: string
      descricao: string
      sentido: 'saida' | 'entrada'
      valorCents: number
      /** `variavel`: luz, água — o valor é a mediana, não uma promessa. */
      variacao: 'fixo' | 'variavel'
      /** Só quando o valor mudou (o alerta `valor-mudou`): `valorCents` é o
       *  último valor, e este é o de antes. */
      valorAnteriorCents?: number
    }
  | {
      tipo: 'parcelas'
      bank: string
      accountId?: string | null
      valorCents: number
      parcelas: ItemFuturo[]
    }

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
function vencimentoPorConta(docs: DocVencimento[]): Map<string, number> {
  const ultima = new Map<string, string>()
  for (const d of docs) {
    if (d.doc_type !== 'fatura' || !d.period_end) continue
    const conta = d.account_id ?? `${d.bank}:sem-conta`
    const atual = ultima.get(conta)
    if (!atual || d.period_end > atual) ultima.set(conta, d.period_end)
  }
  return new Map([...ultima].map(([conta, fim]) => [conta, Number(fim.slice(8, 10))]))
}

/** O mês seguinte à competência mais recente com dado — a mesma régua dos
 *  alertas de recorrência, e não o relógio: o calendário de quem importou
 *  até agosto é o de setembro, em qualquer dia em que for aberto.
 *
 *  Recorrência no dia típico (o 31 vira o último dia de um mês curto), com
 *  o valor típico — ou o último, quando o alerta diz que ele mudou;
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

  const recorrencias = detectarRecorrencias(txs)
  // O valor que mudou é o do alerta, e não uma régua própria: o calendário
  // não pode prever o valor novo de uma conta que a tela de alertas diz não
  // ter mudado. Pela mediana, um reajuste só apareceria depois de se repetir.
  const mudancas = new Map<string, { deCents: number; paraCents: number }>()
  for (const a of alertasDe(recorrencias, atual)) {
    if (a.tipo === 'valor-mudou') mudancas.set(`${a.origem}|${a.chave}`, a)
  }

  for (const r of recorrencias) {
    if (r.cadencia === 'anual') {
      if (somarMeses(r.ultimaCompetencia, 12) !== competencia) continue
    } else if (mesesEntre(r.ultimaCompetencia, atual) > ATRASO_TOLERADO) continue
    const chave = `${r.tipo}|${r.chave}`
    // Só com uma cobrança no último mês: com duas (salário e férias) o
    // alerta acusa a soma, e a soma não é o valor de um mês.
    const mudanca = r.ocorrenciasNaUltima === 1 ? mudancas.get(chave) : undefined
    const valorCents = mudanca ? mudanca.paraCents : r.valorTipicoCents
    adicionar(Math.min(r.diaTipico, ultimoDia), {
      tipo: 'recorrencia',
      chave,
      descricao: r.descricao,
      sentido: r.tipo,
      valorCents,
      variacao: r.variacao,
      ...(mudanca && { valorAnteriorCents: mudanca.deCents }),
    })
    if (r.tipo === 'entrada') entradaCents += valorCents
    else saidaCents += valorCents
  }

  const vencimentos = vencimentoPorConta(docs)
  const mes = projecaoFutura(txs).find((m) => m.competencia === competencia)
  type ParcelasDaConta = {
    bank: string
    accountId: string | null
    totalCents: number
    parcelas: ItemFuturo[]
  }
  const porConta = new Map<string, ParcelasDaConta>()
  for (const parcela of mes?.itens ?? []) {
    const conta = parcela.accountId ?? `${parcela.bank}:sem-conta`
    const grupo: ParcelasDaConta = porConta.get(conta) ?? {
      bank: parcela.bank,
      accountId: parcela.accountId ?? null,
      totalCents: 0,
      parcelas: [],
    }
    grupo.totalCents += parcela.amountCents
    grupo.parcelas.push(parcela)
    porConta.set(conta, grupo)
  }
  for (const [conta, { bank, accountId, totalCents, parcelas }] of porConta) {
    const dia = vencimentos.get(conta)
    adicionar(dia === undefined ? null : Math.min(dia, ultimoDia), {
      tipo: 'parcelas',
      bank,
      accountId,
      valorCents: totalCents,
      parcelas,
    })
    saidaCents += totalCents
  }

  if (porDia.size === 0) return null
  const dias = [...porDia]
    .map(([dia, itens]) => ({ dia, itens: itens.sort((a, b) => b.valorCents - a.valorCents) }))
    .sort((a, b) => (a.dia ?? Infinity) - (b.dia ?? Infinity))
  return { competencia, dias, saidaCents, entradaCents }
}
