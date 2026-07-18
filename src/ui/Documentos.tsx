import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { toast } from 'sonner'
import { puxarDocumentos, apagarDocumento, apagarTudo, type DocumentoSalvo } from '../persist/documentos'
import { formatBRL } from '../normalize/money'

type Props = {
  onFechar: () => void
  /** Chamado quando algo é apagado, para o dashboard recarregar. */
  onMudou: () => void
  /** Contagem/soma por documento, vinda do dashboard (já em memória). */
  contagem: Map<string, { qtd: number; totalCents: number }>
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function periodoCurto(ini: string | null, fim: string | null): string {
  const fmt = (s: string | null) => {
    if (!s) return '?'
    const [, m, d] = s.split('-')
    return `${d}/${MESES[Number(m) - 1]}`
  }
  if (!ini && !fim) return '—'
  return `${fmt(ini)} – ${fmt(fim)}`
}

export function Documentos({ onFechar, onMudou, contagem }: Props) {
  const [docs, setDocs] = useState<DocumentoSalvo[] | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [apagandoTudo, setApagandoTudo] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function carregar() {
    try {
      setDocs(await puxarDocumentos())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao listar documentos.')
    }
  }

  useEffect(() => {
    carregar()
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function apagar(id: string) {
    setOcupado(true)
    try {
      await apagarDocumento(id)
      toast.success('Documento apagado.')
      setConfirmando(null)
      await carregar()
      onMudou()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao apagar.')
    } finally {
      setOcupado(false)
    }
  }

  async function apagarGeral() {
    setOcupado(true)
    try {
      await apagarTudo()
      toast.success('Tudo apagado. Você começa do zero.')
      onMudou()
      onFechar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao apagar tudo.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFechar()
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-xl rounded-xl border border-carvao-700 bg-carvao-900 shadow-2xl shadow-black/40"
      >
        <header className="flex items-center justify-between border-b border-carvao-800 px-6 py-4">
          <div>
            <h2 className="font-display text-xl text-tinta">Documentos importados</h2>
            <p className="text-xs text-tinta-fraca">Apague uma fatura/extrato ou recomece do zero.</p>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="grid h-8 w-8 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:text-tinta"
          >
            ✕
          </button>
        </header>

        <div className="max-h-[55vh] overflow-y-auto px-3 py-2">
          {docs === null ? (
            <p className="px-4 py-10 text-center text-sm text-tinta-fraca">Carregando…</p>
          ) : docs.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-tinta-fraca">
              Nenhum documento importado ainda.
            </p>
          ) : (
            <ul className="space-y-1">
              {docs.map((d) => {
                const c = contagem.get(d.id)
                const ehFatura = d.doc_type === 'fatura'
                return (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-carvao-850"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-semibold capitalize"
                      style={{
                        background: d.bank === 'nubank' ? '#8a05be22' : '#cc092f22',
                        color: d.bank === 'nubank' ? '#c17ce0' : '#e8637a',
                      }}
                    >
                      {d.bank.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-tinta">
                        {ehFatura ? 'Fatura' : 'Extrato'} · <span className="capitalize">{d.bank}</span>
                        <span className="text-tinta-tenue"> · {periodoCurto(d.period_start, d.period_end)}</span>
                      </p>
                      <p className="tabular text-[11px] text-tinta-tenue">
                        {c ? `${c.qtd} lançamentos` : '—'}
                        {c && c.totalCents > 0 ? ` · ${formatBRL(c.totalCents)}` : ''} · importado em{' '}
                        {new Date(d.imported_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    {confirmando === d.id ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          disabled={ocupado}
                          onClick={() => apagar(d.id)}
                          className="rounded-md bg-falha px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          Apagar
                        </button>
                        <button
                          onClick={() => setConfirmando(null)}
                          className="rounded-md px-2 py-1 text-xs text-tinta-tenue transition-colors hover:text-tinta"
                        >
                          não
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmando(d.id)}
                        aria-label="Apagar documento"
                        title="Apagar este documento"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-tinta-tenue transition-colors hover:bg-falha/15 hover:text-falha"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
                        </svg>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-carvao-800 px-6 py-4">
          <AnimatePresence mode="wait">
            {apagandoTudo ? (
              <motion.div
                key="conf"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-3"
              >
                <p className="text-sm text-tinta-fraca">
                  Apagar <strong className="text-tinta">todos</strong> os documentos e lançamentos?
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    disabled={ocupado}
                    onClick={apagarGeral}
                    className="rounded-md bg-falha px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Sim, apagar tudo
                  </button>
                  <button
                    onClick={() => setApagandoTudo(false)}
                    className="rounded-md border border-carvao-700 px-3 py-1.5 text-xs text-tinta-fraca transition-colors hover:text-tinta"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setApagandoTudo(true)}
                disabled={!docs || docs.length === 0}
                className="text-xs font-medium text-falha transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                Apagar tudo e recomeçar
              </motion.button>
            )}
          </AnimatePresence>
        </footer>
      </motion.div>
    </motion.div>
  )
}
