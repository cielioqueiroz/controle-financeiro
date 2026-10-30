export type TxQuitacao = {
  amount_cents: number
  kind: string
  doc_type: string
  vinculo_document_id?: string | null
}

export type QuitacoesSemFatura = { contagem: number; totalCents: number }

/** Quitações de fatura, vindas de extrato, que não acharam a fatura que
 *  pagaram.
 *
 *  A quitação sai do gasto real para não contar duas vezes o que a fatura
 *  já detalha (ADR-0002). Sem a fatura, as compras dela também não estão
 *  na soma: o gasto real fica menor do que foi. Desde a 0009 a quitação
 *  reconhecida guarda a fatura em `vinculo_document_id` (ADR-0021); quem
 *  não tem essa evidência é o que a tela precisa avisar.
 *
 *  "Podem não estar", nunca "não estão": um pagamento parcial também fica
 *  sem evidência, com a fatura importada e as compras contadas. */
export function quitacoesSemFatura(txs: TxQuitacao[]): QuitacoesSemFatura {
  let contagem = 0
  let totalCents = 0
  for (const t of txs) {
    if (t.kind !== 'card_payment' || t.doc_type !== 'extrato' || t.vinculo_document_id) continue
    contagem += 1
    totalCents += Math.abs(t.amount_cents)
  }
  return { contagem, totalCents }
}
