import { useT } from '../i18n/IdiomaProvider'
import { useDinheiro } from '../dados/DiscretoProvider'

type Props = {
  consumoCents: number
  dividasCents: number
}

/** O gasto real aberto em consumo e dívidas, sob o número dele.
 *
 *  Painel, Relatórios e Minha situação financeira mostram o mesmo total, e
 *  os três precisam dizer de que ele é feito: sem isso, a parcela de um
 *  empréstimo fala pelo período inteiro. Some sem dívida, porque aí o
 *  consumo é o próprio total e a linha só repetiria o número de cima. */
export function DetalheGasto({ consumoCents, dividasCents }: Props) {
  const { t } = useT()
  const dinheiro = useDinheiro()
  if (dividasCents === 0) return null
  return (
    <dl className="mt-2 space-y-0.5 text-[11px] text-tinta-tenue">
      <div className="flex justify-between gap-3">
        <dt>{t('dash.consumo')}</dt>
        <dd className="tabular">{dinheiro(consumoCents)}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt>{t('dash.dividas')}</dt>
        <dd className="tabular">{dinheiro(dividasCents)}</dd>
      </div>
    </dl>
  )
}
