export type TxQuitacaoParcial = {
  date: string
  amount_cents: number
  kind: string
  doc_type: string
  document_id: string
  vinculo_document_id?: string | null
}

export type DocParaQuitacao = {
  id: string
  bank: string
  account_id: string | null
  doc_type: string
  /** Na fatura, o vencimento. No extrato, o fim do período. */
  period_end: string | null
  /** O "Total a pagar" da fatura. */
  declared_total: number | null
}

export type FaturaPagaAMenor = {
  faturaId: string
  bank: string
  vencimento: string
  competencia: string
  totalCents: number
  pagoCents: number
  restanteCents: number
  /** De onde veio o pagamento: o registro na fatura seguinte do mesmo
   *  cartão, ou a saída no extrato. */
  fonte: 'fatura' | 'extrato'
}

/** A janela em volta do vencimento é assimétrica. Depois dele, os mesmos
 *  sete dias da 0009. Antes, quinze: pagar adiantado, entre o fechamento e o
 *  vencimento, é comum, e um pagamento adiantado que ficasse de fora faria
 *  o que veio depois parecer o pagamento inteiro. */
const DIAS_ANTES = 15
const DIAS_DEPOIS = 7

function diasAte(de: string, ate: string): number {
  const ms = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
  return Math.round((ms(ate) - ms(de)) / 86_400_000)
}

function naJanela(data: string, vencimento: string): boolean {
  const antes = diasAte(data, vencimento)
  return antes <= DIAS_ANTES && antes >= -DIAS_DEPOIS
}

/** Faturas que os documentos mostram pagas só em parte.
 *
 *  A quitação só ganha evidência com o valor inteiro (ADR-0021), então o
 *  pagamento parcial fica sem vínculo e sem aviso, e o resto vai para o
 *  rotativo. Aqui o navegador não grava conclusão nenhuma: só lê o que já
 *  está salvo e aponta a diferença.
 *
 *  O pagamento vem de uma de duas fontes, nesta ordem:
 *
 *  1. **A fatura seguinte do mesmo cartão**, que registra o pagamento
 *     recebido. É o próprio cartão dizendo quanto entrou, sem ambiguidade de
 *     destino. Quando existe, o extrato não é somado: seria o mesmo dinheiro
 *     duas vezes.
 *  2. **O extrato**, com a mesma regra de unicidade da 0009: um pagamento
 *     que cabe na janela de duas faturas em aberto não é de nenhuma. E o
 *     extrato precisa cobrir o vencimento, senão o resto do pagamento pode
 *     só não ter sido importado ainda.
 *
 *  Sem pagamento nenhum, cala. O app não sabe se a conta que pagou foi
 *  importada, e "não pagou" seria uma acusação sem documento. */
export function faturasPagasAMenor(txs: TxQuitacaoParcial[], docs: DocParaQuitacao[]): FaturaPagaAMenor[] {
  const porId = new Map(docs.map((d) => [d.id, d]))
  const quitadas = new Set(
    txs.filter((t) => t.kind === 'card_payment' && t.vinculo_document_id).map((t) => t.vinculo_document_id),
  )
  const emAberto = docs.filter(
    (d): d is DocParaQuitacao & { period_end: string; declared_total: number } =>
      d.doc_type === 'fatura' && d.period_end !== null && d.declared_total !== null && d.declared_total > 0
      && !quitadas.has(d.id),
  )
  const pagamentos = txs.filter((t) => t.kind === 'card_payment')
  const doExtrato = pagamentos.filter((t) => t.doc_type === 'extrato' && !t.vinculo_document_id)

  const achados: FaturaPagaAMenor[] = []
  for (const f of emAberto) {
    const vencimento = f.period_end
    const naSeguinte = f.account_id === null ? [] : pagamentos.filter((t) =>
      t.doc_type === 'fatura'
      && t.document_id !== f.id
      && porId.get(t.document_id)?.account_id === f.account_id
      && naJanela(t.date, vencimento))
    const fonte = naSeguinte.length > 0 ? 'fatura' : 'extrato'
    const pagos = fonte === 'fatura' ? naSeguinte : doExtrato.filter((t) =>
      naJanela(t.date, vencimento)
      && (porId.get(t.document_id)?.period_end ?? '') >= vencimento
      && emAberto.filter((g) => naJanela(t.date, g.period_end)).length === 1)

    const pagoCents = pagos.reduce((a, t) => a + Math.abs(t.amount_cents), 0)
    if (pagoCents === 0 || pagoCents >= f.declared_total) continue
    achados.push({
      faturaId: f.id,
      bank: f.bank,
      vencimento,
      competencia: vencimento.slice(0, 7),
      totalCents: f.declared_total,
      pagoCents,
      restanteCents: f.declared_total - pagoCents,
      fonte,
    })
  }
  return achados.sort((a, b) => b.vencimento.localeCompare(a.vencimento))
}
