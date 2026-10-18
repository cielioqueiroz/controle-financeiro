import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n/IdiomaProvider'
import { Portal, useTravarRolagem } from './Portal'

const EMOJIS = [
  { icone: "🛒", chave: "emoji.supermercado" },
  { icone: "🥖", chave: "emoji.padaria" },
  { icone: "💊", chave: "emoji.farmacia" },
  { icone: "⛽", chave: "emoji.combustivel" },
  { icone: "📦", chave: "emoji.compras" },
  { icone: "🔄", chave: "emoji.assinaturas" },
  { icone: "💄", chave: "emoji.beleza" },
  { icone: "📱", chave: "emoji.celular" },
  { icone: "✈️", chave: "emoji.viagem" },
  { icone: "🍔", chave: "emoji.alimentacao" },
  { icone: "📚", chave: "emoji.livros" },
  { icone: "✏️", chave: "emoji.papelaria" },
  { icone: "🔧", chave: "emoji.servicos" },
  { icone: "🏦", chave: "emoji.banco" },
  { icone: "📈", chave: "emoji.rendimentos" },
  { icone: "↔️", chave: "emoji.transferencias" },
  { icone: "💧", chave: "emoji.agua" },
  { icone: "💡", chave: "emoji.luz" },
  { icone: "🚗", chave: "emoji.carro" },
  { icone: "🍽️", chave: "emoji.restaurante" },
  { icone: "🎬", chave: "emoji.cinema" },
  { icone: "👕", chave: "emoji.roupas" },
  { icone: "🐾", chave: "emoji.animais" },
  { icone: "🏠", chave: "emoji.casa" },
  { icone: "🔑", chave: "emoji.aluguel" },
  { icone: "🏋️", chave: "emoji.academia" },
  { icone: "💰", chave: "emoji.dinheiro" },
  { icone: "🎁", chave: "emoji.presentes" },
  { icone: "🧾", chave: "emoji.impostos" },
  { icone: "❓", chave: "emoji.outros" },
  { icone: "🏷️", chave: "emoji.etiqueta" },
  { icone: "🎮", chave: "emoji.jogos" },
  { icone: "🎨", chave: "emoji.arte" },
  { icone: "🐶", chave: "emoji.cachorro" },
  { icone: "🐱", chave: "emoji.gato" },
  { icone: "🧱", chave: "emoji.construcao" },
  { icone: "☕", chave: "emoji.cafe" },
  { icone: "🍕", chave: "emoji.pizza" },
  { icone: "🚌", chave: "emoji.onibus" },
  { icone: "🚲", chave: "emoji.bicicleta" },
  { icone: "📖", chave: "emoji.leitura" },
  { icone: "🎓", chave: "emoji.formacao" },
  { icone: "🩺", chave: "emoji.medico" },
  { icone: "💻", chave: "emoji.computador" },
  { icone: "💼", chave: "emoji.trabalho" },
  { icone: "🧳", chave: "emoji.bagagem" },
  { icone: "⚽", chave: "emoji.futebol" },
  { icone: "🌱", chave: "emoji.plantas" },
] as const

type Props = {
  valor: string
  rotulo: string
  aoSelecionar: (emoji: string) => void
}

export function SeletorEmoji({ valor, rotulo, aoSelecionar }: Props) {
  const { t } = useT()
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const gatilho = useRef<HTMLButtonElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const dialogo = useRef<HTMLDivElement>(null)
  useTravarRolagem(aberto)
  useEffect(() => { if (aberto) campo.current?.focus() }, [aberto])
  const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
  const opcoes = EMOJIS.filter((item) => normalizar(`${t(item.chave)} ${item.icone}`).includes(normalizar(busca.trim())))
  function fechar() {
    setAberto(false)
    gatilho.current?.focus()
  }
  return (
    <div className="shrink-0">
      <button ref={gatilho} type="button" onClick={() => { setBusca(''); setAberto(true) }}
        aria-label={rotulo} aria-haspopup="dialog" aria-expanded={aberto}
        className="campo-painel grid h-11 w-12 place-items-center !p-0 text-xl">
        {valor}
      </button>
      {aberto && <Portal>
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-veu/60 p-4 backdrop-blur-sm"
          onMouseDown={(evento) => { evento.stopPropagation(); if (evento.target === evento.currentTarget) fechar() }}>
          <div ref={dialogo} role="dialog" aria-modal="true" aria-label={rotulo}
            className="cartao max-h-[85dvh] w-full max-w-sm overflow-y-auto p-4 sombra-flutuante"
            onKeyDown={(evento) => {
              if (evento.key === 'Escape') { evento.preventDefault(); evento.stopPropagation(); fechar(); return }
              const controles = [...(dialogo.current?.querySelectorAll<HTMLElement>('input, button') ?? [])]
              const indice = controles.indexOf(document.activeElement as HTMLElement)
              if (evento.key === 'Tab') {
                if (evento.shiftKey && indice === 0) { evento.preventDefault(); controles.at(-1)?.focus() }
                else if (!evento.shiftKey && indice === controles.length - 1) { evento.preventDefault(); controles[0]?.focus() }
              }
              if (!(document.activeElement instanceof HTMLButtonElement)) return
              const botoes = [...(dialogo.current?.querySelectorAll<HTMLButtonElement>('[aria-pressed]') ?? [])]
              const atual = botoes.indexOf(document.activeElement)
              if (atual < 0) return
              const passo = new Map([['ArrowRight', 1], ['ArrowLeft', -1], ['ArrowDown', 6], ['ArrowUp', -6]]).get(evento.key)
              if (passo !== undefined) { evento.preventDefault(); botoes[(atual + passo + botoes.length) % botoes.length]?.focus() }
            }}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-xl text-tinta">{rotulo}</h3>
              <button type="button" onClick={fechar} className="acao-painel" aria-label={t('geral.fechar')}>×</button>
            </div>
            <input ref={campo} type="search" value={busca} onChange={(evento) => setBusca(evento.target.value)}
              aria-label={t('emoji.buscar')} placeholder={t('emoji.buscar')} className="campo-painel mb-3 w-full" />
            <div className="grid grid-cols-6 gap-1">
              {opcoes.map((item) => <button key={item.icone} type="button" title={t(item.chave)}
                aria-label={`${rotulo}: ${item.icone}`} aria-pressed={valor === item.icone}
                onClick={() => { aoSelecionar(item.icone); fechar() }}
                className={`grid min-h-11 min-w-0 place-items-center rounded-lg text-xl transition-colors hover:bg-afundado ${valor === item.icone ? 'bg-afundado ring-2 ring-marca' : ''}`}>
                {item.icone}
              </button>)}
            </div>
            {opcoes.length === 0 && <p role="status" className="py-6 text-center text-sm text-tinta-fraca">{t('emoji.semResultado')}</p>}
          </div>
        </div>
      </Portal>}
    </div>
  )
}
