import { normalizeMerchant } from './normalize/merchant'

/** Recorrências detectadas: o que se repete mês a mês sem ninguém cadastrar.
 *
 *  O app é retrospectivo — nada aqui é digitado. A detecção olha o histórico
 *  já importado e responde "o que cobra de mim todo mês, quanto e em que
 *  dia". Isso cobre de uma vez as duas coisas que um app de finanças
 *  costuma pedir cadastro para fazer: a lista de contas fixas e o calendário
 *  de datas do mês (`diaTipico`).
 *
 *  Puro: sem rede, sem React. */

export type TxRecorrente = {
  /** Data real do lançamento (YYYY-MM-DD). */
  date: string
  /** Competência — mês da fatura (YYYY-MM). */
  competencia: string
  description: string
  label: string | null
  amount_cents: number
  kind: string
  category_slug: string | null
  installment: { current: number; total: number } | null
}

export type Recorrencia = {
  /** Chave normalizada do estabelecimento (`normalizeMerchant`). */
  chave: string
  /** Como mostrar: o rótulo do usuário da ocorrência mais recente, se houver. */
  descricao: string
  categoriaSlug: string
  tipo: 'saida' | 'entrada'
  /** Mediana dos totais por competência, em centavos (sempre positivo). */
  valorTipicoCents: number
  /** Mediana das competências ANTERIORES à última. É a linha de base contra
   *  a qual o alerta de mudança de valor compara. */
  valorAnteriorCents: number
  /** Mediana do dia do mês. É o "Datas do mês" — 05 aluguel, 15 salário. */
  diaTipico: number
  /** `fixo` = todas as competências anteriores dentro de ±5% da mediana
   *  delas. `variavel` = luz, água, o que oscila por natureza. */
  variacao: 'fixo' | 'variavel'
  /** Competências em que apareceu, em ordem crescente. */
  competencias: string[]
  ultimoValorCents: number
  ultimaCompetencia: string
}

/** Mínimo de meses distintos para algo ser considerado recorrente. Dois
 *  meses seguidos podem ser coincidência; três já é padrão. */
const MIN_COMPETENCIAS = 3

/** Tolerância para classificar como valor fixo. */
const TOLERANCIA_FIXO = 0.05

function mediana(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** Competência mais recente presente nos dados. É a régua dos alertas: sem
 *  ela, o mês cuja fatura ainda não foi importada acusaria tudo como sumido. */
export function competenciaMaisRecente(txs: TxRecorrente[]): string | null {
  let max: string | null = null
  for (const t of txs) if (max === null || t.competencia > max) max = t.competencia
  return max
}

type Grupo = {
  chave: string
  tipo: 'saida' | 'entrada'
  ocorrencias: TxRecorrente[]
}

/** Detecta o que se repete. Devolve ordenado por valor típico desc.
 *
 *  Três filtros, cada um por um motivo:
 *
 *  1. **Parceladas ficam de fora.** Parcela já é assunto de
 *     `projecaoFutura`/`CompromissosFuturos`. Sem essa fronteira a mesma
 *     compra apareceria em dois lugares dizendo coisas diferentes.
 *  2. **Só `expense` e `income`.** Vínculo (`card_payment`,
 *     `internal_transfer`) é dinheiro mudando de lugar; a quitação da fatura
 *     é mensal e lideraria a lista sem significar nada.
 *  3. **Tipicamente uma cobrança por mês** (mediana de ocorrências por
 *     competência igual a 1). É o que separa assinatura de supermercado: o
 *     mercado também aparece todo mês, mas com 27 compras, e listá-lo como
 *     "recorrência" encheria a lista de coisa que não é conta fixa. Tolera o
 *     mês com cobrança dobrada sem derrubar a série. */
export function detectarRecorrencias(txs: TxRecorrente[]): Recorrencia[] {
  const grupos = new Map<string, Grupo>()

  for (const t of txs) {
    if (t.installment) continue
    if (t.kind !== 'expense' && t.kind !== 'income') continue
    const tipo = t.kind === 'income' ? 'entrada' : 'saida'
    const chave = normalizeMerchant(t.description)
    if (!chave) continue
    // O tipo entra na chave do grupo: um estorno de mesmo nome não pode
    // entrar na mesma série da cobrança.
    const id = `${tipo}|${chave}`
    const g = grupos.get(id) ?? { chave, tipo, ocorrencias: [] }
    g.ocorrencias.push(t)
    grupos.set(id, g)
  }

  const recorrencias: Recorrencia[] = []

  for (const g of grupos.values()) {
    // Soma e conta por competência.
    const porComp = new Map<string, { soma: number; qtd: number }>()
    for (const t of g.ocorrencias) {
      const c = porComp.get(t.competencia) ?? { soma: 0, qtd: 0 }
      c.soma += Math.abs(t.amount_cents)
      c.qtd += 1
      porComp.set(t.competencia, c)
    }

    const competencias = [...porComp.keys()].sort()
    if (competencias.length < MIN_COMPETENCIAS) continue
    if (mediana(competencias.map((c) => porComp.get(c)!.qtd)) !== 1) continue

    const somas = competencias.map((c) => porComp.get(c)!.soma)
    const anteriores = somas.slice(0, -1)
    const base = mediana(anteriores)
    // A última ocorrência fica FORA do cálculo da linha de base de propósito:
    // ela é justamente a candidata a ser a mudança que o alerta anuncia, e
    // incluí-la faria o aumento se esconder reclassificando a série como
    // variável.
    const variacao =
      base > 0 && anteriores.every((v) => Math.abs(v - base) / base <= TOLERANCIA_FIXO)
        ? 'fixo'
        : 'variavel'

    const ultimaCompetencia = competencias[competencias.length - 1]
    // Exibição e categoria vêm da ocorrência mais recente: se o usuário
    // renomeou ou recategorizou a compra, é essa a versão que ele reconhece.
    const maisNova = g.ocorrencias
      .filter((t) => t.competencia === ultimaCompetencia)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0]

    recorrencias.push({
      chave: g.chave,
      descricao: maisNova.label ?? maisNova.description,
      categoriaSlug: maisNova.category_slug ?? 'outros',
      tipo: g.tipo,
      valorTipicoCents: mediana(somas),
      valorAnteriorCents: base,
      diaTipico: mediana(g.ocorrencias.map((t) => Number(t.date.slice(8, 10)))),
      variacao,
      competencias,
      ultimoValorCents: somas[somas.length - 1],
      ultimaCompetencia,
    })
  }

  return recorrencias.sort((a, b) => b.valorTipicoCents - a.valorTipicoCents)
}

/** Campos comuns a todo alerta.
 *
 *  `origem` existe porque `chave` sozinha NÃO identifica a recorrência: a
 *  mesma loja pode ter uma série de saída (a cobrança) e outra de entrada (o
 *  estorno), e as duas podem sumir no mesmo mês. Sem `origem` os dois alertas
 *  ficariam indistinguíveis — e, na lista, com a mesma chave de React. */
type AlertaBase = {
  chave: string
  origem: 'saida' | 'entrada'
  descricao: string
}

export type Alerta =
  | (AlertaBase & {
      tipo: 'valor-mudou'
      deCents: number
      paraCents: number
    })
  | (AlertaBase & {
      tipo: 'sumiu'
      /** Última competência em que apareceu. */
      desdeCompetencia: string
    })

/** Mudança de valor só vira alerta acima de 10% E de R$ 5,00. As duas
 *  condições juntas: só o percentual faria uma assinatura de R$ 9,90 gritar
 *  por R$ 1,00; só o valor absoluto faria uma conta de R$ 800 ignorar R$ 6,00
 *  de aumento. */
const MIN_VARIACAO_PCT = 0.1
const MIN_VARIACAO_CENTS = 500

/** Quantos meses de atraso ainda contam como "sumiu". Sem esse teto, uma
 *  série que existiu por 3 meses em 2024 alertaria para sempre. */
const MAX_MESES_SUMIDO = 3

function mesesEntre(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

/** Alertas derivados das recorrências. `competenciaAtual` é a competência
 *  mais recente que TEM DADO (não o mês do calendário) — é o que impede que
 *  o mês cuja fatura ainda não foi importada acuse tudo como sumido. */
export function alertasDe(
  recorrencias: Recorrencia[],
  competenciaAtual: string | null,
): Alerta[] {
  if (!competenciaAtual) return []
  const alertas: Alerta[] = []

  for (const r of recorrencias) {
    // 1. Mudou de valor. Só para série de valor fixo: a conta de luz varia
    //    por natureza e alertaria todo mês, ensinando a ignorar o alerta.
    if (r.variacao === 'fixo' && r.valorAnteriorCents > 0) {
      const delta = Math.abs(r.ultimoValorCents - r.valorAnteriorCents)
      if (
        delta >= MIN_VARIACAO_CENTS &&
        delta / r.valorAnteriorCents >= MIN_VARIACAO_PCT
      ) {
        alertas.push({
          tipo: 'valor-mudou',
          chave: r.chave,
          origem: r.tipo,
          descricao: r.descricao,
          deCents: r.valorAnteriorCents,
          paraCents: r.ultimoValorCents,
        })
        continue
      }
    }

    // 2. Sumiu. Faltou no mês mais recente com dado, e o atraso é recente.
    const atraso = mesesEntre(r.ultimaCompetencia, competenciaAtual)
    if (atraso >= 1 && atraso <= MAX_MESES_SUMIDO) {
      alertas.push({
        tipo: 'sumiu',
        chave: r.chave,
        origem: r.tipo,
        descricao: r.descricao,
        desdeCompetencia: r.ultimaCompetencia,
      })
    }
  }

  return alertas
}
