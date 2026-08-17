import { useMemo } from 'react'
import { LinhaTransacao, CabecalhoLancamentos } from './LinhaTransacao'
import { buscar } from '../../domain/busca'
import { categoria, nomeCategoria } from '../../domain/categorize/categorias'
import { formatBRL } from '../../domain/normalize/money'
import { useT } from '../../i18n/IdiomaProvider'
import type { TransacaoSalva } from '../../persist/puxar'

type Props = {
  txs: TransacaoSalva[]
  onEditar: (t: TransacaoSalva) => void
  /** Busca e categoria vêm de fora — na tela, da URL.
   *
   *  Eram `useState` daqui de dentro, e isso deixava duas promessas do
   *  projeto por cumprir: o recorte não sobrevivia ao F5, e o clique numa
   *  fatia do donut (que navega para `/lancamentos?cat=…`) chegava aqui sem
   *  efeito nenhum — a pessoa via a lista inteira, sem saber por quê. */
  termo: string
  cat: string | null
  onTermo: (v: string) => void
  onCat: (v: string | null) => void
}

/** Lista plana do período com busca por texto e filtro por categoria.
 *
 *  As outras duas vistas (por categoria, por dia) respondem "para onde foi o
 *  dinheiro". Esta responde "onde está aquela compra" — a pergunta que não
 *  tinha resposta antes: só dava para navegar por agrupamento, nunca
 *  procurar. Ordena por data desc, a ordem que a memória usa. */
export function ListaTodos({ txs, onEditar, termo, cat, onTermo, onCat }: Props) {
  const { t, idioma } = useT()

  // Categorias presentes nestas transações, para o filtro só oferecer o que
  // de fato existe no período. `idioma` entra nas dependências porque a
  // ordem alfabética é pelo nome TRADUZIDO: sem ele a lista ficaria ordenada
  // pelo idioma anterior depois de trocar.
  const categorias = useMemo(() => {
    const slugs = [...new Set(txs.map((x) => x.category_slug ?? 'outros'))]
    return slugs
      .map((s) => ({ slug: s, cat: categoria(s) }))
      .sort((a, b) => nomeCategoria(a.cat).localeCompare(nomeCategoria(b.cat)))
    // `idioma` não aparece no corpo, mas É dependência: `nomeCategoria` lê uma
    // variável de MÓDULO que o IdiomaProvider reescreve ao trocar de idioma.
    // O linter não enxerga isso e chama de desnecessária — sem ela, a ordem
    // alfabética fica congelada no idioma anterior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, idioma])

  // Ao trocar de período, a categoria escolhida pode não existir mais. O
  // <select> então cai visualmente em "todas" (nenhuma option casa com o
  // value) enquanto o estado continua filtrando — a tela mostrava "0
  // lançamentos" com um filtro invisível. Derivar a categoria efetiva mantém
  // o que se vê e o que se filtra sempre iguais, sem depender de um efeito.
  const catEfetiva = cat && categorias.some((c) => c.slug === cat) ? cat : null

  const filtradas = useMemo(() => {
    const r = buscar(txs, termo, catEfetiva)
    return [...r].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [txs, termo, catEfetiva])

  const totalCents = useMemo(
    () => filtradas.reduce((a, x) => (x.kind === 'expense' ? a + x.amount_cents : a), 0),
    [filtradas],
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
        <input
          type="search"
          value={termo}
          onChange={(e) => onTermo(e.target.value)}
          placeholder={t('busca.placeholder')}
          aria-label={t('busca.rotulo')}
          className="min-w-0 flex-1 rounded-lg border border-campo-borda bg-carvao-950/40 px-3 py-1.5 text-sm text-tinta placeholder:text-tinta-tenue"
        />
        <select
          value={catEfetiva ?? ''}
          onChange={(e) => onCat(e.target.value || null)}
          aria-label={t('busca.categoria')}
          className="rounded-lg border border-campo-borda bg-carvao-950/40 px-2 py-1.5 text-sm text-tinta"
        >
          <option value="">{t('busca.todasCategorias')}</option>
          {categorias.map(({ slug, cat: c }) => (
            <option key={slug} value={slug}>
              {c.icone} {nomeCategoria(c)}
            </option>
          ))}
        </select>
      </div>

      {/* Uma string só, não pedaços concatenados em JSX: assim o leitor de
          tela lê uma frase e o texto fica localizável como um nó único. */}
      <p className="tabular px-3 pb-2 text-[11px] text-tinta-tenue">
        {t(filtradas.length === 1 ? 'busca.resultado1' : 'busca.resultados', {
          n: filtradas.length,
        }) + (totalCents > 0 ? ` · ${formatBRL(totalCents)}` : '')}
      </p>

      {filtradas.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-tinta-fraca">{t('busca.vazio')}</p>
      ) : (
        <>
          <CabecalhoLancamentos mostrarCategoria />
          <ul>
            {filtradas.map((x) => (
              <LinhaTransacao key={x.id} t={x} onEditar={onEditar} mostrarCategoria />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
