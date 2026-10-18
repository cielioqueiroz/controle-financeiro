import { Link, useSearchParams } from 'react-router-dom'
import { mesAbrev } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'

export function TransacoesDoMes({ competencia }: { competencia: string }) {
  const [search] = useSearchParams()
  const { t } = useT()
  const params = new URLSearchParams(search)
  params.set('ref', competencia)
  params.set('p', 'mes')
  params.delete('cat')
  params.delete('q')
  params.delete('documento')
  params.set('vista', 'todos')
  const [ano, mes] = competencia.split('-').map(Number)
  return <div className="mt-4 flex justify-end border-t border-borda pt-4">
    <Link className="acao-painel" to={`/lancamentos?${params.toString()}`}>
      {t('grafico.verTransacoesMes', { mes: `${mesAbrev(new Date(ano, mes - 1, 1))} ${ano}` })}
    </Link>
  </div>
}
