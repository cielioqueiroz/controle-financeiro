import { useMemo, useState } from 'react'

import { agregar, evolucaoMensal, type PontoMes } from '../domain/agrupar'
import { nomeCategoria } from '../domain/categorize/categorias'
import { mesAbrev } from '../domain/normalize/data'
import { saldosPorConta } from '../domain/saldos'
import { useDados } from '../dados/DadosProvider'
import { useRecorte } from '../dados/useRecorte'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'
import { ComparativoFinanceiro } from '../ui/graficos/ComparativoFinanceiro'
import { GraficoCategorias } from '../ui/graficos/GraficoCategorias'
import { GraficoFluxo } from '../ui/graficos/GraficoFluxo'

type Janela = 3 | 6 | 12

function rotuloMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  return `${mesAbrev(new Date(ano, mes - 1, 1))} ${ano}`
}

function resultado(ponto: PontoMes): number {
  return ponto.entradasCents - ponto.gastoCents
}

function taxaEconomia(entradasCents: number, gastoCents: number): number | null {
  if (entradasCents <= 0) return null
  return ((entradasCents - gastoCents) / entradasCents) * 100
}

function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

/** Visão retrospectiva da trajetória financeira.
 *
 * É a adaptação da seção “Minha Vida Financeira” do Ambit para o contrato do
 * Capital: cada número nasce do histórico importado, e a janela selecionada
 * só muda quanto desse histórico entra na leitura. Patrimônio, investimentos
 * e metas ficam fora até existirem em documentos que o sistema saiba ler.
 */
export function SituacaoFinanceira() {
  const { t } = useT()
  const dinheiro = useDinheiro()
  const { docsSaldo } = useDados()
  const { visiveis, carregando } = useRecorte()
  const [janela, setJanela] = useState<Janela>(12)
  const [mesAtivo, setMesAtivo] = useState<string | null>(null)
  const [comparar, setComparar] = useState(false)

  const historico = useMemo(() => visiveis ?? [], [visiveis])
  const serieCompleta = useMemo(() => evolucaoMensal(historico), [historico])
  const serie = useMemo(() => serieCompleta.slice(-janela), [janela, serieCompleta])
  const serieAnterior = useMemo(() => {
    const fim = Math.max(0, serieCompleta.length - janela)
    return serieCompleta.slice(Math.max(0, fim - janela), fim)
  }, [janela, serieCompleta])
  const competencias = useMemo(() => new Set(serie.map((p) => p.competencia)), [serie])
  const competenciasAnteriores = useMemo(() => new Set(serieAnterior.map((p) => p.competencia)), [serieAnterior])
  const txsJanela = useMemo(
    () => historico.filter((tx) => competencias.has(tx.competencia)),
    [competencias, historico],
  )
  const resumo = useMemo(() => agregar(txsJanela), [txsJanela])
  const txsAnteriores = useMemo(
    () => historico.filter((tx) => competenciasAnteriores.has(tx.competencia)),
    [competenciasAnteriores, historico],
  )
  const resumoAnterior = useMemo(() => agregar(txsAnteriores), [txsAnteriores])
  const melhorMes = useMemo(
    () => serie.reduce<PontoMes | null>((melhor, atual) => (!melhor || resultado(atual) > resultado(melhor) ? atual : melhor), null),
    [serie],
  )
  const piorMes = useMemo(
    () => serie.reduce<PontoMes | null>((pior, atual) => (!pior || atual.gastoCents > pior.gastoCents ? atual : pior), null),
    [serie],
  )
  const categoriasPiorMes = useMemo(() => {
    if (!piorMes) return []
    return agregar(historico.filter((tx) => tx.competencia === piorMes.competencia)).porCategoria.slice(0, 4)
  }, [historico, piorMes])
  const saldos = useMemo(() => saldosPorConta(docsSaldo), [docsSaldo])
  const saldoAtual = saldos.reduce((total, conta) => total + conta.balanceCents, 0)
  const ativo = mesAtivo && serie.some((p) => p.competencia === mesAtivo) ? mesAtivo : serie.at(-1)?.competencia ?? ''
  const primeiro = serie[0]
  const ultimo = serie.at(-1)
  const taxaAtual = taxaEconomia(resumo.entradasCents, resumo.gastoCents)
  const taxaAnterior = taxaEconomia(resumoAnterior.entradasCents, resumoAnterior.gastoCents)

  if (carregando) return null

  return (
    <div className="mt-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo">{t('situacao.eyebrow')}</p>
          <h2 className="mt-1 font-display text-3xl text-tinta sm:text-4xl">{t('situacao.evolucaoTitulo')}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-tinta-fraca">{t('situacao.descricao')}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setComparar((valor) => !valor)}
            aria-pressed={comparar}
            className="rounded-lg border border-carvao-700 px-3 py-2 text-xs font-medium text-tinta-fraca transition-colors hover:border-carvao-600 hover:bg-carvao-850 hover:text-tinta"
          >
            {t(comparar ? 'situacao.esconderComparacao' : 'situacao.compararPeriodos')}
          </button>
          <div className="flex gap-1 rounded-lg border border-carvao-700 bg-carvao-900 p-1">
          {([
            [3, 'situacao.janela3'],
            [6, 'situacao.janela6'],
            [12, 'situacao.janela12'],
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
        </div>
      </header>

      {serie.length === 0 ? (
        <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-6 text-sm text-tinta-fraca sombra-flutuante">
          {t('situacao.semDados')}
        </section>
      ) : (
        <>
          {comparar && (
            <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="rotulo">{t('situacao.comparacaoTitulo')}</p>
                  <p className="mt-1 text-xs text-tinta-fraca">{t('situacao.comparacaoDescricao', { n: serie.length })}</p>
                </div>
                <span className="text-[11px] text-tinta-tenue">
                  {serieAnterior.length > 0 ? t('situacao.comparacaoDisponivel') : t('situacao.comparacaoIndisponivel')}
                </span>
              </div>
              {serieAnterior.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <ComparacaoCard
                    titulo={t('situacao.receitas')}
                    atual={resumo.entradasCents}
                    anterior={resumoAnterior.entradasCents}
                    dinheiro={dinheiro}
                  />
                  <ComparacaoCard
                    titulo={t('situacao.despesas')}
                    atual={resumo.gastoCents}
                    anterior={resumoAnterior.gastoCents}
                    dinheiro={dinheiro}
                  />
                  <ComparacaoCard
                    titulo={t('situacao.taxaEconomia')}
                    atual={taxaAtual}
                    anterior={taxaAnterior}
                    formatar={(valor) => (valor === null ? '—' : `${valor.toFixed(1).replace('.', ',')}%`)}
                  />
                </div>
              ) : (
                <p className="mt-5 rounded-lg border border-dashed border-carvao-600 bg-afundado p-4 text-sm text-tinta-fraca">
                  {t('situacao.comparacaoAjuda')}
                </p>
              )}
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="rounded-xl border border-carvao-700 bg-carvao-900 p-6 sombra-flutuante">
              <p className="rotulo">{t('situacao.saldoAtual')}</p>
              <p className="tabular mt-3 text-4xl text-tinta sm:text-5xl">
                {saldos.length > 0 ? dinheiro(saldoAtual) : '—'}
              </p>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-tinta-fraca">
                {saldos.length > 0
                  ? t('situacao.saldoAtualDesc', { n: saldos.length })
                  : t('situacao.saldoIndisponivel')}
              </p>
            </div>
            <ComparativoFinanceiro
              gastoCents={resumo.gastoCents}
              entradasCents={resumo.entradasCents}
              saldoCents={resumo.saldoCents}
            />
          </section>

          <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="rotulo">{t('situacao.linhaTempoTitulo')}</p>
                <p className="mt-1 text-xs text-tinta-fraca">{t('situacao.linhaTempoDescricao')}</p>
              </div>
              {primeiro && ultimo && (
                <span className="text-[11px] text-tinta-tenue">
                  {rotuloMes(primeiro.competencia)} — {rotuloMes(ultimo.competencia)}
                </span>
              )}
            </div>
            <div className="relative mt-6">
              <div aria-hidden className="absolute left-0 right-0 top-4 h-px bg-carvao-700" />
              <div className="relative grid gap-x-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
                {serie.map((ponto) => {
                  const ehMelhor = ponto.competencia === melhorMes?.competencia
                  const ehPior = ponto.competencia === piorMes?.competencia
                  const selecionado = ponto.competencia === ativo
                  return (
                    <button
                      key={ponto.competencia}
                      type="button"
                      onClick={() => setMesAtivo(ponto.competencia)}
                      aria-pressed={selecionado}
                      aria-label={t('situacao.selecionarMes', { mes: rotuloMes(ponto.competencia) })}
                      className="group min-w-0 text-left"
                    >
                      <span className={`relative z-10 block h-8 w-8 rounded-full border-4 border-carvao-900 transition-transform group-hover:scale-110 ${selecionado ? 'bg-marca' : ehPior ? 'bg-falha' : ehMelhor ? 'bg-credito' : 'bg-tinta-tenue'}`} />
                      <span className={`mt-2 block truncate text-[11px] ${selecionado ? 'font-semibold text-tinta' : 'text-tinta-fraca'}`}>
                        {rotuloMes(ponto.competencia)}
                      </span>
                      <span className="tabular mt-1 block truncate text-[10px] text-tinta-tenue">
                        {dinheiro(resultado(ponto))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="rotulo">{t('situacao.momentosTitulo')}</p>
                <p className="mt-1 text-xs text-tinta-fraca">{t('situacao.momentosDescricao', { n: serie.length })}</p>
              </div>
              <span className="text-[11px] text-tinta-tenue">{t('situacao.documentosAviso')}</span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {melhorMes && (
                <article className="rounded-lg border border-carvao-700 bg-afundado p-4">
                  <p className="rotulo !text-[10px]">{t('situacao.melhorMes')}</p>
                  <p className="mt-2 text-lg font-medium text-tinta">{rotuloMes(melhorMes.competencia)}</p>
                  <p className="mt-2 text-sm text-tinta-fraca">
                    {t('situacao.melhorMesTexto', { valor: dinheiro(resultado(melhorMes)) })}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-carvao-700 pt-4 sm:grid-cols-4">
                    <div>
                      <p className="rotulo !text-[9px]">{t('situacao.receitas')}</p>
                      <p className="tabular mt-1 text-sm text-tinta">{dinheiro(melhorMes.entradasCents)}</p>
                    </div>
                    <div>
                      <p className="rotulo !text-[9px]">{t('situacao.despesas')}</p>
                      <p className="tabular mt-1 text-sm text-tinta">{dinheiro(melhorMes.gastoCents)}</p>
                    </div>
                    <div>
                      <p className="rotulo !text-[9px]">{t('situacao.economia')}</p>
                      <p className="tabular mt-1 text-sm text-credito">{dinheiro(resultado(melhorMes))}</p>
                    </div>
                    <div>
                      <p className="rotulo !text-[9px]">{t('situacao.taxaEconomia')}</p>
                      <p className="tabular mt-1 text-sm text-credito">
                        {melhorMes.entradasCents > 0
                          ? `${((resultado(melhorMes) / melhorMes.entradasCents) * 100).toFixed(1).replace('.', ',')}%`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </article>
              )}
              {piorMes && (
                <article className="rounded-lg border border-carvao-700 bg-afundado p-4">
                  <p className="rotulo !text-[10px]">{t('situacao.mesMaisCaro')}</p>
                  <p className="mt-2 text-lg font-medium text-tinta">{rotuloMes(piorMes.competencia)}</p>
                  <p className="mt-2 text-sm text-tinta-fraca">
                    {t('situacao.mesMaisCaroTexto', { valor: dinheiro(piorMes.gastoCents) })}
                  </p>
                  {categoriasPiorMes.length > 0 && (
                    <div className="mt-5 border-t border-carvao-700 pt-4">
                      <p className="rotulo !text-[9px]">{t('situacao.mesMaisCaroCategorias')}</p>
                      <ul className="mt-3 space-y-2.5">
                        {categoriasPiorMes.map((item) => (
                          <li key={item.cat.slug} className="flex items-center gap-2 text-xs">
                            <span className="w-28 shrink-0 truncate text-tinta-fraca">
                              {nomeCategoria(item.cat)}
                            </span>
                            <span className="h-1 flex-1 overflow-hidden rounded-full bg-carvao-800">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${Math.min((item.totalCents / piorMes.gastoCents) * 100, 100)}%`,
                                  backgroundColor: item.cat.cor,
                                }}
                              />
                            </span>
                            <span className="tabular w-24 text-right text-tinta">
                              {dinheiro(item.totalCents)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
            <GraficoFluxo serie={serie} ativo={ativo} onSelecionar={setMesAtivo} />
          </section>

          {resumo.porCategoria.length > 0 && (
            <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
              <GraficoCategorias categorias={resumo.porCategoria} totalCents={resumo.gastoCents} />
            </section>
          )}
        </>
      )}
    </div>
  )
}

function ComparacaoCard({
  titulo,
  atual,
  anterior,
  dinheiro,
  formatar,
}: {
  titulo: string
  atual: number | null
  anterior: number | null
  dinheiro?: (valor: number) => string
  formatar?: (valor: number | null) => string
}) {
  const mostrar = formatar ?? ((valor: number | null) => (valor === null || !dinheiro ? '—' : dinheiro(valor)))
  const variacao = atual !== null && anterior !== null ? variacaoPct(atual, anterior) : null
  return (
    <article className="rounded-lg border border-carvao-700 bg-afundado p-4">
      <p className="rotulo !text-[10px]">{titulo}</p>
      <p className="tabular mt-2 text-xl text-tinta">{mostrar(atual)}</p>
      <p className="mt-1 text-[11px] text-tinta-tenue">{mostrar(anterior)} {variacao === null ? '' : `· ${variacao >= 0 ? '+' : ''}${variacao.toFixed(1).replace('.', ',')}%`}</p>
    </article>
  )
}
