import { useEffect, useId, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { BOTAO_PRIMARIO } from './estilos-campo'
import { useT } from '../../i18n/IdiomaProvider'
import { Portal, useTravarRolagem } from '../Portal'

// BOTAO_PRIMARIO nasceu para o botão de largura cheia do card de acesso
// (w-full, py-3). Aqui ele divide a linha com o Cancelar, num
// `flex justify-end`: a largura cheia tomaria a linha inteira e a altura
// de py-3 ficaria maior que a do Cancelar (py-2). Puxamos o mesmo
// vocabulário visual (cor, sombra, hover, disabled) e neutralizamos só
// largura e altura, aqui, sem tocar a constante compartilhada — outros
// lugares dependem dela como está.
const BOTAO_CONFIRMAR_NORMAL = BOTAO_PRIMARIO.replace('w-full ', '').replace('py-3', 'py-2')

// Seletor de elementos focáveis dentro do card. Usado para o foco preso:
// como `descricao` é ReactNode, ela pode trazer um link ou botão próprio,
// então não dá para assumir que só existem os dois botões da rodapé.
const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

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
  const { t } = useT()
  const tituloId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
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

      // Foco preso: calcula a lista de focáveis a cada Tab (não fixa em
      // "dois botões") porque `descricao` pode trazer link ou botão
      // próprio, e a lista muda com o conteúdo.
      const lista = cardRef.current
        ? Array.from(cardRef.current.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL))
        : []
      if (lista.length === 0) {
        // Com `ocupado`, os dois botões ficam disabled e a lista esvazia —
        // justo quando a ação está em voo e o diálogo mais precisa reter o
        // usuário. Sem prender aqui, o Tab seguiria a ordem do documento e
        // escaparia para a página por baixo. Segura o foco no próprio card.
        e.preventDefault()
        cardRef.current?.focus()
        return
      }

      const primeiro = lista[0]
      const ultimo = lista[lista.length - 1]
      const atual = document.activeElement as HTMLElement | null

      if (!atual || !lista.includes(atual)) {
        // Caso geral: o foco escapou do par conhecido (ex.: um clique numa
        // área não focável do card levou o foco ao body, ou o Tab partiu
        // de dentro de um link da descrição). Sem isto, o próximo Tab
        // seguiria a ordem natural do documento e escaparia do diálogo.
        e.preventDefault()
        primeiro.focus()
      } else if (e.shiftKey && atual === primeiro) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && atual === ultimo) {
        e.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto, ocupado, onCancelar])

  useTravarRolagem(aberto)

  if (!aberto) return null

  return (
    <Portal>
    <motion.div
      // fixed, nunca absolute: o overlay é decoração pura e não pode
      // entrar no fluxo de rolagem de um container rolável por baixo.
      // O Portal é o que garante que o `fixed` valha para a JANELA (ver
      // Portal.tsx: um ancestral com transform sequestraria o inset-0).
      className="fixed inset-0 z-[60] grid place-items-center bg-veu/65 p-4 backdrop-blur-md"
      initial={semMovimento ? undefined : { opacity: 0 }}
      animate={semMovimento ? undefined : { opacity: 1 }}
      exit={semMovimento ? undefined : { opacity: 0 }}
      // O clique aqui é no fundo: só fecha se o alvo do clique for o
      // próprio overlay. Um clique no card propagaria até aqui, mas o
      // alvo continuaria sendo o card — não o overlay. Com `ocupado`, nem
      // o clique no fundo fecha: a ação já está em voo (mesma razão do
      // Esc), senão o diálogo "fecharia com sucesso" enquanto o servidor
      // ainda está apagando.
      onClick={(e) => {
        if (ocupado) return
        if (e.target === e.currentTarget) onCancelar()
      }}
    >
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        // Alvo de foco quando não há botão focável (ação em curso trava os
        // dois), para o foco preso ter onde pousar sem sair do diálogo.
        tabIndex={-1}
        className="w-full max-w-sm sombra-flutuante rounded-2xl border border-carvao-700 bg-carvao-900 p-6"
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
            disabled={ocupado}
            onClick={onCancelar}
            className="rounded-xl border border-carvao-700 px-4 py-2 text-sm text-tinta-fraca transition-colors hover:text-tinta disabled:opacity-50"
          >
            {t('geral.cancelar')}
          </button>
          <button
            ref={botaoConfirmarRef}
            type="button"
            disabled={ocupado}
            onClick={onConfirmar}
            className={
              severidade === 'perigo'
                ? 'rounded-xl bg-falha px-4 py-2 text-sm font-semibold text-tinta-viva transition-colors hover:bg-tinta-fraca disabled:opacity-50'
                : BOTAO_CONFIRMAR_NORMAL
            }
          >
            {rotuloConfirmar}
          </button>
        </div>
      </motion.div>
    </motion.div>
    </Portal>
  )
}
