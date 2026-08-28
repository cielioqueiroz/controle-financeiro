import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { neon } from '../lib/neon'
import { Confirmacao } from './acesso/Confirmacao'
import { useT } from '../i18n/IdiomaProvider'

type Props = {
  onSair: () => void
  onVerTutorial?: () => void
  onEditarPerfil?: () => void
}

/** Menu de conta. O "Sair" mora aqui dentro, longe do toggle de tema e
 *  atrás de um clique intencional (abrir → confirmar) — antes ele ficava
 *  colado no toggle e dava para sair sem querer. */
export function ContaMenu({ onSair, onVerTutorial, onEditarPerfil }: Props) {
  const [aberto, setAberto] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useT()

  useEffect(() => {
    neon?.auth
      .getSession()
      .then(({ data }) => {
        const e = (data as { user?: { email?: string } } | null)?.user?.email
        if (e) setEmail(e)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!aberto) return
    // Com o diálogo aberto, quem manda é ele: o Confirmacao vive num portal
    // pendurado no <body> (ver Portal.tsx), logo FORA deste `ref`. Se estes
    // ouvintes continuassem valendo, o mousedown no próprio botão "Sair"
    // contaria como clique fora — o menu e o diálogo sumiriam antes de o
    // clique virar `onConfirmar`, e não dava para sair da conta. O diálogo
    // já trata Esc e clique no véu por conta própria.
    if (confirmando) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false)
        setConfirmando(false)
      }
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setAberto(false)
        setConfirmando(false)
      }
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto, confirmando])

  const inicial = (email?.[0] ?? '?').toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={t('conta.aria')}
        title={t('conta.aria')}
        className="grid h-11 w-11 place-items-center rounded-full border border-carvao-700 bg-carvao-850 text-sm font-medium text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
      >
        {inicial}
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute right-0 z-30 mt-2 w-60 origin-top-right overflow-hidden border border-borda bg-cartao sombra-flutuante"
          >
            <div className="border-b border-carvao-800 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-tinta-tenue">{t('conta.conectadoComo')}</p>
              <p className="mt-0.5 truncate text-sm text-tinta" title={email ?? undefined}>
                {email ?? '—'}
              </p>
            </div>

            {onEditarPerfil && (
              <button
                onClick={() => {
                  setAberto(false)
                  onEditarPerfil()
                }}
                className="flex w-full items-center gap-2 border-b border-carvao-800 px-4 py-3 text-left text-sm text-tinta-fraca transition-colors hover:bg-carvao-850 hover:text-tinta"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="8" r="3.2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 19a6.5 6.5 0 0 1 13 0" />
                </svg>
                {t('conta.editarPerfil')}
              </button>
            )}
            {onVerTutorial && (
              <button
                onClick={() => {
                  setAberto(false)
                  onVerTutorial()
                }}
                className="flex w-full items-center gap-2 border-b border-carvao-800 px-4 py-3 text-left text-sm text-tinta-fraca transition-colors hover:bg-carvao-850 hover:text-tinta"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7M12 17h.01" />
                </svg>
                {t('conta.verTutorial')}
              </button>
            )}
            <button
              onClick={() => setConfirmando(true)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-tinta-fraca transition-colors hover:bg-carvao-850 hover:text-tinta"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
              </svg>
              {t('conta.sair')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Confirmacao
        aberto={confirmando}
        titulo={t('conta.sairTitulo')}
        descricao={t('conta.sairDescricao')}
        rotuloConfirmar={t('conta.sairConfirmar')}
        severidade="perigo"
        onConfirmar={onSair}
        onCancelar={() => setConfirmando(false)}
      />
    </div>
  )
}
