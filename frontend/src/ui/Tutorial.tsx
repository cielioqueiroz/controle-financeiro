import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useT } from '../i18n/IdiomaProvider'
import { Portal, useTravarRolagem } from './Portal'
import type { Dicionario } from '../i18n/dicionarios/pt'

type Props = {
  nome: string
  onFechar: () => void
}

type Passo = { icone: string; titulo: keyof Dicionario; corpo: keyof Dicionario }

/** Os seis passos seguem a ordem em que a pessoa realmente usa o app, e a
 *  copy foi reescrita em 2026-08-12 porque descrevia um app que não existe
 *  mais: mandava clicar num botão "Documentos" (virou a página Faturas na
 *  reforma de 07/08) e dizia que o relatório "abre o diálogo de impressão"
 *  (o `window.print()` saiu em 24/07, quando o PDF passou a ser um arquivo
 *  de verdade, para baixar ou compartilhar). O 🖨️ saiu junto pelo mesmo
 *  motivo: ícone também é afirmação. */
const PASSOS: Passo[] = [
  { icone: '📄', titulo: 'tutorial.p1t', corpo: 'tutorial.p1c' },
  { icone: '📊', titulo: 'tutorial.p2t', corpo: 'tutorial.p2c' },
  { icone: '🗓️', titulo: 'tutorial.p3t', corpo: 'tutorial.p3c' },
  { icone: '🔎', titulo: 'tutorial.p4t', corpo: 'tutorial.p4c' },
  { icone: '🗂️', titulo: 'tutorial.p5t', corpo: 'tutorial.p5c' },
  { icone: '🔁', titulo: 'tutorial.p6t', corpo: 'tutorial.p6c' },
]

/** Tutorial guiado de boas-vindas: passos curtos mostrando como usar o
 *  app. Aparece uma vez para quem nunca viu (flag no navegador) e pode ser
 *  reaberto pelo menu de conta. */
export function Tutorial({ nome, onFechar }: Props) {
  const { t } = useT()
  const [i, setI] = useState(-1) // -1 = tela de boas-vindas
  const total = PASSOS.length
  const boasVindas = i < 0
  const passo = boasVindas ? null : PASSOS[i]
  const ultimo = i === total - 1
  useTravarRolagem(true)

  return (
    <Portal>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-veu/60 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-md sombra-flutuante overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900"
      >
        <div className="relative px-8 pb-6 pt-9">
          <button
            onClick={onFechar}
            className="absolute right-4 top-4 text-[11px] uppercase tracking-widest text-tinta-tenue transition-colors hover:text-tinta"
          >
            {t('tutorial.pular')}
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="min-h-[168px]"
            >
              {boasVindas ? (
                <>
                  <div className="text-4xl">👋</div>
                  <h2 className="mt-3 font-display text-2xl text-tinta">
                    {t('header.ola', { nome })}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">
                    {t('tutorial.boasVindas')}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-4xl">{passo!.icone}</div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="tabular text-xs text-tinta-tenue">
                      {i + 1}/{total}
                    </span>
                    <h2 className="font-display text-2xl text-tinta">{t(passo!.titulo)}</h2>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">{t(passo!.corpo)}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t border-carvao-800 px-8 py-4">
          {/* Pontinhos de progresso */}
          <div className="flex gap-1.5">
            {PASSOS.map((_, k) => (
              <span
                key={k}
                className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${
                  k === i ? 'w-5 bg-tinta' : 'w-1.5 bg-carvao-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!boasVindas && (
              <button
                onClick={() => setI((v) => v - 1)}
                className="rounded-lg px-3 py-1.5 text-sm text-tinta-fraca transition-colors hover:text-tinta"
              >
                {t('tutorial.voltar')}
              </button>
            )}
            {ultimo ? (
              <button
                onClick={onFechar}
                className="bg-tinta px-4 py-1.5 text-sm font-medium text-carvao-950 transition-colors hover:bg-tinta-fraca"
              >
                {t('tutorial.comecar')}
              </button>
            ) : (
              <button
                onClick={() => setI((v) => v + 1)}
                className="rounded-lg bg-tinta px-4 py-1.5 text-sm font-medium text-carvao-950 transition-colors hover:bg-tinta-fraca"
              >
                {t(boasVindas ? 'tutorial.boraVer' : 'tutorial.proximo')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
    </Portal>
  )
}
