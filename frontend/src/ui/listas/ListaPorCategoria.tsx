import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { LinhaTransacao } from './LinhaTransacao'

import { nomeCategoria } from '../../domain/categorize/categorias'
import type { GrupoCategoria } from '../../persist/agrupar'
import type { TransacaoSalva } from '../../persist/puxar'
import { useDinheiro } from '../../dados/DiscretoProvider'

type Props = {
  grupos: GrupoCategoria<TransacaoSalva>[]
  totalCents: number
  onEditar: (t: TransacaoSalva) => void
}

/** Gastos por categoria com drill-down: cada categoria é uma seção que
 *  abre a tabela das compras daquela categoria (data, estabelecimento,
 *  valor). Abre a maior categoria por padrão. */
export function ListaPorCategoria({ grupos, totalCents, onEditar }: Props) {
  const formatBRL = useDinheiro()
  const [abertas, setAbertas] = useState<Set<string>>(() =>
    grupos[0] ? new Set([grupos[0].slug]) : new Set(),
  )

  function alternar(slug: string) {
    setAbertas((s) => {
      const n = new Set(s)
      if (n.has(slug)) n.delete(slug)
      else n.add(slug)
      return n
    })
  }

  if (grupos.length === 0) {
    return <p className="px-6 py-10 text-center text-sm text-tinta-fraca">Sem despesas neste período.</p>
  }

  return (
    <ul className="divide-y divide-carvao-800">
      {grupos.map((g, i) => {
        const aberta = abertas.has(g.slug)
        const pct = totalCents > 0 ? (g.totalCents / totalCents) * 100 : 0
        return (
          <motion.li
            key={g.slug}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              onClick={() => alternar(g.slug)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-carvao-850"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-carvao-850 text-lg">
                {g.cat.icone}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-tinta">{nomeCategoria(g.cat)}</span>
                  <span className="tabular shrink-0 text-sm text-tinta">{formatBRL(g.totalCents)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-carvao-800">
                    <motion.span
                      className="block h-full rounded-full"
                      style={{ background: g.cat.cor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                    />
                  </span>
                  <span className="tabular w-16 shrink-0 text-right text-[11px] text-tinta-tenue">
                    {g.contagem} · {Math.round(pct)}%
                  </span>
                </div>
              </div>
              <motion.span
                animate={{ rotate: aberta ? 90 : 0 }}
                className="shrink-0 text-tinta-tenue"
                aria-hidden
              >
                ›
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {aberta && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <ul className="bg-carvao-950/30 py-1">
                    {g.itens.map((t) => (
                      <LinhaTransacao key={t.id} t={t} onEditar={onEditar} semIcone />
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.li>
        )
      })}
    </ul>
  )
}
