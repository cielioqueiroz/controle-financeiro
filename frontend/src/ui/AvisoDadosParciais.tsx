import { useT } from '../i18n/IdiomaProvider'
import type { Dicionario } from '../i18n/dicionarios/pt'

type Props = {
  falhas: Partial<Record<'categorias' | 'saldos', keyof Dicionario>>
  onTentar: () => void
}

export function AvisoDadosParciais({ falhas: errosParciais, onTentar }: Props) {
  const { t } = useT()
  const falhas = Object.entries(errosParciais)
  if (falhas.length === 0) return null

  return (
    <aside className="cartao mt-6 p-4" aria-label={t('dados.parciaisTitulo')}>
      <div role="status">
        <h2 className="text-sm font-medium text-tinta">{t('dados.parciaisTitulo')}</h2>
        <ul className="mt-2 space-y-2 text-sm text-tinta-fraca">
          {falhas.map(([parte, chave]) => {
            const rotulo = parte === 'categorias' ? 'dados.categoriasIndisponiveis' : 'dados.saldosIndisponiveis'
            return <li key={parte}>{t(rotulo)}{chave !== rotulo && <> {t(chave)}</>}</li>
          })}
        </ul>
      </div>
      <button type="button" className="acao-painel mt-3" onClick={onTentar}>
        {t('estado.tentarDeNovo')}
      </button>
    </aside>
  )
}
