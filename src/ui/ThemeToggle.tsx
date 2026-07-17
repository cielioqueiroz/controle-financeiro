import { useEffect, useState } from 'react'
import { motion } from 'motion/react'

type Tema = 'dark' | 'light'

function temaInicial(): Tema {
  const salvo = localStorage.getItem('tema')
  if (salvo === 'light' || salvo === 'dark') return salvo
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Alterna claro/escuro. Grava a escolha e estampa data-theme no <html>,
 *  que faz as variáveis de cor inverterem (ver index.css). */
export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>('dark')

  useEffect(() => {
    const t = temaInicial()
    setTema(t)
    document.documentElement.dataset.theme = t
  }, [])

  function alternar() {
    const novo: Tema = tema === 'dark' ? 'light' : 'dark'
    setTema(novo)
    document.documentElement.dataset.theme = novo
    localStorage.setItem('tema', novo)
  }

  const claro = tema === 'light'

  return (
    <button
      onClick={alternar}
      aria-label={claro ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
      title={claro ? 'Tema escuro' : 'Tema claro'}
      className="grid h-9 w-9 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
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
