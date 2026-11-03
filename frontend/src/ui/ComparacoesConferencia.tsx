import type { ComparacaoGabarito } from '../domain/validate/checksum'
import type { LinhaSuspeita } from '../domain/validate/suspeitas'
import { dataLongaDe } from '../domain/normalize/data'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'

const rotulos = {
  entradas: 'conferencia.entradas', saidas: 'conferencia.saidas',
  'variacao-saldo': 'conferencia.variacaoSaldo', 'total-fatura': 'conferencia.totalFatura',
} as const

type Suspeitas = Partial<Record<ComparacaoGabarito['criterio'], LinhaSuspeita[]>>

/** `suspeitas` só existe na prévia, que tem as linhas lidas; o documento já
 *  salvo guarda os números da conferência, não as linhas que a explicam. */
export function ComparacoesConferencia({ comparacoes, suspeitas }: { comparacoes: ComparacaoGabarito[]; suspeitas?: Suspeitas }) {
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
          {(['igual', 'dobro'] as const).map((tipo) => {
            const linhas = suspeitas?.[c.criterio]?.filter((s) => s.tipo === tipo) ?? []
            if (linhas.length === 0) return null
            const chave = tipo === 'igual'
              ? linhas.length === 1 ? 'conferencia.suspeitaIgual1' : 'conferencia.suspeitaIgualN'
              : linhas.length === 1 ? 'conferencia.suspeitaDobro1' : 'conferencia.suspeitaDobroN'
            return (
              <div key={tipo} data-prova="linha-suspeita"
                className="mt-3 rounded-md border border-dashed border-carvao-600 bg-afundado p-3 text-xs">
                <p className="leading-relaxed text-tinta-fraca">{t(chave)}</p>
                <ul className="mt-2 space-y-1">
                  {linhas.map(({ transacao }, i) => (
                    <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="min-w-0 basis-40 flex-1 break-words text-tinta">
                        <span className="tabular text-tinta-tenue">{dataLongaDe(transacao.date)}</span>{' '}
                        {transacao.description}
                      </span>
                      <span className="tabular whitespace-nowrap text-tinta">{dinheiro(transacao.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </li>
      ))}
    </ul>
  )
}
