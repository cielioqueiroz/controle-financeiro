/** Saldo em aberto do cartão, declarado pela própria fatura.
 *
 *  As quatro colunas lidas aqui existem no schema 0001 e são gravadas por
 *  `salvar.ts` desde sempre — mas nenhum ponto do app as lia. Este módulo é
 *  o leitor que faltava. Nubank declara saldo em aberto e próximo
 *  fechamento; Bradesco declara só o total das próximas faturas.
 *
 *  Gêmeo de `saldos.ts` (saldo do extrato): mesma forma de entrada, mesma
 *  regra de "vence o de maior period_end por conta", mesma saída. Puro. */

export type DocParaAberto = {
  bank: string
  account_id: string | null
  doc_type: string
  period_end: string | null
  total_open_balance: number | null
  next_invoice_balance: number | null
  next_close_date: string | null
  future_installments_total: number | null
}

export type FaturaAberta = {
  accountId: string | null
  bank: string
  /** Saldo em aberto total declarado pela fatura, em centavos. */
  abertoCents: number
  /** Saldo em aberto da próxima fatura, quando o banco declara. */
  proximaCents: number | null
  /** Data do próximo fechamento (YYYY-MM-DD), quando o banco declara. */
  proximoFechamento: string | null
  /** `period_end` da fatura de onde os números vieram. */
  date: string
}

/** Para cada conta com ao menos uma fatura que declare saldo em aberto,
 *  vence a fatura de maior `period_end`. Extrato e fatura sem saldo (ou sem
 *  data) são ignorados — sem data não há como saber qual é a mais nova. */
export function faturasAbertas(docs: DocParaAberto[]): FaturaAberta[] {
  const porConta = new Map<string, FaturaAberta & { _pe: string }>()
  for (const d of docs) {
    if (d.doc_type !== 'fatura') continue
    if (d.total_open_balance == null || d.period_end == null) continue
    // Sem account_id (documento antigo), agrupa por banco para não colidir.
    const chave = d.account_id ?? `${d.bank}:sem-conta`
    const atual = porConta.get(chave)
    if (!atual || d.period_end > atual._pe) {
      porConta.set(chave, {
        accountId: d.account_id,
        bank: d.bank,
        abertoCents: d.total_open_balance,
        proximaCents: d.next_invoice_balance,
        proximoFechamento: d.next_close_date,
        date: d.period_end,
        _pe: d.period_end,
      })
    }
  }
  return [...porConta.values()].map(({ _pe, ...f }) => f)
}
