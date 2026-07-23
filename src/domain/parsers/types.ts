import type { Installment } from '../normalize/installment'
import type { Bank } from '../pdf/detect'

/** Natureza da linha dentro do documento. Distingue o que é gasto real
 *  do que é encargo ou quitação — sem isso os totais mentem. */
export type RawKind =
  /** Compra no cartão ou débito em conta. */
  | 'compra'
  /** IOF, anuidade, juros — encargo do banco, não gasto seu. */
  | 'encargo'
  /** Pagamento de fatura, quitação. Não é despesa nova. */
  | 'pagamento'
  /** Entrada: PIX recebido, rendimento, estorno. */
  | 'entrada'

export type Fx = {
  currency: string
  /** Valor na moeda original, em centavos dessa moeda. */
  amount: number
  /** Cotação usada, em centavos de real por unidade da moeda. */
  rate: number
}

export type RawTransaction = {
  date: Date
  /** Descrição original do banco. Imutável — o `label` do usuário vive
   *  noutro campo. Ver spec, seção "Modelo de dados". */
  description: string
  /** Centavos. Positivo = saiu dinheiro; negativo = entrou. */
  amountCents: number
  installment: Installment | null
  /** Últimos 4 dígitos do cartão, quando a linha traz. */
  card: string | null
  fx: Fx | null
  kind: RawKind
  /** Linha original, para auditoria contra o PDF. */
  raw: string
}

export type AccountHint = {
  bank: Bank
  type: 'checking' | 'credit_card'
  last4: string | null
  agency: string | null
  number: string | null
  holderName: string | null
}

/** Campos prospectivos declarados pela fatura. Alimentam a projeção de
 *  compromisso futuro (fatia 3). Ver spec, seção "Compromisso futuro". */
export type Forward = {
  nextCloseDate: Date | null
  nextInvoiceBalance: number | null
  totalOpenBalance: number | null
  futureInstallmentsTotal: number | null
}

/** Interface comum a todos os parsers. Permite adicionar banco sem
 *  tocar em nada a jusante. */
export type ParseResult = {
  transactions: RawTransaction[]
  /** Gabarito de FATURA: o "Total a pagar" declarado. Null em extrato e
   *  no parser genérico. Ver spec, "Validação". */
  declaredTotal: number | null
  /** Gabaritos de EXTRATO: total de entradas e de saídas declarados
   *  (magnitude, centavos). O extrato não tem um "total" único — tem os
   *  dois fluxos. Null em fatura. */
  declaredIncome: number | null
  declaredExpense: number | null
  /** Gabarito alternativo de EXTRATO por SALDO: quando o banco não declara
   *  totais de entradas/saídas (ex.: Banco do Brasil), a conferência sai da
   *  progressão saldoInicial→saldoFinal. Centavos, com sinal (credor > 0,
   *  devedor < 0). Ausente/null quando o gabarito vem dos totais declarados. */
  balance?: { initial: number; final: number } | null
  period: { start: Date; end: Date } | null
  account: AccountHint
  forward: Forward
}
