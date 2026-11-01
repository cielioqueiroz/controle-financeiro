import type { TxAgrupavel } from './agrupar'
import type { FaturaAberta } from './aberto'
import type { SaldoConta } from './saldos'

/** Quantos dias de gasto real a média recente cobre. */
export const JANELA_FOLEGO_DIAS = 90
/** Abaixo disto, a média diz mais sobre o mês importado do que sobre o ritmo. */
export const HISTORICO_MINIMO_DIAS = 30

export type Folego = {
  /** Dias de histórico na média: 90, ou menos se o histórico for mais curto. */
  janelaDias: number
  gastoDiarioCents: number
  dias: number
}

const DIA_MS = 86_400_000

function emDias(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DIA_MS
}

/** Dias de fôlego: quantos dias o saldo de hoje dura no ritmo de gasto real
 *  dos últimos 90 dias, contados até a data do saldo.
 *
 *  Pela data real, não pela competência: a pergunta é sobre dias. A janela
 *  começa na transação mais antiga quando o histórico tem menos de 90 dias —
 *  dividir por 90 dias que ninguém importou faria o gasto parecer menor e o
 *  fôlego, maior. Com menos de 30 dias de histórico, ou sem gasto, cala. */
export function diasDeFolego(saldoCents: number, referencia: string, txs: TxAgrupavel[]): Folego | null {
  const fim = emDias(referencia)
  let maisAntiga = Infinity
  for (const t of txs) maisAntiga = Math.min(maisAntiga, emDias(t.date))
  const inicio = Math.max(fim - (JANELA_FOLEGO_DIAS - 1), maisAntiga)

  const janelaDias = fim - inicio + 1
  if (!(janelaDias >= HISTORICO_MINIMO_DIAS)) return null

  let gastoCents = 0
  for (const t of txs) {
    if (t.kind !== 'expense') continue
    const dia = emDias(t.date)
    if (dia >= inicio && dia <= fim) gastoCents += t.amount_cents
  }
  if (gastoCents <= 0) return null

  const gastoDiario = gastoCents / janelaDias
  return {
    janelaDias,
    gastoDiarioCents: Math.round(gastoDiario),
    dias: saldoCents <= 0 ? 0 : Math.floor(saldoCents / gastoDiario),
  }
}

export type Liquido = {
  /** Soma dos saldos das contas correntes. */
  seuCents: number
  /** Soma do em aberto declarado pelos cartões. */
  deveCents: number
  liquidoCents: number
  /** Bancos de cartões que só declaram parcelas futuras e ficaram de fora. */
  semAberto: string[]
}

/** Líquido de curto prazo: o que está nas contas menos o que os cartões já
 *  cobram no ciclo em aberto. Parcelas futuras não entram — não vencem agora.
 *  Sem saldo, ou sem nenhum em aberto declarado, cala: a conta seria só o
 *  saldo, repetido. */
export function liquidoCurtoPrazo(saldos: SaldoConta[], abertos: FaturaAberta[]): Liquido | null {
  const comAberto = abertos.filter((a) => a.abertoCents != null)
  if (saldos.length === 0 || comAberto.length === 0) return null
  const seuCents = saldos.reduce((total, s) => total + s.balanceCents, 0)
  const deveCents = comAberto.reduce((total, a) => total + a.abertoCents!, 0)
  return {
    seuCents,
    deveCents,
    liquidoCents: seuCents - deveCents,
    semAberto: abertos.filter((a) => a.abertoCents == null).map((a) => a.bank),
  }
}
