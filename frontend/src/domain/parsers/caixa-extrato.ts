import { cellAt, cellAtRight, type Line } from '../pdf/lines'
import { parseBRL } from '../normalize/money'
import type { ParseResult, RawTransaction } from './types'

const DATA = /^(\d{2})\/(\d{2})\/(\d{4})$/
const VALOR = /^\s*([\d.]+,\d{2})\s*([CD])\s*$/

function data(texto: string): Date | null {
  const m = texto.trim().match(DATA)
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2]) - 1
  const ano = Number(m[3])
  const resultado = new Date(ano, mes, dia)
  return resultado.getFullYear() === ano && resultado.getMonth() === mes && resultado.getDate() === dia
    ? resultado : null
}

function valor(texto: string | null, permitirSaldoZero = false): { cents: number; credito: boolean } | null {
  // O GovConta antigo omite C/D quando o saldo é exatamente zero.
  if (permitirSaldoZero && texto?.trim() === '0,00') return { cents: 0, credito: true }
  const m = texto?.match(VALOR)
  return m ? { cents: parseBRL(m[1]), credito: m[2] === 'C' } : null
}

/** GovConta de conta corrente, medido nas páginas de referência.
 * A coluna de saldo se repete em dias sem movimento: só a coluna Valor
 * produz transações. Compilações de contas/períodos são recusadas para não
 * conferir uma soma contra o saldo de outra conta. */
export function parseCaixaExtrato(lines: Line[]): ParseResult {
  const transactions: RawTransaction[] = []
  let initial: number | null = null
  let final: number | null = null
  let period: ParseResult['period'] = null
  let agency: string | null = null
  let number: string | null = null
  let holderName: string | null = null
  let identidade: string | null = null

  for (const pagina of new Set(lines.map((l) => l.page))) {
    const paginaLines = lines.filter((l) => l.page === pagina)
    const cabecalho = paginaLines.find((l) => /Data Mov/.test(l.text) && /Valor \(R\$\)/.test(l.text))
    if (!cabecalho) throw new Error('Layout GovConta não reconhecido')
    const historico = cabecalho.cells.find((c) => /^Hist[óo]rico$/i.test(c.text.trim()))
    const colunaValor = cabecalho.cells.find((c) => /^Valor \(R\$\)$/i.test(c.text.trim()))
    const colunaSaldo = cabecalho.cells.find((c) => /^Saldo \(R\$\)$/i.test(c.text.trim()))
    if (!historico || !colunaValor || !colunaSaldo) throw new Error('Colunas GovConta não reconhecidas')
    const antes = paginaLines.filter((l) => l.y > cabecalho.y)
    const texto = antes.map((l) => l.text).join('\n')
    const conta = texto.match(/Conta(?: Refer[êe]ncia)?:\s*(\d{4})\/(\d{3,4})\/([\d-]+)/i)
    const periodoTexto = antes.find((l) => /Per[íi]odo:/.test(l.text))?.text
    const datas = periodoTexto?.match(/\d{2}\/\d{2}\/\d{4}/g) ?? []
    const start = datas[0] ? data(datas[0]) : null
    const end = datas[1] ? data(datas[1]) : null
    if (!conta || !start || !end || start > end) throw new Error('Conta ou período GovConta não reconhecido')
    const atual = `${conta[1]}/${conta[2]}/${conta[3]}:${datas.join(':')}`
    if (identidade !== null && atual !== identidade) throw new Error('O documento reúne contas ou períodos diferentes')
    identidade = atual
    agency = conta[1]
    number = `${conta[2]}/${conta[3]}`
    holderName = texto.match(/Nome:\s*([^\n]+)/i)?.[1]?.trim() ?? null
    period = { start, end }

    for (const l of paginaLines.filter((linha) => linha.y < cabecalho.y)) {
      const date = data(cellAt(l, 40, 65) ?? '')
      if (!date) continue
      const description = cellAt(l, historico.x - 3, colunaValor.x - 10) ?? ''
      const saldo = valor(cellAtRight(l, colunaSaldo.right), true)
      if (/^SALDO ANTERIOR$/i.test(description)) {
        if (initial === null && saldo) initial = saldo.credito ? saldo.cents : -saldo.cents
        continue
      }
      if (/^SALDO FINAL$/i.test(description)) {
        if (saldo) final = saldo.credito ? saldo.cents : -saldo.cents
        continue
      }
      const valorTexto = cellAtRight(l, colunaValor.right)
      const v = valor(valorTexto)
      if (valorTexto && !v) throw new Error('Valor GovConta não reconhecido')
      if (!v) continue
      if (!description || date < start || date > end) throw new Error('Transação GovConta fora do período ou sem descrição')
      transactions.push({
        date, description, amountCents: v.credito ? -v.cents : v.cents,
        kind: v.credito ? 'entrada' : /TARIFA|TAR\b|IOF/i.test(description) ? 'encargo' : 'compra',
        installment: null, card: null, fx: null, raw: l.text,
      })
    }
  }

  if (identidade === null) throw new Error('Extrato GovConta vazio')

  return {
    transactions, declaredTotal: null, declaredIncome: null, declaredExpense: null,
    balance: initial !== null && final !== null ? { initial, final } : null,
    period, account: { bank: 'caixa', type: 'checking', agency, number, holderName, last4: null },
    forward: { nextCloseDate: null, nextInvoiceBalance: null, totalOpenBalance: null, futureInstallmentsTotal: null },
  }
}
