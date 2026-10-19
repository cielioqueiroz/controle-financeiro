import type { Line } from '../pdf/lines'
import { cellAt } from '../pdf/lines'
import { detectDocument } from '../pdf/detect'
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

function dataValida(texto: string): Date | null {
  const m = texto.trim().match(DATA)
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2]) - 1
  const ano = Number(m[3])
  const data = new Date(ano, mes, dia)
  return data.getFullYear() === ano && data.getMonth() === mes && data.getDate() === dia
    ? data : null
}

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
function historico(line: Line, antigo: boolean): string {
  const bruto = antigo ? cellAt(line, 175, 200) ?? '' : cellAt(line, X_HISTORICO[0], X_HISTORICO[1]) ?? ''
  return bruto.replace(/^[\d\s]+/, '').trim()
}

function detalhe(line: Line | undefined, ancora: Line, antigo: boolean): string | null {
  if (!line || line.page !== ancora.page) return null
  const dt = cellAt(line, X_DATA[0], X_DATA[1])
  if (dt && DATA.test(dt.trim())) return null // é outra âncora
  return antigo ? cellAt(line, 175, 200) : cellAt(line, X_DETALHE[0], X_DETALHE[1])
}

function periodo(lines: Line[]): { start: Date; end: Date } | null {
  const texto = lines.map((l) => l.text).join('\n')
  const intervalo = texto.match(/Per[íi]odo do extrato\s*(\d{2})\/(\d{2})\/(\d{4})\s*(?:a|-|at[ée])\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  if (intervalo) {
    const start = dataValida(`${intervalo[1]}/${intervalo[2]}/${intervalo[3]}`)
    const end = dataValida(`${intervalo[4]}/${intervalo[5]}/${intervalo[6]}`)
    if (!start || !end || start > end) throw new Error('Período do extrato BB não reconhecido')
    return { start, end }
  }
  const m = texto.match(/Per[íi]odo do extrato\s*(\d{2})\s*\/\s*(\d{4})/i)
  if (!m) return null
  const mes = Number(m[1]) - 1
  const ano = Number(m[2])
  if (mes < 0 || mes > 11) throw new Error('Período do extrato BB não reconhecido')
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
  // Layout A inverte o cabeçalho das datas e desloca o histórico para x≈186.
  const antigo = lines.some((l) => /Dt\.?\s*movimento.*Dt\.?\s*balancete/i.test(l.text))
  if (antigo) {
    const periodos = new Set(lines.filter((l) => /Per[íi]odo do extrato/i.test(l.text)).map((l) => l.text))
    const contas = new Set(lines.filter((l) => /^Conta corrente/i.test(l.text)).map((l) => l.text))
    const paginas = new Set(lines.map((l) => l.page))
    const outroEmissor = [...paginas].some((pagina) => {
      const linhasPagina = lines.filter((l) => l.page === pagina)
      const tipo = detectDocument(linhasPagina.map((l) => ({ ...l, page: 1 })))
      return tipo.bank !== 'desconhecido' && tipo.bank !== 'bb'
    })
    const paginaIncompativel = [...paginas].some((pagina) => !lines.some((l) => {
      if (l.page !== pagina) return false
      const data = cellAt(l, X_DATA[0], X_DATA[1])?.trim()
      return Boolean(data?.match(DATA) && valorCD(l) && historico(l, true).trim())
    }))
    if (periodos.size > 1 || contas.size > 1 || outroEmissor || paginaIncompativel || lines.some((l) => /GOVCONTA CAIXA/i.test(l.text))) {
      throw new Error('O documento reúne contas ou períodos diferentes')
    }
  }
  let saldoInicial: number | null = null
  let saldoFinal: number | null = null

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const dataTexto = cellAt(l, X_DATA[0], X_DATA[1])
    const dm = dataTexto?.trim().match(DATA)
    if (!dm) continue

    const data = dataValida(dataTexto ?? '')
    if (!data) throw new Error('Data do movimento BB não reconhecida')
    const hist = historico(l, antigo)
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

    const det = detalhe(lines[i + 1], l, antigo)
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
