import type { Line } from '../pdf/lines'
import { parseBRL } from '../normalize/money'
import type { ParseResult, RawKind, RawTransaction } from './types'

/** Extrato de conta do Mercado Pago.
 *
 *  O documento é o mais curto que o app lê, e o único cuja descrição pode
 *  ficar ACIMA e ABAIXO da linha do valor ao mesmo tempo:
 *
 *      Pix recebido JACIELIO DA        ← prefixo   (y 417)
 *      08-08-2026 171802730931 R$ 100,00 R$ 100,00 ← o lançamento (y 410)
 *      SILVA QUEIROZ                   ← sufixo    (y 405)
 *
 *  ⚠️ **O que junta os três é a DISTÂNCIA, não a vizinhança.** Pegar
 *  "a linha de cima e a de baixo" quebra em lançamentos seguidos: entre
 *  dois valores há ~30pt, e a linha logo abaixo de um deles pode ser o
 *  prefixo do PRÓXIMO, não o sufixo dele. Os fragmentos de uma mesma
 *  descrição ficam a 5–7pt do valor; a próxima linha de valor, a 30.
 *
 *  Sinal: o documento usa positivo para crédito e negativo para débito. A
 *  convenção do app é a inversa (positivo = saiu dinheiro), então tudo
 *  entra invertido — ver `types.ts`. */

/** `08-08-2026 Rendimentos 1748158276539 R$ 0,04 R$ 100,04`, com a
 *  descrição opcional porque ela pode ter ido inteira para as linhas
 *  vizinhas. O ID da operação tem 9 dígitos ou mais em toda a amostra;
 *  exigir 6 já o separa de qualquer valor. */
const LANCAMENTO =
  /^(\d{2})-(\d{2})-(\d{4})\s+(.*?)\s*\b(\d{6,})\s+R\$\s*(-?[\d.]+,\d{2})\s+R\$\s*(-?[\d.]+,\d{2})$/

/** `Periodo: De 01-08-2026 al 30-08-2026` — o "al" é espanhol mesmo, e é
 *  do documento, não erro de transcrição. */
const PERIODO = /Periodo:\s*De\s*(\d{2})-(\d{2})-(\d{4})\s*al\s*(\d{2})-(\d{2})-(\d{4})/i
const ENTRADAS = /Entradas:\s*R\$\s*(-?[\d.]+,\d{2})/i
const SAIDAS = /Saidas:\s*R\$\s*(-?[\d.]+,\d{2})/i
const SALDOS = /Saldo inicial:\s*R\$\s*(-?[\d.]+,\d{2})\s+Saldo final:\s*R\$\s*(-?[\d.]+,\d{2})/i
const CONTA = /Ag[êe]ncia:\s*(\S+)\s+Conta:\s*(\S+)/i

/** Distância máxima, em pontos, entre o valor e um fragmento da descrição
 *  dele. Medido: fragmentos a 5–7pt, lançamentos vizinhos a 26–33pt. */
const TOL_FRAGMENTO = 12

/** Linhas que nunca são descrição de ninguém: cabeçalho de tabela,
 *  paginação e o rodapé jurídico. Sem isto, "Data Descrição ID da operação
 *  Valor Saldo" viraria prefixo do primeiro lançamento da página. */
const NAO_E_DESCRICAO =
  /^(Data\s+Descri|DETALHE DOS|EXTRATO DE|Periodo:|Entradas:|Saidas:|Saldo inicial|Data de gera|Voc[êe] tem alguma|o nosso SAC|da ouvidoria|Mercado Pago Institui|903\.|\d+\/\d+$)/i

function fragmento(l: Line | undefined, alvo: Line): string | null {
  if (!l || l.page !== alvo.page) return null
  if (Math.abs(l.y - alvo.y) > TOL_FRAGMENTO) return null
  if (LANCAMENTO.test(l.text) || NAO_E_DESCRICAO.test(l.text.trim())) return null
  return l.text.trim() || null
}

/** Entrada é sempre 'entrada'. Entre as saídas, só a QUITAÇÃO DE FATURA é
 *  'pagamento'.
 *
 *  ⚠️ **Parcela de empréstimo NÃO entra aqui**, por mais que o documento a
 *  chame de "Débito por dívida". `pagamento` vira `card_payment` na
 *  gravação, e `card_payment` é vínculo — sairia do gasto real. Mas o
 *  vínculo existe para impedir DUPLA CONTAGEM entre a fatura e o extrato
 *  do mesmo mês (CONTEXT.md: quitação de fatura, transferência entre
 *  contas próprias, varredura automática), e a parcela do empréstimo não
 *  está contada em documento nenhum além deste. É gasto, e tem categoria
 *  própria. */
function natureza(descricao: string, cents: number): RawKind {
  if (cents < 0) return 'entrada'
  if (/fatura|cart[ãa]o de cr[ée]dito/i.test(descricao)) return 'pagamento'
  if (/\b(juros|iof|multa|tarifa|encargo)/i.test(descricao)) return 'encargo'
  return 'compra'
}

export function parseMercadoPagoExtrato(lines: Line[]): ParseResult {
  const texto = lines.map((l) => l.text).join('\n')
  const transactions: RawTransaction[] = []

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const m = l.text.match(LANCAMENTO)
    if (!m) continue

    // Prefixo, meio e sufixo nesta ordem — é a ordem de leitura da página,
    // e é ela que devolve "Pix recebido JACIELIO DA" + "SILVA QUEIROZ" como
    // uma frase e não como duas soltas.
    const descricao = [fragmento(lines[i - 1], l), m[4].trim() || null, fragmento(lines[i + 1], l)]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Inverte o sinal: no documento crédito é positivo; aqui, saída é.
    const amountCents = -parseBRL(m[6])

    transactions.push({
      date: new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
      description: descricao,
      amountCents,
      // Extrato de conta não tem parcela nem cartão.
      installment: null,
      card: null,
      fx: null,
      kind: natureza(descricao, amountCents),
      raw: l.text,
    })
  }

  const periodo = texto.match(PERIODO)
  const entradas = texto.match(ENTRADAS)
  const saidas = texto.match(SAIDAS)
  const saldos = texto.match(SALDOS)

  return {
    transactions,
    declaredTotal: null,
    // Os dois gabaritos são magnitudes: o documento escreve as saídas com
    // sinal ("R$ -135,18") e `validar` compara contra a soma absoluta.
    declaredIncome: entradas ? Math.abs(parseBRL(entradas[1])) : null,
    declaredExpense: saidas ? Math.abs(parseBRL(saidas[1])) : null,
    // Vem junto mesmo com os dois totais acima: `validar` prefere os
    // totais, mas o saldo final é o que alimenta a fileira de saldo por
    // conta do painel (`documents.end_balance_cents`).
    balance: saldos ? { initial: parseBRL(saldos[1]), final: parseBRL(saldos[2]) } : null,
    period: periodo
      ? {
          start: new Date(Number(periodo[3]), Number(periodo[2]) - 1, Number(periodo[1])),
          end: new Date(Number(periodo[6]), Number(periodo[5]) - 1, Number(periodo[4])),
        }
      : null,
    account: {
      bank: 'mercadopago',
      type: 'checking',
      last4: null,
      agency: texto.match(CONTA)?.[1] ?? null,
      number: texto.match(CONTA)?.[2] ?? null,
      // A segunda linha do documento é o titular, logo abaixo do título.
      holderName: lines[1]?.text.trim() ?? null,
    },
    forward: {
      nextCloseDate: null,
      nextInvoiceBalance: null,
      totalOpenBalance: null,
      futureInstallmentsTotal: null,
    },
  }
}
