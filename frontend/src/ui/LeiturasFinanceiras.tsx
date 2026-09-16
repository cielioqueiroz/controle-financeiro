import { motion, useReducedMotion } from 'motion/react'

import { useT } from '../i18n/IdiomaProvider'

export type LeituraFinanceira = {
  id: string
  titulo: string
  texto: string
  tom: 'positivo' | 'alerta' | 'neutro'
  onAbrir?: () => void
  rotuloAcao?: string
}

type Props = {
  itens: LeituraFinanceira[]
}

/** Leituras curtas do recorte, no formato de cards do Ambit.
 *
 * Este módulo só desenha e encaminha ações. As conclusões são montadas pelo
 * Painel a partir do mesmo Resumo, dos dias e dos rankings que alimentam os
 * gráficos; assim uma leitura nunca pode discordar do desenho ao lado.
 */
export function LeiturasFinanceiras({ itens }: Props) {
  const { t } = useT()
  const semMovimento = useReducedMotion()
  if (itens.length === 0) return null

  const corPorTom = {
    positivo: 'var(--color-confere)',
    alerta: 'var(--color-ressalva)',
    neutro: 'var(--color-tinta-tenue)',
  } as const

  return (
    <section className="screen-only mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="rotulo">{t('leituras.titulo')}</p>
        <p className="text-[11px] text-tinta-tenue">{t('leituras.descricao')}</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {itens.map((item, index) => {
          const conteudo = (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tinta-tenue">
                {item.titulo}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-tinta-fraca">{item.texto}</p>
              {item.onAbrir && item.rotuloAcao && (
                <span className="mt-3 block text-[11px] font-medium text-tinta underline decoration-dotted underline-offset-4">
                  {item.rotuloAcao} →
                </span>
              )}
            </>
          )

          return (
            <motion.article
              key={item.id}
              initial={semMovimento ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="relative overflow-hidden rounded-xl border border-carvao-700 bg-carvao-900 p-4 sombra-flutuante"
              style={{ borderLeftWidth: 3, borderLeftColor: corPorTom[item.tom] }}
            >
              {item.onAbrir ? (
                <button
                  type="button"
                  onClick={item.onAbrir}
                  className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2 focus-visible:ring-offset-carvao-900"
                >
                  {conteudo}
                </button>
              ) : (
                conteudo
              )}
            </motion.article>
          )
        })}
      </div>
    </section>
  )
}
