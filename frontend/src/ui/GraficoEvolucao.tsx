import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { formatBRL } from '../domain/normalize/money'
import { mesAbrev } from '../domain/normalize/data'
import type { PontoMes } from '../persist/agrupar'

type Props = {
  serie: PontoMes[]
  /** Competência ativa (AAAA-MM) — a coluna do mês que a tela mostra. */
  ativo: string
  onSelecionar: (competencia: string) => void
}

function rotulo(comp: string): string {
  const [y, m] = comp.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  // Janeiro leva o ano junto: é o único ponto da régua onde a virada
  // acontece, e sem ele doze abreviações viram uma fita sem referência.
  return m === 1 ? `${mesAbrev(d)}/${String(y).slice(2)}` : mesAbrev(d)
}

/** Entradas × saídas nos últimos 12 meses, por competência.
 *
 *  Duas barras por mês, não uma: `entradasCents` já existia na série e
 *  nunca era desenhado — o gráfico antigo mostrava só o gasto, e gasto sem
 *  a entrada ao lado não responde a pergunta que importa ("sobrou ou
 *  faltou?").
 *
 *  **Uma escala só para as duas séries.** Dois eixos y fariam as alturas
 *  mentirem: a barra de entrada pareceria maior que a de saída sendo menor.
 *
 *  Clicar num mês leva a tela para ele. Passar o mouse ou focar pelo
 *  teclado mostra os dois valores. */
export function GraficoEvolucao({ serie, ativo, onSelecionar }: Props) {
  const semMovimento = useReducedMotion()
  const [emFoco, setEmFoco] = useState<string | null>(null)

  // Com um mês só não há evolução para mostrar.
  if (serie.length < 2) return null

  const ultimos = serie.slice(-12)
  const max = Math.max(...ultimos.flatMap((p) => [p.gastoCents, p.entradasCents]), 1)
  const ponto = ultimos.find((p) => p.competencia === emFoco)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="rotulo">Entradas × saídas · 12 meses</p>
        {/* Legenda: duas séries pedem legenda sempre, senão a identidade
            fica só na cor. */}
        <div className="flex items-center gap-3 text-[11px] text-tinta-tenue">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-[1px] bg-credito" />
            Entradas
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-[1px] bg-debito" />
            Saídas
          </span>
        </div>
      </div>

      {/* Faixa do valor em foco. Altura reservada mesmo vazia: sem isso o
          gráfico inteiro pula 20px quando o mouse entra. */}
      <div className="mb-2 flex h-9 items-center gap-4 rounded-sm bg-afundado px-3">
        {ponto ? (
          <>
            <span className="rotulo !text-[10px]">{rotulo(ponto.competencia)}</span>
            <span className="tabular text-xs text-credito">
              +{formatBRL(ponto.entradasCents).replace('R$', '').trim()}
            </span>
            <span className="tabular text-xs text-debito">
              −{formatBRL(ponto.gastoCents).replace('R$', '').trim()}
            </span>
            <span
              className={`tabular ml-auto text-xs ${
                ponto.entradasCents - ponto.gastoCents < 0 ? 'text-debito' : 'text-tinta'
              }`}
            >
              {formatBRL(ponto.entradasCents - ponto.gastoCents)}
            </span>
          </>
        ) : (
          <span className="text-[11px] text-tinta-tenue">
            Escolha um mês para ver os valores
          </span>
        )}
      </div>

      <div className="flex h-32 items-end gap-1">
        {ultimos.map((p) => {
          const ehAtivo = p.competencia === ativo
          const alturaEntrada = Math.max((p.entradasCents / max) * 100, 1)
          const alturaSaida = Math.max((p.gastoCents / max) * 100, 1)
          return (
            <button
              key={p.competencia}
              onClick={() => onSelecionar(p.competencia)}
              onMouseEnter={() => setEmFoco(p.competencia)}
              onMouseLeave={() => setEmFoco(null)}
              onFocus={() => setEmFoco(p.competencia)}
              onBlur={() => setEmFoco(null)}
              className="group flex h-full flex-1 flex-col justify-end gap-1 rounded-sm px-0.5 pt-1 transition-colors hover:bg-afundado"
              aria-label={`${rotulo(p.competencia)}: entradas ${formatBRL(p.entradasCents)}, saídas ${formatBRL(p.gastoCents)}. Ver este mês.`}
              aria-current={ehAtivo ? 'true' : undefined}
            >
              {/* As duas barras, com 2px de vão entre elas. */}
              <span className="flex h-full items-end justify-center gap-[2px]">
                <motion.span
                  className="w-full max-w-3 rounded-t-[2px] bg-credito"
                  initial={semMovimento ? false : { height: 0 }}
                  animate={{ height: `${alturaEntrada}%` }}
                  transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                />
                <motion.span
                  className="w-full max-w-3 rounded-t-[2px] bg-debito"
                  initial={semMovimento ? false : { height: 0 }}
                  animate={{ height: `${alturaSaida}%` }}
                  transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                />
              </span>
              <span
                className={`tabular text-[10px] ${
                  ehAtivo ? 'font-semibold text-tinta' : 'text-tinta-tenue'
                }`}
              >
                {rotulo(p.competencia)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
