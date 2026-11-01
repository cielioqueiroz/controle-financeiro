import { useMemo } from 'react'

import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'
import type { TxAgrupavel } from '../domain/agrupar'
import type { FaturaAberta } from '../domain/aberto'
import { resumirSaldos, type SaldoConta } from '../domain/saldos'
import { diasDeFolego, liquidoCurtoPrazo } from '../domain/folego'
import { useT } from '../i18n/IdiomaProvider'
import { useDinheiro } from '../dados/DiscretoProvider'

type Props = {
  saldos: SaldoConta[]
  abertos: FaturaAberta[]
  /** O histórico inteiro, de todos os bancos: o ritmo de gasto não depende
   *  do filtro da tela. */
  txs: TxAgrupavel[]
}

/** O que o dinheiro de hoje cobre: o líquido de curto prazo e os dias de
 *  fôlego.
 *
 *  O fôlego parte do LÍQUIDO quando ele existe. A média de gasto inclui as
 *  compras no cartão, e o em aberto delas ainda vai sair das contas: partir do
 *  saldo cheio contaria esse dinheiro duas vezes, uma no saldo e outra no
 *  ritmo. */
export function Folego({ saldos, abertos, txs }: Props) {
  const { t } = useT()
  const dinheiro = useDinheiro()

  const liquido = useMemo(() => liquidoCurtoPrazo(saldos, abertos), [saldos, abertos])
  const folego = useMemo(() => {
    const { totalCents } = resumirSaldos(saldos)
    if (totalCents === null) return null
    const referencia = saldos.reduce((maior, s) => (s.date > maior ? s.date : maior), saldos[0].date)
    return diasDeFolego(liquido?.liquidoCents ?? totalCents, referencia, txs)
  }, [saldos, liquido, txs])

  if (!liquido && !folego) return null

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {liquido && (
        <div className="rounded-xl border border-carvao-700 bg-afundado px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-tinta-tenue">{t('folego.liquido')}</p>
          <p className={`tabular mt-1 text-lg ${liquido.liquidoCents < 0 ? 'text-falha' : 'text-tinta'}`}>
            {dinheiro(liquido.liquidoCents)}
          </p>
          <p className="text-[11px] text-tinta-tenue">
            {t('folego.liquidoDetalhe', { seu: dinheiro(liquido.seuCents), deve: dinheiro(liquido.deveCents) })}
          </p>
          {liquido.semAberto.length > 0 && (
            <p className="mt-1 text-[11px] text-tinta-tenue">
              {t('folego.semAberto', {
                bancos: liquido.semAberto.map((b) => (BANCOS[b as Bank] ?? BANCOS.desconhecido).nome).join(', '),
              })}
            </p>
          )}
        </div>
      )}
      {folego && (
        <div className="rounded-xl border border-carvao-700 bg-afundado px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-tinta-tenue">{t('folego.titulo')}</p>
          <p className={`tabular mt-1 text-lg ${folego.dias === 0 ? 'text-falha' : 'text-tinta'}`}>
            {t(folego.dias === 1 ? 'folego.dia1' : 'folego.dias', { n: folego.dias })}
          </p>
          <p className="text-[11px] text-tinta-tenue">
            {t('folego.detalhe', { valor: dinheiro(folego.gastoDiarioCents), n: folego.janelaDias })}{' '}
            {t(liquido ? 'folego.baseLiquido' : 'folego.baseSaldo')}
          </p>
        </div>
      )}
    </div>
  )
}
