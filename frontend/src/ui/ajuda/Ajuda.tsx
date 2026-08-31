import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../../i18n/IdiomaProvider'
import { Portal, useTravarRolagem } from '../Portal'
import { TOPICOS } from './topicos'
import { buscarTopicos } from './buscar'

type Props = {
  onFechar: () => void
  /** Reabre o tutorial guiado. A ajuda é para procurar uma coisa; o tutorial
   *  é para quem quer o passeio inteiro — e quem abriu a ajuda perdido é
   *  exatamente quem pode querer o passeio. */
  onVerTutorial: () => void
}

/** O painel do "?": um índice de assuntos com busca.
 *
 *  Abre com a lista INTEIRA, e não vazia esperando alguém digitar. Quem
 *  clica no "?" costuma não saber o nome do que procura — uma caixa de
 *  busca sozinha devolve a pergunta para a pessoa. A lista responde
 *  "existe isto, isto e isto" antes de qualquer digitação.
 *
 *  Cada assunto abre no lugar, e leva à tela quando o assunto tem uma. O
 *  que não tem tela (competência, privacidade) é conceito, e um botão que
 *  não leva a lugar nenhum ensina a não clicar. */
export function Ajuda({ onFechar, onVerTutorial }: Props) {
  const { t } = useT()
  const navigate = useNavigate()
  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)
  useTravarRolagem(true)

  const achados = useMemo(() => buscarTopicos(TOPICOS, termo, t), [termo, t])

  function irPara(rota: string) {
    navigate(rota)
    onFechar()
  }

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onFechar}
        className="fixed inset-0 z-50 flex items-start justify-center bg-veu/60 p-4 pt-[6vh] backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          // Sem isto, clicar dentro do painel fecharia o painel: o clique
          // sobe até o véu, que é quem escuta o "clicou fora".
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t('ajuda.titulo')}
          className="sombra-flutuante flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900"
        >
          <header className="border-b border-carvao-800 px-6 pb-4 pt-5">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-xl text-tinta">{t('ajuda.titulo')}</h2>
              <button
                onClick={onFechar}
                className="tabular text-[11px] uppercase tracking-widest text-tinta-tenue transition-colors hover:text-tinta"
              >
                {t('ajuda.fechar')} ✕
              </button>
            </div>

            <input
              // `autoFocus` porque o painel abre por um clique deliberado no
              // "?": quem abriu já quer digitar.
              autoFocus
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder={t('ajuda.placeholder')}
              aria-label={t('ajuda.placeholder')}
              className="mt-4 w-full rounded-xl border border-campo-borda bg-carvao-950/40 px-4 py-2.5 text-sm text-tinta outline-none transition-colors placeholder:text-tinta-tenue focus:border-marca"
            />

            <p className="tabular mt-2 text-[11px] text-tinta-tenue">
              {achados.length === 1
                ? t('ajuda.contagem1')
                : t('ajuda.contagem', { n: achados.length })}
            </p>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {achados.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-tinta-fraca">{t('ajuda.vazio')}</p>
            ) : (
              <ul className="space-y-1">
                {achados.map((topico) => {
                  const expandido = aberto === topico.id
                  return (
                    <li key={topico.id} className="rounded-lg">
                      <button
                        onClick={() => setAberto(expandido ? null : topico.id)}
                        aria-expanded={expandido}
                        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-tinta transition-colors hover:bg-carvao-850"
                      >
                        <span>{t(topico.titulo)}</span>
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className={`h-4 w-4 shrink-0 text-tinta-tenue transition-transform ${
                            expandido ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                        </svg>
                      </button>

                      {expandido && (
                        <div className="px-3 pb-4">
                          <p className="text-sm leading-relaxed text-tinta-fraca">
                            {t(topico.corpo)}
                          </p>
                          {topico.rota && (
                            <button
                              onClick={() => irPara(topico.rota!)}
                              className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-marca transition-opacity hover:opacity-80"
                            >
                              {t('ajuda.ir')} →
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <footer className="border-t border-carvao-800 px-6 py-3">
            <button
              onClick={() => {
                onFechar()
                onVerTutorial()
              }}
              className="text-xs text-tinta-tenue transition-colors hover:text-tinta"
            >
              {t('ajuda.verTutorial')}
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </Portal>
  )
}
