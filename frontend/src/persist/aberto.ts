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
  /** Saldo em aberto total declarado pela fatura, em centavos, ou `null`
   *  quando o banco não declara esse número (é o caso do Bradesco). */
  abertoCents: number | null
  /** Saldo em aberto da próxima fatura, quando o banco declara. */
  proximaCents: number | null
  /** Total já comprometido em parcelas que cairão nas próximas faturas,
   *  quando o banco declara. É o número que o Bradesco dá no lugar do saldo
   *  em aberto — e são coisas DIFERENTES, por isso campos diferentes:
   *  "em aberto" é o que já foi gasto no ciclo que ainda não fechou;
   *  "próximas faturas" é o que já está comprado e ainda vai ser cobrado. */
  futurasCents: number | null
  /** Data do próximo fechamento (YYYY-MM-DD), quando o banco declara. */
  proximoFechamento: string | null
  /** `period_end` da fatura de onde os números vieram. */
  date: string
}

/** Para cada conta com ao menos uma fatura que declare algum número olhando
 *  para a frente, vence a fatura de maior `period_end`.
 *
 *  A régua de entrada é "declara em aberto **ou** próximas faturas", e não só
 *  a primeira: exigir `total_open_balance` deixava o Bradesco de fora da
 *  fileira inteira — a fatura dele não traz esse campo — e a tela ficava com
 *  um card de "em aberto" só do Nubank, sem nada explicando a ausência do
 *  outro. Cada banco aparece com o número que ele de fato declara. */
export function faturasAbertas(docs: DocParaAberto[]): FaturaAberta[] {
  const porConta = new Map<string, FaturaAberta & { _pe: string }>()
  for (const d of docs) {
    if (d.doc_type !== 'fatura') continue
    if (d.period_end == null) continue
    if (d.total_open_balance == null && d.future_installments_total == null) continue
    // Sem account_id (documento antigo), agrupa por banco para não colidir.
    const chave = d.account_id ?? `${d.bank}:sem-conta`
    const atual = porConta.get(chave)
    if (!atual || d.period_end > atual._pe) {
      porConta.set(chave, {
        accountId: d.account_id,
        bank: d.bank,
        abertoCents: d.total_open_balance,
        proximaCents: d.next_invoice_balance,
        futurasCents: d.future_installments_total,
        proximoFechamento: d.next_close_date,
        date: d.period_end,
        _pe: d.period_end,
      })
    }
  }
  return [...porConta.values()].map(({ _pe, ...f }) => f)
}
