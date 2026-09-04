import { categoria, nomeCategoria } from '../../domain/categorize/categorias'
import { ehVinculo } from '../../domain/link/vinculos'

import { useT } from '../../i18n/IdiomaProvider'
import type { TransacaoSalva } from '../../persist/puxar'
import { useDinheiro } from '../../dados/DiscretoProvider'

type Props = {
  t: TransacaoSalva
  onEditar: (t: TransacaoSalva) => void
  /** Esconde o ícone da categoria (dentro de uma seção de categoria). */
  semIcone?: boolean
  /** Mostra a coluna de categoria (desktop) — útil na visão por dia. */
  mostrarCategoria?: boolean
}

/** Linha de lançamento em colunas alinhadas (estilo planilha): data,
 *  descrição, categoria (desktop) e valor, com um lápis para editar. Zebra
 *  via `even:`. Reutilizada nas visões por dia e categoria.
 *
 *  ⚠️ **O lápis só some no hover a partir de `lg`.** Ele era `opacity-0` com
 *  `group-hover:opacity-100` em toda largura, e num celular não existe
 *  hover: o botão ficava clicável mas INVISÍVEL para sempre. Corrigir uma
 *  categoria errada — o gesto que o app inteiro pede que a pessoa faça, e
 *  com o qual ele aprende — não tinha porta de entrada no telefone. Pior:
 *  os 44px do botão invisível continuavam ocupando a linha e empurravam o
 *  valor para fora.
 *
 *  `lg` e não uma consulta de ponteiro fino porque é o mesmo limite em que a
 *  calha lateral aparece: abaixo dele o projeto já assume dedo. */
export function LinhaTransacao({ t, onEditar, semIcone, mostrarCategoria }: Props) {
  const formatBRL = useDinheiro()
  const { t: tr } = useT()
  const cat = categoria(t.category_slug ?? 'outros')
  const interno = ehVinculo(t.kind)
  return (
    <li
      className={`group flex items-center gap-2 px-2 py-1.5 text-sm transition-colors even:bg-carvao-950/25 hover:bg-carvao-850 sm:gap-3 sm:px-3 ${
        interno ? 'opacity-55' : ''
      }`}
    >
      <span className="tabular w-11 shrink-0 text-xs text-tinta-tenue sm:w-12">
        {t.date.slice(8, 10)}/{t.date.slice(5, 7)}
      </span>
      {!semIcone && (
        <span className="shrink-0 text-base" title={nomeCategoria(cat)}>
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
        <span
          className="hidden w-32 shrink-0 truncate text-xs text-tinta-tenue lg:block"
          title={nomeCategoria(cat)}
        >
          {nomeCategoria(cat)}
        </span>
      )}
      <button
        onClick={() => onEditar(t)}
        aria-label={tr('editar.titulo')}
        title={tr('linha.renomearTitle')}
        className="screen-only grid h-11 w-11 shrink-0 place-items-center rounded-md text-tinta-tenue transition-[opacity,background-color,color] hover:bg-carvao-800 hover:text-tinta focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      </button>
      <span
        className={`tabular w-24 shrink-0 text-right text-xs sm:w-28 sm:text-sm ${t.amount_cents < 0 ? 'text-confere' : 'text-tinta'}`}
      >
        {formatBRL(t.amount_cents)}
      </span>
    </li>
  )
}

/** Cabeçalho de colunas para as listas (estilo planilha). */
export function CabecalhoLancamentos({ mostrarCategoria }: { mostrarCategoria?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-carvao-800 bg-carvao-900 px-2 py-2 text-[10px] uppercase tracking-widest text-tinta-tenue sm:gap-3 sm:px-3">
      <span className="w-11 shrink-0 sm:w-12">Data</span>
      <span className="min-w-0 flex-1">Descrição</span>
      {mostrarCategoria && <span className="hidden w-32 shrink-0 lg:block">Categoria</span>}
      <span className="w-11 shrink-0" />
      <span className="w-24 shrink-0 text-right sm:w-28">Valor</span>
    </div>
  )
}
