import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import type { CategoriaResumo } from '../../domain/insights'

import { nomeCategoria } from '../../domain/categorize/categorias'
import { useFiltros } from '../../dados/useFiltros'
import { escreverFiltros } from '../../dados/filtros'
import { useT } from '../../i18n/IdiomaProvider'
import { MarcaCategoria } from '../MarcaCategoria'
import { corCategoria } from '../corCategoria'
import { useDinheiro } from '../../dados/DiscretoProvider'
import { escalaRobusta, alturaPct } from './escala-barras'

type Props = {
  categorias: CategoriaResumo[]
  totalCents: number
  onAbrir?: (slug: string) => void
  /** O nome do total no centro do donut. Sem ele, "gasto real" — que deixa
   *  de ser verdade quando a página tira os atípicos do desenho. */
  rotuloTotal?: string
}

const R = 52
const CIRC = 2 * Math.PI * R
/** Vão de 2px entre fatias. Sem ele, duas categorias de cor parecida viram
 *  um bloco só — o vão é o que separa as fatias antes da cor. */
const VAO = 2

/** A partir de que fatia o donut deixa de responder.
 *
 *  Acima de dois terços, todas as outras categorias juntas dividem menos de
 *  um terço do círculo e as pequenas viram fiapos. O caso que motivou isto
 *  (U1 da auditoria de 30/10) era um empréstimo com 91% do mês. Abaixo do
 *  limiar o donut fica: 60/40 é perfeitamente legível. */
const DOMINANCIA = 2 / 3

/** A geometria do donut: cada fatia começa onde a anterior terminou.
 *
 *  Mora aqui fora porque o acumulado precisa ser DERIVADO antes da pintura.
 *  Somá-lo dentro do `map` do JSX reatribui uma variável do corpo do
 *  componente enquanto o React monta a árvore — trabalho que ele pode
 *  reexecutar pela metade, e o donut sairia com fatias sobrepostas. */
function geometriaDonut(topo: CategoriaResumo[], totalCents: number) {
  let acumulado = 0
  return topo.map((c) => {
    const fracao = c.totalCents / totalCents
    const fatia = { arco: Math.max(fracao * CIRC - VAO, 1), offset: -acumulado * CIRC }
    acumulado += fracao
    return fatia
  })
}

/** Gasto por categoria, em SVG próprio — sem biblioteca de gráfico.
 *
 *  Os tokens por categoria preservam a identidade entre temas e rankings.
 *  **O rótulo direto ao lado não é enfeite, é a condição que torna o gráfico
 *  legível**: cada fatia aparece com ícone, nome, valor e percentual.
 *
 *  Interativo: passar o mouse (ou focar pelo teclado) destaca a fatia e
 *  mostra o valor dela no centro; clicar abre os lançamentos da categoria. */
export function GraficoCategorias({ categorias, totalCents, onAbrir, rotuloTotal }: Props) {
  const formatBRL = useDinheiro()
  const semMovimento = useReducedMotion()
  const navigate = useNavigate()
  const { filtros } = useFiltros()
  const { t } = useT()
  const [ativa, setAtiva] = useState<number | null>(null)

  if (categorias.length === 0) return null

  const positivas = categorias.filter((c) => c.totalCents > 0)
  const negativas = categorias.filter((c) => c.totalCents < 0)
  const totalPositivoCents = positivas.reduce((soma, c) => soma + c.totalCents, 0)
  if (totalPositivoCents === 0 && negativas.length === 0) return null

  const topo = positivas.slice(0, 8)
  const itens = [...topo, ...negativas]
  const suave = [0.22, 1, 0.36, 1] as const

  const emFoco = ativa !== null ? itens[ativa] : null
  const rotuloCentro = emFoco ? nomeCategoria(emFoco.cat) : negativas.length > 0 ? t('grafico.saidasPositivas') : rotuloTotal ?? t('dash.gastoReal')
  const valorCentro = emFoco ? emFoco.totalCents : totalPositivoCents

  /** Abre os lançamentos da categoria SEM perder o recorte atual.
   *
   *  A versão anterior montava `?cat=…` na mão e ia embora com o resto: quem
   *  clicava numa fatia de maio, filtrando por um banco, caía em lançamentos
   *  de outro mês (a página, sem `ref` na URL, se ancora na competência mais
   *  recente) e com todos os bancos. O gráfico mostrava uma coisa e o clique
   *  levava a outra. */
  function abrir(slug: string) {
    if (onAbrir) return onAbrir(slug)
    navigate(`/lancamentos${escreverFiltros({ ...filtros, categoria: slug })}`)
  }

  const fatias = geometriaDonut(topo, totalPositivoCents)

  // Com uma categoria dominando, a lista vira o gráfico: as barras deixam de
  // ser fração do total (onde a dominante esmaga todas) e passam à escala
  // robusta dos outros gráficos, com a serrilha em quem passa do teto. O
  // percentual escrito continua sendo do total, então nada mente.
  const dominante = topo.length > 0 && topo[0].totalCents / totalPositivoCents > DOMINANCIA
  const escala = dominante ? escalaRobusta(topo.map((c) => c.totalCents)) : null
  const largura = (c: CategoriaResumo) => escala
    ? alturaPct(c.totalCents, escala)
    : Math.min((c.totalCents / totalCents) * 100, 100)

  return (
    <div>
      <div className="mb-5">
        <p className="rotulo">{t('dash.porCategoria')}</p>
        <p className="mt-1 text-xs text-tinta-fraca">
          {negativas.length > 0
            ? t('grafico.categoriasComEstornos')
            : dominante
            ? t('grafico.categoriasDominante', {
                categoria: nomeCategoria(topo[0].cat),
                pct: Math.round((topo[0].totalCents / totalPositivoCents) * 100),
              })
            : t('grafico.categoriasDescricao')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
      {!dominante && topo.length > 0 && <div className="relative shrink-0">
        <svg
          viewBox="0 0 130 130"
          className="h-40 w-40 -rotate-90"
          role="img"
          aria-label={t('donut.rotulo', { total: formatBRL(totalPositivoCents) })}
        >
          {topo.map((c, i) => {
            const { arco, offset } = fatias[i]
            const destacada = ativa === i
            const cor = corCategoria(c.cat)
            return (
              <motion.circle
                key={c.cat.slug}
                cx="65"
                cy="65"
                r={R}
                fill="none"
                stroke={cor}
                strokeWidth={destacada ? 20 : 15}
                strokeDashoffset={offset}
                opacity={ativa === null || destacada ? 1 : 0.28}
                initial={semMovimento ? false : { strokeDasharray: `0 ${CIRC}` }}
                animate={{ strokeDasharray: `${arco} ${CIRC - arco}` }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: suave }}
                onMouseEnter={() => setAtiva(i)}
                onMouseLeave={() => setAtiva(null)}
                style={{ transition: 'stroke-width .16s ease, opacity .26s ease' }}
              />
            )
          })}
        </svg>

        {/* O texto do centro fica em HTML, fora do SVG girado: dentro dele
            precisaria de um rotate(90) de correção em cada nó, e a fonte
            não herdaria os tokens. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="rotulo max-w-[7rem] truncate">{rotuloCentro}</p>
            <p className="tabular mt-0.5 text-base font-semibold text-tinta">
              {formatBRL(valorCentro).replace('R$', '').trim()}
            </p>
          </div>
        </div>
      </div>}

      {/* A lista É a legenda, e é obrigatória — ver o comentário do topo. */}
      <ul className="min-w-0 basis-64 flex-1 space-y-2">
        {itens.map((c, i) => (
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
              type="button"
              // Sem `aria-label`: o nome vem do que está escrito no botão,
              // e o resto da frase entra só para o leitor de tela. Um rótulo
              // à parte ("Mercado: R$ 10, 5% do total") quebrava o WCAG 2.5.3
              // — quem fala o que VÊ ("Mercado R$ 10 5%") não acionava o
              // botão por voz. O axe-core 4.14 passou a cobrar isso.
              className="grid min-h-11 w-full grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-afundado focus-visible:bg-afundado"
            >
              <MarcaCategoria cor={corCategoria(c.cat)} />
              <span aria-hidden className="text-sm">
                {c.cat.icone}
              </span>
              <span className="break-words text-tinta-fraca">{nomeCategoria(c.cat)}</span>{' '}
              <span className="tabular col-start-3 flex flex-wrap justify-between gap-x-3 text-tinta">{formatBRL(c.totalCents)}{' '}
              <span className="text-xs text-tinta-tenue">
                {c.totalCents < 0 ? t('grafico.estorno') : `${Math.round((c.totalCents / totalPositivoCents) * 100)}%`}{' '}
                <span className="sr-only">{t(c.totalCents < 0 ? 'fluxoPeriodo.verLancamentos' : 'donut.sufixoFatia')}</span>
              </span>
              </span>
            </button>
            {c.totalCents > 0 && <div aria-hidden className={`ml-9 mr-12 ${dominante ? 'h-2' : 'h-1'} overflow-hidden rounded-full bg-afundado`}>
              <motion.span
                className="relative block h-full rounded-full"
                style={{ backgroundColor: corCategoria(c.cat) }}
                initial={semMovimento ? false : { width: 0 }}
                animate={{ width: `${largura(c)}%` }}
                transition={{ duration: 0.55, delay: 0.1 + i * 0.04, ease: suave }}
              >
                {escala && c.totalCents > escala.teto && (
                  // Serrilha na ponta: a barra continua fora do desenho, a
                  // mesma convenção do eixo quebrado do ritmo diário.
                  <span
                    data-cortada
                    className="absolute inset-y-0 right-0 w-2"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, var(--color-carvao-900) 0 2px, transparent 2px 4px)',
                    }}
                  />
                )}
              </motion.span>
            </div>}
          </motion.li>
        ))}
      </ul>
    </div>
      {negativas.length > 0 && (
        <p className="tabular mt-3 text-xs text-tinta-fraca">
          {t('grafico.gastoAposEstornos', { total: formatBRL(totalCents) })}
        </p>
      )}
      {escala && escala.cortados > 0 && (
        <p className="tabular mt-3 text-[10px] text-tinta-tenue">
          {t('diario.escala', { teto: formatBRL(escala.teto) })} ·{' '}
          {t(escala.cortados === 1 ? 'grafico.categoriaAcima1' : 'grafico.categoriasAcima', {
            n: escala.cortados,
          })}
        </p>
      )}
    </div>
  )
}
