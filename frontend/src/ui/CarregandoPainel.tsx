import { useT } from '../i18n/IdiomaProvider'
import { Cartao } from './Cartao'

export function CarregandoPainel() {
  const { t } = useT()
  return (
    <div role="status" aria-label={t('estado.carregando')}>
      <span className="sr-only">{t('estado.carregando')}</span>
      <div aria-hidden="true" className="pilha-paineis motion-safe:animate-pulse">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Cartao as="div" key={i}>
              <div className="h-3 w-24 rounded bg-afundado" />
              <div className="mt-4 h-8 w-3/4 rounded bg-afundado" />
              <div className="mt-3 h-3 w-1/2 rounded bg-afundado" />
            </Cartao>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Cartao as="div" key={i}>
              <div className="h-3 w-32 rounded bg-afundado" />
              <div className="mt-6 h-48 rounded-lg bg-afundado" />
            </Cartao>
          ))}
        </div>
      </div>
    </div>
  )
}
