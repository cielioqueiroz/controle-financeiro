import type { RawTransaction } from '../parsers/types'
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

/** Chave de dedup de uma transação: conta + data + valor + merchant
 *  normalizado. Igualdade exata — nunca difusa. */
export function chaveTransacao(tx: RawTransaction, accountKey: string): string {
  const dia = tx.date.toISOString().slice(0, 10)
  const merchant = normalizeMerchant(tx.description)
  return `${accountKey}|${dia}|${tx.amountCents}|${merchant}`
}

export function hashTransacao(tx: RawTransaction, accountKey: string): Promise<string> {
  return sha256(chaveTransacao(tx, accountKey))
}
