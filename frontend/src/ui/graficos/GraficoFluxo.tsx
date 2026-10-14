import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import type { PontoMes } from '../../domain/agrupar'
import { mesAbrev } from '../../domain/normalize/data'
import { useDinheiro } from '../../dados/DiscretoProvider'
import { useT } from '../../i18n/IdiomaProvider'

type Props = {
  serie: PontoMes[]
  competencias?: string[]
  ativo: string
  onSelecionar: (competencia: string) => void
}

type Modo = 'acumulado' | 'periodo'
type Serie = 'entrada' | 'saida' | 'acumulado'

const LARGURA = 720
const ALTURA = 250
const ESQUERDA = 0
const DIREITA = 0
const TOPO = 14
const BASE = 204

function xDoIndice(indice: number, total: number): number {
  return ESQUERDA + (LARGURA - ESQUERDA - DIREITA) * (indice + 0.5) / total
}

function rotulo(comp: string): string {
  const [y, m] = comp.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return m === 1 ? `${mesAbrev(d)}/${String(y).slice(2)}` : mesAbrev(d)
}

function yDoValor(valor: number, minimo: number, maximo: number): number {
  const faixa = maximo - minimo || 1
  return TOPO + ((maximo - valor) / faixa) * (BASE - TOPO)
}

function caminhoLinha(valores: (number | null)[], minimo: number, maximo: number): string {
  return valores
    .map((valor, i) => {
      if (valor === null) return ''
      const x = xDoIndice(i, valores.length)
      const y = yDoValor(valor, minimo, maximo)
      return `${i === 0 || valores[i - 1] === null ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function caminhoArea(valores: (number | null)[], minimo: number, maximo: number): string {
  const zero = yDoValor(0, minimo, maximo)
  let inicio = ESQUERDA
  return valores.map((valor, i) => {
    if (valor === null) return ''
    const x = xDoIndice(i, valores.length)
    const novo = i === 0 || valores[i - 1] === null
    if (novo) inicio = x
    const trecho = `${novo ? 'M' : 'L'} ${x.toFixed(2)} ${yDoValor(valor, minimo, maximo).toFixed(2)}`
    const fim = i === valores.length - 1 || valores[i + 1] === null
    return fim ? `${trecho} L ${x.toFixed(2)} ${zero.toFixed(2)} L ${inicio.toFixed(2)} ${zero.toFixed(2)} Z` : trecho
  }).join(' ')
}

function valorCompacto(valor: number, formatBRL: (cents: number) => string): string {
  return formatBRL(valor).replace('R$', '').trim()
}

/** Fluxo financeiro no formato analítico do Ambit.
 *
 * A estrutura é nova, mas a fonte não é: toda série vem de `evolucaoMensal`,
 * que já agrupa pela competência e ignora vínculos. O desenho só organiza a
 * leitura — entradas e saídas como áreas, e uma terceira linha alternável
 * para resultado do período ou saldo acumulado.
 */
export function GraficoFluxo({ serie, competencias, ativo, onSelecionar }: Props) {
  const formatBRL = useDinheiro()
  const semMovimento = useReducedMotion()
  const { t } = useT()
  const [modo, setModo] = useState<Modo>('acumulado')
  const [emFoco, setEmFoco] = useState<string | null>(null)
  const [serieEmFoco, setSerieEmFoco] = useState<Serie | null>(null)
  const [serieFixada, setSerieFixada] = useState<Serie | null>(null)
  const destaque = serieEmFoco ?? serieFixada
  const opacidade = (cor: Serie) => destaque === null || destaque === cor ? 1 : 0.25

  const pontos = useMemo(() => {
    const mapa = new Map(serie.map((p) => [p.competencia, p]))
    return (competencias ?? serie.map((p) => p.competencia)).slice(-12).map((competencia) => ({
      competencia, dados: mapa.get(competencia) ?? null,
    }))
  }, [serie, competencias])
  const temLacunas = pontos.some((p) => p.dados === null)
  const modoLeitura = temLacunas ? 'periodo' : modo
  const acumulados = useMemo(() => {
    const totais = serie.reduce<number[]>((valores, p) => {
      const anterior = valores[valores.length - 1] ?? 0
      return [...valores, anterior + p.entradasCents - p.gastoCents]
    }, [])
    const porCompetencia = new Map(serie.map((p, i) => [p.competencia, totais[i]]))
    return pontos.map((p) => porCompetencia.get(p.competencia) ?? 0)
  }, [serie, pontos])

  if (pontos.length < 2) return null

  const entradas = pontos.map((p) => p.dados?.entradasCents ?? null)
  const saidas = pontos.map((p) => p.dados?.gastoCents ?? null)
  const resultados = pontos.map((p) => p.dados ? p.dados.entradasCents - p.dados.gastoCents : null)
  const linhaSecundaria = modoLeitura === 'acumulado' ? acumulados : resultados
  const conhecidos = [...entradas, ...saidas, ...linhaSecundaria].filter((v): v is number => v !== null)
  const minimo = Math.min(0, ...conhecidos)
  const maximo = Math.max(...conhecidos, 1)
  const zero = yDoValor(0, minimo, maximo)
  const emLeitura = pontos.find((p) => p.competencia === emFoco) ?? pontos.find((p) => p.competencia === ativo) ?? pontos[pontos.length - 1]
  const indiceLeitura = pontos.findIndex((p) => p.competencia === emLeitura.competencia)
  const acumuladoLeitura = acumulados[indiceLeitura]
  const resultadoLeitura = emLeitura.dados
    ? modoLeitura === 'acumulado' ? acumuladoLeitura : emLeitura.dados.entradasCents - emLeitura.dados.gastoCents
    : null

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="rotulo">{t('fluxo.titulo')}</p>
          <p className="mt-1 text-xs text-tinta-fraca">{t('fluxo.descricao')}</p>
        </div>
        <label className="flex items-center gap-2 text-[10px] text-tinta-tenue">
          <span className="rotulo !text-[9px]">{t('fluxo.modoRotulo')}</span>
          <select
            aria-label={t('fluxo.modoRotulo')}
            value={modoLeitura}
            onChange={(event) => setModo(event.target.value as Modo)}
            className="rounded-sm border border-campo-borda bg-afundado px-2 py-1 text-xs text-tinta"
          >
            <option value="acumulado" disabled={temLacunas}>{t('fluxo.modoAcumulado')}</option>
            <option value="periodo">{t('fluxo.modoPeriodo')}</option>
          </select>
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-tinta-fraca">
        {([
          ['entrada', t('evolucao.entradas')],
          ['saida', t('evolucao.saidas')],
          ['acumulado', modoLeitura === 'acumulado' ? t('fluxo.modoAcumulado') : t('fluxo.modoPeriodo')],
        ] as const).map(([cor, nome]) => (
          <button key={cor} type="button" aria-pressed={serieFixada === cor}
            onClick={() => setSerieFixada(serieFixada === cor ? null : cor)}
            onMouseEnter={() => setSerieEmFoco(cor)} onMouseLeave={() => setSerieEmFoco(null)}
            onFocus={() => setSerieEmFoco(cor)} onBlur={() => setSerieEmFoco(null)}
            className={`flex min-h-11 items-center gap-2 rounded-md border px-3 ${destaque === cor ? 'border-campo-borda bg-afundado' : 'border-transparent'}`}>
            <span aria-hidden className={`w-4 border-t-2 ${cor === 'acumulado' ? 'border-dashed' : ''}`}
              style={{ borderColor: `var(--color-grafico-${cor})` }} />
            {nome}
          </button>
        ))}
      </div>

      {temLacunas && <p className="mb-3 text-xs leading-relaxed text-tinta-fraca">{t('fluxo.lacunasAviso')}</p>}
      <div className="mb-2 flex min-h-9 flex-wrap items-center gap-3 rounded-sm bg-afundado px-3 py-2">
        <span className="rotulo !text-[10px]">{rotulo(emLeitura.competencia)}</span>
        {emLeitura.dados ? <>
        <span className="tabular text-xs text-credito">
          +{valorCompacto(emLeitura.dados.entradasCents, formatBRL)}
        </span>
        <span className="tabular text-xs text-debito">
          −{valorCompacto(emLeitura.dados.gastoCents, formatBRL)}
        </span>
        <span
          className={`tabular ml-auto text-xs ${
            resultadoLeitura !== null && resultadoLeitura < 0 ? 'text-debito' : 'text-tinta'
          }`}
        >
          {resultadoLeitura !== null && valorCompacto(resultadoLeitura, formatBRL)}
        </span>
        </> : <span className="text-xs text-tinta-fraca">{t('relatorios.mesSemDados')}</span>}
      </div>

      <p className="mb-1 text-[10px] text-tinta-tenue tabular">
        {t('fluxo.escala', { min: valorCompacto(minimo, formatBRL), max: valorCompacto(maximo, formatBRL) })}
      </p>
      <div className="relative h-56 min-w-0" data-grafico="fluxo">
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={t('fluxo.rotulo', { modo: modoLeitura === 'acumulado' ? t('fluxo.modoAcumulado') : t('fluxo.modoPeriodo') })}
        >
          {[TOPO, (TOPO + BASE) / 2, BASE].map((y) => (
            <line
              key={y}
              x1={ESQUERDA}
              x2={LARGURA - DIREITA}
              y1={y}
              y2={y}
              stroke="var(--color-grade-grafico)"
              strokeDasharray="2 5"
              opacity="0.78"
            />
          ))}
          {minimo < 0 && <line x1="0" x2={LARGURA} y1={zero} y2={zero} stroke="var(--color-grade-grafico)" />}
          <motion.path
            d={caminhoArea(entradas, minimo, maximo)}
            fill="var(--color-grafico-entrada)"
            fillOpacity="0.08"
            stroke="none"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: opacidade('entrada') }}
            transition={{ duration: 0.55 }}
          />
          <motion.path
            d={caminhoArea(saidas, minimo, maximo)}
            fill="var(--color-grafico-saida)"
            fillOpacity="0.07"
            stroke="none"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: opacidade('saida') }}
            transition={{ duration: 0.55, delay: 0.06 }}
          />
          <motion.path
            d={caminhoLinha(entradas, minimo, maximo)}
            fill="none"
            stroke="var(--color-grafico-entrada)"
            vectorEffect="non-scaling-stroke"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={semMovimento ? false : { pathLength: 0 }}
            animate={{ pathLength: 1, opacity: opacidade('entrada') }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path
            d={caminhoLinha(saidas, minimo, maximo)}
            fill="none"
            stroke="var(--color-grafico-saida)"
            vectorEffect="non-scaling-stroke"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={semMovimento ? false : { pathLength: 0 }}
            animate={{ pathLength: 1, opacity: opacidade('saida') }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          />
          <motion.path
            d={caminhoLinha(linhaSecundaria, minimo, maximo)}
            fill="none"
            stroke="var(--color-grafico-acumulado)"
            vectorEffect="non-scaling-stroke"
            strokeWidth="1.8"
            strokeDasharray="5 4"
            strokeLinecap="round"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: opacidade('acumulado') }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.16 }}
          />
          {temLacunas && pontos.map((p, i) => p.dados && (
            <g key={p.competencia}>
              {([['entrada', p.dados.entradasCents], ['saida', p.dados.gastoCents], ['acumulado', resultados[i]!]] as const).map(([cor, valor]) => (
                <circle key={cor} cx={xDoIndice(i, pontos.length)} opacity={opacidade(cor)}
                  cy={yDoValor(valor, minimo, maximo)} r="3" fill={`var(--color-grafico-${cor})`} />
              ))}
            </g>
          ))}
        </svg>

        <div className="absolute inset-0 flex">
          {pontos.map((p, i) => (
            <button
              key={p.competencia}
              type="button"
              onClick={() => { setEmFoco(p.competencia); if (p.dados) onSelecionar(p.competencia) }}
              aria-disabled={!p.dados || undefined}
              onMouseEnter={() => setEmFoco(p.competencia)}
              onMouseLeave={() => setEmFoco(null)}
              onFocus={() => setEmFoco(p.competencia)}
              onBlur={() => setEmFoco(null)}
              aria-current={p.competencia === ativo ? 'true' : undefined}
              aria-label={p.dados ? t('fluxo.rotuloPonto', {
                mes: rotulo(p.competencia),
                entradas: formatBRL(p.dados.entradasCents),
                saidas: formatBRL(p.dados.gastoCents),
                resultado: formatBRL(p.dados.entradasCents - p.dados.gastoCents),
              }) : t('fluxo.mesSemDados', { mes: rotulo(p.competencia) })}
              className="group relative h-full min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-inset"
            >
              <span
                aria-hidden
                className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-grafico-acumulado/45 transition-opacity ${
                  emLeitura.competencia === p.competencia ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              />
              <span
                className={`tabular absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] ${pontos.length > 6 && i % 3 !== 0 && i !== pontos.length - 1 ? 'hidden sm:block' : ''} ${
                  p.competencia === ativo ? 'font-semibold text-tinta' : 'text-tinta-tenue'
                }`}
              >
                {rotulo(p.competencia)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-right text-[10px] text-tinta-tenue">
        {modoLeitura === 'acumulado' ? t('fluxo.rodapeAcumulado') : t('fluxo.rodapePeriodo')}
      </p>
    </div>
  )
}
