import type { Line } from '../pdf/lines'
import { detectDocument, type DocKind } from '../pdf/detect'
import { parseNubankFatura } from './nubank-fatura'
import { parseNubankExtrato } from './nubank-extrato'
import { parseBradescoExtrato } from './bradesco-extrato'
import { parseBradescoFatura } from './bradesco-fatura'
import { parseBBExtrato } from './bb-extrato'
import { parseSicrediExtrato } from './sicredi-extrato'
import { parseSicoobExtrato } from './sicoob-extrato'
import type { ParseResult } from './types'

export class ParserNaoImplementadoError extends Error {
  readonly kind: DocKind
  constructor(kind: DocKind) {
    super(
      kind.bank === 'desconhecido'
        ? 'Não reconheci este documento'
        : `Ainda não sei ler ${kind.docType} do ${kind.bank}`,
    )
    this.name = 'ParserNaoImplementadoError'
    this.kind = kind
  }
}

/** Despacha para o parser do emissor. Adicionar banco novo é acrescentar
 *  uma entrada aqui — nada a jusante muda, porque todos devolvem
 *  ParseResult. */
export function parse(lines: Line[]): { kind: DocKind; result: ParseResult } {
  const kind = detectDocument(lines)

  if (kind.bank === 'nubank' && kind.docType === 'fatura') {
    return { kind, result: parseNubankFatura(lines) }
  }
  if (kind.bank === 'nubank' && kind.docType === 'extrato') {
    return { kind, result: parseNubankExtrato(lines) }
  }
  if (kind.bank === 'bradesco' && kind.docType === 'extrato') {
    return { kind, result: parseBradescoExtrato(lines) }
  }
  if (kind.bank === 'bradesco' && kind.docType === 'fatura') {
    return { kind, result: parseBradescoFatura(lines) }
  }
  if (kind.bank === 'bb' && kind.docType === 'extrato') {
    return { kind, result: parseBBExtrato(lines) }
  }
  if (kind.bank === 'sicredi' && kind.docType === 'extrato') {
    return { kind, result: parseSicrediExtrato(lines) }
  }
  if (kind.bank === 'sicoob' && kind.docType === 'extrato') {
    return { kind, result: parseSicoobExtrato(lines) }
  }

  throw new ParserNaoImplementadoError(kind)
}

export { detectDocument }
export type { ParseResult }
