import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { porCategoriaDetalhado, porDia } from '../persist/agrupar'
import type { TransacaoSalva } from '../persist/puxar'
import { useRecorte } from '../dados/useRecorte'
import { useDados } from '../dados/DadosProvider'
import { BarraFiltros } from '../ui/BarraFiltros'
import { ListaPorCategoria } from '../ui/ListaPorCategoria'
import { ListaPorDia } from '../ui/ListaPorDia'
import { ListaTodos } from '../ui/ListaTodos'
import { EditarCompra } from '../ui/EditarCompra'
import { ErroCarregar } from '../ui/ErroCarregar'
import { useT } from '../i18n/IdiomaProvider'

type Vista = 'categoria' | 'dia' | 'todos'

type Props = {
  onAprendeu?: () => void
}

/** As três vistas do histórico, que antes dividiam a tela do painel com os
 *  gráficos. Aqui elas têm a largura inteira — que é o que uma tabela de
 *  lançamentos precisa e o que a coluna estreita do painel não dava. */
export function Lancamentos({ onAprendeu }: Props) {
  const { t } = useT()
  const { txs, resumo, carregando, erro, vazio, filtros, setFiltros } = useRecorte()
  // Chegar com `cat` ou `q` na URL é chegar procurando: veio do clique numa
  // fatia do donut, ou de um link salvo. A vista "por categoria" ignoraria os
  // dois e mostraria o agrupamento inteiro, como se o clique não tivesse
  // acontecido — então quem chega assim abre direto na vista que filtra.
  const [vista, setVista] = useState<Vista>(
    filtros.categoria || filtros.busca ? 'todos' : 'categoria',
  )
  const [editando, setEditando] = useState<TransacaoSalva | null>(null)
  const { recarregar, aplicarEdicao } = useDados()

  const grupos = useMemo(() => porCategoriaDetalhado(txs), [txs])
  const dias = useMemo(() => porDia(txs), [txs])

  return (
    <div className="mt-6">
      <BarraFiltros />

      <div className="overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900">
        {carregando ? (
          <p className="px-6 py-16 text-center text-sm text-tinta-fraca">{t('docs.carregando')}</p>
        ) : erro ? (
          <ErroCarregar mensagem={t(erro)} onTentar={recarregar} />
        ) : vazio ? (
          <p className="px-6 py-16 text-center text-sm text-tinta-fraca">
            {t('estado.vazioCorpo')}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-carvao-800 px-5 py-3">
              <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">
                {t('dash.lancamentos')}
              </p>
              <div className="flex gap-0.5 rounded-full border border-carvao-700 bg-carvao-900 p-0.5">
                <AbaVista ativa={vista === 'categoria'} onClick={() => setVista('categoria')}>
                  {t('dash.porCategoria')}
                </AbaVista>
                <AbaVista ativa={vista === 'dia'} onClick={() => setVista('dia')}>
                  {t('dash.porDia')}
                </AbaVista>
                <AbaVista ativa={vista === 'todos'} onClick={() => setVista('todos')}>
                  {t('dash.todos')}
                </AbaVista>
              </div>
            </div>

            {vista === 'categoria' ? (
              <ListaPorCategoria
                grupos={grupos}
                totalCents={resumo.gastoCents}
                onEditar={setEditando}
              />
            ) : vista === 'dia' ? (
              <ListaPorDia grupos={dias} onEditar={setEditando} />
            ) : (
              <ListaTodos
                txs={txs}
                onEditar={setEditando}
                termo={filtros.busca}
                cat={filtros.categoria}
                onTermo={(busca) => setFiltros({ busca })}
                onCat={(categoria) => setFiltros({ categoria })}
              />
            )}
          </>
        )}
      </div>

      {/* Editar continua modal: é ação pontual sobre uma linha da lista, e
          virar página perderia o lugar onde a pessoa estava. */}
      {editando && (
        <EditarCompra
          tx={editando}
          onFechar={() => setEditando(null)}
          onSalvo={aplicarEdicao}
          onAprendeu={onAprendeu}
        />
      )}
    </div>
  )
}

function AbaVista({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-full px-3 py-1 text-xs transition-colors ${
        ativa ? 'text-carvao-950' : 'text-tinta-fraca hover:text-tinta'
      }`}
    >
      {ativa && (
        <motion.span
          layoutId="pilula-vista"
          className="absolute inset-0 rounded-full bg-tinta"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  )
}
