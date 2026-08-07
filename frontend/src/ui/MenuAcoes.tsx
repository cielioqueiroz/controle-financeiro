import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useT } from '../i18n/IdiomaProvider'

type Props = {
  onImportar: () => void
  onBaixarPDF?: () => void
  /** Só chega quando o aparelho compartilha arquivos (Web Share nível 2). */
  onCompartilharPDF?: () => void
}

/** Menu hambúrguer com as ações do painel. Usado no mobile (no desktop as
 *  ações aparecem inline). */
export function MenuAcoes({
  onImportar,
  onBaixarPDF,
  onCompartilharPDF,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useT()

  useEffect(() => {
    if (!aberto) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const item = 'flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-tinta-fraca transition-colors hover:bg-carvao-850 hover:text-tinta'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={t('dash.menu')}
        aria-expanded={aberto}
        className="grid h-10 w-10 place-items-center rounded-lg border border-carvao-700 bg-carvao-900 text-tinta transition-colors hover:bg-carvao-850"
      >
        <div className="space-y-1">
          <motion.span animate={{ rotate: aberto ? 45 : 0, y: aberto ? 6 : 0 }} className="block h-0.5 w-5 bg-current" />
          <motion.span animate={{ opacity: aberto ? 0 : 1 }} className="block h-0.5 w-5 bg-current" />
          <motion.span animate={{ rotate: aberto ? -45 : 0, y: aberto ? -6 : 0 }} className="block h-0.5 w-5 bg-current" />
        </div>
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute right-0 z-30 mt-2 w-52 origin-top-right overflow-hidden rounded-xl border border-carvao-700 bg-carvao-900 shadow-xl shadow-black/30"
          >
            <button onClick={() => { setAberto(false); onImportar() }} className={item}>
              <span aria-hidden>＋</span> {t('dash.importar').replace('+ ', '')}
            </button>
            {/* Documentos e Categorias sairam daqui: viraram Faturas e
                Categorias na barra de navegacao, alcancaveis de qualquer
                pagina. Duplica-las no menu daria dois caminhos para o
                mesmo lugar. */}
            {onBaixarPDF && (
              <button onClick={() => { setAberto(false); onBaixarPDF() }} className={item}>
                <span aria-hidden>⬇️</span> {t('dash.baixarPdf')}
              </button>
            )}
            {onCompartilharPDF && (
              <button onClick={() => { setAberto(false); onCompartilharPDF() }} className={item}>
                <span aria-hidden>📤</span> {t('dash.compartilharPdf')}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
