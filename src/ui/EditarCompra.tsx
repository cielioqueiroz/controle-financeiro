import { useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { editarTransacao } from '../persist/editar'
import { CATEGORIAS } from '../domain/categorize/categorias'
import { formatBRL } from '../domain/normalize/money'
import type { TransacaoSalva } from '../persist/puxar'

type Props = {
  tx: TransacaoSalva
  onFechar: () => void
  /** Devolve os campos alterados para o dashboard atualizar em memória. */
  onSalvo: (id: string, campos: { label: string | null; category_slug: string }) => void
}

/** Editor de uma compra: renomeia o estabelecimento (label) e troca a
 *  categoria. A descrição original do banco fica visível, mas imutável. */
export function EditarCompra({ tx, onFechar, onSalvo }: Props) {
  const [label, setLabel] = useState(tx.label ?? '')
  const [slug, setSlug] = useState(tx.category_slug ?? 'outros')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    const labelLimpo = label.trim() || null
    try {
      await editarTransacao(tx.id, { label: labelLimpo, category_slug: slug })
      onSalvo(tx.id, { label: labelLimpo, category_slug: slug })
      toast.success('Compra atualizada.')
      onFechar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
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
        className="w-full max-w-md rounded-xl border border-carvao-700 bg-carvao-900 shadow-2xl shadow-black/40"
      >
        <header className="flex items-start justify-between gap-3 border-b border-carvao-800 px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-tinta">Editar compra</h2>
            <p className="truncate text-xs text-tinta-tenue" title={tx.description}>
              {tx.date.slice(8, 10)}/{tx.date.slice(5, 7)} · {tx.description} ·{' '}
              <span className="tabular">{formatBRL(tx.amount_cents)}</span>
            </p>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:text-tinta"
          >
            ✕
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          <label className="block">
            <span className="text-xs uppercase tracking-widest text-tinta-tenue">
              Nome do estabelecimento
            </span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={tx.description}
              autoFocus
              className="mt-1.5 w-full rounded-lg border border-carvao-700 bg-carvao-850 px-3 py-2 text-sm text-tinta outline-none transition-colors placeholder:text-tinta-tenue focus:border-carvao-600"
            />
            <span className="mt-1 block text-[11px] text-tinta-tenue">
              Deixe em branco para usar o texto original do banco.
            </span>
          </label>

          <div>
            <span className="text-xs uppercase tracking-widest text-tinta-tenue">Categoria</span>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => setSlug(c.slug)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                    slug === c.slug
                      ? 'border-transparent text-carvao-950'
                      : 'border-carvao-700 text-tinta-fraca hover:border-carvao-600 hover:text-tinta'
                  }`}
                  style={slug === c.slug ? { background: c.cor } : undefined}
                >
                  <span>{c.icone}</span>
                  <span className="truncate">{c.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-carvao-800 px-6 py-4">
          <button
            onClick={onFechar}
            className="rounded-lg px-4 py-2 text-sm text-tinta-fraca transition-colors hover:text-tinta"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="rounded-lg bg-tinta px-4 py-2 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  )
}
