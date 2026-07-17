import type { CategoriaResumo } from '../insights'
import { formatBRL } from '../normalize/money'

/** Donut de categorias em SVG puro — sem biblioteca de gráfico. Cada
 *  fatia usa a cor da categoria. */
export function GraficoCategorias({
  categorias,
  totalCents,
}: {
  categorias: CategoriaResumo[]
  totalCents: number
}) {
  if (totalCents === 0 || categorias.length === 0) return null

  const R = 52
  const C = 2 * Math.PI * R
  let acumulado = 0

  const topo = categorias.slice(0, 8)

  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg viewBox="0 0 130 130" className="h-40 w-40 shrink-0 -rotate-90">
        {topo.map((c, i) => {
          const fracao = c.totalCents / totalCents
          const dash = fracao * C
          const offset = -acumulado * C
          acumulado += fracao
          return (
            <circle
              key={i}
              cx="65"
              cy="65"
              r={R}
              fill="none"
              stroke={c.cat.cor}
              strokeWidth="16"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
              className="surgir"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          )
        })}
        <text
          x="65"
          y="60"
          transform="rotate(90 65 65)"
          textAnchor="middle"
          className="tabular"
          fill="var(--color-tinta)"
          fontSize="9"
        >
          gasto real
        </text>
        <text
          x="65"
          y="74"
          transform="rotate(90 65 65)"
          textAnchor="middle"
          className="tabular"
          fill="var(--color-tinta)"
          fontSize="11"
          fontWeight="600"
        >
          {formatBRL(totalCents).replace('R$', '').trim()}
        </text>
      </svg>

      <ul className="flex-1 space-y-1.5">
        {topo.map((c, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span className="text-base">{c.cat.icone}</span>
            <span className="flex-1 text-tinta-fraca">{c.cat.nome}</span>
            <span className="tabular text-tinta">{formatBRL(c.totalCents)}</span>
            <span
              className="tabular w-12 text-right text-xs text-tinta-tenue"
            >
              {Math.round((c.totalCents / totalCents) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
