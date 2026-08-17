import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { formatBRL } from '../../domain/normalize/money'
import { mesAbrev } from '../../domain/normalize/data'
import { BANCOS } from '../../domain/banks'
import type { Bank } from '../../domain/pdf/detect'
import { useT } from '../../i18n/IdiomaProvider'
import { escalaRobusta, alturaPct } from './escala-barras'
import type { MesFuturo } from '../../persist/agrupar'

type Props = {
  meses: MesFuturo[]
  /** Abre aquele mês na lista ao lado. */
  onSelecionar: (competencia: string) => void
}

function rotuloMes(comp: string): string {
  const [y, m] = comp.split('-').map(Number)
  return mesAbrev(new Date(y, (m ?? 1) - 1, 1))
}

function tema(bank: string) {
  return BANCOS[bank as Bank] ?? BANCOS.desconhecido
}

/** A curva do que já está comprado: quanto cai em cada mês futuro, e de qual
 *  cartão.
 *
 *  A lista ao lado responde *quanto* mês a mês, mas exige ler quatro números
 *  e compará-los de cabeça; e não responde de quem é a dívida sem abrir cada
 *  mês. O desenho responde as duas de relance — a altura diz quanto, a cor
 *  diz de quem.
 *
 *  **A cor vem do catálogo `BANCOS`**, a mesma fonte dos pontinhos do filtro
 *  e dos cards de saldo: o roxo do Nubank e o vermelho do Bradesco são os
 *  mesmos em toda a tela, então a associação se aprende uma vez só. Cor
 *  nunca vai sozinha: cada barra tem o valor no nome acessível, com a parte
 *  de cada banco, e a legenda nomeia quem está no gráfico. */
export function GraficoCompromissos({ meses, onSelecionar }: Props) {
  const semMovimento = useReducedMotion()
  const { t } = useT()
  const [emFoco, setEmFoco] = useState<string | null>(null)

  // Uma barra sozinha não compara nada: é o número do card ao lado,
  // desenhado, ocupando meia tela.
  if (meses.length < 2) return null

  const escala = escalaRobusta(meses.map((m) => m.totalCents))
  const foco = meses.find((m) => m.competencia === emFoco) ?? meses[0]

  // Só os bancos que aparecem — legenda com banco ausente é ruído, e nesta
  // tela ela é curta de propósito.
  const bancos = [...new Set(meses.flatMap((m) => m.porBanco.map((f) => f.bank)))]

  function detalhe(m: MesFuturo): string {
    return m.porBanco.map((f) => `${tema(f.bank).nome} ${formatBRL(f.totalCents)}`).join(', ')
  }

  return (
    // `h-full` + a área das barras em `flex-1`: a lista de meses ao lado é
    // mais alta que este card, e a diferença virava faixa morta. Assim o
    // desenho cresce com a coluna em vez de flutuar no topo dela.
    <div className="screen-only flex h-full flex-col rounded-sm border border-carvao-700 bg-carvao-900 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="rotulo">{t('compGrafico.titulo')}</p>
        <div className="flex items-center gap-3 text-[11px] text-tinta-tenue">
          {bancos.map((b) => (
            <span key={b} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 rounded-[1px]"
                style={{ background: tema(b).accent }}
              />
              {tema(b).nome}
            </span>
          ))}
        </div>
      </div>

      {/* Faixa do mês em foco, com altura reservada: sem ela o gráfico pula
          quando o mouse entra. Fora do foco, mostra o primeiro mês — o mais
          próximo, que é o que se quer saber primeiro. */}
      <div className="mb-2 flex h-9 items-center gap-3 rounded-sm bg-afundado px-3">
        <span className="rotulo !text-[10px] capitalize">
          {rotuloMes(foco.competencia)} {foco.competencia.slice(0, 4)}
        </span>
        <span className="tabular text-xs text-tinta">{formatBRL(foco.totalCents)}</span>
        <span className="tabular ml-auto truncate text-[10px] text-tinta-tenue">
          {detalhe(foco)}
        </span>
      </div>

      <div className="flex min-h-40 flex-1 items-end gap-1.5 border-b border-carvao-700">
        {meses.map((m) => (
          <button
            key={m.competencia}
            onClick={() => onSelecionar(m.competencia)}
            onMouseEnter={() => setEmFoco(m.competencia)}
            onMouseLeave={() => setEmFoco(null)}
            onFocus={() => setEmFoco(m.competencia)}
            onBlur={() => setEmFoco(null)}
            className="flex h-full flex-1 flex-col justify-end gap-1 rounded-sm px-0.5 pt-1 transition-colors hover:bg-afundado"
            aria-label={t('compGrafico.rotuloBarra', {
              mes: `${rotuloMes(m.competencia)} ${m.competencia.slice(0, 4)}`,
              total: formatBRL(m.totalCents),
              detalhe: detalhe(m),
            })}
          >
            {/* A pilha cresce de baixo para cima na ordem de `porBanco` (do
                maior para o menor), que é estável entre os meses — sem isso
                as faixas trocariam de lugar de coluna em coluna. */}
            <motion.span
              className="flex w-full max-w-10 flex-col-reverse justify-start self-center overflow-hidden rounded-t-[2px]"
              initial={semMovimento ? false : { height: 0 }}
              animate={{ height: `${alturaPct(m.totalCents, escala)}%` }}
              transition={{ type: 'spring', stiffness: 140, damping: 22 }}
            >
              {m.porBanco.map((f) => (
                <span
                  key={f.bank}
                  data-banco={f.bank}
                  aria-hidden
                  className="w-full"
                  style={{
                    backgroundColor: tema(f.bank).accent,
                    height: `${(f.totalCents / m.totalCents) * 100}%`,
                  }}
                />
              ))}
            </motion.span>
            <span className="tabular text-center text-[10px] capitalize text-tinta-tenue">
              {rotuloMes(m.competencia)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
