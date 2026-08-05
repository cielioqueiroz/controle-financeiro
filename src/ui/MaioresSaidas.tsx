import { motion } from 'motion/react'
import { formatBRL } from '../domain/normalize/money'
import { categoria, nomeCategoria } from '../domain/categorize/categorias'
import { useT } from '../i18n/IdiomaProvider'
import type { TransacaoSalva } from '../persist/puxar'

type Props = {
  /** Já vem cortado e ordenado por `maioresSaidas`. */
  itens: TransacaoSalva[]
  onEditar: (t: TransacaoSalva) => void
}

/** Ranking das maiores despesas do período. Mora no aside, junto do donut e
 *  de CompromissosFuturos — a coluna do "resumo visual". Cada linha é
 *  clicável e abre o editor, como as demais listas do painel. */
export function MaioresSaidas({ itens, onEditar }: Props) {
  const { t } = useT()
  if (itens.length === 0) return null

  return (
    <div>
      <p className="tabular mb-2 text-[10px] uppercase tracking-widest text-tinta-tenue">
        {t('maiores.titulo')}
      </p>
      <ul className="space-y-0.5">
        {itens.map((item, i) => {
          const cat = categoria(item.category_slug ?? 'outros')
          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.3 }}
            >
              <button
                onClick={() => onEditar(item)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-carvao-850"
              >
                <span className="tabular w-3 shrink-0 text-[11px] text-tinta-tenue">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-tinta">
                    {item.label ?? item.description}
                  </span>
                  <span
                    className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{ background: `${cat.cor}22`, color: cat.cor }}
                  >
                    {nomeCategoria(cat)}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm text-tinta">
                  {formatBRL(item.amount_cents)}
                </span>
              </button>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
