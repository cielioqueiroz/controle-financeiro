import type { ParseResult, RawTransaction } from '../parsers/types'
import type { DocKind } from '../pdf/detect'
import { normalizeMerchant } from '../normalize/merchant'

/** SHA-256 em hex. Usa Web Crypto (disponível no navegador e no Node 20+). */
export async function sha256(data: ArrayBuffer | string): Promise<string> {
  const buffer =
    typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Hash do arquivo inteiro. Barra reimportação do mesmo PDF, de graça e
 *  sem falso positivo (ver spec, "Duplicatas / Documento"). */
export function hashDocumento(bytes: ArrayBuffer): Promise<string> {
  return sha256(bytes)
}

/**
 * Identidade do conteúdo financeiro do Documento. O PDF exportado de novo
 * pode mudar metadados, IDs internos e a ordem dos objetos sem mudar o que o
 * banco declarou. Esses detalhes não podem fazer o mesmo Documento parecer
 * novo; por isso a impressão usa somente o resultado estruturado do parser.
 */
export function hashConteudoDocumento(result: ParseResult, kind: DocKind): Promise<string> {
  const transacoes = result.transactions
    .map((tx) => ({
      date: dataDa(tx.date),
      description: textoEstavel(tx.description),
      amountCents: tx.amountCents,
      installment: tx.installment,
      fx: tx.fx,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

  return sha256(
    JSON.stringify({
      bank: kind.bank,
      docType: kind.docType,
      period: result.period
        ? { start: dataDa(result.period.start), end: dataDa(result.period.end) }
        : null,
      account: {
        type: result.account.type,
        last4: result.account.last4,
        agency: result.account.agency,
        number: result.account.number,
      },
      declaredTotal: result.declaredTotal,
      declaredIncome: result.declaredIncome,
      declaredExpense: result.declaredExpense,
      balance: result.balance ?? null,
      forward: result.forward,
      transactions: transacoes,
    }),
  )
}

const dataDa = (date: Date): string => date.toISOString().slice(0, 10)

const textoEstavel = (text: string): string => text.trim().replace(/\s+/g, ' ')

/** Identidade usada nas importações antigas e nas transações sem parcela. */
export function chaveTransacaoLegada(tx: RawTransaction, accountKey: string): string {
  const dia = tx.date.toISOString().slice(0, 10)
  const merchant = normalizeMerchant(tx.description)
  return `${accountKey}|${dia}|${tx.amountCents}|${merchant}`
}


/** A data original da compra pode se repetir nas próximas faturas.
 *  O número da parcela distingue cobranças que repetem data e valor. */
export function chaveTransacao(tx: RawTransaction, accountKey: string): string {
  const base = chaveTransacaoLegada(tx, accountKey)
  if (!tx.installment) return base
  return JSON.stringify([base, tx.installment.current, tx.installment.total])
}
