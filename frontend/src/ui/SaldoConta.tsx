import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'

import { mesAbrev } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'
import { useDinheiro } from '../dados/DiscretoProvider'

/** "2026-06-30" → "30/jun" (mês na locale ativa). Constrói a data local para
 *  não escorregar de fuso (a data já é local, do extrato). */
function dataCurta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}/${mesAbrev(new Date(y, (m ?? 1) - 1, d))}`
}

type Props = { bank: string; balanceCents: number; date: string }

/** Card compacto do saldo de uma conta. Nome e cor vêm do catálogo canônico
 *  (`BANCOS`); banco fora do catálogo cai em "Documento" sem quebrar. */
export function SaldoConta({ bank, balanceCents, date }: Props) {
  const formatBRL = useDinheiro()
  const tema = BANCOS[bank as Bank] ?? BANCOS.desconhecido
  const negativo = balanceCents < 0
  const { t } = useT()
  return (
    <div className="rounded-xl border border-carvao-700 bg-carvao-900/80 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tema.accent }} aria-hidden />
        <span className="text-[10px] uppercase tracking-widest text-tinta-tenue">{t('saldo.rotulo')}</span>
        <span className="truncate text-sm text-tinta">{tema.nome}</span>
      </div>
      <p className={`tabular mt-1 text-lg ${negativo ? 'text-falha' : 'text-tinta'}`}>
        {formatBRL(balanceCents)}
      </p>
      <p className="text-[11px] text-tinta-tenue">{t('saldo.em', { data: dataCurta(date) })}</p>
    </div>
  )
}
