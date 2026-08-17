import { categoria, type Categoria } from '../domain/categorize/categorias'
import { normalizeMerchant } from '../domain/normalize/merchant'
import type { CategoriaResumo } from '../domain/insights'

export type Periodo = 'dia' | 'semana' | 'mes' | 'ano'

/** O mínimo que o agrupamento precisa de uma transação. TransacaoSalva
 *  satisfaz esta forma. */
export type TxAgrupavel = {
  date: string // data real da compra/débito, YYYY-MM-DD
  competencia: string // mês de referência (fatura), YYYY-MM
  amount_cents: number
  kind: string
  category_slug: string | null
}

/** Competência = mês em que o lançamento "conta". Para fatura é o mês do
 *  vencimento (period_end); para extrato, o mês do próprio período. Assim
 *  uma compra de 20/mai que veio na fatura de junho conta em JUNHO — o
 *  jeito que o usuário pensa ("o que veio na fatura desse mês"). */
export function competenciaDe(periodEnd: string | null | undefined, date: string): string {
  return (periodEnd ?? date).slice(0, 7)
}

/** YYYY-MM-DD no fuso local (a `ref` do dashboard é uma Date local).
 *
 *  Exportado porque o destaque do ritmo diário precisa casar com a MESMA
 *  data que `pertence()` compara no período Dia. Duas conversões separadas
 *  divergiriam na primeira mudança de fuso, e a barra destacada seria a do
 *  dia anterior sem nada denunciar. */
export function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

/** Intervalo [início, fim] da semana (segunda a domingo) que contém `ref`. */
function semana(ref: Date): { ini: string; fim: string } {
  const dow = (ref.getDay() + 6) % 7 // segunda = 0
  const ini = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - dow)
  const fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6)
  return { ini: isoLocal(ini), fim: isoLocal(fim) }
}

/** A transação pertence ao período ancorado em `ref`?
 *  Dia/Semana usam a DATA REAL (quando a compra aconteceu); Mês/Ano usam a
 *  COMPETÊNCIA (a fatura). Ver decisão do usuário em 2026-07. */
export function pertence(tx: TxAgrupavel, periodo: Periodo, ref: Date): boolean {
  switch (periodo) {
    case 'dia':
      return tx.date === isoLocal(ref)
    case 'semana': {
      const { ini, fim } = semana(ref)
      return tx.date >= ini && tx.date <= fim
    }
    case 'mes':
      return tx.competencia === isoLocal(ref).slice(0, 7)
    case 'ano':
      return tx.competencia.slice(0, 4) === String(ref.getFullYear())
  }
}

export function filtrar<T extends TxAgrupavel>(txs: T[], periodo: Periodo, ref: Date): T[] {
  return txs.filter((t) => pertence(t, periodo, ref))
}

export type Resumo = {
  gastoCents: number
  entradasCents: number
  /** Entradas menos gasto. Positivo = sobrou. Vínculos não entram (não são
   *  gasto nem entrada), então o número é o que de fato sobrou no período. */
  saldoCents: number
  contagem: number
  porCategoria: CategoriaResumo[]
}

/** Agrega em números de dashboard. Gasto = despesas (kind 'expense');
 *  entradas = 'income'; vínculos (internal_transfer/card_payment) ficam de
 *  fora do gasto para não contar o mesmo dinheiro duas vezes. */
export function agregar(txs: TxAgrupavel[]): Resumo {
  let gastoCents = 0
  let entradasCents = 0
  const mapa = new Map<string, CategoriaResumo & { cat: Categoria }>()

  for (const t of txs) {
    if (t.kind === 'income') {
      entradasCents += Math.abs(t.amount_cents)
      continue
    }
    if (t.kind !== 'expense') continue
    gastoCents += t.amount_cents
    const slug = t.category_slug ?? 'outros'
    const atual = mapa.get(slug) ?? { cat: categoria(slug), totalCents: 0, contagem: 0 }
    atual.totalCents += t.amount_cents
    atual.contagem += 1
    mapa.set(slug, atual)
  }

  return {
    gastoCents,
    entradasCents,
    saldoCents: entradasCents - gastoCents,
    contagem: txs.length,
    porCategoria: [...mapa.values()].sort((a, b) => b.totalCents - a.totalCents),
  }
}

export type GrupoCategoria<T> = {
  slug: string
  cat: Categoria
  totalCents: number
  contagem: number
  itens: T[]
}

/** Agrupa as DESPESAS por categoria com os itens dentro (para o drill-down:
 *  clicar em Supermercado e ver todas as compras). Ordena categorias por
 *  total e itens por valor, ambos desc. Igual ao donut, mas com detalhe. */
export function porCategoriaDetalhado<T extends TxAgrupavel>(txs: T[]): GrupoCategoria<T>[] {
  const mapa = new Map<string, GrupoCategoria<T>>()
  for (const t of txs) {
    if (t.kind !== 'expense') continue
    const slug = t.category_slug ?? 'outros'
    const g = mapa.get(slug) ?? { slug, cat: categoria(slug), totalCents: 0, contagem: 0, itens: [] }
    g.totalCents += t.amount_cents
    g.contagem += 1
    g.itens.push(t)
    mapa.set(slug, g)
  }
  const grupos = [...mapa.values()]
  for (const g of grupos) g.itens.sort((a, b) => b.amount_cents - a.amount_cents)
  return grupos.sort((a, b) => b.totalCents - a.totalCents)
}

export type PontoMes = {
  competencia: string // YYYY-MM
  gastoCents: number
  entradasCents: number
}

/** Série de gasto/entradas por competência (mês da fatura), em ordem
 *  cronológica. Alimenta o gráfico de evolução mês a mês. */
export function evolucaoMensal(txs: TxAgrupavel[]): PontoMes[] {
  const mapa = new Map<string, PontoMes>()
  for (const t of txs) {
    const p = mapa.get(t.competencia) ?? {
      competencia: t.competencia,
      gastoCents: 0,
      entradasCents: 0,
    }
    if (t.kind === 'income') p.entradasCents += Math.abs(t.amount_cents)
    else if (t.kind === 'expense') p.gastoCents += t.amount_cents
    mapa.set(t.competencia, p)
  }
  return [...mapa.values()].sort((a, b) => (a.competencia < b.competencia ? -1 : 1))
}

export type TxParcela = {
  competencia: string
  amount_cents: number
  kind: string
  description: string
  label: string | null
  bank: string
  installment: { current: number; total: number } | null
}

export type ItemFuturo = {
  descricao: string
  parcela: number
  total: number
  amountCents: number
  bank: string
}

/** Quanto de um mês futuro vem de cada cartão. É o que o gráfico dos
 *  compromissos pinta: a cor do banco responde "de quem é essa parcela" sem
 *  precisar abrir o mês. */
export type FaixaBanco = { bank: string; totalCents: number }

export type MesFuturo = {
  competencia: string // YYYY-MM
  totalCents: number
  itens: ItemFuturo[]
  /** Do maior para o menor — a ordem estável que impede a pilha de trocar
   *  de arranjo entre um mês e outro. */
  porBanco: FaixaBanco[]
}

function somarMeses(comp: string, k: number): string {
  const [y, m] = comp.split('-').map(Number)
  const d = new Date(y, m - 1 + k, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Projeta as parcelas que ainda vão cair, por mês futuro.
 *
 *  "Sem duplicar": a projeção NUNCA é salva no banco — é só cálculo. E, para
 *  cada série de parcelas (mesma compra em várias faturas), projetamos a
 *  partir da parcela MAIS RECENTE conhecida. Como a próxima parcela ainda
 *  não foi importada (se tivesse, ela seria a mais recente), a projeção
 *  nunca colide com um lançamento real que chegar. */
export function projecaoFutura(txs: TxParcela[]): MesFuturo[] {
  // Uma entrada por série, mantendo a parcela de maior número (mais nova).
  const series = new Map<
    string,
    { comp: string; current: number; total: number; cents: number; desc: string; bank: string }
  >()
  for (const t of txs) {
    if (t.kind !== 'expense' || !t.installment) continue
    const { current, total } = t.installment
    if (total <= current) continue
    const desc = t.label ?? t.description
    const chave = `${desc}|${total}`
    const atual = series.get(chave)
    if (!atual || current > atual.current) {
      series.set(chave, {
        comp: t.competencia,
        current,
        total,
        cents: t.amount_cents,
        desc,
        bank: t.bank,
      })
    }
  }

  const meses = new Map<string, MesFuturo>()
  for (const s of series.values()) {
    for (let k = 1; k <= s.total - s.current; k++) {
      const comp = somarMeses(s.comp, k)
      const mes = meses.get(comp) ?? { competencia: comp, totalCents: 0, itens: [], porBanco: [] }
      mes.totalCents += s.cents
      mes.itens.push({
        descricao: s.desc,
        parcela: s.current + k,
        total: s.total,
        amountCents: s.cents,
        bank: s.bank,
      })
      meses.set(comp, mes)
    }
  }
  for (const m of meses.values()) {
    m.itens.sort((a, b) => b.amountCents - a.amountCents)
    const soma = new Map<string, number>()
    for (const it of m.itens) soma.set(it.bank, (soma.get(it.bank) ?? 0) + it.amountCents)
    m.porBanco = [...soma.entries()]
      .map(([bank, totalCents]) => ({ bank, totalCents }))
      .sort((a, b) => b.totalCents - a.totalCents)
  }
  return [...meses.values()].sort((a, b) => (a.competencia < b.competencia ? -1 : 1))
}

/** As n maiores despesas do período, da maior para a menor.
 *
 *  Só `kind === 'expense'`: entrada não é saída, e vínculo
 *  (`card_payment`/`internal_transfer`) é dinheiro que só mudou de lugar —
 *  incluí-lo poria a quitação da fatura no topo do ranking todo mês,
 *  escondendo os gastos de verdade.
 *
 *  Copia antes de ordenar: a lista que chega é a mesma que o dashboard usa
 *  noutros cálculos, e `sort` muta no lugar. */
export function maioresSaidas<T extends TxAgrupavel>(txs: T[], n = 5): T[] {
  return txs
    .filter((t) => t.kind === 'expense')
    .slice()
    .sort((a, b) => b.amount_cents - a.amount_cents)
    .slice(0, n)
}

export type TxComEstabelecimento = TxAgrupavel & {
  /** Descrição do banco. É ela que identifica o estabelecimento. */
  description: string
  /** Renome do usuário para AQUELA compra — não para o estabelecimento. */
  label: string | null
}

export type GrupoEstabelecimento = {
  /** Chave normalizada: é o que agrupa, e é o que a busca recebe no clique. */
  merchant: string
  /** Nome a exibir — o rótulo do usuário quando existe, senão a chave. */
  rotulo: string
  totalCents: number
  contagem: number
}

/** Ranking de ONDE o dinheiro saiu, somando as compras repetidas.
 *
 *  Pergunta diferente da de `maioresSaidas`, e as duas convivem: aquela acha
 *  a maior compra isolada (o empréstimo de R$ 41 mil), esta acha o ralo que
 *  só existe somado — três pedidos de R$ 80 no mesmo lugar viram R$ 240 e
 *  sobem no ranking, enquanto isoladamente nenhum apareceria.
 *
 *  **Agrupa pela descrição do banco, nunca pelo rótulo do usuário.** Renomear
 *  UMA compra é uma nota sobre aquela linha; se o rótulo agrupasse, renomear
 *  uma das três partiria o grupo em dois e o ranking mentiria. O rótulo entra
 *  só na exibição — quem escreveu "iFood" no lugar de "PAG*IFOOD*RESTAURA"
 *  já disse como quer ler aquele lugar. */
export function porEstabelecimento<T extends TxComEstabelecimento>(
  txs: T[],
  n = 5,
): GrupoEstabelecimento[] {
  // Mesmo filtro de `agregar` e `maioresSaidas`: pagamento de fatura e
  // transferência interna não são gasto. Sem isso "PAGAMENTO FATURA" lideraria
  // o ranking com a soma de todas as compras que ele quita.
  const mapa = new Map<string, GrupoEstabelecimento & { maiorRotulado: number }>()

  for (const t of txs) {
    if (t.kind !== 'expense') continue
    const merchant = normalizeMerchant(t.description)
    const atual = mapa.get(merchant) ?? {
      merchant,
      rotulo: merchant,
      totalCents: 0,
      contagem: 0,
      maiorRotulado: -1,
    }
    atual.totalCents += t.amount_cents
    atual.contagem += 1
    // O rótulo da MAIOR compra rotulada vence: com duas notas diferentes no
    // mesmo lugar, a da compra maior é a que descreve melhor o grupo.
    if (t.label && t.amount_cents > atual.maiorRotulado) {
      atual.rotulo = t.label
      atual.maiorRotulado = t.amount_cents
    }
    mapa.set(merchant, atual)
  }

  return [...mapa.values()]
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, n)
    .map(({ merchant, rotulo, totalCents, contagem }) => ({
      merchant,
      rotulo,
      totalCents,
      contagem,
    }))
}

/** Variação do período contra o anterior, como fração com sinal
 *  (`0.22` = +22%).
 *
 *  `null` quando não há período anterior com que comparar. Esse retorno é o
 *  ponto do arquivo: sem base, qualquer gasto seria "+∞%", e um número
 *  inventado num tile é pior que tile nenhum — a UI esconde em vez de
 *  preencher. O contrário (atual zerado, anterior com dado) É comparável:
 *  gastou antes e não gastou agora é -100%, e isso informa. */
export function variacaoPct(atualCents: number, anteriorCents: number): number | null {
  if (anteriorCents === 0) return null
  return (atualCents - anteriorCents) / anteriorCents
}

export type GrupoDia<T> = {
  dia: string // YYYY-MM-DD
  gastoCents: number
  entradasCents: number
  itens: T[]
}

/** Agrupa TUDO por dia (compras, débitos, créditos, estornos) com subtotal
 *  de gasto e de entradas do dia. Dias mais recentes primeiro. */
export function porDia<T extends TxAgrupavel>(txs: T[]): GrupoDia<T>[] {
  const mapa = new Map<string, GrupoDia<T>>()
  for (const t of txs) {
    const g = mapa.get(t.date) ?? { dia: t.date, gastoCents: 0, entradasCents: 0, itens: [] }
    if (t.kind === 'income') g.entradasCents += Math.abs(t.amount_cents)
    else if (t.kind === 'expense') g.gastoCents += t.amount_cents
    g.itens.push(t)
    mapa.set(t.date, g)
  }
  return [...mapa.values()].sort((a, b) => (a.dia < b.dia ? 1 : -1))
}

/** Os lançamentos do MÊS DE CALENDÁRIO de `ref`, pela DATA REAL.
 *
 *  Existe separado de `filtrar(txs, 'mes', ref)` porque aquele recorta por
 *  COMPETÊNCIA (ver ADR-0001) e este alimenta um gráfico cujo eixo x é a data
 *  do lançamento. Misturar as duas réguas poria, no desenho de junho, uma
 *  barra em 20/mai — a compra que caiu na fatura de junho mas aconteceu em
 *  maio. O eixo mentiria sobre a própria posição.
 *
 *  Serve ao ritmo diário quando o recorte é Dia ou Semana: ali o recorte tem
 *  um punhado de dias, e "onde estão os picos" é pergunta que só existe
 *  contra um pano de fundo maior. */
export function doMesCalendario<T extends TxAgrupavel>(txs: T[], ref: Date): T[] {
  const alvo = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`
  return txs.filter((t) => t.date.slice(0, 7) === alvo)
}
