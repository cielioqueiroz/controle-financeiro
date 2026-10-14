import { Link } from 'react-router-dom'
import type { PeriodoRelatorio } from '../domain/relatorios'
import type { TransacaoSalva } from '../aplicacao/consultas/historico'
import { mesAbrev } from '../domain/normalize/data'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'
import { Cartao } from './Cartao'

type Props = {
  atual: PeriodoRelatorio<TransacaoSalva>
  anterior: PeriodoRelatorio<TransacaoSalva>
  comparavel: boolean
  titulo?: string
}

function rotuloMes(competencia: string) {
  const [ano, mes] = competencia.split('-').map(Number)
  return `${mesAbrev(new Date(ano, mes - 1, 1))} ${ano}`
}

export function MesesRelatorio({ atual, anterior, comparavel, titulo }: Props) {
  const { t } = useT()
  const dinheiro = useDinheiro()
  return (
    <Cartao>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl text-tinta">{titulo ?? t('relatorios.mesesTitulo')}</h3>
          <p className="mt-2 text-sm text-tinta-fraca">{t(comparavel ? 'relatorios.comparacaoDisponivel' : 'relatorios.comparacaoBloqueada')}</p>
        </div>
        {!comparavel && <Link to="/importar" className="acao-painel">{t('dash.importar')}</Link>}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {([{ titulo: 'relatorios.intervaloAtual', periodo: atual }, { titulo: 'relatorios.intervaloAnterior', periodo: anterior }] as const).map(({ titulo, periodo }) => (
          <div key={titulo} className="min-w-0 rounded-lg bg-afundado p-4">
            <p className="rotulo">{t(titulo)}</p>
            <p className="mt-1 text-sm text-tinta">{rotuloMes(periodo.inicio)} — {rotuloMes(periodo.fim)}</p>
            <p className="mt-2 text-xs text-tinta-fraca">{t('relatorios.mesesContagem', { n: periodo.mesesComDados, total: periodo.meses.length })}</p>
          </div>
        ))}
      </div>
      <details className="mt-4">
        <summary className="min-h-11 py-3 text-sm font-medium text-marca">{t('relatorios.verMeses')}</summary>
        <div className="grid gap-6 sm:grid-cols-2">
          {([{ titulo: 'relatorios.intervaloAtual', periodo: atual }, { titulo: 'relatorios.intervaloAnterior', periodo: anterior }] as const).map(({ titulo, periodo }) => (
            <div key={titulo} className="min-w-0">
            <h4 className="rotulo mb-2">{t(titulo)}</h4>
            <ul aria-label={t(titulo)} className="divide-y divide-borda">
              {periodo.meses.map((mes) => (
                <li key={mes.competencia} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <span className="text-tinta">{rotuloMes(mes.competencia)}</span>
                    <p className="mt-1 text-xs text-tinta-fraca">{mes.resumo
                      ? t('relatorios.documentosMes', { n: new Set(mes.transacoes.map((tx) => tx.document_id)).size })
                      : t('relatorios.mesSemDados')}</p>
                  </div>
                  <span className="tabular text-xs text-tinta">{mes.resumo
                    ? t('relatorios.gastoMes', { valor: dinheiro(mes.resumo.gastoCents) }) : '—'}</span>
                </li>
              ))}
            </ul>
            </div>
          ))}
        </div>
      </details>
      <p className="mt-3 text-xs leading-relaxed text-tinta-fraca">{t('relatorios.mesesLimite')}</p>
    </Cartao>
  )
}
