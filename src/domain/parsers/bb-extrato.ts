import type { Line } from '../pdf/lines'
import { cellAt } from '../pdf/lines'
import { parseBRL } from '../normalize/money'
import type { ParseResult, RawKind, RawTransaction } from './types'

/** Extrato de conta corrente do Banco do Brasil (layout 2023).
 *
 *  Colunas medidas na Task 0 (ver spec, apêndice). Diferenças em relação ao
 *  Bradesco:
 *  - UMA coluna de valor com sufixo C/D (crédito/débito), não duas colunas.
 *  - Sem linha "Total": o gabarito é a progressão de SALDO (inicial→final).
 *    Por isso preenche `balance`, não `declaredIncome/Expense`.
 *  - Cada lançamento pode ter uma linha de detalhe (contraparte do PIX/TED)
 *    logo abaixo, na faixa x≈252.
 *  - Varredura interna (Resgate Automático / Aplicação) fica no extrato e
 *    entra na conferência de saldo; quem a tira do gasto é o vínculo
 *    `internal_transfer` (ver domain/link/vinculos). */

// Faixas de X (borda esquerda) das colunas de texto.
const X_DATA = [58, 74] as const
const X_HISTORICO = [220, 240] as const
const X_DETALHE = [245, 262] as const

const DATA = /^(\d{2})\/(\d{2})\/(\d{4})$/
/** Valor/saldo do BB: "2.001,00 D", "0,00 C". Captura número e a letra. */
const VALOR_CD = /([\d.]+,\d{2})\s*([CD])\b/
const SALDO_ANTERIOR = /Saldo\s+Anterior/i
const SALDO_FINAL = /S\s*A\s*L\s*D\s*O/i

/** Lê a primeira ocorrência de "número C/D" nas células à direita do
 *  documento. Numa linha de varredura o valor e o saldo colam
 *  ("5.361,48 C 0,00 C"): o primeiro é o valor. */
function valorCD(line: Line): { cents: number; letra: 'C' | 'D' } | null {
  const texto = line.cells
    .filter((c) => c.x >= 440)
    .map((c) => c.text)
    .join(' ')
  const m = texto.match(VALOR_CD)
  if (!m) return null
  return { cents: parseBRL(m[1]), letra: m[2] as 'C' | 'D' }
}

/** Histórico sem os códigos de lote/agência que o antecedem
 *  ("13105 144 Pix - Enviado" → "Pix - Enviado"). */
function historico(line: Line): string {
  const bruto = cellAt(line, X_HISTORICO[0], X_HISTORICO[1]) ?? ''
  return bruto.replace(/^[\d\s]+/, '').trim()
}

function detalhe(line: Line | undefined, ancora: Line): string | null {
  if (!line || line.page !== ancora.page) return null
  const dt = cellAt(line, X_DATA[0], X_DATA[1])
  if (dt && DATA.test(dt.trim())) return null // é outra âncora
  return cellAt(line, X_DETALHE[0], X_DETALHE[1])
}

function periodo(lines: Line[]): { start: Date; end: Date } | null {
  const texto = lines.map((l) => l.text).join('\n')
  const m = texto.match(/Per[íi]odo do extrato\s*(\d{2})\s*\/\s*(\d{4})/i)
  if (!m) return null
  const mes = Number(m[1]) - 1
  const ano = Number(m[2])
  return { start: new Date(ano, mes, 1), end: new Date(ano, mes + 1, 0) }
}

function conta(lines: Line[]): { agency: string | null; number: string | null; holder: string | null } {
  const texto = lines.map((l) => l.text).join('\n')
  const ag = texto.match(/Ag[êe]ncia\s+([\d-]+)/i)
  const cc = texto.match(/Conta corrente\s+([\d-]+)\s*(.*)/i)
  return {
    agency: ag ? ag[1] : null,
    number: cc ? cc[1] : null,
    holder: cc && cc[2] ? cc[2].trim() : null,
  }
}

export function parseBBExtrato(lines: Line[]): ParseResult {
  const transactions: RawTransaction[] = []
  let saldoInicial: number | null = null
  let saldoFinal: number | null = null

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const dataTexto = cellAt(l, X_DATA[0], X_DATA[1])
    const dm = dataTexto?.trim().match(DATA)
    if (!dm) continue

    const data = new Date(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]))
    const hist = historico(l)
    const v = valorCD(l)

    // Saldo inicial e final: entram só na conferência, não como transação.
    // O saldo é positivo quando credor (C) e negativo quando devedor (D).
    if (SALDO_ANTERIOR.test(hist)) {
      if (v) saldoInicial = v.letra === 'C' ? v.cents : -v.cents
      continue
    }
    if (SALDO_FINAL.test(hist)) {
      if (v) saldoFinal = v.letra === 'C' ? v.cents : -v.cents
      continue
    }
    if (!v) continue

    // Valor: crédito (C) é entrada (amountCents negativo); débito (D) é
    // saída (positivo). Convenção oposta à do saldo, de propósito.
    const amountCents = v.letra === 'C' ? -v.cents : v.cents

    const det = detalhe(lines[i + 1], l)
    const description = [hist, det].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

    const kind: RawKind =
      v.letra === 'C'
        ? 'entrada'
        : /Tarifa|IOF|Tar\b|Tar\./i.test(description)
          ? 'encargo'
          : 'compra'

    transactions.push({
      date: data,
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
      bank: 'bb',
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
