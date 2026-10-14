import { useT } from '../i18n/IdiomaProvider'
import { Cartao } from './Cartao'

type Props = {
  mensagem: string
  onTentar: () => void
}

/** Estado de erro do dashboard, no mesmo capricho do estado "Vazio": ícone,
 *  mensagem e uma saída — "Tentar de novo" — em vez de um texto vermelho
 *  solto. Um erro de rede não deveria ser um beco sem saída. */
export function ErroCarregar({ mensagem, onTentar }: Props) {
  const { t } = useT()
  return (
    <Cartao className="text-center">
      <div className="mx-auto max-w-md py-8 sm:py-12">
        <div
          className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full border border-carvao-700 text-falha"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5M12 16h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h2 className="font-display text-2xl text-tinta">{t('estado.erroTitulo')}</h2>
        <p role="alert" className="mt-3 text-sm leading-relaxed text-tinta-fraca">{mensagem}</p>
        <button type="button" onClick={onTentar} className="acao-painel mt-6">
          {t('estado.tentarDeNovo')}
        </button>
      </div>
    </Cartao>
  )
}
