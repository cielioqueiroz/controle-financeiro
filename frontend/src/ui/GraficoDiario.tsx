import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { formatBRL } from '../domain/normalize/money'
import { mesAbrev } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'
import type { GrupoDia } from '../persist/agrupar'
import type { TransacaoSalva } from '../persist/puxar'

type Props = {
  /** Dias do período, como `porDia` devolve (mais recente primeiro). */
  dias: GrupoDia<TransacaoSalva>[]
  /** Leva a tela para aquele dia. */
  onSelecionar: (dia: string) => void
}

/** "2026-07-14" → "14/jul" (mês na locale ativa). Data local, sem fuso. */
function rotuloDia(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}/${mesAbrev(new Date(y, (m ?? 1) - 1, d))}`
}

/** O ritmo do período: quanto saiu em cada dia.
 *
 *  Ocupa a metade do painel que ficava VAZIA quando não há dois meses de
 *  competência para o gráfico de evolução desenhar — situação normal de quem
 *  acabou de importar as primeiras faturas, e que deixava um buraco branco na
 *  tela. Este responde com um mês só, porque a pergunta é outra: o donut diz
 *  *em que* o dinheiro foi, a evolução diz *como o mês se compara*, e este diz
 *  **quando** — onde estão os picos, e se o gasto é contínuo ou concentrado.
 *
 *  Só as saídas. Entrada de salário no dia 5 é uma barra que esmagaria todas
 *  as outras numa escala compartilhada, e o gráfico deixaria de responder
 *  "quando eu gastei" — que é a única pergunta que ele existe para responder.
 *
 *  Clicar num dia leva a tela para ele, como clicar num mês na evolução. */
export function GraficoDiario({ dias, onSelecionar }: Props) {
  const semMovimento = useReducedMotion()
  const { t } = useT()
  const [emFoco, setEmFoco] = useState<string | null>(null)

  // Em ordem cronológica: a leitura é da esquerda para a direita, ao
  // contrário da lista, que quer o mais recente no topo.
  const comGasto = [...dias].filter((d) => d.gastoCents > 0).sort((a, b) => (a.dia < b.dia ? -1 : 1))

  // Um dia só não é um ritmo — é o mesmo número do tile de gasto, desenhado.
  if (comGasto.length < 2) return null

  const max = Math.max(...comGasto.map((d) => d.gastoCents), 1)
  const total = comGasto.reduce((s, d) => s + d.gastoCents, 0)
  const foco = comGasto.find((d) => d.dia === emFoco)
  const maior = comGasto.reduce((a, b) => (b.gastoCents > a.gastoCents ? b : a))

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="rotulo">{t('diario.titulo')}</p>
        <p className="text-[11px] text-tinta-tenue">
          {t('diario.resumo', {
            dias: String(comGasto.length),
            media: formatBRL(Math.round(total / comGasto.length)),
          })}
        </p>
      </div>

      {/* Altura reservada mesmo sem foco, senão o gráfico pula quando o
          mouse entra. Fora do foco, mostra o dia de maior saída — o que
          alguém procuraria primeiro num gráfico de picos. */}
      <div className="mb-2 flex h-9 items-center gap-4 rounded-sm bg-afundado px-3">
        <span className="rotulo !text-[10px]">{rotuloDia((foco ?? maior).dia)}</span>
        <span className="tabular text-xs text-debito">
          −{formatBRL((foco ?? maior).gastoCents).replace('R$', '').trim()}
        </span>
        <span className="tabular ml-auto text-[10px] text-tinta-tenue">
          {t(
            (foco ?? maior).itens.length === 1 ? 'diario.lancamento1' : 'diario.lancamentos',
            { n: String((foco ?? maior).itens.length) },
          )}
        </span>
      </div>

      <div className="flex h-32 items-end gap-px">
        {comGasto.map((d) => {
          const altura = Math.max((d.gastoCents / max) * 100, 2)
          const ehPico = d.dia === maior.dia
          return (
            <button
              key={d.dia}
              onClick={() => onSelecionar(d.dia)}
              onMouseEnter={() => setEmFoco(d.dia)}
              onMouseLeave={() => setEmFoco(null)}
              onFocus={() => setEmFoco(d.dia)}
              onBlur={() => setEmFoco(null)}
              className="flex h-full flex-1 flex-col justify-end rounded-sm px-[1px] pt-1 transition-colors hover:bg-afundado"
              aria-label={t('diario.rotuloBarra', {
                dia: rotuloDia(d.dia),
                valor: formatBRL(d.gastoCents),
              })}
            >
              <motion.span
                // O pico fica em tinta cheia e os demais em débito: a régua
                // de "onde foi o maior dia" não depende de comparar alturas
                // parecidas nem de ler o eixo.
                className={`w-full rounded-t-[2px] ${ehPico ? 'bg-tinta' : 'bg-debito'}`}
                initial={semMovimento ? false : { height: 0 }}
                animate={{ height: `${altura}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 22 }}
              />
            </button>
          )
        })}
      </div>

      {/* Só as pontas da régua: um rótulo por barra viraria borrão com 30
          dias, e o valor exato de cada dia já está na faixa de foco. */}
      <div className="tabular mt-1 flex justify-between text-[10px] text-tinta-tenue">
        <span>{rotuloDia(comGasto[0].dia)}</span>
        <span>{rotuloDia(comGasto[comGasto.length - 1].dia)}</span>
      </div>
    </div>
  )
}
