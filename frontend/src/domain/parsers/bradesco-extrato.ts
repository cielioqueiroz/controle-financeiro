import type { Line } from '../pdf/lines'
import { cellAtRight } from '../pdf/lines'
import { parseBRL } from '../normalize/money'
import type { ParseResult, RawKind, RawTransaction } from './types'

/** Colunas do extrato Bradesco, por borda DIREITA (valores alinhados à
 *  direita — ver plano, "Coordenadas medidas").
 *
 *  Estrutura de cada transação: TRÊS linhas físicas —
 *    tipo   (x≈110, acima)   "PIX ENVIADO" / "RENDIMENTOS"
 *    âncora (data x≈46, docto x≈303, valor, saldo)
 *    detalhe(x≈110, abaixo)  "DES: fulano 31/05"
 *  Alguns tipos vêm inline na âncora (IOF, COD. LANC). A data pode faltar
 *  na âncora, herdando da transação anterior. */
const COL = {
  data: 46,
  historico: 110,
  creditoRight: 427,
  debitoRight: 490,
  saldoRight: 551,
} as const

const TOL = 3
const TOL_VIZINHO = 8

const DATA = /^(\d{2})\/(\d{2})\/(\d{4})$/
const SALDO_INICIAL = /COD\.\s*LANC/i
const PAGAMENTO_FATURA = /GASTOS CARTAO DE CREDITO/i

const xAt = (line: Line, x: number, tol = 4): string | null =>
  line.cells.find((c) => Math.abs(c.x - x) <= tol)?.text ?? null

const ehAncora = (line: Line): boolean =>
  cellAtRight(line, COL.saldoRight, TOL) !== null &&
  (cellAtRight(line, COL.creditoRight, TOL) !== null ||
    cellAtRight(line, COL.debitoRight, TOL) !== null)

/** Texto de histórico de uma linha vizinha, se ela não for âncora. */
function historicoVizinho(line: Line | undefined, ancora: Line): string | null {
  if (!line) return null
  if (Math.abs(line.y - ancora.y) >= TOL_VIZINHO) return null
  if (line.page !== ancora.page) return null
  if (ehAncora(line)) return null
  return xAt(line, COL.historico)
}

/** Lê a linha "Total 33.265,53 41.841,65 46.999,01" da página final do
 *  período (o gabarito). Os dois primeiros valores são créditos e débitos. */
function totaisDeclarados(
  lines: Line[],
  ate: number,
): { income: number | null; expense: number | null } {
  for (let i = 0; i < ate; i++) {
    const l = lines[i]
    if (l.cells[0]?.text.trim() !== 'Total') continue
    const cred = cellAtRight(l, COL.creditoRight, TOL)
    const deb = cellAtRight(l, COL.debitoRight, TOL)
    if (cred && deb) {
      return { income: Math.abs(parseBRL(cred)), expense: Math.abs(parseBRL(deb)) }
    }
  }
  return { income: null, expense: null }
}

function periodo(lines: Line[]): { start: Date; end: Date } | null {
  const texto = lines.map((l) => l.text).join('\n')
  const m = texto.match(
    /Movimenta[çc][ãa]o entre:\s*(\d{2})\/(\d{2})\/(\d{4})\s*e\s*(\d{2})\/(\d{2})\/(\d{4})/i,
  )
  if (!m) return null
  return {
    start: new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
    end: new Date(Number(m[6]), Number(m[5]) - 1, Number(m[4])),
  }
}

function conta(lines: Line[]): { agency: string | null; number: string | null } {
  const texto = lines.map((l) => l.text).join('\n')
  const m = texto.match(/Ag[êe]ncia:\s*(\d+)\s*\|\s*Conta:\s*([\d-]+)/i)
  return m ? { agency: m[1], number: m[2] } : { agency: null, number: null }
}

function titular(lines: Line[]): string | null {
  const linha = lines.find((l) => /^Nome:/i.test(l.text))
  return linha ? linha.text.replace(/^Nome:\s*/i, '').trim() : null
}

export function parseBradescoExtrato(lines: Line[]): ParseResult {
  // O extrato principal cobre o período declarado (páginas 1-2). A página
  // 3 ("Últimos Lancamentos") é de OUTRO período (julho) com seu próprio
  // Total — incluí-la quebraria a conferência de junho. Paramos no
  // primeiro "Total".
  let fim = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].cells[0]?.text.trim() === 'Total') {
      fim = i
      break
    }
  }

  const transactions: RawTransaction[] = []
  let dataCorrente: Date | null = null
  // Saldo pela coluna direita (saldoRight): a linha COD. LANC. traz o inicial;
  // o final é o saldo da última âncora antes do "Total".
  let saldoInicialCents: number | null = null
  let saldoFinalCents: number | null = null

  for (let i = 0; i < fim; i++) {
    const l = lines[i]
    if (!ehAncora(l)) continue

    const inline = xAt(l, COL.historico)
    if (inline && SALDO_INICIAL.test(inline)) {
      // "COD. LANC. 0" marca o saldo inicial — atualiza data, não é transação.
      const dt = xAt(l, COL.data)?.match(DATA)
      if (dt) dataCorrente = new Date(Number(dt[3]), Number(dt[2]) - 1, Number(dt[1]))
      const s = cellAtRight(l, COL.saldoRight, TOL)
      if (s) saldoInicialCents = parseBRL(s)
      continue
    }

    const dataTexto = xAt(l, COL.data)
    const dm = dataTexto?.match(DATA)
    if (dm) dataCorrente = new Date(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]))
    if (!dataCorrente) continue

    const credito = cellAtRight(l, COL.creditoRight, TOL)
    const debito = cellAtRight(l, COL.debitoRight, TOL)

    // O saldo desta âncora; a última a sobreviver ao loop é o saldo final.
    const saldoTexto = cellAtRight(l, COL.saldoRight, TOL)
    if (saldoTexto) saldoFinalCents = parseBRL(saldoTexto)

    const acima = historicoVizinho(lines[i - 1], l)
    const abaixo = historicoVizinho(lines[i + 1], l)
    const description = [acima, inline, abaixo].filter(Boolean).join(' ').trim()

    // Crédito → entrada (negativo). Débito → saída (positivo).
    const amountCents = credito
      ? -Math.abs(parseBRL(credito))
      : Math.abs(parseBRL(debito!))

    const kind: RawKind = credito
      ? 'entrada'
      : PAGAMENTO_FATURA.test(description)
        ? 'pagamento'
        : 'compra'

    transactions.push({
      date: dataCorrente,
      description,
      amountCents,
      installment: null,
      card: null,
      fx: null,
      kind,
      raw: l.text,
    })
  }

  const { income, expense } = totaisDeclarados(lines, fim + 1)
  const { agency, number } = conta(lines)

  return {
    transactions,
    declaredTotal: null,
    declaredIncome: income,
    declaredExpense: expense,
    balance:
      saldoInicialCents != null && saldoFinalCents != null
        ? { initial: saldoInicialCents, final: saldoFinalCents }
        : null,
    period: periodo(lines),
    account: {
      bank: 'bradesco',
      type: 'checking',
      last4: null,
      agency,
      number,
      holderName: titular(lines),
    },
    forward: {
      nextCloseDate: null,
      nextInvoiceBalance: null,
      totalOpenBalance: null,
      futureInstallmentsTotal: null,
    },
  }
}
