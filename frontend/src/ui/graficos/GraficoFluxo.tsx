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
type Serie = 'entrada' | 'saida' | 'resultado' | 'acumulado'

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

/** Compara entradas, saídas e resultado por competência. O acumulado soma
 * apenas os meses documentados; lacunas continuam vazias e interrompem a linha. */
export function GraficoFluxo({ serie, competencias, ativo, onSelecionar }: Props) {
  const formatBRL = useDinheiro()
  const semMovimento = useReducedMotion()
  const { t } = useT()
  const [modo, setModo] = useState<Modo>('periodo')
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
  const acumulados = useMemo(() => {
    const totais = serie.reduce<number[]>((valores, p) => {
      const anterior = valores[valores.length - 1] ?? 0
      return [...valores, anterior + p.entradasCents - p.gastoCents]
    }, [])
    const porCompetencia = new Map(serie.map((p, i) => [p.competencia, totais[i]]))
    return pontos.map((p) => porCompetencia.get(p.competencia) ?? null)
  }, [serie, pontos])

  if (pontos.length < 2) return null

  const entradas = pontos.map((p) => p.dados?.entradasCents ?? null)
  const saidas = pontos.map((p) => p.dados?.gastoCents ?? null)
  const resultados = pontos.map((p) => p.dados ? p.dados.entradasCents - p.dados.gastoCents : null)
  const linhaSecundaria = modo === 'acumulado' ? acumulados : resultados
  const conhecidos = modo === 'acumulado'
    ? linhaSecundaria.filter((v): v is number => v !== null)
    : [...entradas, ...saidas, ...resultados].filter((v): v is number => v !== null)
  const minimo = Math.min(0, ...conhecidos)
  const maximo = Math.max(...conhecidos, 1)
  const zero = yDoValor(0, minimo, maximo)
  const emLeitura = pontos.find((p) => p.competencia === emFoco) ?? pontos.find((p) => p.competencia === ativo) ?? pontos[pontos.length - 1]
  const indiceLeitura = pontos.findIndex((p) => p.competencia === emLeitura.competencia)
  const acumuladoLeitura = acumulados[indiceLeitura]
  const resultadoLeitura = emLeitura.dados
    ? modo === 'acumulado' ? acumuladoLeitura : emLeitura.dados.entradasCents - emLeitura.dados.gastoCents
    : null
  const rotuloModo = modo === 'acumulado' ? t('fluxo.modoAcumulado') : t('fluxo.modoPeriodo')
  const tituloResultado = modo === 'acumulado' ? t('fluxo.modoAcumulado') : t('fluxo.resultado')
  const larguraBarra = Math.min(18, LARGURA / pontos.length * 0.28)
  const deslocamentoBarra = larguraBarra / 2 + 2

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="rotulo">{t('fluxo.titulo')}</p>
          <p className="mt-1 text-xs text-tinta-fraca">{t('fluxo.descricao')}</p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <span className="rotulo !text-[9px]">{t('fluxo.modoRotulo')}</span>
          <div role="group" aria-label={t('fluxo.modoRotulo')} className="inline-flex rounded-md border border-campo-borda bg-afundado p-1">
            {(['periodo', 'acumulado'] as const).map((opcao) => (
              <button
                key={opcao}
                type="button"
                aria-pressed={modo === opcao}
                onClick={() => {
                  setModo(opcao)
                  setSerieFixada(null)
                  setSerieEmFoco(null)
                }}
                className={`min-h-9 rounded px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca ${
                  modo === opcao ? 'bg-superficie text-tinta shadow-sm' : 'text-tinta-fraca hover:text-tinta'
                }`}
              >
                {opcao === 'periodo' ? t('fluxo.modoPeriodo') : t('fluxo.modoAcumulado')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-tinta-fraca">
        {(modo === 'periodo'
          ? [
              ['entrada', t('evolucao.entradas')],
              ['saida', t('evolucao.saidas')],
              ['resultado', t('fluxo.resultado')],
            ] as const
          : [['acumulado', t('fluxo.modoAcumulado')]] as const
        ).map(([cor, nome]) => (
          <button key={cor} type="button" aria-pressed={serieFixada === cor}
            onClick={() => setSerieFixada(serieFixada === cor ? null : cor)}
            onMouseEnter={() => setSerieEmFoco(cor)} onMouseLeave={() => setSerieEmFoco(null)}
            onFocus={() => setSerieEmFoco(cor)} onBlur={() => setSerieEmFoco(null)}
            className={`flex min-h-11 items-center gap-2 rounded-md border px-3 ${destaque === cor ? 'border-campo-borda bg-afundado' : 'border-transparent'}`}>
            <span aria-hidden className={`w-4 border-t-2 ${cor === 'acumulado' || cor === 'resultado' ? 'border-dashed' : ''}`}
              style={{ borderColor: `var(--color-grafico-${cor === 'resultado' ? 'acumulado' : cor})` }} />
            {nome}
          </button>
        ))}
      </div>

      {modo === 'acumulado' && pontos.some((p) => !p.dados) && (
        <p className="mb-3 text-xs leading-relaxed text-tinta-fraca">{t('fluxo.lacunasAviso')}</p>
      )}
      <div className="mb-2 flex min-h-10 flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-afundado px-3 py-2">
        <span className="rotulo !text-[10px]">{rotulo(emLeitura.competencia)}</span>
        {emLeitura.dados ? <>
        <span className="tabular text-xs text-credito">+{valorCompacto(emLeitura.dados.entradasCents, formatBRL)}</span>
        <span className="tabular text-xs text-debito">−{valorCompacto(emLeitura.dados.gastoCents, formatBRL)}</span>
        <span className={`ml-auto tabular text-xs ${resultadoLeitura !== null && resultadoLeitura < 0 ? 'text-debito' : 'text-tinta'}`}>
          <span className="mr-1 text-tinta-tenue">{tituloResultado}</span>
          {resultadoLeitura !== null ? valorCompacto(resultadoLeitura, formatBRL) : '—'}
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
          aria-label={t('fluxo.rotulo', { modo: rotuloModo })}
        >
          {[TOPO, (TOPO + BASE) / 2, BASE].map((y) => (
            <line key={y} x1={ESQUERDA} x2={LARGURA - DIREITA} y1={y} y2={y}
              stroke="var(--color-grade-grafico)" strokeDasharray="2 5" opacity="0.78" />
          ))}
          <line x1="0" x2={LARGURA} y1={zero} y2={zero} stroke="var(--color-linha-grafico)" strokeWidth="1.25" />

          {modo === 'periodo' && pontos.map((p, i) => p.dados && (
            <g key={p.competencia}>
              {([
                ['entrada', p.dados.entradasCents, -deslocamentoBarra],
                ['saida', p.dados.gastoCents, deslocamentoBarra],
              ] as const).map(([cor, valor, deslocamento]) => {
                const y = yDoValor(valor, minimo, maximo)
                return (
                  <motion.rect
                    key={cor}
                    data-serie={cor}
                    x={xDoIndice(i, pontos.length) + deslocamento - larguraBarra / 2}
                    y={Math.min(zero, y)}
                    width={larguraBarra}
                    height={Math.max(1, Math.abs(zero - y))}
                    rx="2"
                    fill={`var(--color-grafico-${cor})`}
                    opacity={opacidade(cor)}
                    initial={semMovimento ? false : { opacity: 0.25 }}
                    animate={{ opacity: opacidade(cor) }}
                    transition={{ duration: 0.35 }}
                  />
                )
              })}
            </g>
          ))}

          {modo === 'acumulado' && (
            <path d={caminhoArea(linhaSecundaria, minimo, maximo)} fill="var(--color-grafico-acumulado)" fillOpacity="0.11" />
          )}
          <motion.path
            data-serie={modo === 'acumulado' ? 'acumulado' : 'resultado'}
            d={caminhoLinha(linhaSecundaria, minimo, maximo)}
            fill="none"
            stroke="var(--color-grafico-acumulado)"
            vectorEffect="non-scaling-stroke"
            strokeWidth="2.5"
            strokeDasharray={modo === 'acumulado' ? undefined : '6 4'}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: opacidade(modo === 'acumulado' ? 'acumulado' : 'resultado') }}
            transition={{ duration: 0.55 }}
          />
          {pontos.map((p, i) => p.dados && (
            <circle key={p.competencia} data-ponto={p.competencia}
              cx={xDoIndice(i, pontos.length)} cy={yDoValor(modo === 'acumulado' ? acumulados[i] ?? 0 : resultados[i] ?? 0, minimo, maximo)}
              r="3.5" fill="var(--color-grafico-acumulado)" />
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
              <span aria-hidden className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-grafico-acumulado/45 transition-opacity ${
                emLeitura.competencia === p.competencia ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`} />
              <span className={`tabular absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] ${
                pontos.length > 6 && i % 3 !== 0 && i !== pontos.length - 1 ? 'hidden sm:block' : ''
              } ${p.competencia === ativo ? 'font-semibold text-tinta' : 'text-tinta-tenue'}`}>
                {rotulo(p.competencia)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1 text-right text-[10px] text-tinta-tenue">
        {modo === 'acumulado' ? t('fluxo.rodapeAcumulado') : t('fluxo.rodapePeriodo')}
      </p>
    </div>
  )
}
