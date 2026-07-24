import type { Line, Cell } from '../pdf/lines'
import { cellAtRight } from '../pdf/lines'
import { parseBRL } from '../normalize/money'
import { parseMesAbreviado } from '../normalize/date'
import type { Forward, ParseResult, RawKind, RawTransaction } from './types'

/** Colunas medidas no fixture. O extrato Nubank é hierárquico:
 *  dia (x≈58) → "Total de entradas/saídas" (x≈120, define o sinal) →
 *  transações (tipo x≈120, descrição x≈260, valor à direita r≈533). */
const COL = {
  dia: 58,
  /** Rótulo de grupo E tipo de transação. */
  label: 120,
  descricao: 260,
  valorRight: 533,
  /** Rótulos do quadro-resumo (gabarito) ficam mais à direita. */
  resumoLabel: 341,
} as const

const TOL = 4

const DIA = /^(\d{2})\s+([A-Z]{3})\s+(\d{4})$/i
const GRUPO_ENTRADA = /^Total de entradas$/i
const GRUPO_SAIDA = /^Total de sa[íi]das$/i
const PAGAMENTO_FATURA = /Pagamento de fatura/i

const cellNear = (line: Line, x: number): Cell | undefined =>
  line.cells.find((c) => Math.abs(c.x - x) <= TOL)

const textNear = (line: Line, x: number): string | null =>
  cellNear(line, x)?.text ?? null

/** Lê um valor do quadro-resumo pelo rótulo. O resumo tem rótulo em
 *  x≈341 — distinto dos grupos de dia (x≈120), que também dizem
 *  "Total de entradas". */
function resumo(lines: Line[], rotulo: RegExp): number | null {
  for (const line of lines) {
    const r = line.cells.find(
      (c) => Math.abs(c.x - COL.resumoLabel) <= TOL && rotulo.test(c.text.trim()),
    )
    if (!r) continue
    const valor = cellAtRight(line, 535, 6)
    if (valor) return Math.abs(parseBRL(valor))
  }
  return null
}

/** Saldo do quadro-resumo pelo rótulo — como `resumo`, mas mantém o sinal
 *  (credor > 0, devedor < 0); saldo pode ser negativo, então NÃO se aplica
 *  o `Math.abs` que os totais de fluxo usam. */
function saldoResumo(lines: Line[], rotulo: RegExp): number | null {
  for (const line of lines) {
    const r = line.cells.find(
      (c) => Math.abs(c.x - COL.resumoLabel) <= TOL && rotulo.test(c.text.trim()),
    )
    if (!r) continue
    const valor = cellAtRight(line, 535, 6)
    if (valor) return parseBRL(valor)
  }
  return null
}

function periodo(lines: Line[]): { start: Date; end: Date } | null {
  const texto = lines.map((l) => l.text).join('\n')
  const m = texto.match(
    /(\d{2})\s+DE\s+([A-ZÇ]+)\s+DE\s+(\d{4})\s+a\s+(\d{2})\s+DE\s+([A-ZÇ]+)\s+DE\s+(\d{4})/i,
  )
  if (!m) return null
  const mes = (nome: string) => parseMesAbreviado(nome.slice(0, 3))
  return {
    start: new Date(Number(m[3]), mes(m[2]) - 1, Number(m[1])),
    end: new Date(Number(m[6]), mes(m[5]) - 1, Number(m[4])),
  }
}

function titular(lines: Line[]): string | null {
  // Primeira linha do documento é o nome do titular.
  const primeira = lines.find((l) => l.page === 1 && /^[A-Za-zÀ-ú]/.test(l.text))
  return primeira ? primeira.cells[0].text.trim() : null
}

export function parseNubankExtrato(lines: Line[]): ParseResult {
  const per = periodo(lines)

  const transactions: RawTransaction[] = []
  let dataCorrente: Date | null = null
  let sinalCorrente: 'in' | 'out' | null = null
  let ultima: RawTransaction | null = null

  for (const line of lines) {
    // Atualiza a data quando encontra cabeçalho de dia (x≈58).
    const diaTexto = textNear(line, COL.dia)
    if (diaTexto) {
      const md = diaTexto.trim().match(DIA)
      if (md) {
        dataCorrente = new Date(
          Number(md[3]),
          parseMesAbreviado(md[2]) - 1,
          Number(md[1]),
        )
      }
    }

    const labelTexto = textNear(line, COL.label)

    // Grupo (x≈120) define o sinal das transações seguintes. Ignora o
    // quadro-resumo, cujo rótulo está em x≈341.
    if (labelTexto && GRUPO_ENTRADA.test(labelTexto.trim())) {
      sinalCorrente = 'in'
      continue
    }
    if (labelTexto && GRUPO_SAIDA.test(labelTexto.trim())) {
      sinalCorrente = 'out'
      continue
    }

    const valorTexto = cellAtRight(line, COL.valorRight, TOL)
    const descTexto = textNear(line, COL.descricao)

    const ehTransacao =
      valorTexto !== null && labelTexto !== null && dataCorrente !== null

    if (!ehTransacao) {
      // Continuação de descrição multi-linha: só texto na coluna de
      // descrição, sem valor. Anexa à última transação (o nome do
      // contraparte importa para detectar transferência interna depois).
      if (ultima && descTexto && valorTexto === null && labelTexto === null) {
        ultima.description = `${ultima.description} ${descTexto}`.trim()
        ultima.raw = `${ultima.raw} ${descTexto}`.trim()
      }
      continue
    }

    if (sinalCorrente === null) continue

    const magnitude = parseBRL(valorTexto)
    const amountCents = sinalCorrente === 'out' ? magnitude : -magnitude

    const kind: RawKind =
      sinalCorrente === 'in'
        ? 'entrada'
        : PAGAMENTO_FATURA.test(descTexto ?? labelTexto)
          ? 'pagamento'
          : 'compra'

    const tx: RawTransaction = {
      date: dataCorrente!,
      description: (descTexto ?? labelTexto).trim(),
      amountCents,
      installment: null,
      card: null,
      fx: null,
      kind,
      raw: line.text,
    }
    transactions.push(tx)
    ultima = tx
  }

  const forward: Forward = {
    nextCloseDate: null,
    nextInvoiceBalance: null,
    totalOpenBalance: null,
    futureInstallmentsTotal: null,
  }

  const saldoFinal = saldoResumo(lines, /^Saldo final do per[íi]odo$/i)
  const saldoInicial = saldoResumo(lines, /^Saldo inicial$/i)

  return {
    transactions,
    declaredTotal: null,
    declaredIncome: resumo(lines, /^Total de entradas$/i),
    declaredExpense: resumo(lines, /^Total de sa[íi]das$/i),
    balance: saldoFinal != null ? { initial: saldoInicial ?? 0, final: saldoFinal } : null,
    period: per,
    account: {
      bank: 'nubank',
      type: 'checking',
      last4: null,
      agency: '0001',
      number: null,
      holderName: titular(lines),
    },
    forward,
  }
}
