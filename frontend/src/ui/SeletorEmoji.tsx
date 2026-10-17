import { useRef, useState } from 'react'

const EMOJIS = [
  '🛒', '🥖', '💊', '⛽', '📦', '🔄', '💄', '📱', '✈️', '🍔', '📚', '✏️',
  '🔧', '🏦', '📈', '↔️', '💧', '💡', '🚗', '🍽️', '🎬', '👕', '🐾', '🏠',
  '🔑', '🏋️', '💰', '🎁', '🧾', '❓', '🏷️', '🎮', '🎨', '🐶', '🐱', '🧱',
  '☕', '🍕', '🚌', '🚲', '📖', '🎓', '🩺', '💻', '💼', '🧳', '⚽', '🌱',
]

type Props = {
  valor: string
  rotulo: string
  aoSelecionar: (emoji: string) => void
}

export function SeletorEmoji({ valor, rotulo, aoSelecionar }: Props) {
  const [aberto, setAberto] = useState(false)
  const gatilho = useRef<HTMLButtonElement>(null)
  return (
    <div className="relative shrink-0">
      <button
        ref={gatilho}
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-label={rotulo}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className="grid h-11 w-12 place-items-center rounded-lg border border-campo-borda bg-carvao-950/40 text-xl transition-colors hover:border-carvao-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca"
      >
        {valor}
      </button>
      {aberto && (
        <div role="dialog" aria-label={rotulo} className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-carvao-700 bg-carvao-900 p-3 sombra-flutuante">
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`${rotulo}: ${emoji}`}
                aria-pressed={valor === emoji}
                onClick={() => {
                  aoSelecionar(emoji)
                  setAberto(false)
                  gatilho.current?.focus()
                }}
                className={`grid h-8 w-7 place-items-center rounded-md text-lg transition-colors hover:bg-carvao-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca ${valor === emoji ? 'bg-carvao-800 ring-1 ring-marca' : ''}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
