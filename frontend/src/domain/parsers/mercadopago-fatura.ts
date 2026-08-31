import type { Line } from '../pdf/lines'
import { parseBRL } from '../normalize/money'
import { extractInstallment } from '../normalize/installment'
import type { Fx, ParseResult, RawKind, RawTransaction } from './types'

/** Fatura do cartão de crédito Mercado Pago.
 *
 *  Diferente dos outros dois cartões que o app lê, este documento é
 *  regular o bastante para ser lido pelo TEXTO da linha, sem medir coluna
 *  por X: a tabela de consumo tem uma linha por lançamento, com data,
 *  descrição e valor na mesma linha visual. Onde o Bradesco exigiu régua
 *  de coordenadas, aqui ela seria precisão inventada.
 *
 *  As três coisas que o documento faz e que o parser precisa saber:
 *
 *  1. **A data não traz o ano** ("16/07"). Ele sai do vencimento, com a
 *     virada de dezembro tratada — ver `anoDe`.
 *  2. **Compra internacional ocupa DUAS linhas**: a do lançamento e uma de
 *     conversão logo abaixo ("USD 1 = R$ 5.09 USD 5.00"). A segunda não é
 *     transação; é o câmbio da primeira.
 *  3. **"Total" aparece três vezes**, em páginas diferentes e significando
 *     coisas diferentes: o total da fatura (p. 1 e 2) e o total de
 *     lançamentos futuros (p. 4). Confundi-los faria o gabarito conferir
 *     contra o número errado — por isso cada leitura aqui é ancorada. */

/** `16/07 MERCADOLIVRE*GREYCOMLTDA Parcela 1 de 4 R$ 47,88` */
const LANCAMENTO = /^(\d{2})\/(\d{2})\s+(.+?)\s+R\$\s*(-?[\d.]+,\d{2})$/

/** A linha de câmbio da compra internacional.
 *
 *  Exige o MESMO código de moeda dos dois lados e cotação positiva, e é
 *  isso que a torna segura: o documento também produz
 *  "BRL 0 = USD 1 = R$ 0 BRL 50.00", em que a cotação vem zerada e a moeda
 *  não fecha. Ali o câmbio fica `null` — melhor sem o dado do que com um
 *  dado que diz que o dólar custa zero. */
const CAMBIO = /\b([A-Z]{3})\s+1\s*=\s*R\$\s*([\d.]+)\s+\1\s+([\d.]+)\s*$/

/** `Vencimento: 17/08/2026` (repetido no topo das páginas 2 em diante) e,
 *  na primeira, a data solta na fileira do "Vence em". */
const VENCIMENTO = /Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i
/** `Consumos de 11/07 a 11/08 R$ 621,34` */
const CONSUMOS = /Consumos de (\d{2})\/(\d{2}) a (\d{2})\/(\d{2})/i
/** `Próximo fechamento 11/09/2026` */
const PROXIMO_FECHAMENTO = /Pr[óo]ximo fechamento\s*(\d{2})\/(\d{2})\/(\d{4})/i
/** `Cartão Visa [************1465]` */
const CARTAO = /Cart[ãa]o\s+\w+\s*\[[*\s]*(\d{4})\]/i

/** Ponto decimal, não vírgula: a linha de câmbio vem em formato
 *  americano ("R$ 5.09", "USD 5.00"), ao contrário do resto da fatura. */
function cambio(texto: string): Fx | null {
  const m = texto.match(CAMBIO)
  if (!m) return null
  const rate = Math.round(Number(m[2]) * 100)
  const amount = Math.round(Number(m[3]) * 100)
  if (!Number.isFinite(rate) || !Number.isFinite(amount) || rate <= 0) return null
  return { currency: m[1], amount, rate }
}

function vencimento(lines: Line[]): Date | null {
  for (const l of lines) {
    const m = l.text.match(VENCIMENTO)
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  }
  return null
}

/** O ano de uma data sem ano, dado o mês em que a fatura fecha.
 *
 *  Uma fatura que fecha em janeiro lista compras de dezembro: o mês da
 *  compra é MAIOR que o do fechamento, e o ano é o anterior. Fora dessa
 *  virada os dois anos coincidem. */
function anoDe(mes: number, mesFechamento: number, anoFechamento: number): number {
  return mes > mesFechamento ? anoFechamento - 1 : anoFechamento
}

/** Uma leitura ancorada de "Total R$ x": o primeiro `Total` que aparece
 *  DEPOIS da linha âncora. É o que separa o total da fatura (ancorado em
 *  "Resumo da fatura") do total de lançamentos futuros (ancorado em
 *  "Fatura parcelada"), que são iguais em forma e diferentes em sentido. */
function totalApos(lines: Line[], ancora: RegExp): number | null {
  const i = lines.findIndex((l) => ancora.test(l.text))
  if (i < 0) return null
  for (let j = i + 1; j < lines.length; j++) {
    const m = lines[j].text.match(/^Total\s+R\$\s*(-?[\d.]+,\d{2})$/i)
    if (m) return parseBRL(m[1])
  }
  return null
}

/** Pagamento e estorno chegam com valor negativo; compra, positivo. O
 *  encargo do Mercado Pago vem nomeado ("Juros", "IOF", "Multa"), e é
 *  gasto seu — só não é consumo. */
function natureza(descricao: string, cents: number): RawKind {
  if (cents < 0) return /estorno/i.test(descricao) ? 'entrada' : 'pagamento'
  if (/\b(juros|iof|multa|anuidade|tarifa|encargo)/i.test(descricao)) return 'encargo'
  return 'compra'
}

export function parseMercadoPagoFatura(lines: Line[]): ParseResult {
  const venc = vencimento(lines)
  const pagina1 = lines.filter((l) => l.page === 1)
  const texto1 = pagina1.map((l) => l.text).join('\n')

  const consumos = texto1.match(CONSUMOS)
  // O mês de fechamento é o fim do período de consumo. Sem ele (fatura de
  // formato inesperado) cai no mês do vencimento, que erra no máximo na
  // virada do ano e nunca deixa a data sem ano nenhum.
  const mesFechamento = consumos ? Number(consumos[4]) : (venc?.getMonth() ?? 0) + 1
  const anoFechamento = venc
    ? anoDe(mesFechamento, venc.getMonth() + 1, venc.getFullYear())
    : new Date().getFullYear()

  const transactions: RawTransaction[] = []
  const cartao = lines.find((l) => CARTAO.test(l.text))?.text.match(CARTAO)?.[1] ?? null

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    // A tabela de consumo mora da página 2 em diante. Varrer a 1 traria
    // "Consumos de 11/07 a 11/08 R$ 621,34" como se fosse lançamento.
    if (l.page < 2) continue

    const m = l.text.match(LANCAMENTO)
    if (!m) continue

    const bruto = m[3].trim()
    const { installment, clean } = extractInstallment(bruto)
    const cents = parseBRL(m[4])
    const mes = Number(m[2])
    const date = new Date(anoDe(mes, mesFechamento, anoFechamento), mes - 1, Number(m[1]))

    transactions.push({
      date,
      description: clean,
      amountCents: cents,
      installment,
      card: cartao,
      // A conversão vem na linha SEGUINTE à do lançamento, e só nas
      // internacionais. `?? null` porque a última compra do documento não
      // tem linha depois dela.
      fx: cambio(lines[i + 1]?.text ?? '') ?? null,
      kind: natureza(clean, cents),
      raw: l.text,
    })
  }

  return {
    transactions,
    declaredTotal: totalApos(pagina1, /Resumo da fatura/i),
    declaredIncome: null,
    declaredExpense: null,
    period: venc
      ? {
          start: consumos
            ? new Date(
                anoDe(Number(consumos[2]), mesFechamento, anoFechamento),
                Number(consumos[2]) - 1,
                Number(consumos[1]),
              )
            : (transactions[0]?.date ?? venc),
          // O FIM do período é o VENCIMENTO, não o fechamento: é dele que
          // sai a competência da fatura (ADR-0001), e é por isso que este
          // campo não guarda "11/08" mesmo o documento dizendo que fechou
          // ali.
          end: venc,
        }
      : null,
    account: {
      bank: 'mercadopago',
      type: 'credit_card',
      last4: cartao,
      agency: null,
      number: null,
      holderName: pagina1[0]?.text.trim() ?? null,
    },
    forward: {
      nextCloseDate: (() => {
        const m = lines.map((l) => l.text).join('\n').match(PROXIMO_FECHAMENTO)
        return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null
      })(),
      nextInvoiceBalance: null,
      // O Mercado Pago NÃO declara saldo em aberto — nem o "Limite
      // utilizado" serve, porque ele soma o que já está nesta fatura com o
      // que ainda vai vir. Derivar seria inventar. Mesmo caso do Bradesco.
      totalOpenBalance: null,
      // "Lançamentos futuros": compras parceladas + fatura parcelada. É o
      // "Total para as próximas faturas" do Bradesco com outro nome.
      futureInstallmentsTotal: totalApos(lines, /Fatura parcelada/i),
    },
  }
}
