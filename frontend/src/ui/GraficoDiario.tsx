import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { formatBRL } from '../domain/normalize/money'
import { mesAbrev } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'
import { escalaRobusta, alturaPct } from './escala-barras'
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
 *  acabou de importar as primeiras faturas. Este responde com um mês só,
 *  porque a pergunta é outra: o donut diz *em que* o dinheiro foi, a evolução
 *  diz *como o mês se compara*, e este diz **quando** — onde estão os picos.
 *
 *  Só as saídas. Entrada de salário no dia 5 é uma barra que esmagaria todas
 *  as outras numa escala compartilhada.
 *
 *  **A escala não é o máximo** (ver `escala-barras.ts`): um pagamento de
 *  empréstimo de R$ 41.653 num mês de compras de dezenas achatava as outras
 *  38 barras contra o chão. A escala vai até o maior dia **não discrepante**,
 *  e quem passa disso é desenhado cortado, com a serrilha à vista e o aviso
 *  no cabeçalho — a distorção é local e declarada, em vez de global e muda,
 *  que é o que uma escala logarítmica faria.
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

  const escala = escalaRobusta(comGasto.map((d) => d.gastoCents))
  const total = comGasto.reduce((s, d) => s + d.gastoCents, 0)
  const media = Math.round(total / comGasto.length)
  const foco = comGasto.find((d) => d.dia === emFoco)
  const maior = comGasto.reduce((a, b) => (b.gastoCents > a.gastoCents ? b : a))
  // A régua da média só entra se couber no desenho: com escala cortada ela
  // pode cair acima do teto, e uma linha grudada no topo não informa nada.
  const mediaPct = media > 0 && media < escala.teto ? alturaPct(media, escala) : null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="rotulo">{t('diario.titulo')}</p>
        <p className="text-[11px] text-tinta-tenue">
          {t('diario.resumo', { dias: String(comGasto.length), media: formatBRL(media) })}
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

      <div className="relative h-40">
        <div className="flex h-full items-end gap-[2px] border-b border-carvao-700">
          {comGasto.map((d) => {
            const cortada = d.gastoCents > escala.teto
            const ehPico = d.dia === maior.dia
            return (
              <button
                key={d.dia}
                onClick={() => onSelecionar(d.dia)}
                onMouseEnter={() => setEmFoco(d.dia)}
                onMouseLeave={() => setEmFoco(null)}
                onFocus={() => setEmFoco(d.dia)}
                onBlur={() => setEmFoco(null)}
                className="flex h-full min-w-[3px] flex-1 flex-col justify-end rounded-sm px-[1px] pt-1 transition-colors hover:bg-afundado"
                aria-label={t(cortada ? 'diario.rotuloBarraCortada' : 'diario.rotuloBarra', {
                  dia: rotuloDia(d.dia),
                  valor: formatBRL(d.gastoCents),
                })}
              >
                <motion.span
                  // O pico fica em tinta cheia e os demais em débito: a régua
                  // de "onde foi o maior dia" não depende de comparar alturas
                  // parecidas nem de ler o eixo.
                  className={`relative w-full rounded-t-[2px] ${ehPico ? 'bg-tinta' : 'bg-debito'}`}
                  initial={semMovimento ? false : { height: 0 }}
                  animate={{ height: `${alturaPct(d.gastoCents, escala)}%` }}
                  transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                >
                  {cortada && (
                    // Serrilha no topo: a convenção do eixo quebrado. Diz
                    // "esta barra continua fora do desenho" sem precisar de
                    // legenda — e o cabeçalho diz até onde a escala vai.
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
              </button>
            )
          })}
        </div>

        {mediaPct !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 flex justify-end border-t border-dashed border-tinta-tenue/40"
            style={{ bottom: `${mediaPct}%` }}
          >
            <span className="tabular -mt-2 bg-carvao-900 pl-1 text-[9px] text-tinta-tenue">
              {t('diario.media')}
            </span>
          </div>
        )}
      </div>

      {/* Só as pontas da régua: um rótulo por barra viraria borrão com 30
          dias, e o valor exato de cada dia já está na faixa de foco. */}
      <div className="tabular mt-1 flex items-baseline justify-between gap-2 text-[10px] text-tinta-tenue">
        <span>{rotuloDia(comGasto[0].dia)}</span>
        {escala.cortados > 0 && (
          <span className="text-center">
            {t('diario.escala', { teto: formatBRL(escala.teto) })} ·{' '}
            {t(escala.cortados === 1 ? 'diario.acima1' : 'diario.acima', {
              n: String(escala.cortados),
            })}
          </span>
        )}
        <span>{rotuloDia(comGasto[comGasto.length - 1].dia)}</span>
      </div>
    </div>
  )
}
