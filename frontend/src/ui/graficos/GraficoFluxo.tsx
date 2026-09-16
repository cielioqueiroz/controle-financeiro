import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import type { PontoMes } from '../../domain/agrupar'
import { mesAbrev } from '../../domain/normalize/data'
import { useDinheiro } from '../../dados/DiscretoProvider'
import { useT } from '../../i18n/IdiomaProvider'

type Props = {
  serie: PontoMes[]
  ativo: string
  onSelecionar: (competencia: string) => void
}

type Modo = 'acumulado' | 'periodo'

const LARGURA = 720
const ALTURA = 250
const ESQUERDA = 48
const DIREITA = 14
const TOPO = 14
const BASE = 204

function rotulo(comp: string): string {
  const [y, m] = comp.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return m === 1 ? `${mesAbrev(d)}/${String(y).slice(2)}` : mesAbrev(d)
}

function yDoValor(valor: number, minimo: number, maximo: number): number {
  const faixa = maximo - minimo || 1
  return TOPO + ((maximo - valor) / faixa) * (BASE - TOPO)
}

function caminhoLinha(valores: number[], minimo: number, maximo: number): string {
  const largura = LARGURA - ESQUERDA - DIREITA
  const passo = valores.length > 1 ? largura / (valores.length - 1) : 0
  return valores
    .map((valor, i) => {
      const x = ESQUERDA + passo * i
      const y = yDoValor(valor, minimo, maximo)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function caminhoArea(valores: number[], minimo: number, maximo: number): string {
  const linha = caminhoLinha(valores, minimo, maximo)
  const largura = LARGURA - ESQUERDA - DIREITA
  const zero = yDoValor(0, minimo, maximo)
  return `${linha} L ${(ESQUERDA + largura).toFixed(2)} ${zero.toFixed(2)} L ${ESQUERDA} ${zero.toFixed(2)} Z`
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
export function GraficoFluxo({ serie, ativo, onSelecionar }: Props) {
  const formatBRL = useDinheiro()
  const semMovimento = useReducedMotion()
  const { t } = useT()
  const [modo, setModo] = useState<Modo>('acumulado')
  const [emFoco, setEmFoco] = useState<string | null>(null)

  const pontos = useMemo(() => serie.slice(-12), [serie])
  const acumulados = useMemo(() => {
    const totais = serie.reduce<number[]>((valores, p) => {
      const anterior = valores[valores.length - 1] ?? 0
      return [...valores, anterior + p.entradasCents - p.gastoCents]
    }, [])
    return totais.slice(-12)
  }, [serie])

  if (pontos.length < 2) return null

  const entradas = pontos.map((p) => p.entradasCents)
  const saidas = pontos.map((p) => p.gastoCents)
  const resultados = pontos.map((p) => p.entradasCents - p.gastoCents)
  const linhaSecundaria = modo === 'acumulado' ? acumulados : resultados
  const minimo = Math.min(0, ...linhaSecundaria)
  const maximo = Math.max(...entradas, ...saidas, ...linhaSecundaria, 1)
  const zero = yDoValor(0, minimo, maximo)
  const emLeitura = pontos.find((p) => p.competencia === emFoco) ?? pontos[pontos.length - 1]
  const indiceLeitura = pontos.findIndex((p) => p.competencia === emLeitura.competencia)
  const acumuladoLeitura = acumulados[indiceLeitura]

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
            value={modo}
            onChange={(event) => setModo(event.target.value as Modo)}
            className="rounded-sm border border-campo-borda bg-afundado px-2 py-1 text-xs text-tinta"
          >
            <option value="acumulado">{t('fluxo.modoAcumulado')}</option>
            <option value="periodo">{t('fluxo.modoPeriodo')}</option>
          </select>
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-tinta-tenue">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-[1px] bg-grafico-entrada" />
          {t('evolucao.entradas')}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-[1px] bg-grafico-saida" />
          {t('evolucao.saidas')}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-px w-3 border-t border-dashed"
            style={{ borderTopColor: 'var(--color-grafico-acumulado)' }}
          />
          {modo === 'acumulado' ? t('fluxo.modoAcumulado') : t('fluxo.modoPeriodo')}
        </span>
      </div>

      <div className="mb-2 flex min-h-9 items-center gap-3 rounded-sm bg-afundado px-3">
        <span className="rotulo !text-[10px]">{rotulo(emLeitura.competencia)}</span>
        <span className="tabular text-xs text-credito">
          +{valorCompacto(emLeitura.entradasCents, formatBRL)}
        </span>
        <span className="tabular text-xs text-debito">
          −{valorCompacto(emLeitura.gastoCents, formatBRL)}
        </span>
        <span
          className={`tabular ml-auto text-xs ${
            emLeitura.entradasCents - emLeitura.gastoCents < 0 ? 'text-debito' : 'text-tinta'
          }`}
        >
          {modo === 'acumulado'
            ? valorCompacto(acumuladoLeitura, formatBRL)
            : valorCompacto(emLeitura.entradasCents - emLeitura.gastoCents, formatBRL)}
        </span>
      </div>

      <div className="relative h-56 min-w-0">
        <svg
          viewBox={`0 0 ${LARGURA} ${ALTURA}`}
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={t('fluxo.rotulo', { modo: modo === 'acumulado' ? t('fluxo.modoAcumulado') : t('fluxo.modoPeriodo') })}
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
          <text x="2" y={TOPO + 4} className="fill-tinta-tenue text-[10px]">
            {valorCompacto(maximo, formatBRL)}
          </text>
          {minimo < 0 ? (
            <>
              <text x="2" y={zero + 4} className="fill-tinta-tenue text-[10px]">
                {valorCompacto(0, formatBRL)}
              </text>
              <text x="2" y={BASE + 4} className="fill-tinta-tenue text-[10px]">
                {valorCompacto(minimo, formatBRL)}
              </text>
            </>
          ) : (
            <text x="2" y={BASE + 4} className="fill-tinta-tenue text-[10px]">
              {valorCompacto(0, formatBRL)}
            </text>
          )}
          <motion.path
            d={caminhoArea(entradas, minimo, maximo)}
            fill="var(--color-grafico-entrada)"
            fillOpacity="0.08"
            stroke="none"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55 }}
          />
          <motion.path
            d={caminhoArea(saidas, minimo, maximo)}
            fill="var(--color-grafico-saida)"
            fillOpacity="0.07"
            stroke="none"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, delay: 0.06 }}
          />
          <motion.path
            d={caminhoLinha(entradas, minimo, maximo)}
            fill="none"
            stroke="var(--color-grafico-entrada)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={semMovimento ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.path
            d={caminhoLinha(saidas, minimo, maximo)}
            fill="none"
            stroke="var(--color-grafico-saida)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={semMovimento ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          />
          <motion.path
            d={caminhoLinha(linhaSecundaria, minimo, maximo)}
            fill="none"
            stroke="var(--color-grafico-acumulado)"
            strokeWidth="1.8"
            strokeDasharray="5 4"
            strokeLinecap="round"
            initial={semMovimento ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.16 }}
          />
        </svg>

        <div className="absolute inset-x-[6.7%] inset-y-0 flex">
          {pontos.map((p) => (
            <button
              key={p.competencia}
              type="button"
              onClick={() => onSelecionar(p.competencia)}
              onMouseEnter={() => setEmFoco(p.competencia)}
              onMouseLeave={() => setEmFoco(null)}
              onFocus={() => setEmFoco(p.competencia)}
              onBlur={() => setEmFoco(null)}
              aria-current={p.competencia === ativo ? 'true' : undefined}
              aria-label={t('fluxo.rotuloPonto', {
                mes: rotulo(p.competencia),
                entradas: formatBRL(p.entradasCents),
                saidas: formatBRL(p.gastoCents),
                resultado: formatBRL(p.entradasCents - p.gastoCents),
              })}
              className="group relative h-full min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-inset"
            >
              <span
                aria-hidden
                className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-grafico-acumulado/45 transition-opacity ${
                  emLeitura.competencia === p.competencia ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              />
              <span
                className={`tabular absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] ${
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
        {modo === 'acumulado' ? t('fluxo.rodapeAcumulado') : t('fluxo.rodapePeriodo')}
      </p>
    </div>
  )
}
