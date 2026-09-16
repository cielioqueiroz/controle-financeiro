import { useMemo, useState } from 'react'

import { agregar, evolucaoMensal, maioresSaidas, porEstabelecimento } from '../domain/agrupar'
import { mesAbrev } from '../domain/normalize/data'
import { useDados } from '../dados/DadosProvider'
import { useRecorte } from '../dados/useRecorte'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'
import { GraficoCategorias } from '../ui/graficos/GraficoCategorias'
import { GraficoFluxo } from '../ui/graficos/GraficoFluxo'

type Janela = 3 | 6 | 12

function rotuloMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  return `${mesAbrev(new Date(ano, (mes ?? 1) - 1, 1))} ${ano}`
}

function taxaEconomia(entradasCents: number, gastoCents: number): number | null {
  if (entradasCents <= 0) return null
  return ((entradasCents - gastoCents) / entradasCents) * 100
}

function percentual(valor: number | null): string {
  return valor === null ? '—' : `${valor.toFixed(1).replace('.', ',')}%`
}

/** Relatório de leitura: concentra as perguntas mais profundas do Lovable,
 * mas usa o mesmo recorte e as mesmas agregações do Painel. Não há orçamento,
 * meta ou variação inventada: sem período anterior, a comparação desaparece. */
export function Relatorios() {
  const { t } = useT()
  const dinheiro = useDinheiro()
  const { todas } = useDados()
  const { visiveis, carregando, setFiltros } = useRecorte()
  const [janela, setJanela] = useState<Janela>(12)

  // A janela do relatório acompanha o histórico mais recente. O estado local
  // precisa ser mutável; a linha acima evita um useState extra neste cálculo.
  // O seletor abaixo usa os filtros da URL para manter a leitura compartilhável.
  const historico = useMemo(() => visiveis ?? todas ?? [], [todas, visiveis])
  const serieCompleta = useMemo(() => evolucaoMensal(historico), [historico])
  const serie = useMemo(() => serieCompleta.slice(-janela), [janela, serieCompleta])
  const competencias = useMemo(() => new Set(serie.map((p) => p.competencia)), [serie])
  const txs = useMemo(
    () => historico.filter((tx) => competencias.has(tx.competencia)),
    [competencias, historico],
  )
  const resumo = useMemo(() => agregar(txs), [txs])
  const anteriorSerie = useMemo(
    () => serieCompleta.slice(Math.max(0, serieCompleta.length - janela * 2), Math.max(0, serieCompleta.length - janela)),
    [janela, serieCompleta],
  )
  const competenciasAnteriores = useMemo(
    () => new Set(anteriorSerie.map((p) => p.competencia)),
    [anteriorSerie],
  )
  const txsAnteriores = useMemo(
    () => historico.filter((tx) => competenciasAnteriores.has(tx.competencia)),
    [competenciasAnteriores, historico],
  )
  const resumoAnterior = useMemo(() => agregar(txsAnteriores), [txsAnteriores])
  const maiores = useMemo(() => maioresSaidas(txs, 6), [txs])
  const estabelecimentos = useMemo(() => porEstabelecimento(txs, 5), [txs])
  const inicio = serie[0]
  const fim = serie.at(-1)
  const taxaAtual = taxaEconomia(resumo.entradasCents, resumo.gastoCents)
  const taxaAnterior = taxaEconomia(resumoAnterior.entradasCents, resumoAnterior.gastoCents)
  const variacaoGasto =
    resumoAnterior.gastoCents > 0
      ? ((resumo.gastoCents - resumoAnterior.gastoCents) / resumoAnterior.gastoCents) * 100
      : null

  function selecionarMes(competencia: string) {
    const [ano, mes] = competencia.split('-').map(Number)
    setFiltros({ periodo: 'mes', ref: new Date(ano, (mes ?? 1) - 1, 1) })
  }

  if (carregando) return null

  return (
    <div className="mt-6 space-y-6 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo">{t('relatorios.eyebrow')}</p>
          <h2 className="mt-1 font-display text-3xl text-tinta sm:text-4xl">{t('relatorios.titulo')}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-tinta-fraca">{t('relatorios.descricao')}</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-carvao-700 bg-carvao-900 p-1">
          {([
            [3, 'relatorios.janela3'],
            [6, 'relatorios.janela6'],
            [12, 'relatorios.janela12'],
          ] as const).map(([valor, chave]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setJanela(valor)}
              aria-pressed={janela === valor}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                janela === valor ? 'bg-carvao-850 text-tinta' : 'text-tinta-tenue hover:text-tinta'
              }`}
            >
              {t(chave)}
            </button>
          ))}
        </div>
      </header>

      {serie.length === 0 ? (
        <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-6 text-sm text-tinta-fraca sombra-flutuante">
          {t('relatorios.semDados')}
        </section>
      ) : (
        <>
          <section aria-label={t('relatorios.resumoAria')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante">
              <p className="rotulo">{t('relatorios.receitas')}</p>
              <p className="tabular mt-3 text-2xl text-credito">{dinheiro(resumo.entradasCents)}</p>
              <p className="mt-1 text-xs text-tinta-fraca">{t('relatorios.periodoResumo', { n: serie.length })}</p>
            </article>
            <article className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante">
              <p className="rotulo">{t('relatorios.despesas')}</p>
              <p className="tabular mt-3 text-2xl text-debito">{dinheiro(resumo.gastoCents)}</p>
              <p className="mt-1 text-xs text-tinta-fraca">
                {variacaoGasto === null ? t('relatorios.semComparacao') : t('relatorios.variacao', { valor: percentual(variacaoGasto) })}
              </p>
            </article>
            <article className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante">
              <p className="rotulo">{t('relatorios.resultado')}</p>
              <p className={`tabular mt-3 text-2xl ${resumo.saldoCents < 0 ? 'text-falha' : 'text-tinta'}`}>
                {dinheiro(resumo.saldoCents)}
              </p>
              <p className="mt-1 text-xs text-tinta-fraca">{t('relatorios.resultadoDescricao')}</p>
            </article>
            <article className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante">
              <p className="rotulo">{t('relatorios.taxaEconomia')}</p>
              <p className="tabular mt-3 text-2xl text-credito">{percentual(taxaAtual)}</p>
              <p className="mt-1 text-xs text-tinta-fraca">
                {taxaAnterior === null ? t('relatorios.semComparacao') : t('relatorios.comparadoAnterior', { valor: percentual(taxaAnterior) })}
              </p>
            </article>
          </section>

          <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="rotulo">{t('relatorios.fluxoTitulo')}</p>
                <p className="mt-1 text-xs text-tinta-fraca">{t('relatorios.fluxoDescricao')}</p>
              </div>
              <span className="text-[11px] text-tinta-tenue">
                {inicio && fim ? `${rotuloMes(inicio.competencia)} — ${rotuloMes(fim.competencia)}` : ''}
              </span>
            </div>
            <div className="mt-5">
              <GraficoFluxo serie={serie} ativo={fim?.competencia ?? ''} onSelecionar={selecionarMes} />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {resumo.porCategoria.length > 0 && (
              <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
                <p className="rotulo">{t('relatorios.categoriasTitulo')}</p>
                <p className="mt-1 text-xs text-tinta-fraca">{t('relatorios.categoriasDescricao')}</p>
                <div className="mt-5">
                  <GraficoCategorias categorias={resumo.porCategoria} totalCents={resumo.gastoCents} />
                </div>
              </section>
            )}
            <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
              <p className="rotulo">{t('relatorios.insightsTitulo')}</p>
              <p className="mt-1 text-xs text-tinta-fraca">{t('relatorios.insightsDescricao')}</p>
              <div className="mt-5 space-y-4">
                {estabelecimentos.slice(0, 3).map((item) => (
                  <div key={item.merchant} className="flex items-center gap-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-marca" />
                    <span className="min-w-0 flex-1 truncate text-sm text-tinta-fraca">{item.rotulo}</span>
                    <span className="tabular text-sm text-tinta">{dinheiro(item.totalCents)}</span>
                  </div>
                ))}
                {estabelecimentos.length === 0 && <p className="text-sm text-tinta-fraca">{t('relatorios.semInsights')}</p>}
              </div>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
              <p className="rotulo">{t('relatorios.maioresSaidasTitulo')}</p>
              <p className="mt-1 text-xs text-tinta-fraca">{t('relatorios.maioresSaidasDescricao')}</p>
              <ul className="mt-5 divide-y divide-carvao-700">
                {maiores.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="tabular w-6 text-xs text-tinta-tenue">{maiores.indexOf(item) + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-tinta-fraca">{item.label ?? item.description}</span>
                    <span className="tabular text-sm text-debito">{dinheiro(item.amount_cents)}</span>
                  </li>
                ))}
                {maiores.length === 0 && <li className="text-sm text-tinta-fraca">{t('relatorios.semSaidas')}</li>}
              </ul>
            </section>
            <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
              <p className="rotulo">{t('relatorios.provenienciaTitulo')}</p>
              <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">{t('relatorios.provenienciaDescricao')}</p>
              <div className="mt-5 rounded-lg border border-dashed border-carvao-600 bg-afundado p-4 text-xs leading-relaxed text-tinta-tenue">
                {t('relatorios.provenienciaAviso')}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
