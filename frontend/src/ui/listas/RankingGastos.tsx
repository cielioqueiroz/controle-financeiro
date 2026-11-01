import { useState } from 'react'
import { useT } from '../../i18n/IdiomaProvider'
import { MaioresSaidas } from './MaioresSaidas'
import { TopEstabelecimentos } from './TopEstabelecimentos'
import type { TransacaoSalva } from '../../aplicacao/consultas/historico'
import type { GrupoEstabelecimento } from '../../domain/agrupar'

type Visao = 'estabelecimento' | 'compra'

type Props = {
  maiores: TransacaoSalva[]
  estabelecimentos: GrupoEstabelecimento[]
  onEditar: (t: TransacaoSalva) => void
  onAbrirEstabelecimento: (merchant: string) => void
}

/** Um ranking só, com duas perguntas.
 *
 *  As duas listas lado a lado repetiam quase sempre o mesmo primeiro lugar —
 *  a compra grande também é o lugar que mais levou dinheiro — e dividiam a
 *  atenção ao meio para dizer a mesma coisa duas vezes (U6 da auditoria de
 *  30/10). A alternância mantém as duas perguntas e mostra uma de cada vez.
 *
 *  Por estabelecimento é o padrão: soma as compras repetidas, que é o gasto
 *  que nenhuma lista de maior compra mostra. A escolha não vai para a URL,
 *  porque não muda o recorte, só o jeito de olhar para ele. */
export function RankingGastos({ maiores, estabelecimentos, onEditar, onAbrirEstabelecimento }: Props) {
  const { t } = useT()
  const [visao, setVisao] = useState<Visao>('estabelecimento')
  if (maiores.length === 0 && estabelecimentos.length === 0) return null

  const opcoes: Array<{ id: Visao; rotulo: string }> = [
    { id: 'estabelecimento', rotulo: t('ranking.porEstabelecimento') },
    { id: 'compra', rotulo: t('ranking.porCompra') },
  ]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="rotulo">{t('ranking.titulo')}</p>
        <div role="group" aria-label={t('ranking.titulo')} className="flex rounded-full border border-carvao-700 p-0.5">
          {opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={visao === o.id}
              onClick={() => setVisao(o.id)}
              className={`min-h-9 rounded-full px-3 text-xs transition-colors ${
                visao === o.id ? 'bg-carvao-800 text-tinta' : 'text-tinta-fraca hover:text-tinta'
              }`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-tinta-fraca">
        {t(visao === 'estabelecimento' ? 'ranking.descEstabelecimento' : 'ranking.descCompra')}
      </p>
      {visao === 'estabelecimento'
        ? <TopEstabelecimentos itens={estabelecimentos} onAbrir={onAbrirEstabelecimento} semTitulo />
        : <MaioresSaidas itens={maiores} onEditar={onEditar} semTitulo />}
    </div>
  )
}
