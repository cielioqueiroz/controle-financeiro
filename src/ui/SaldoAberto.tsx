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
  abertoCents: number
  proximoFechamento: string | null
}

/** Card compacto do saldo em aberto do cartão, declarado pela fatura.
 *  Irmão de `SaldoConta` (que mostra o saldo do extrato) e mora na mesma
 *  grade. Banco fora do catálogo cai no tema "desconhecido" sem quebrar. */
export function SaldoAberto({ bank, abertoCents, proximoFechamento }: Props) {
  const tema = BANCOS[bank as Bank] ?? BANCOS.desconhecido
  const { t } = useT()
  return (
    <div className="rounded-xl border border-carvao-700 bg-carvao-900/80 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tema.accent }} aria-hidden />
        <span className="text-[10px] uppercase tracking-widest text-tinta-tenue">
          {t('aberto.rotulo')}
        </span>
        <span className="truncate text-sm text-tinta">{tema.nome}</span>
      </div>
      <p className="tabular mt-1 text-lg text-tinta">{formatBRL(abertoCents)}</p>
      {proximoFechamento && (
        <p className="text-[11px] text-tinta-tenue">
          {t('aberto.fecha', { data: dataCurta(proximoFechamento) })}
        </p>
      )}
    </div>
  )
}
