import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useT } from '../i18n/IdiomaProvider'

type Tema = 'dark' | 'light'

/** Escolha salva > **escuro**. O sistema não opina.
 *
 *  A regra tinha a preferência do sistema no meio, e o padrão era claro. Em
 *  2026-09-04 apareceu o que isso significa na prática: um celular no modo
 *  claro abriu o app branco para alguém que entrava pela primeira vez —
 *  diferente de todo print, de toda captura de tela e do que o desktop de
 *  quem indicou o app mostrava. Identidade escura que só aparece em metade
 *  dos aparelhos não é identidade.
 *
 *  Quem prefere claro tem o botão ao lado, e a escolha fica salva.
 *
 *  ⚠️ A MESMA regra vive no script inline do `index.html`, que roda antes da
 *  primeira pintura. Mudar uma sem a outra faz a página nascer com um tema e
 *  trocar para o outro ao montar — o piscar que aquele bloco existe para
 *  evitar. E o script inline tem hash na CSP: ver o aviso lá. */
function temaInicial(): Tema {
  return localStorage.getItem('tema') === 'light' ? 'light' : 'dark'
}

/** Alterna claro/escuro. Grava a escolha e estampa data-theme no <html>,
 *  que faz as variáveis de cor inverterem (ver index.css). */
export function ThemeToggle() {
  const { t } = useT()
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
