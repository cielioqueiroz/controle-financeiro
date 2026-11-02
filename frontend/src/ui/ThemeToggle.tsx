import { motion } from 'motion/react'
import { useT } from '../i18n/IdiomaProvider'
import { aplicarTema, useTema } from '../lib/tema'

/** Alterna claro/escuro. A regra do tema inicial e a escrita moram em
 *  `lib/tema.ts`; o perfil também troca o tema, e este botão acompanha
 *  porque lê o `data-theme` da página, não um estado próprio. */
export function ThemeToggle() {
  const { t } = useT()
  const tema = useTema()
  const claro = tema === 'light'

  return (
    <button
      onClick={() => aplicarTema(claro ? 'dark' : 'light')}
      aria-label={t(claro ? 'tema.paraEscuro' : 'tema.paraClaro')}
      title={t(claro ? 'tema.escuro' : 'tema.claro')}
      className="grid h-11 w-11 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
    >
      <motion.span
        key={tema}
        initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {claro ? <Sol /> : <Lua />}
      </motion.span>
    </button>
  )
}

function Lua() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" strokeLinejoin="round" />
    </svg>
  )
}

function Sol() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      />
    </svg>
  )
}
