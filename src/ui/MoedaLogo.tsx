import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/** Raio do anel externo — o que se abre em fatias. */
const R_ANEL = 23
const CIRCUNFERENCIA = 2 * Math.PI * R_ANEL
const FATIAS = 4
const VAO = 9

/** Fechado, os quatro arcos se tocam e leem como um anel contínuo; aberto,
 *  cada um encolhe e abre a fatia — o donut de categorias do dashboard. */
const ANEL_FECHADO = `${CIRCUNFERENCIA / FATIAS} 0`
const ANEL_ABERTO = `${CIRCUNFERENCIA / FATIAS - VAO} ${VAO}`

/** Moeda R$ do logo. Três camadas de movimento: a entrada (que quem monta
 *  controla, com o giro em mola), um brilho que varre a face em repouso, e
 *  o anel externo que periodicamente se abre em fatias de donut.
 *
 *  Respeita `prefers-reduced-motion`: quem pede menos movimento recebe a
 *  moeda parada, com o anel fechado. */
export function MoedaLogo() {
  const semMovimento = useReducedMotion()
  // Dois logos na mesma página colidiriam se os ids fossem fixos, e o
  // segundo herdaria o clip do primeiro.
  //
  // Os dois-pontos precisam sair: o useId devolve algo como ":r0:", e
  // dois-pontos dentro de url(#...) quebram a referência — o clip e o
  // gradiente simplesmente não se aplicam, sem erro nenhum no console.
  const id = useId().replace(/:/g, '')
  const idFace = `moeda-face-${id}`
  const idBrilho = `moeda-brilho-${id}`

  return (
    <svg width="56" height="56" viewBox="0 0 64 64" className="drop-shadow-lg" aria-hidden>
      <defs>
        <clipPath id={idFace}>
          <circle cx="32" cy="32" r={R_ANEL} />
        </clipPath>
        <linearGradient id={idBrilho} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-moeda-brilho)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--color-moeda-brilho)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--color-moeda-brilho)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <circle cx="32" cy="32" r={R_ANEL} fill="var(--color-marca)" />

      {/* A inclinação fica num <g> por fora, e não como atributo do próprio
          rect: o motion anima `x` via CSS transform, que sobrescreve o
          atributo transform do SVG — o skew seria descartado em silêncio e
          o brilho viraria uma barra reta. */}
      <g clipPath={`url(#${idFace})`}>
        <g transform="skewX(-18)">
          <motion.rect
            x="0"
            y="-4"
            width="16"
            height="72"
            fill={`url(#${idBrilho})`}
            initial={{ x: -30 }}
            animate={semMovimento ? { x: -30 } : { x: [-30, 80] }}
            transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 4.2, ease: 'easeInOut' }}
          />
        </g>
      </g>

      <motion.circle
        cx="32"
        cy="32"
        r={R_ANEL}
        fill="none"
        stroke="var(--color-moeda-traco)"
        strokeWidth="2.5"
        opacity="0.55"
        style={{ transformOrigin: '32px 32px' }}
        initial={{ strokeDasharray: ANEL_FECHADO, rotate: 0 }}
        animate={
          semMovimento
            ? { strokeDasharray: ANEL_FECHADO, rotate: 0 }
            : { strokeDasharray: [ANEL_FECHADO, ANEL_ABERTO, ANEL_FECHADO], rotate: [0, 90] }
        }
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 3.4, ease: 'easeInOut' }}
      />

      <circle
        cx="32"
        cy="32"
        r="18.5"
        fill="none"
        stroke="var(--color-moeda-traco)"
        strokeWidth="1.6"
        opacity="0.4"
      />

      <text
        x="32"
        y="41.5"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="800"
        fontSize="24"
        fill="var(--color-moeda-traco)"
      >
        R$
      </text>
    </svg>
  )
}
