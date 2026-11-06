import { useEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact } from 'react'
import { motion } from 'motion/react'
import { useT } from '../i18n/IdiomaProvider'
import { Portal, useTravarRolagem } from './Portal'
import { AbaConta } from './perfil/AbaConta'
import { AbaPreferencias } from './perfil/AbaPreferencias'
import { AbaDados } from './perfil/AbaDados'

type Props = {
  /** Nome completo atual (vem do Neon Auth, `user.name`). */
  nomeAtual: string
  /** E-mail do login, só para leitura. */
  emailAtual?: string | null
  /** Apelido atual (o que aparece na saudação). */
  apelidoAtual: string
  onFechar: () => void
  /** Chamado após salvar, para o App recarregar a sessão e repintar a
   *  saudação e o avatar. */
  onSalvo: () => void
  /** Os dados (e talvez o login) acabaram de ser apagados: o App decide se
   *  sai da conta ou recarrega vazio. */
  onDadosExcluidos?: (loginExcluido: boolean) => void
}

const ABAS = ['conta', 'preferencias', 'dados'] as const
type Aba = (typeof ABAS)[number]

const ROTULO: Record<Aba, 'perfil.aba.conta' | 'perfil.aba.preferencias' | 'perfil.aba.dados'> = {
  conta: 'perfil.aba.conta',
  preferencias: 'perfil.aba.preferencias',
  dados: 'perfil.aba.dados',
}

/** O perfil, em três abas: **Conta** (quem você é e como entra),
 *  **Preferências** (como o app se comporta, valendo em todo aparelho) e
 *  **Seus dados** (levar embora ou apagar).
 *
 *  Este arquivo é só a moldura — o diálogo, as abas e o fechar. Enquanto uma
 *  aba trabalha (salvando, trocando senha, apagando), Esc e clique no véu
 *  não fecham: fechar no meio de uma exclusão esconderia o resultado dela. */
export function EditarPerfil({
  nomeAtual,
  emailAtual = null,
  apelidoAtual,
  onFechar,
  onSalvo,
  onDadosExcluidos,
}: Props) {
  const [aba, setAba] = useState<Aba>('conta')
  const [ocupado, setOcupado] = useState(false)
  const abasRef = useRef<Array<HTMLButtonElement | null>>([])
  const { t } = useT()
  useTravarRolagem(true)

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !ocupado) onFechar()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar, ocupado])

  // Setas entre as abas, como o padrão de `tablist` da ARIA pede: Tab sai da
  // lista e entra no painel; as setas andam dentro dela.
  function navegar(e: KeyboardEventReact<HTMLDivElement>) {
    const i = ABAS.indexOf(aba)
    const proxima =
      e.key === 'ArrowRight' ? (i + 1) % ABAS.length : e.key === 'ArrowLeft' ? (i - 1 + ABAS.length) % ABAS.length : null
    if (proxima === null) return
    e.preventDefault()
    setAba(ABAS[proxima])
    abasRef.current[proxima]?.focus()
  }

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label={t('conta.editarPerfil')}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-veu/60 p-4 backdrop-blur-md sm:p-8"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !ocupado) onFechar()
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="w-full max-w-lg min-w-0 sombra-flutuante rounded-2xl border border-carvao-700 bg-carvao-900"
        >
          <header className="flex items-start justify-between gap-3 px-6 pt-4">
            <div className="min-w-0">
              <h2 className="font-display text-xl text-tinta">{t('conta.editarPerfil')}</h2>
              <p className="text-xs text-tinta-tenue">{t('perfil.subtitulo')}</p>
            </div>
            <button
              onClick={onFechar}
              disabled={ocupado}
              aria-label={t('geral.fechar')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:text-tinta disabled:opacity-50"
            >
              ✕
            </button>
          </header>

          <div
            role="tablist"
            aria-label={t('perfil.abas')}
            onKeyDown={navegar}
            className="mt-3 flex gap-1 border-b border-carvao-800 px-4"
          >
            {ABAS.map((id, i) => (
              <button
                key={id}
                ref={(el) => {
                  abasRef.current[i] = el
                }}
                role="tab"
                id={`perfil-aba-${id}`}
                aria-selected={aba === id}
                aria-controls={`perfil-painel-${id}`}
                tabIndex={aba === id ? 0 : -1}
                disabled={ocupado && aba !== id}
                onClick={() => setAba(id)}
                className={`-mb-px min-h-11 shrink-0 border-b-2 px-3 text-sm transition-colors disabled:opacity-50 ${
                  aba === id ? 'border-marca text-tinta' : 'border-transparent text-tinta-fraca hover:text-tinta'
                }`}
              >
                {t(ROTULO[id])}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`perfil-painel-${aba}`} aria-labelledby={`perfil-aba-${aba}`}>
            {aba === 'conta' && (
              <AbaConta
                nomeAtual={nomeAtual}
                emailAtual={emailAtual}
                apelidoAtual={apelidoAtual}
                onOcupado={setOcupado}
                onCancelar={onFechar}
                onSalvo={() => {
                  onSalvo()
                  onFechar()
                }}
              />
            )}
            {aba === 'preferencias' && <AbaPreferencias />}
            {aba === 'dados' && (
              <AbaDados
                perfil={{ nome: nomeAtual || null, email: emailAtual ?? null }}
                onOcupado={setOcupado}
                onExcluidos={(loginExcluido) => {
                  onFechar()
                  onDadosExcluidos?.(loginExcluido)
                }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  )
}
