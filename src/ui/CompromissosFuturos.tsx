import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { formatBRL } from '../normalize/money'
import type { MesFuturo } from '../persist/agrupar'

type Props = {
  meses: MesFuturo[]
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function rotuloMes(comp: string): string {
  const [y, m] = comp.split('-').map(Number)
  return `${MESES[m - 1]} ${y}`
}

/** Compromissos futuros: as parcelas que ainda vão cair, mês a mês. É
 *  projeção (não está no banco), então não infla os totais atuais nem
 *  duplica quando a próxima fatura chegar. */
export function CompromissosFuturos({ meses }: Props) {
  const [aberto, setAberto] = useState<string | null>(null)
  if (meses.length === 0) return null

  const totalCents = meses.reduce((a, m) => a + m.totalCents, 0)
  const qtd = meses.reduce((a, m) => a + m.itens.length, 0)

  return (
    <div className="screen-only overflow-hidden rounded-sm border border-carvao-700 bg-carvao-900">
      <div className="flex items-baseline justify-between border-b border-carvao-800 px-5 py-4">
        <div>
          <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">
            Compromissos futuros
          </p>
          <p className="text-xs text-tinta-fraca">
            {qtd} {qtd === 1 ? 'parcela a vencer' : 'parcelas a vencer'}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-xl text-tinta">{formatBRL(totalCents)}</p>
          <p className="text-[10px] text-tinta-tenue">soma a vencer</p>
        </div>
      </div>

      <ul className="divide-y divide-carvao-800">
        {meses.map((m) => {
          const open = aberto === m.competencia
          return (
            <li key={m.competencia}>
              <button
                onClick={() => setAberto(open ? null : m.competencia)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-carvao-850"
              >
                <span className="min-w-0 flex-1 truncate text-sm capitalize text-tinta">
                  {rotuloMes(m.competencia)}
                </span>
                <span className="tabular text-[11px] text-tinta-tenue">{m.itens.length}×</span>
                <span className="tabular text-sm text-tinta">{formatBRL(m.totalCents)}</span>
                <motion.span animate={{ rotate: open ? 90 : 0 }} className="text-tinta-tenue" aria-hidden>
                  ›
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden bg-carvao-950/40 px-5 py-1"
                  >
                    {m.itens.map((it, i) => (
                      <li key={i} className="flex items-center gap-3 py-1.5 text-sm">
                        <span className="tabular shrink-0 rounded-sm bg-carvao-800 px-1.5 py-0.5 text-[10px] text-tinta-fraca">
                          {it.parcela}/{it.total}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-tinta-fraca">{it.descricao}</span>
                        <span className="tabular shrink-0 text-tinta">{formatBRL(it.amountCents)}</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
