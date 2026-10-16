import type { ParseResult } from '../domain/parsers/types'
import { compararGabaritos, validar } from '../domain/validate/checksum'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'
import { CarimboConferencia } from './CarimboConferencia'

export function ConferenciaDocumento({ result }: { result: ParseResult }) {
  const dinheiro = useDinheiro()
  const { t } = useT()
  const conf = validar(result)
  const comparacoes = compararGabaritos(result)
  const rotulos = {
    entradas: 'conferencia.entradas',
    saidas: 'conferencia.saidas',
    'variacao-saldo': 'conferencia.variacaoSaldo',
    'total-fatura': 'conferencia.totalFatura',
  } as const

  return (
    <section className="px-5 py-6 sm:px-8" aria-label={t('conferencia.titulo')}>
      <div className="flex flex-wrap items-center gap-5">
        <CarimboConferencia conf={conf} data={result.period?.end} />
        <div>
          <h2 className="font-display text-lg text-tinta">
            {t(conf.status === 'confere' ? 'import.confereTitulo'
              : conf.status === 'diverge' ? 'import.naoFechouTitulo' : 'import.semGabaritoTitulo')}
          </h2>
          <p className="mt-1 text-xs text-tinta-tenue">{t('docs.nLancamentos', { n: conf.contagem })}</p>
        </div>
      </div>
      <p className="mt-5 text-sm leading-relaxed text-tinta-fraca">
        {t(conf.status === 'confere' ? 'conferencia.confereAjuda'
          : conf.status === 'diverge' ? 'conferencia.divergeAjuda' : 'conferencia.semGabaritoAjuda')}
      </p>
      {comparacoes.length > 0 && (
        <ul className="mt-4 space-y-3">
          {comparacoes.map((c) => (
            <li key={c.criterio} className="rounded-lg border border-carvao-700 p-4">
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
              {c.criterio === 'variacao-saldo' && (
                <p className="mt-3 text-xs text-tinta-tenue">{t('conferencia.saldoAjuda')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
