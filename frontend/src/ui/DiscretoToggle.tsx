import { motion } from 'motion/react'
import { useDiscreto } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'

/** Interruptor do modo discreto, irmão do ThemeToggle. */
export function DiscretoToggle() {
  const { t } = useT()
  const { discreto, alternar } = useDiscreto()

  return (
    <button
      onClick={alternar}
      aria-label={t(discreto ? 'discreto.mostrar' : 'discreto.esconder')}
      title={t(discreto ? 'discreto.mostrar' : 'discreto.esconder')}
      aria-pressed={discreto}
      className="grid h-11 w-11 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
    >
      <motion.span
        key={String(discreto)}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {discreto ? <OlhoFechado /> : <Olho />}
      </motion.span>
    </button>
  )
}

function Olho() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  )
}

function OlhoFechado() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12s3.6-6 10-6c1.7 0 3.2.4 4.5 1M22 12s-3.6 6-10 6c-1.7 0-3.2-.4-4.5-1M4 20L20 4"
      />
    </svg>
  )
}
