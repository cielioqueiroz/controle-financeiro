import { categoria } from '../domain/categorize/categorias'
import { formatBRL } from '../domain/normalize/money'
import type { TransacaoSalva } from '../persist/puxar'

type Props = {
  t: TransacaoSalva
  onEditar: (t: TransacaoSalva) => void
  /** Esconde o ícone da categoria (dentro de uma seção de categoria). */
  semIcone?: boolean
  /** Mostra a coluna de categoria (desktop) — útil na visão por dia. */
  mostrarCategoria?: boolean
}

/** Linha de lançamento em colunas alinhadas (estilo planilha): data,
 *  descrição, categoria (desktop) e valor, com um lápis no hover para
 *  editar. Zebra via `even:`. Reutilizada nas visões por dia e categoria. */
export function LinhaTransacao({ t, onEditar, semIcone, mostrarCategoria }: Props) {
  const cat = categoria(t.category_slug ?? 'outros')
  const interno = t.kind === 'internal_transfer' || t.kind === 'card_payment'
  return (
    <li
      className={`group flex items-center gap-3 px-3 py-1.5 text-sm transition-colors even:bg-carvao-950/25 hover:bg-carvao-850 ${
        interno ? 'opacity-55' : ''
      }`}
    >
      <span className="tabular w-12 shrink-0 text-xs text-tinta-tenue">
        {t.date.slice(8, 10)}/{t.date.slice(5, 7)}
      </span>
      {!semIcone && (
        <span className="shrink-0 text-base" title={cat.nome}>
          {cat.icone}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-tinta">
        {t.label ?? t.description}
        {t.installment && (
          <span className="tabular ml-2 rounded-sm bg-carvao-800 px-1.5 py-0.5 text-[10px] text-tinta-fraca">
            {t.installment.current}/{t.installment.total}
          </span>
        )}
      </span>
      {mostrarCategoria && (
        <span className="hidden w-32 shrink-0 truncate text-xs text-tinta-tenue lg:block" title={cat.nome}>
          {cat.nome}
        </span>
      )}
      <button
        onClick={() => onEditar(t)}
        aria-label="Editar compra"
        title="Renomear / trocar categoria"
        className="screen-only grid h-7 w-7 shrink-0 place-items-center rounded-md text-tinta-tenue opacity-0 transition-all hover:bg-carvao-800 hover:text-tinta focus:opacity-100 group-hover:opacity-100"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
      <span
        className={`tabular w-28 shrink-0 text-right ${t.amount_cents < 0 ? 'text-confere' : 'text-tinta'}`}
      >
        {formatBRL(t.amount_cents)}
      </span>
    </li>
  )
}

/** Cabeçalho de colunas para as listas (estilo planilha). */
export function CabecalhoLancamentos({ mostrarCategoria }: { mostrarCategoria?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-carvao-800 bg-carvao-900 px-3 py-2 text-[10px] uppercase tracking-widest text-tinta-tenue">
      <span className="w-12 shrink-0">Data</span>
      <span className="min-w-0 flex-1">Descrição</span>
      {mostrarCategoria && <span className="hidden w-32 shrink-0 lg:block">Categoria</span>}
      <span className="w-7 shrink-0" />
      <span className="w-28 shrink-0 text-right">Valor</span>
    </div>
  )
}
