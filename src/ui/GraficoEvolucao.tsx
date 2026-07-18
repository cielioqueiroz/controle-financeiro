import { motion } from 'motion/react'
import { formatBRL } from '../normalize/money'
import type { PontoMes } from '../persist/agrupar'

type Props = {
  serie: PontoMes[]
  /** Competência ativa (YYYY-MM) — barra destacada. */
  ativo: string
  onSelecionar: (competencia: string) => void
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function rotulo(comp: string): string {
  const [y, m] = comp.split('-').map(Number)
  return m === 1 ? `${MESES[0]}/${String(y).slice(2)}` : MESES[m - 1]
}

/** Evolução do gasto mês a mês (por competência). Barras clicáveis levam
 *  ao mês. Só aparece com 2+ meses — com um mês só não há evolução. */
export function GraficoEvolucao({ serie, ativo, onSelecionar }: Props) {
  if (serie.length < 2) return null
  const ultimos = serie.slice(-12)
  const max = Math.max(...ultimos.map((p) => p.gastoCents), 1)

  return (
    <div className="rounded-sm border border-carvao-700 bg-carvao-900 px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">
          Evolução do gasto
        </p>
        <p className="text-[11px] text-tinta-tenue">por fatura · clique num mês</p>
      </div>
      <div className="flex h-28 items-end gap-1.5">
        {ultimos.map((p) => {
          const ativa = p.competencia === ativo
          const alt = Math.max((p.gastoCents / max) * 100, 2)
          return (
            <button
              key={p.competencia}
              onClick={() => onSelecionar(p.competencia)}
              title={`${rotulo(p.competencia)}: ${formatBRL(p.gastoCents)}`}
              className="group flex flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="tabular text-[9px] text-tinta-tenue opacity-0 transition-opacity group-hover:opacity-100">
                {formatBRL(p.gastoCents).replace('R$', '').trim()}
              </span>
              <motion.span
                className={`w-full rounded-t-sm transition-colors ${
                  ativa ? 'bg-tinta' : 'bg-carvao-700 group-hover:bg-carvao-600'
                }`}
                initial={{ height: 0 }}
                animate={{ height: `${alt}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
              <span
                className={`tabular text-[10px] ${ativa ? 'text-tinta' : 'text-tinta-tenue'}`}
              >
                {rotulo(p.competencia)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
