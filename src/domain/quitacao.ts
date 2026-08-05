/** Quais faturas já foram quitadas, derivado do que está salvo.
 *
 *  A regra é a mesma do `link/vinculos.ts`: um lançamento de pagamento de
 *  fatura cujo valor bate com o total declarado da fatura a quita. A
 *  diferença é o alcance — `vincular()` só cruza os documentos do LOTE de uma
 *  importação, então fatura e extrato importados em dias diferentes nunca se
 *  encontram. Aqui a regra roda sobre todo o histórico salvo.
 *
 *  Puro: sem rede, sem React. */

export type FaturaParaQuitacao = {
  id: string
  /** Total declarado no rodapé do PDF, em centavos. */
  declared_total: number | null
  /** Vencimento da fatura (YYYY-MM-DD). */
  period_end: string | null
}

export type PagamentoParaQuitacao = {
  id: string
  /** Data real do lançamento (YYYY-MM-DD). */
  date: string
  amount_cents: number
  kind: string
}

/** Quão longe do vencimento um pagamento ainda pode estar para ser aceito
 *  como quitação daquela fatura. Guarda contra um pagamento antigo de valor
 *  coincidente quitar uma fatura recente. */
const JANELA_DIAS = 45

const DIA_MS = 86400_000

function diasEntre(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / DIA_MS
}

/** Devolve os `id` das faturas quitadas.
 *
 *  Casa por **par mais próximo primeiro**, não fatura por fatura. A diferença
 *  importa: percorrer as faturas em ordem de vencimento e dar a cada uma o
 *  melhor pagamento disponível deixa a fatura MAIS ANTIGA roubar o pagamento
 *  que casa exatamente com uma mais nova de igual valor (fatura de maio e de
 *  junho de R$ 832,42, pagamento em 20/jun: a de maio ficava com ele). Aqui
 *  todos os pares viáveis são ordenados por distância e consumidos em
 *  ordem — o casamento exato sempre vence o aproximado.
 *
 *  Cada pagamento quita no máximo UMA fatura, e cada fatura é quitada por no
 *  máximo um pagamento. Empates desempatam por id, para o resultado não
 *  depender da ordem em que os documentos chegaram. */
export function faturasQuitadas(
  faturas: FaturaParaQuitacao[],
  pagamentos: PagamentoParaQuitacao[],
): Set<string> {
  const candidatas = faturas.filter(
    (f) => f.declared_total != null && f.period_end != null,
  )
  const disponiveis = pagamentos.filter((p) => p.kind === 'card_payment')

  type Par = { faturaId: string; pagamentoId: string; dist: number }
  const pares: Par[] = []
  for (const f of candidatas) {
    for (const p of disponiveis) {
      if (Math.abs(p.amount_cents) !== f.declared_total) continue
      const dist = diasEntre(p.date, f.period_end!)
      if (dist > JANELA_DIAS) continue
      pares.push({ faturaId: f.id, pagamentoId: p.id, dist })
    }
  }

  pares.sort(
    (a, b) =>
      a.dist - b.dist ||
      a.faturaId.localeCompare(b.faturaId) ||
      a.pagamentoId.localeCompare(b.pagamentoId),
  )

  const pagosUsados = new Set<string>()
  const quitadas = new Set<string>()
  for (const par of pares) {
    if (pagosUsados.has(par.pagamentoId)) continue
    if (quitadas.has(par.faturaId)) continue
    pagosUsados.add(par.pagamentoId)
    quitadas.add(par.faturaId)
  }

  return quitadas
}
