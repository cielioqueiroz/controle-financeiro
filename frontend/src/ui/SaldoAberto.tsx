import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'
import { formatBRL } from '../domain/normalize/money'
import { mesAbrev } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'

/** "2026-07-20" → "20/jul" (mês na locale ativa). Constrói a data local para
 *  não escorregar de fuso (a data já é local, da fatura). */
function dataCurta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}/${mesAbrev(new Date(y, (m ?? 1) - 1, d))}`
}

type Props = {
  bank: string
  /** Saldo em aberto declarado. `null` em banco que não declara. */
  abertoCents: number | null
  /** Total comprometido em parcelas futuras, declarado. */
  futurasCents: number | null
  proximoFechamento: string | null
}

/** Card compacto do que a fatura declara olhando para a FRENTE.
 *
 *  Mostra o número que o banco de fato dá, com o nome certo — e os dois nomes
 *  não são sinônimos: **em aberto** é o que já foi gasto no ciclo que ainda
 *  não fechou (Nubank declara); **próximas faturas** é o que já está comprado
 *  e ainda vai ser cobrado (Bradesco declara). Chamar os dois de "em aberto"
 *  poria lado a lado, com o mesmo rótulo, dois números que respondem a
 *  perguntas diferentes.
 *
 *  Irmão de `SaldoConta` (saldo do extrato) e mora na mesma grade. Banco fora
 *  do catálogo cai no tema "desconhecido" sem quebrar. */
export function SaldoAberto({ bank, abertoCents, futurasCents, proximoFechamento }: Props) {
  const tema = BANCOS[bank as Bank] ?? BANCOS.desconhecido
  const { t } = useT()

  // Em aberto vence quando existe: é o número mais próximo do "quanto já
  // devo agora". Só na falta dele o card fala das parcelas futuras.
  const emAberto = abertoCents != null
  const valor = emAberto ? abertoCents : futurasCents
  if (valor == null) return null

  return (
    <div className="rounded-xl border border-carvao-700 bg-carvao-900/80 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tema.accent }} aria-hidden />
        <span className="text-[10px] uppercase tracking-widest text-tinta-tenue">
          {t(emAberto ? 'aberto.rotulo' : 'aberto.proximas')}
        </span>
        <span className="truncate text-sm text-tinta">{tema.nome}</span>
      </div>
      <p className="tabular mt-1 text-lg text-tinta">{formatBRL(valor)}</p>
      {proximoFechamento && (
        <p className="text-[11px] text-tinta-tenue">
          {t('aberto.fecha', { data: dataCurta(proximoFechamento) })}
        </p>
      )}
    </div>
  )
}
