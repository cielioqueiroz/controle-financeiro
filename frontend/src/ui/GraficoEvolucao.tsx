import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { formatBRL } from '../domain/normalize/money'
import { mesAbrev } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'
import { escalaRobusta, alturaPct } from './escala-barras'
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
 *  **E a escala é robusta** (`escala-barras.ts`): o mês do empréstimo de
 *  R$ 41 mil deixava os outros onze rentes ao chão. Vai até o maior valor
 *  não discrepante das duas séries, e quem passa é desenhado cortado, com a
 *  serrilha à vista e o aviso no rodapé.
 *
 *  Clicar num mês leva a tela para ele. Passar o mouse ou focar pelo
 *  teclado mostra os dois valores. */
export function GraficoEvolucao({ serie, ativo, onSelecionar }: Props) {
  const semMovimento = useReducedMotion()
  const { t } = useT()
  const [emFoco, setEmFoco] = useState<string | null>(null)

  // Com um mês só não há evolução para mostrar.
  if (serie.length < 2) return null

  const ultimos = serie.slice(-12)
  const escala = escalaRobusta(ultimos.flatMap((p) => [p.gastoCents, p.entradasCents]))
  const ponto = ultimos.find((p) => p.competencia === emFoco)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="rotulo">{t('evolucao.titulo')}</p>
        {/* Legenda: duas séries pedem legenda sempre, senão a identidade
            fica só na cor. */}
        <div className="flex items-center gap-3 text-[11px] text-tinta-tenue">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-[1px] bg-credito" />
            {t('evolucao.entradas')}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-[1px] bg-debito" />
            {t('evolucao.saidas')}
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
          <span className="text-[11px] text-tinta-tenue">{t('evolucao.escolha')}</span>
        )}
      </div>

      <div className="flex h-40 items-end gap-1 border-b border-carvao-700">
        {ultimos.map((p) => {
          const ehAtivo = p.competencia === ativo
          const cortada = p.gastoCents > escala.teto || p.entradasCents > escala.teto
          return (
            <button
              key={p.competencia}
              onClick={() => onSelecionar(p.competencia)}
              onMouseEnter={() => setEmFoco(p.competencia)}
              onMouseLeave={() => setEmFoco(null)}
              onFocus={() => setEmFoco(p.competencia)}
              onBlur={() => setEmFoco(null)}
              className="group flex h-full flex-1 flex-col justify-end gap-1 rounded-sm px-0.5 pt-1 transition-colors hover:bg-afundado"
              aria-label={t(cortada ? 'evolucao.rotuloBarraCortada' : 'evolucao.rotuloBarra', {
                mes: rotulo(p.competencia),
                entradas: formatBRL(p.entradasCents),
                saidas: formatBRL(p.gastoCents),
              })}
              aria-current={ehAtivo ? 'true' : undefined}
            >
              {/* As duas barras, com 2px de vão entre elas. */}
              <span className="flex h-full items-end justify-center gap-[2px]">
                <Barra
                  valorCents={p.entradasCents}
                  altura={alturaPct(p.entradasCents, escala)}
                  cortada={p.entradasCents > escala.teto}
                  cor="bg-credito"
                  semMovimento={semMovimento}
                />
                <Barra
                  valorCents={p.gastoCents}
                  altura={alturaPct(p.gastoCents, escala)}
                  cortada={p.gastoCents > escala.teto}
                  cor="bg-debito"
                  semMovimento={semMovimento}
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

      {escala.cortados > 0 && (
        <p className="tabular mt-1 text-right text-[10px] text-tinta-tenue">
          {t('diario.escala', { teto: formatBRL(escala.teto) })} ·{' '}
          {t(escala.cortados === 1 ? 'evolucao.acima1' : 'evolucao.acima', {
            n: String(escala.cortados),
          })}
        </p>
      )}
    </div>
  )
}

function Barra({
  valorCents,
  altura,
  cortada,
  cor,
  semMovimento,
}: {
  valorCents: number
  altura: number
  cortada: boolean
  cor: string
  semMovimento: boolean | null
}) {
  return (
    <motion.span
      className={`relative w-full max-w-3 rounded-t-[2px] ${cor}`}
      initial={semMovimento ? false : { height: 0 }}
      animate={{ height: `${valorCents > 0 ? altura : 1}%` }}
      transition={{ type: 'spring', stiffness: 140, damping: 22 }}
    >
      {cortada && (
        // Serrilha do eixo quebrado: diz "continua fora do desenho".
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-2 rounded-t-[2px]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, var(--color-carvao-900) 0 2px, transparent 2px 4px)',
          }}
        />
      )}
    </motion.span>
  )
}
