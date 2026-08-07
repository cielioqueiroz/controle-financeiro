import { motion, useReducedMotion } from 'motion/react'
import type { CategoriaResumo } from '../domain/insights'
import { formatBRL } from '../domain/normalize/money'
import { nomeCategoria } from '../domain/categorize/categorias'
import { useT } from '../i18n/IdiomaProvider'

/** Donut de categorias em SVG puro — sem biblioteca de gráfico. Cada fatia
 *  usa a cor da categoria e se DESENHA ao entrar (o dasharray cresce de 0
 *  ao arco final), varrendo o círculo em sequência. Movimento sutil, no
 *  espírito "premium": diz "estou calculando" sem saltar. Respeita
 *  prefers-reduced-motion. */
export function GraficoCategorias({
  categorias,
  totalCents,
}: {
  categorias: CategoriaResumo[]
  totalCents: number
}) {
  const semMovimento = useReducedMotion()
  const { t } = useT()
  if (totalCents === 0 || categorias.length === 0) return null

  const R = 52
  const C = 2 * Math.PI * R
  let acumulado = 0

  const topo = categorias.slice(0, 8)
  // Curva de saída "expo" — arranca rápido e assenta devagar, o que dá a
  // sensação de peso/qualidade em vez de linear.
  const suave = [0.22, 1, 0.36, 1] as const

  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg viewBox="0 0 130 130" className="h-40 w-40 shrink-0 -rotate-90">
        {topo.map((c, i) => {
          const fracao = c.totalCents / totalCents
          const dash = fracao * C
          const offset = -acumulado * C
          acumulado += fracao
          return (
            <motion.circle
              key={i}
              cx="65"
              cy="65"
              r={R}
              fill="none"
              stroke={c.cat.cor}
              strokeWidth="16"
              strokeDashoffset={offset}
              initial={semMovimento ? false : { strokeDasharray: `0 ${C}` }}
              animate={{ strokeDasharray: `${dash} ${C - dash}` }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: suave }}
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
          {t('dash.gastoReal')}
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
          <motion.li
            key={i}
            className="flex items-center gap-3 text-sm"
            initial={semMovimento ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.25 + i * 0.05, ease: suave }}
          >
            <span className="text-base">{c.cat.icone}</span>
            <span className="flex-1 text-tinta-fraca">{nomeCategoria(c.cat)}</span>
            <span className="tabular text-tinta">{formatBRL(c.totalCents)}</span>
            <span className="tabular w-12 text-right text-xs text-tinta-tenue">
              {Math.round((c.totalCents / totalCents) * 100)}%
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
