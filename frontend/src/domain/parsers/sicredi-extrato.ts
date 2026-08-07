import type { Line } from '../pdf/lines'
import { cellAt, cellAtRight } from '../pdf/lines'
import { parseBRL } from '../normalize/money'
import type { ParseResult, RawKind, RawTransaction } from './types'

/** Extrato de conta corrente do Sicredi.
 *
 *  Colunas medidas na Task 0 (ver spec). Mais simples que o BB: uma linha
 *  por lançamento, sem detalhe abaixo. Diferenças:
 *  - Sinal por MENOS no valor ("-2.230,00" = débito/saída); positivo é
 *    crédito/entrada. Convenção OPOSTA à do app (saída > 0), então o
 *    amountCents é o valor com o sinal invertido.
 *  - Sem linha "Total": o gabarito é o saldo (linha "SALDO" no topo →
 *    saldo da última transação). Preenche `balance`, não os totais. */

const X_DATA = [74, 88] as const
const X_DESC = [124, 140] as const
const VALOR_RIGHT = 476
const SALDO_RIGHT = 524
const TOL = 6

const DATA = /^(\d{2})\/(\d{2})\/(\d{4})$/

function descricao(line: Line): string {
  return (cellAt(line, X_DESC[0], X_DESC[1]) ?? '').trim()
}

function periodo(lines: Line[]): { start: Date; end: Date } | null {
  const texto = lines.map((l) => l.text).join('\n')
  const m = texto.match(
    /per[íi]odo\s*(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/i,
  )
  if (!m) return null
  return {
    start: new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
    end: new Date(Number(m[6]), Number(m[5]) - 1, Number(m[4])),
  }
}

function conta(lines: Line[]): { agency: string | null; number: string | null; holder: string | null } {
  const texto = lines.map((l) => l.text).join('\n')
  const cc = texto.match(/Conta Corrente:\s*([\d-]+)/i)
  const ag = texto.match(/Cooperativa:\s*([\d-]+)/i)
  const nome = texto.match(/Associado:\s*(.+)/i)
  return {
    agency: ag ? ag[1] : null,
    number: cc ? cc[1] : null,
    holder: nome ? nome[1].trim() : null,
  }
}

export function parseSicrediExtrato(lines: Line[]): ParseResult {
  const transactions: RawTransaction[] = []
  let saldoInicial: number | null = null
  let saldoFinal: number | null = null

  for (const l of lines) {
    const saldoTexto = cellAtRight(l, SALDO_RIGHT, TOL)
    const desc = descricao(l)

    // Linha "SALDO" no topo: só tem saldo, sem valor — é o saldo inicial.
    if (saldoInicial == null && /^SALDO$/i.test(desc) && saldoTexto) {
      saldoInicial = parseBRL(saldoTexto)
      continue
    }

    const dataTexto = cellAt(l, X_DATA[0], X_DATA[1])
    const dm = dataTexto?.trim().match(DATA)
    if (!dm) continue

    const valorTexto = cellAtRight(l, VALOR_RIGHT, TOL)
    if (!valorTexto) continue

    const data = new Date(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]))
    // O menos do Sicredi é débito (saída). O app usa saída > 0, entrada < 0:
    // por isso invertemos o sinal do valor lido.
    const amountCents = -parseBRL(valorTexto)

    const kind: RawKind =
      amountCents < 0
        ? 'entrada'
        : /DARF|Tarifa|IOF|Tar\b/i.test(desc)
          ? 'encargo'
          : 'compra'

    transactions.push({
      date: data,
      description: desc,
      amountCents,
      installment: null,
      card: null,
      fx: null,
      kind,
      raw: l.text,
    })

    // O saldo corrente da última transação é o saldo final do período.
    if (saldoTexto) saldoFinal = parseBRL(saldoTexto)
  }

  const { agency, number, holder } = conta(lines)

  return {
    transactions,
    declaredTotal: null,
    declaredIncome: null,
    declaredExpense: null,
    balance:
      saldoInicial != null && saldoFinal != null
        ? { initial: saldoInicial, final: saldoFinal }
        : null,
    period: periodo(lines),
    account: {
      bank: 'sicredi',
      type: 'checking',
      last4: null,
      agency,
      number,
      holderName: holder,
    },
    forward: {
      nextCloseDate: null,
      nextInvoiceBalance: null,
      totalOpenBalance: null,
      futureInstallmentsTotal: null,
    },
  }
}
