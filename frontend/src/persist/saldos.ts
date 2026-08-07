export type SaldoConta = {
  accountId: string | null
  bank: string
  balanceCents: number
  date: string
}

export type DocParaSaldo = {
  bank: string
  account_id: string | null
  doc_type: string
  period_end: string | null
  end_balance_cents: number | null
}

/** Saldo atual por conta: para cada conta com ao menos um extrato que traga
 *  saldo, vence o extrato de maior `period_end`. Fatura e documento sem saldo
 *  (ou sem data) são ignorados. Puro — testável sem banco. */
export function saldosPorConta(docs: DocParaSaldo[]): SaldoConta[] {
  const porConta = new Map<string, SaldoConta & { _pe: string }>()
  for (const d of docs) {
    if (d.doc_type !== 'extrato') continue
    if (d.end_balance_cents == null || d.period_end == null) continue
    // Sem account_id (documento antigo), agrupa por banco para não colidir.
    const chave = d.account_id ?? `${d.bank}:sem-conta`
    const atual = porConta.get(chave)
    if (!atual || d.period_end > atual._pe) {
      porConta.set(chave, {
        accountId: d.account_id,
        bank: d.bank,
        balanceCents: d.end_balance_cents,
        date: d.period_end,
        _pe: d.period_end,
      })
    }
  }
  return [...porConta.values()].map(({ _pe, ...s }) => s)
}
