import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import type { CategoriaResumo } from '../../domain/insights'
import { formatBRL } from '../../domain/normalize/money'
import { nomeCategoria } from '../../domain/categorize/categorias'
import { useFiltros } from '../../dados/useFiltros'
import { escreverFiltros } from '../../dados/filtros'
import { useT } from '../../i18n/IdiomaProvider'
import { MarcaCategoria } from '../MarcaCategoria'

type Props = {
  categorias: CategoriaResumo[]
  totalCents: number
}

const R = 52
const CIRC = 2 * Math.PI * R
/** Vão de 2px entre fatias. Sem ele, duas categorias de cor parecida viram
 *  um bloco só — o vão é o que separa as fatias antes da cor. */
const VAO = 2

/** Gasto por categoria, em SVG próprio — sem biblioteca de gráfico.
 *
 *  **A cor é da CATEGORIA, não da posição no ranking.** A mesma categoria
 *  tem a mesma cor no donut, na lista e no seletor, e trocar o mês não
 *  repinta o que sobrou. Por isso a paleta aqui não é a lista fixa de oito
 *  matizes validadas: a identidade vence.
 *
 *  O preço disso é que duas cores de categoria podem ficar próximas para
 *  quem tem daltonismo — então **o rótulo direto ao lado não é enfeite, é a
 *  condição que torna o gráfico legível**: cada fatia aparece na lista com
 *  ícone, nome, valor e percentual. Identidade nunca depende só da cor.
 *
 *  Interativo: passar o mouse (ou focar pelo teclado) destaca a fatia e
 *  mostra o valor dela no centro; clicar abre os lançamentos da categoria. */
export function GraficoCategorias({ categorias, totalCents }: Props) {
  const semMovimento = useReducedMotion()
  const navigate = useNavigate()
  const { filtros } = useFiltros()
  const { t } = useT()
  const [ativa, setAtiva] = useState<number | null>(null)

  if (totalCents === 0 || categorias.length === 0) return null

  const topo = categorias.slice(0, 8)
  const suave = [0.22, 1, 0.36, 1] as const

  const emFoco = ativa !== null ? topo[ativa] : null
  const rotuloCentro = emFoco ? nomeCategoria(emFoco.cat) : t('dash.gastoReal')
  const valorCentro = emFoco ? emFoco.totalCents : totalCents

  /** Abre os lançamentos da categoria SEM perder o recorte atual.
   *
   *  A versão anterior montava `?cat=…` na mão e ia embora com o resto: quem
   *  clicava numa fatia de maio, filtrando por um banco, caía em lançamentos
   *  de outro mês (a página, sem `ref` na URL, se ancora na competência mais
   *  recente) e com todos os bancos. O gráfico mostrava uma coisa e o clique
   *  levava a outra. */
  function abrir(slug: string) {
    navigate(`/lancamentos${escreverFiltros({ ...filtros, categoria: slug })}`)
  }

  let acumulado = 0

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 130 130"
          className="h-40 w-40 -rotate-90"
          role="img"
          aria-label={t('donut.rotulo', { total: formatBRL(totalCents) })}
        >
          {topo.map((c, i) => {
            const fracao = c.totalCents / totalCents
            const arco = Math.max(fracao * CIRC - VAO, 1)
            const offset = -acumulado * CIRC
            acumulado += fracao
            const destacada = ativa === i
            return (
              <motion.circle
                key={c.cat.slug}
                cx="65"
                cy="65"
                r={R}
                fill="none"
                stroke={c.cat.cor}
                strokeWidth={destacada ? 20 : 15}
                strokeDashoffset={offset}
                opacity={ativa === null || destacada ? 1 : 0.35}
                initial={semMovimento ? false : { strokeDasharray: `0 ${CIRC}` }}
                animate={{ strokeDasharray: `${arco} ${CIRC - arco}` }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: suave }}
                style={{ transition: 'stroke-width .12s, opacity .12s' }}
              />
            )
          })}
        </svg>

        {/* O texto do centro fica em HTML, fora do SVG girado: dentro dele
            precisaria de um rotate(90) de correção em cada nó, e a fonte
            não herdaria os tokens. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="rotulo max-w-[7rem] truncate !text-[9px]">{rotuloCentro}</p>
            <p className="tabular mt-0.5 text-base font-semibold text-tinta">
              {formatBRL(valorCentro).replace('R$', '').trim()}
            </p>
          </div>
        </div>
      </div>

      {/* A lista É a legenda, e é obrigatória — ver o comentário do topo. */}
      <ul className="min-w-[15rem] flex-1 space-y-px">
        {topo.map((c, i) => (
          <motion.li
            key={c.cat.slug}
            initial={semMovimento ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.2 + i * 0.04, ease: suave }}
          >
            <button
              onClick={() => abrir(c.cat.slug)}
              onMouseEnter={() => setAtiva(i)}
              onMouseLeave={() => setAtiva(null)}
              onFocus={() => setAtiva(i)}
              onBlur={() => setAtiva(null)}
              className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1 text-left text-sm transition-colors hover:bg-afundado"
              aria-label={t('donut.rotuloFatia', {
                categoria: nomeCategoria(c.cat),
                valor: formatBRL(c.totalCents),
                pct: Math.round((c.totalCents / totalCents) * 100),
              })}
            >
              <MarcaCategoria cor={c.cat.cor} />
              <span aria-hidden className="text-sm">
                {c.cat.icone}
              </span>
              <span className="flex-1 truncate text-tinta-fraca">{nomeCategoria(c.cat)}</span>
              <span className="tabular text-tinta">{formatBRL(c.totalCents)}</span>
              <span className="tabular w-10 text-right text-xs text-tinta-tenue">
                {Math.round((c.totalCents / totalCents) * 100)}%
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
