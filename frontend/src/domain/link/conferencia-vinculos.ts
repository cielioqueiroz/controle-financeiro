export type TransacaoParaConferencia = {
  id: string
  date: string
  description: string
  amount_cents: number
  kind: string
  document_id: string
  vinculo_document_id?: string | null
  vinculo_transacao_id?: string | null
  vinculo_criterio?: string | null
}

export type DocumentoParaConferencia = {
  id: string
  bank: string
  doc_type: string
  filename: string | null
  period_end: string | null
  declared_total: number | null
}

export type PontaVinculo = {
  documento: DocumentoParaConferencia
  description: string | null
  date: string | null
  amountCents: number | null
}

export type ConferenciaVinculo = {
  id: string
  criterio: 'quitacao-fatura' | 'transferencia-pareada'
  origem: PontaVinculo | null
  destino: PontaVinculo | null
}

/** Apresenta a evidência salva; não tenta casar valores no navegador. */
export function conferirVinculos(
  transacoes: TransacaoParaConferencia[],
  documentos: DocumentoParaConferencia[],
): ConferenciaVinculo[] {
  const docs = new Map(documentos.map((d) => [d.id, d]))
  const txs = new Map(transacoes.map((t) => [t.id, t]))
  const pares = new Map<string, ConferenciaVinculo>()
  function ponta(t: TransacaoParaConferencia): PontaVinculo | null {
    const documento = docs.get(t.document_id)
    return documento ? { documento, description: t.description, date: t.date, amountCents: t.amount_cents } : null
  }

  for (const t of transacoes) {
    if (t.vinculo_criterio === 'quitacao-fatura' && t.vinculo_document_id && t.kind === 'card_payment') {
      const documento = docs.get(t.vinculo_document_id)
      pares.set(t.id, {
        id: t.id, criterio: 'quitacao-fatura', origem: ponta(t),
        destino: documento ? { documento, description: null, date: documento.period_end, amountCents: documento.declared_total } : null,
      })
    }
    if (t.vinculo_criterio === 'transferencia-pareada' && t.vinculo_transacao_id && t.kind === 'internal_transfer') {
      const id = [t.id, t.vinculo_transacao_id].sort().join(':')
      if (pares.has(id)) continue
      const candidata = txs.get(t.vinculo_transacao_id)
      const outra = candidata?.vinculo_transacao_id === t.id
        && candidata.kind === 'internal_transfer'
        && candidata.vinculo_criterio === 'transferencia-pareada'
        && candidata.amount_cents === -t.amount_cents ? candidata : null
      const saida = t.amount_cents > 0 ? t : outra
      const entrada = t.amount_cents < 0 ? t : outra
      pares.set(id, {
        id, criterio: 'transferencia-pareada',
        origem: saida ? ponta(saida) : null, destino: entrada ? ponta(entrada) : null,
      })
    }
  }
  return [...pares.values()].sort((a, b) => a.id.localeCompare(b.id))
}
