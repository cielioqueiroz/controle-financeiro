import { categoria } from '../categorize/categorias'
import { formatBRL } from '../normalize/money'
import type { TransacaoSalva } from '../persist/puxar'

type Props = {
  t: TransacaoSalva
  onEditar: (t: TransacaoSalva) => void
  /** Esconde o ícone da categoria (útil dentro de uma seção de categoria). */
  semIcone?: boolean
}

/** Uma linha de transação: data, categoria, nome (label ou descrição),
 *  parcela e valor, com um lápis (no hover) para editar. Reutilizada nas
 *  visões por dia e por categoria. */
export function LinhaTransacao({ t, onEditar, semIcone }: Props) {
  const cat = categoria(t.category_slug ?? 'outros')
  const interno = t.kind === 'internal_transfer' || t.kind === 'card_payment'
  return (
    <li
      className={`group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-carvao-850 ${
        interno ? 'opacity-55' : ''
      }`}
    >
      <span className="tabular w-11 shrink-0 text-xs text-tinta-tenue">
        {t.date.slice(8, 10)}/{t.date.slice(5, 7)}
      </span>
      {!semIcone && (
        <span className="text-base" title={cat.nome}>
          {cat.icone}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-tinta">
        {t.label ?? t.description}
        {t.installment && (
          <span className="tabular ml-2 rounded-sm bg-carvao-800 px-1.5 py-0.5 text-[10px] text-tinta-fraca">
            {t.installment.current}/{t.installment.total}
          </span>
        )}
      </span>
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
      <span className={`tabular shrink-0 text-sm ${t.amount_cents < 0 ? 'text-confere' : 'text-tinta'}`}>
        {formatBRL(t.amount_cents)}
      </span>
    </li>
  )
}
