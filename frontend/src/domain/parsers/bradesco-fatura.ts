import type { Line, Cell } from '../pdf/lines'
import { parseBRL } from '../normalize/money'
import { inferYear } from '../normalize/date'
import { extractInstallment } from '../normalize/installment'
import type { ParseResult, RawKind, RawTransaction } from './types'

/** A fatura Bradesco é o layout mais hostil:
 *  - DUAS colunas: transações à esquerda (x<360), tabela de limites/taxas
 *    à direita (x≥360) que deve ser ignorada.
 *  - Parcela ora grudada ("ARAI KAMINISHI COS02/06"), ora em célula
 *    separada ("GOT SERVICOS ADMI" + "02/02"), ora QUEBRADA na linha de
 *    baixo ("MERCADOLIVRE*MERCADO03/0" + "4" → 03/04).
 *  - Crédito marcado por "-" no fim, às vezes na mesma célula
 *    ("4.782,64 -"), às vezes em célula avulsa à direita ("56,79" + "-"). */
const COL = {
  data: 45,
  /** Início da coluna Histórico. */
  histMin: 60,
  /** Fim do histórico (antes da coluna Cidade em x≈205). */
  histMax: 160,
  /** Faixa X do valor (borda esquerda). */
  valMin: 310,
  valMax: 345,
  /** Faixa do "-" avulso de crédito, logo à direita do valor. */
  minusMin: 345,
  minusMax: 356,
} as const

const TOL_VIZINHO = 9
const DATA = /^(\d{2})\/(\d{2})$/
const DATA_COMPLETA = /^(\d{2})\/(\d{2})\/(\d{4})$/
const CONTINUACAO = /^\d{1,2}$/
const PAGAMENTO = /PAGTO/i

const cellsHistorico = (line: Line): Cell[] =>
  line.cells.filter((c) => c.x >= COL.histMin && c.x <= COL.histMax)

const cellData = (line: Line): Cell | undefined =>
  line.cells.find((c) => c.x < COL.histMin && DATA.test(c.text.trim()))

const cellValor = (line: Line): Cell | undefined =>
  line.cells.find(
    (c) => c.x >= COL.valMin && c.x <= COL.valMax && /^[\d.]+,\d{2}/.test(c.text.trim()),
  )

const temMinusAvulso = (line: Line): boolean =>
  line.cells.some(
    (c) => c.x >= COL.minusMin && c.x <= COL.minusMax && c.text.trim() === '-',
  )

/** Uma linha de continuação carrega só o dígito que completa a parcela
 *  quebrada ("4" em "MERCADO03/0" + "4"): uma única célula curta no início
 *  do histórico, sem data nem valor, logo abaixo da âncora.
 *
 *  Procura numa JANELA de Y, não na linha imediatamente seguinte: a tabela
 *  de limites à direita intercala linhas entre a âncora e a continuação. */
function digitoContinuacao(lines: Line[], idx: number): string | null {
  const ancora = lines[idx]
  for (let j = idx + 1; j < lines.length; j++) {
    const line = lines[j]
    if (line.page !== ancora.page) break
    if (ancora.y - line.y >= TOL_VIZINHO) break // passou da janela abaixo
    const hist = cellsHistorico(line)
    if (hist.length !== 1) continue
    if (cellData(line) || cellValor(line)) continue
    const t = hist[0].text.trim()
    if (CONTINUACAO.test(t)) return t
  }
  return null
}

/** O rótulo "Vencimento" e a data "28/06/2026" ficam em linhas separadas
 *  (o valor logo abaixo do rótulo). Acha a data completa mais próxima
 *  abaixo do rótulo, na mesma coluna. */
function vencimento(lines: Line[]): Date {
  const rotulo = lines.find((l) => l.cells.some((c) => /^Vencimento$/i.test(c.text.trim())))
  if (rotulo) {
    const colX = rotulo.cells.find((c) => /^Vencimento$/i.test(c.text.trim()))!.x
    const candidatas = lines
      .filter((l) => l.page === rotulo.page && l.y < rotulo.y)
      .map((l) => ({
        y: l.y,
        cell: l.cells.find(
          (c) => Math.abs(c.x - colX) <= 8 && DATA_COMPLETA.test(c.text.trim()),
        ),
      }))
      .filter((x) => x.cell)
      .sort((a, b) => b.y - a.y)
    const abaixo = candidatas[0]?.cell
    if (abaixo) {
      const m = abaixo.text.trim().match(DATA_COMPLETA)!
      return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    }
  }
  throw new Error('Fatura Bradesco: não encontrei o vencimento')
}

/** Lê um valor do "Resumo da fatura" pelo rótulo. Os valores vêm com
 *  pontilhado: "(-) Créditos/Pagamentos..... R$ 4.839,43". */
function resumo(lines: Line[], rotulo: RegExp): number | null {
  for (const line of lines) {
    if (!rotulo.test(line.text)) continue
    const m = line.text.match(/R\$\s*([\d.]+,\d{2})/)
    if (m) return parseBRL(m[1])
  }
  return null
}

function cartao(lines: Line[]): string | null {
  const texto = lines.map((l) => l.text).join('\n')
  const m = texto.match(/(\d{4})\s+XXXX\s+XXXX\s+(\d{4})/)
  return m ? m[2] : null
}

export function parseBradescoFatura(lines: Line[]): ParseResult {
  const venc = vencimento(lines)
  const transactions: RawTransaction[] = []

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const cData = cellData(l)
    const cValor = cellValor(l)
    if (!cData || !cValor) continue

    const dm = cData.text.trim().match(DATA)!
    const date = inferYear(Number(dm[1]), Number(dm[2]), venc)

    // Histórico: células da coluna, em ordem X, juntas com espaço.
    const hist = cellsHistorico(l)
      .map((c) => c.text.trim())
      .join(' ')
      .trim()

    // Dígito de continuação da parcela quebrada: anexado SEM espaço, para
    // "MERCADOLIVRE*MERCADO03/0" + "4" virar "...03/04".
    const cont = digitoContinuacao(lines, i)
    const descBruta = cont ? hist + cont : hist

    // Sinal: "-" na própria célula OU em célula avulsa à direita = crédito.
    const negativoAvulso = temMinusAvulso(l)
    const valorTexto = negativoAvulso ? `${cValor.text} -` : cValor.text
    const amountCents = parseBRL(valorTexto)

    const { installment, clean } = extractInstallment(descBruta)

    const kind: RawKind =
      amountCents < 0 ? (PAGAMENTO.test(descBruta) ? 'pagamento' : 'entrada') : 'compra'

    transactions.push({
      date,
      description: clean,
      amountCents,
      installment,
      card: null,
      fx: null,
      kind,
      raw: l.text,
    })
  }

  // Gabarito: o "Resumo da fatura" dá créditos e débitos separados. Valida
  // os dois fluxos (mais preciso que o total, que inclui o saldo anterior).
  const creditos = resumo(lines, /Cr[ée]ditos\/Pagamentos/i)
  const debitos = resumo(lines, /Compras\/D[ée]bitos/i)
  const total = resumo(lines, /\(=\)\s*Total/i)

  return {
    transactions,
    declaredTotal: total,
    declaredIncome: creditos != null ? Math.abs(creditos) : null,
    declaredExpense: debitos != null ? Math.abs(debitos) : null,
    period: { start: transactions[0]?.date ?? venc, end: venc },
    account: {
      bank: 'bradesco',
      type: 'credit_card',
      last4: cartao(lines),
      agency: null,
      number: null,
      holderName: null,
    },
    forward: {
      nextCloseDate: lerProximoFechamento(lines),
      nextInvoiceBalance: null,
      // `totalOpenBalance` fica null porque o Bradesco NÃO declara saldo em
      // aberto: a fatura dele não traz o quanto já foi gasto no ciclo que
      // ainda vai fechar (o Nubank traz, em "Saldo em aberto total"). O que
      // ele declara é o total já comprometido em parcelas — outro número,
      // com outro nome na tela. Derivar um "em aberto" a partir do que temos
      // seria inventar: as compras do ciclo aberto estão na PRÓXIMA fatura,
      // que ninguém importou ainda.
      totalOpenBalance: null,
      futureInstallmentsTotal: resumo(lines, /Total para as pr[óo]ximas faturas/i),
    },
  }
}

/** "Previsão de fechamento da próxima fatura: 16/07/2026".
 *
 *  O Bradesco declara a data, e o app gravava `null` desde sempre — então a
 *  fileira de saldos não tinha o que mostrar para este banco enquanto a do
 *  Nubank mostrava. Formato dd/mm/aaaa, diferente do "16 JUL 2026" do Nubank:
 *  é por isso que cada parser tem o seu leitor em vez de um compartilhado. */
function lerProximoFechamento(lines: Line[]): Date | null {
  for (const line of lines) {
    if (!/fechamento da pr[óo]xima fatura/i.test(line.text)) continue
    const m = line.text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  }
  return null
}
