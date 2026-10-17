import type { ComparacaoGabarito } from '../domain/validate/checksum'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'

const rotulos = {
  entradas: 'conferencia.entradas', saidas: 'conferencia.saidas',
  'variacao-saldo': 'conferencia.variacaoSaldo', 'total-fatura': 'conferencia.totalFatura',
} as const

export function ComparacoesConferencia({ comparacoes }: { comparacoes: ComparacaoGabarito[] }) {
  const dinheiro = useDinheiro()
  const { t } = useT()
  if (comparacoes.length === 0) return null
  return (
    <ul className="mt-4 space-y-3">
      {comparacoes.map((c) => (
        <li key={c.criterio} className="rounded-lg border border-borda p-4">
          <h3 className="text-sm font-medium text-tinta">{t(rotulos[c.criterio])}</h3>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3 sm:gap-4">
            <div className="flex flex-wrap justify-between gap-2 sm:block">
              <dt className="text-tinta-tenue">{t('conferencia.noDocumento')}</dt>
              <dd className="tabular text-tinta sm:mt-1">{dinheiro(c.gabaritoCents)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 sm:block">
              <dt className="text-tinta-tenue">{t('conferencia.lido')}</dt>
              <dd className="tabular text-tinta sm:mt-1">{dinheiro(c.extraidoCents)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 sm:block">
              <dt className="text-tinta-tenue">{t('conferencia.diferenca')}</dt>
              <dd className={`tabular sm:mt-1 ${c.diferencaCents === 0 ? 'text-tinta' : 'text-falha'}`}>
                {dinheiro(c.diferencaCents)}
              </dd>
            </div>
          </dl>
          {c.criterio === 'variacao-saldo' && <p className="mt-3 text-xs text-tinta-tenue">{t('conferencia.saldoAjuda')}</p>}
        </li>
      ))}
    </ul>
  )
}
