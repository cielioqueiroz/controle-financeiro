import { Link } from 'react-router-dom'

import type { MesFuturo } from '../domain/agrupar'
import { mesAbrev } from '../domain/normalize/data'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'

type Props = {
  meses: MesFuturo[]
  href: string
}

function rotuloMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  return `${mesAbrev(new Date(ano, mes - 1, 1))} ${ano}`
}

/** Resumo curto dos compromissos futuros no painel.
 *
 * A lista completa continua em Recorrências. Aqui entram só os próximos três
 * meses para dar contexto ao painel sem transformar a visão geral numa nova
 * tela de detalhes. O valor vem da mesma projeção pura usada pela página de
 * Recorrências; nada deste card é persistido ou inventado.
 */
export function ProximosCompromissos({ meses, href }: Props) {
  const dinheiro = useDinheiro()
  const { t } = useT()
  if (meses.length === 0) return null

  const totalCents = meses.reduce((total, mes) => total + mes.totalCents, 0)
  const parcelas = meses.reduce((total, mes) => total + mes.itens.length, 0)

  return (
    <section className="screen-only min-w-0 rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="rotulo">{t('proximos.titulo')}</p>
          <p className="mt-1 text-xs text-tinta-tenue">{t('proximos.descricao')}</p>
        </div>
        <div className="text-right">
          <p className="tabular text-xl text-tinta">{dinheiro(totalCents)}</p>
          <p className="text-[10px] text-tinta-tenue">{t('comp.somaVencer')}</p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-carvao-800 border-y border-carvao-800">
        {meses.slice(0, 3).map((mes) => (
          <li key={mes.competencia} className="flex items-center gap-3 py-3">
            <span className="min-w-[5.5rem] text-sm capitalize text-tinta">
              {rotuloMes(mes.competencia)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-tinta-fraca">
                {t(mes.itens.length === 1 ? 'comp.aVencerSing' : 'comp.aVencerPlur', {
                  n: mes.itens.length,
                })}
              </span>
              <span className="block text-[11px] text-tinta-tenue">{t('proximos.mesLabel')}</span>
            </span>
            <span className="tabular shrink-0 text-sm text-tinta">{dinheiro(mes.totalCents)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-tinta-tenue">
          {t('proximos.totalResumo', { meses: meses.length, parcelas })}
        </span>
        <Link
          to={href}
          className="text-sm font-medium text-tinta underline decoration-dotted underline-offset-4 transition-colors hover:text-marca"
        >
          {t('proximos.verTodos')} →
        </Link>
      </div>
    </section>
  )
}
