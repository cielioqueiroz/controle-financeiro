import type { ParseResult } from '../domain/parsers/types'
import { compararGabaritos, validar } from '../domain/validate/checksum'
import { useT } from '../i18n/IdiomaProvider'
import { CarimboConferencia } from './CarimboConferencia'
import { ComparacoesConferencia } from './ComparacoesConferencia'

export function ConferenciaDocumento({ result }: { result: ParseResult }) {
  const { t } = useT()
  const conf = validar(result)
  const comparacoes = compararGabaritos(result)

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
      <ComparacoesConferencia comparacoes={comparacoes} />
    </section>
  )
}
