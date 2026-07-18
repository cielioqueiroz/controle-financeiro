import type { Line } from '../pdf/lines'
import { cellAtRight } from '../pdf/lines'
import { parseBRL } from '../normalize/money'
import { inferYear, parseMesAbreviado } from '../normalize/date'
import { extractInstallment } from '../normalize/installment'
import type { Forward, ParseResult, RawKind, RawTransaction } from './types'

/** Colunas medidas no fixture (ver plano, "Coordenadas medidas").
 *  Valores são alinhados à direita: casar por borda direita. */
const COL = {
  data: 123,
  cartao: 172,
  /** Descrição de compra (linha com cartão). */
  desc: 214,
  /** Descrição de IOF e pagamento (linha sem cartão). */
  descSemCartao: 185,
  /** Borda DIREITA do valor. */
  valorRight: 535,
} as const

const TOL = 3

const DATA = /^(\d{2})\s+([A-Z]{3})$/i
const CARTAO = /^•+\s*(\d{4})$/
const VENCIMENTO = /FATURA\s+(\d{2})\s+([A-Z]{3})\s+(\d{4})/i
const PERIODO = /DE\s+(\d{2})\s+([A-Z]{3})\s+A\s+(\d{2})\s+([A-Z]{3})/i
const TOTAL_A_PAGAR = /^Total a pagar$/i
const RESUMO = /RESUMO DA FATURA ATUAL/i
const IOF_LINHA = /^IOF de /i
const PAGAMENTO = /^Pagamento em /i
const SALDO_RESTANTE = /^Saldo restante da fatura anterior$/i

/** "BRL 110.00 = USD 21.57" */
const FX_VALOR = /^([A-Z]{3})\s+([\d.]+)\s*=\s*([A-Z]{3})\s+([\d.]+)$/
/** "Conversão: BRL 5.32 = USD 1 = R$ 5,32" */
const FX_COTACAO = /^Convers[ãa]o:.*=\s*R\$\s*([\d.,]+)$/i

const celulaEm = (line: Line, x: number): string | null => {
  const c = line.cells.find((cell) => Math.abs(cell.x - x) <= TOL)
  return c ? c.text : null
}

function textoDaPagina(lines: Line[], page: number): string {
  return lines.filter((l) => l.page === page).map((l) => l.text).join('\n')
}

/** "29 JUN 2026" → Date. Usado para o vencimento, que ancora a inferência
 *  de ano das transações (que vêm sem ano: "20 MAI"). */
function dataVencimento(lines: Line[]): Date | null {
  const texto = lines.map((l) => l.text).join('\n')
  const m = texto.match(VENCIMENTO)
  if (!m) return null
  return new Date(Number(m[3]), parseMesAbreviado(m[2]) - 1, Number(m[1]))
}

function periodo(lines: Line[], ref: Date): { start: Date; end: Date } | null {
  const linha = lines.find((l) => PERIODO.test(l.text))
  if (!linha) return null
  const m = linha.text.match(PERIODO)!
  return {
    start: inferYear(Number(m[1]), parseMesAbreviado(m[2]), ref),
    end: inferYear(Number(m[3]), parseMesAbreviado(m[4]), ref),
  }
}

/** O gabarito.
 *
 *  ATENÇÃO: a fatura tem DOIS "Total a pagar". O da página 2 é a
 *  simulação de parcelamento ("Total a pagar | R$ 10.096,36 | R$
 *  11.630,56" — quanto você pagaria SE financiasse em 3x ou 6x). O real
 *  está no RESUMO DA FATURA ATUAL. Pegar o primeiro infla a fatura em
 *  21% com um valor hipotético. */
function totalDeclarado(lines: Line[]): number | null {
  const inicioResumo = lines.findIndex((l) => RESUMO.test(l.text))
  if (inicioResumo === -1) return null

  for (const line of lines.slice(inicioResumo)) {
    const rotulo = line.cells.find((c) => TOTAL_A_PAGAR.test(c.text.trim()))
    if (!rotulo) continue

    const valores = line.cells.filter(
      (c) => c !== rotulo && /R\$\s*[\d.]+,\d{2}/.test(c.text),
    )
    // A linha da simulação traz dois valores; a do resumo, um só.
    if (valores.length === 1) return parseBRL(valores[0].text)
  }
  return null
}

function classificar(desc: string): RawKind {
  if (IOF_LINHA.test(desc)) return 'encargo'
  if (PAGAMENTO.test(desc)) return 'pagamento'
  return 'compra'
}

/** Câmbio ocupa 3 linhas: a transação, "BRL 110.00 = USD 21.57" e
 *  "Conversão: BRL 5.32 = USD 1 = R$ 5,32". As duas últimas não têm data
 *  nem valor — são continuação da anterior. */
function lerFx(continuacoes: string[]): RawTransaction['fx'] {
  const linhaValor = continuacoes.find((c) => FX_VALOR.test(c))
  const linhaCotacao = continuacoes.find((c) => FX_COTACAO.test(c))
  if (!linhaValor || !linhaCotacao) return null

  const mv = linhaValor.match(FX_VALOR)!
  const mc = linhaCotacao.match(FX_COTACAO)!

  return {
    currency: mv[3],
    amount: Math.round(Number(mv[4]) * 100),
    rate: parseBRL(mc[1]),
  }
}

export function parseNubankFatura(lines: Line[]): ParseResult {
  const vencimento = dataVencimento(lines)
  if (!vencimento) {
    throw new Error('Fatura Nubank: não encontrei a data de vencimento')
  }

  const transactions: RawTransaction[] = []
  let ultima: RawTransaction | null = null
  let continuacoes: string[] = []

  const fecharFx = () => {
    if (ultima && continuacoes.length > 0) {
      const fx = lerFx(continuacoes)
      if (fx) ultima.fx = fx
    }
    continuacoes = []
  }

  for (const line of lines) {
    const cData = celulaEm(line, COL.data)
    const valorTexto = cellAtRight(line, COL.valorRight, TOL)

    const ehTransacao =
      cData !== null && DATA.test(cData.trim()) && valorTexto !== null

    if (!ehTransacao) {
      // Continuação só existe na coluna de descrição, sem data nem valor.
      const cont = celulaEm(line, COL.desc)
      if (ultima && cont && cData === null && valorTexto === null) {
        continuacoes.push(cont)
      }
      continue
    }

    fecharFx()

    const md = cData.trim().match(DATA)!
    const date = inferYear(
      Number(md[1]),
      parseMesAbreviado(md[2]),
      vencimento,
    )

    const cartaoTexto = celulaEm(line, COL.cartao)
    const card = cartaoTexto?.match(CARTAO)?.[1] ?? null

    const descTexto =
      celulaEm(line, COL.desc) ?? celulaEm(line, COL.descSemCartao)
    if (!descTexto) continue

    // Ruído: "Saldo restante da fatura anterior R$ 0,00" não é transação.
    if (SALDO_RESTANTE.test(descTexto.trim())) continue

    const { installment, clean } = extractInstallment(descTexto)
    const amountCents = parseBRL(valorTexto)

    const tx: RawTransaction = {
      date,
      description: clean,
      amountCents,
      installment,
      card,
      fx: null,
      kind: classificar(descTexto),
      raw: line.text,
    }

    transactions.push(tx)
    ultima = tx
  }

  fecharFx()

  const forward: Forward = {
    nextCloseDate: lerProximoFechamento(lines),
    nextInvoiceBalance: lerValorRotulado(lines, /^Saldo em aberto da pr[óo]xima fatura$/i),
    totalOpenBalance: lerValorRotulado(lines, /^Saldo em aberto total$/i),
    futureInstallmentsTotal: null, // Nubank não declara este campo
  }

  return {
    transactions,
    declaredTotal: totalDeclarado(lines),
    declaredIncome: null,
    declaredExpense: null,
    period: periodo(lines, vencimento),
    account: {
      bank: 'nubank',
      type: 'credit_card',
      last4: transactions.find((t) => t.card)?.card ?? null,
      agency: null,
      number: null,
      holderName: lerTitular(lines),
    },
    forward,
  }
}

function lerValorRotulado(lines: Line[], rotulo: RegExp): number | null {
  for (const line of lines) {
    const r = line.cells.find((c) => rotulo.test(c.text.trim()))
    if (!r) continue
    const valor = line.cells.find(
      (c) => c !== r && /R\$\s*[\d.]+,\d{2}/.test(c.text),
    )
    if (valor) return parseBRL(valor.text)
  }
  return null
}

function lerProximoFechamento(lines: Line[]): Date | null {
  for (const line of lines) {
    if (!/Fechamento da pr[óo]xima fatura/i.test(line.text)) continue
    const m = line.text.match(/(\d{2})\s+([A-Z]{3})\s+(\d{4})/i)
    if (m) return new Date(Number(m[3]), parseMesAbreviado(m[2]) - 1, Number(m[1]))
  }
  return null
}

function lerTitular(lines: Line[]): string | null {
  const pagina2 = textoDaPagina(lines, 2)
  const m = pagina2.match(/^([A-ZÀ-Ú][A-ZÀ-Ú\s]{5,})$/m)
  return m ? m[1].trim() : null
}
