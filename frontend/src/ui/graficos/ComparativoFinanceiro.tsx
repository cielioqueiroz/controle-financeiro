import { motion, useReducedMotion } from 'motion/react'

import { useDinheiro } from '../../dados/DiscretoProvider'
import { useT } from '../../i18n/IdiomaProvider'

type Props = {
  gastoCents: number
  entradasCents: number
  saldoCents: number
}

/** Compara o que entrou e saiu no mesmo recorte.
 *
 * A ideia vem do painel do Ambit, mas os números são derivados do Resumo do
 * Capital: não existe uma segunda fonte de dados nem um valor de demonstração
 * escondido na tela. As barras usam a mesma escala para a comparação ser
 * honesta, e a régua de consumo responde quanto da renda foi comprometida.
 */
export function ComparativoFinanceiro({ gastoCents, entradasCents, saldoCents }: Props) {
  const dinheiro = useDinheiro()
  const { t } = useT()
  const semMovimento = useReducedMotion()
  const maior = Math.max(gastoCents, entradasCents, 1)
  const consumo = entradasCents > 0 ? (gastoCents / entradasCents) * 100 : null
  const economia = entradasCents > 0 ? (saldoCents / entradasCents) * 100 : null

  const linhas = [
    { chave: 'comparativo.entradas' as const, valor: entradasCents, cor: 'bg-grafico-entrada' },
    { chave: 'comparativo.gastos' as const, valor: gastoCents, cor: 'bg-grafico-saida' },
  ]

  return (
    <section className="min-w-0 rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="rotulo">{t('comparativo.titulo')}</p>
          <p className="mt-1 text-xs text-tinta-fraca">{t('comparativo.descricao')}</p>
        </div>
        <span className="rounded-sm border border-carvao-700 bg-afundado px-2 py-1 text-[10px] text-tinta-tenue">
          {consumo === null
            ? t('comparativo.semEntrada')
            : t('comparativo.consumo', { pct: Math.round(consumo) })}
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(15rem,0.9fr)] lg:items-end">
        <div className="space-y-4">
          {linhas.map((linha, i) => (
            <div key={linha.chave}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-tinta-tenue">{t(linha.chave)}</span>
                <span className="tabular text-base font-semibold text-tinta">{dinheiro(linha.valor)}</span>
              </div>
              <div className="mt-2 flex h-2 gap-1 overflow-hidden rounded-full bg-afundado">
                <motion.span
                  className={`h-full rounded-full ${linha.cor}`}
                  initial={semMovimento ? false : { width: 0 }}
                  animate={{ width: `${(linha.valor / maior) * 100}%` }}
                  transition={{ duration: 0.75, delay: 0.1 + i * 0.1 }}
                />
                <span className="h-full flex-1" />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-carvao-700 bg-afundado p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="rotulo !text-[10px]">{t('comparativo.consumoTitulo')}</span>
            <span className="tabular text-sm text-tinta">
              {consumo === null ? '—' : `${Math.round(consumo)}%`}
            </span>
          </div>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-carvao-800">
            <motion.span
              className="h-full bg-grafico-saida"
              initial={semMovimento ? false : { width: 0 }}
              animate={{ width: `${Math.min(Math.max(consumo ?? 0, 0), 100)}%` }}
              transition={{ duration: 0.85 }}
            />
            <motion.span
              className="h-full bg-grafico-entrada"
              initial={semMovimento ? false : { width: 0 }}
              animate={{ width: `${Math.max(100 - Math.min(Math.max(consumo ?? 0, 0), 100), 0)}%` }}
              transition={{ duration: 0.85, delay: 0.12 }}
            />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[10px] text-tinta-tenue">
            <span>{t('comparativo.gastoLegenda')}</span>
            <span>{t('comparativo.guardadoLegenda')}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-carvao-800 pt-4">
        <div>
          <p className="rotulo !text-[10px]">{t('comparativo.resultado')}</p>
          <p className={`tabular mt-1 text-xl ${saldoCents >= 0 ? 'text-credito' : 'text-debito'}`}>
            {dinheiro(saldoCents)}
          </p>
        </div>
        <div className="text-right">
          <p className="rotulo !text-[10px]">{t('comparativo.taxaEconomia')}</p>
          <p className={`tabular mt-1 text-xl ${economia !== null && economia >= 0 ? 'text-credito' : 'text-debito'}`}>
            {economia === null ? '—' : `${economia.toFixed(1).replace('.', ',')}%`}
          </p>
        </div>
      </div>
    </section>
  )
}
