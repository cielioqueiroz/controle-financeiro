import type { Line } from '../pdf/lines'
import { cellAt, cellAtRight } from '../pdf/lines'
import { parseBRL } from '../normalize/money'
import type { ParseResult, RawKind, RawTransaction } from './types'

/** Extrato de conta corrente do Sicoob (plataforma SISBR).
 *
 *  Colunas medidas na Task 0 (ver spec). É o mais elaborado dos quatro:
 *  - Data SEM ano ("05/09") — o ano vem do "Periodo:".
 *  - Sufixo C/D/* no valor ("R$ 1.050,00D"). `*` é saldo bloqueado: ignorado.
 *  - MULTI-LINHA: cada lançamento tem 1–3 linhas de detalhe abaixo (x≈163)
 *    com "Pagamento Pix", o CNPJ do favorecido e a descrição da nota.
 *  - Sem "Total": gabarito por SALDO ANTERIOR → último SALDO DO DIA. */

const X_DATA = [34, 66] as const // x≈40
const X_DETALHE = [158, 170] as const // x≈163
const X_HIST = [172, 210] as const // x≈177 (âncora e linhas SALDO)
const VALOR_RIGHT = 556
const TOL = 8

const DATA_DM = /^(\d{2})\/(\d{2})$/
const VALOR_CD = /R\$\s*([\d.]+,\d{2})\s*([CD*])/

function valor(line: Line): { cents: number; letra: 'C' | 'D' | '*' } | null {
  const c = cellAtRight(line, VALOR_RIGHT, TOL)
  const m = c?.match(VALOR_CD)
  if (!m) return null
  return { cents: parseBRL(m[1]), letra: m[2] as 'C' | 'D' | '*' }
}

function anoDoPeriodo(lines: Line[]): number {
  const texto = lines.map((l) => l.text).join('\n')
  const m = texto.match(/Periodo:\s*\d{2}\/\d{2}\/(\d{4})/i)
  return m ? Number(m[1]) : new Date().getFullYear()
}

function periodo(lines: Line[]): { start: Date; end: Date } | null {
  const texto = lines.map((l) => l.text).join('\n')
  const m = texto.match(/Periodo:\s*(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  if (!m) return null
  return {
    start: new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
    end: new Date(Number(m[6]), Number(m[5]) - 1, Number(m[4])),
  }
}

function conta(lines: Line[]): { agency: string | null; number: string | null; holder: string | null } {
  const texto = lines.map((l) => l.text).join('\n')
  const coop = texto.match(/Cooperativa:\s*([\d-]+)/i)
  const cc = texto.match(/Conta:\s*([\d.-]+)\s*\/\s*(.+)/i)
  return {
    agency: coop ? coop[1] : null,
    number: cc ? cc[1] : null,
    holder: cc && cc[2] ? cc[2].trim() : null,
  }
}

export function parseSicoobExtrato(lines: Line[]): ParseResult {
  const ano = anoDoPeriodo(lines)
  const transactions: RawTransaction[] = []
  let saldoInicial: number | null = null
  let saldoFinal: number | null = null

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const v = valor(l)
    if (v?.letra === '*') continue // saldo bloqueado

    const hist = cellAt(l, X_HIST[0], X_HIST[1]) ?? ''
    if (/SALDO ANTERIOR/i.test(hist) && v) {
      saldoInicial = v.letra === 'C' ? v.cents : -v.cents
      continue
    }
    if (/SALDO DO DIA/i.test(hist) && v) {
      saldoFinal = v.letra === 'C' ? v.cents : -v.cents // último vence
      continue
    }
    if (/SALDO/i.test(hist)) continue

    const dataTexto = cellAt(l, X_DATA[0], X_DATA[1])
    const dm = dataTexto?.trim().match(DATA_DM)
    if (!dm || !v) continue

    const date = new Date(ano, Number(dm[2]) - 1, Number(dm[1]))
    // C = crédito (entrada, negativo); D = débito (saída, positivo).
    const amountCents = v.letra === 'C' ? -v.cents : v.cents

    // Junta as linhas de detalhe (x≈163) até a próxima âncora ou linha de saldo.
    const detalhes: string[] = []
    for (let j = i + 1; j < lines.length; j++) {
      const proxData = cellAt(lines[j], X_DATA[0], X_DATA[1])
      if (proxData && DATA_DM.test(proxData.trim())) break
      if (valor(lines[j])) break // próxima âncora ou SALDO DO DIA
      const d = cellAt(lines[j], X_DETALHE[0], X_DETALHE[1])
      if (d) detalhes.push(d)
    }
    const description = [hist, ...detalhes].join(' ').replace(/\s+/g, ' ').trim()

    const kind: RawKind =
      v.letra === 'C'
        ? 'entrada'
        : /Tarifa|IOF|CONV\.TRIBUTOS|DARF/i.test(description)
          ? 'encargo'
          : 'compra'

    transactions.push({
      date,
      description,
      amountCents,
      installment: null,
      card: null,
      fx: null,
      kind,
      raw: l.text,
    })
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
      bank: 'sicoob',
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
