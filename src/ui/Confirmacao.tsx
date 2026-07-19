import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { BOTAO_PRIMARIO } from './estilos-campo'

type Props = {
  aberto: boolean
  titulo: string
  descricao?: React.ReactNode
  rotuloConfirmar: string
  severidade: 'perigo' | 'normal'
  ocupado?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

/** Diálogo de confirmação único do sistema — sai da conta, apagar
 *  documento, apagar tudo e salvar edição passam todos por aqui, em vez de
 *  cada ação inventar seu próprio bloco de "tem certeza?".
 *
 *  Não sabe nada sobre autenticação, documentos ou edição: só pergunta e
 *  responde através de `onConfirmar`/`onCancelar`. Quem chama decide o que
 *  cada resposta significa. */
export function Confirmacao({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar,
  severidade,
  ocupado = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const semMovimento = useReducedMotion()
  const botaoCancelarRef = useRef<HTMLButtonElement>(null)
  const botaoConfirmarRef = useRef<HTMLButtonElement>(null)
  // Quem tinha o foco antes de abrir — não o elemento no momento da
  // montagem, porque o componente pode montar fechado e abrir bem depois,
  // quando o foco já está em outro lugar.
  const focoAnterior = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!aberto) return

    focoAnterior.current = document.activeElement as HTMLElement | null
    // Perigo é irreversível (apagar tudo zera o histórico do usuário): o
    // foco inicial vai no Cancelar, para que um Enter por reflexo não
    // confirme nada. Ações normais (ex.: salvar edição) começam no Confirmar.
    const alvo = severidade === 'perigo' ? botaoCancelarRef.current : botaoConfirmarRef.current
    alvo?.focus()

    return () => {
      focoAnterior.current?.focus()
    }
    // Só depende de `aberto`: a decisão de foco inicial acontece uma vez,
    // na transição para aberto. Incluir `severidade` aqui refaria a
    // captura de focoAnterior se a severidade mudasse com o diálogo já
    // aberto, sobrescrevendo-a com um botão do próprio diálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  useEffect(() => {
    if (!aberto) return

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Ação em curso: Esc não cancela o que já está acontecendo.
        if (ocupado) return
        onCancelar()
        return
      }

      if (e.key !== 'Tab') return

      // Foco preso: só há dois botões, então o laço é curto — Tab no
      // último volta ao primeiro, Shift+Tab no primeiro vai ao último.
      const primeiro = botaoCancelarRef.current
      const ultimo = botaoConfirmarRef.current
      if (!primeiro || !ultimo) return

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto, ocupado, onCancelar])

  if (!aberto) return null

  const tituloId = 'confirmacao-titulo'

  return (
    <motion.div
      // fixed, nunca absolute: o overlay é decoração pura e não pode
      // entrar no fluxo de rolagem de um container rolável por baixo.
      className="fixed inset-0 z-50 grid place-items-center bg-carvao-950/70 p-4 backdrop-blur-sm"
      initial={semMovimento ? undefined : { opacity: 0 }}
      animate={semMovimento ? undefined : { opacity: 1 }}
      exit={semMovimento ? undefined : { opacity: 0 }}
      // O clique aqui é no fundo: só fecha se o alvo do clique for o
      // próprio overlay. Um clique no card propagaria até aqui, mas o
      // alvo continuaria sendo o card — não o overlay.
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancelar()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="w-full max-w-sm rounded-2xl border border-carvao-700 bg-carvao-900 p-6 shadow-2xl shadow-black/30"
        initial={semMovimento ? undefined : { opacity: 0, scale: 0.96 }}
        animate={semMovimento ? undefined : { opacity: 1, scale: 1 }}
        exit={semMovimento ? undefined : { opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <h2 id={tituloId} className="text-base font-semibold text-tinta">
          {titulo}
        </h2>

        {descricao && <div className="mt-2 text-sm text-tinta-fraca">{descricao}</div>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={botaoCancelarRef}
            type="button"
            onClick={onCancelar}
            className="rounded-xl border border-carvao-700 px-4 py-2 text-sm text-tinta-fraca transition-colors hover:text-tinta"
          >
            Cancelar
          </button>
          <button
            ref={botaoConfirmarRef}
            type="button"
            disabled={ocupado}
            onClick={onConfirmar}
            className={
              severidade === 'perigo'
                ? 'rounded-xl bg-falha px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50'
                : BOTAO_PRIMARIO
            }
          >
            {rotuloConfirmar}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
