import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { agregar, evolucaoMensal, type PontoMes } from '../domain/agrupar'
import { analisarRelatorio, type JanelaRelatorio } from '../domain/relatorios'
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
import { corCategoria } from '../ui/corCategoria'
import { CarregandoPainel } from '../ui/CarregandoPainel'
import { ErroCarregar } from '../ui/ErroCarregar'
import { EstadoVazio } from '../ui/EstadoVazio'
import { MesesRelatorio } from '../ui/MesesRelatorio'


function rotuloMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  return `${mesAbrev(new Date(ano, mes - 1, 1))} ${ano}`
}

function resultado(ponto: PontoMes): number {
  return ponto.entradasCents - ponto.gastoCents
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
  const { docsSaldo, recarregar } = useDados()
  const { visiveis, filtros, carregando, erro } = useRecorte()
  const [search, setSearch] = useSearchParams()
  const parametroJanela = search.get('janela')
  const janela: JanelaRelatorio = parametroJanela === '3' ? 3 : parametroJanela === '6' ? 6 : 12
  const comparar = search.get('comparar') === '1'

  function atualizarBusca(chave: string, valor: string | null) {
    const proxima = new URLSearchParams(search)
    if (valor === null) proxima.delete(chave)
    else proxima.set(chave, valor)
    setSearch(proxima, { replace: true })
  }

  const historico = useMemo(() => visiveis ?? [], [visiveis])
  const relatorio = useMemo(() => analisarRelatorio(historico, janela), [historico, janela])
  const txsJanela = useMemo(() => relatorio?.atual.transacoes ?? [], [relatorio])
  const serie = useMemo(() => evolucaoMensal(txsJanela), [txsJanela])
  const maiorResultadoMensal = Math.max(1, ...serie.map((ponto) => Math.abs(resultado(ponto))))
  const competencias = useMemo(() => relatorio?.atual.meses.map((mes) => mes.competencia) ?? [], [relatorio])
  const resumo = relatorio?.atual.resumo
  const resumoAnterior = relatorio?.anterior.resumo
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
  const saldos = useMemo(() => saldosPorConta(
    filtros.banco === 'geral' ? docsSaldo : docsSaldo.filter((doc) => doc.bank === filtros.banco),
  ), [docsSaldo, filtros.banco])
  const saldoAtual = saldos.reduce((total, conta) => total + conta.balanceCents, 0)
  const mesAtivo = search.get('mes')
  const ativo = mesAtivo && serie.some((p) => p.competencia === mesAtivo) ? mesAtivo : serie.at(-1)?.competencia ?? ''
  const taxaAtual = relatorio?.taxaEconomiaAtualPct ?? null
  const taxaAnterior = relatorio?.taxaEconomiaAnteriorPct ?? null

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
            onClick={() => atualizarBusca('comparar', comparar ? null : '1')}
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
              onClick={() => {
                const proxima = new URLSearchParams(search)
                proxima.set('janela', String(valor))
                proxima.delete('mes')
                setSearch(proxima, { replace: true })
              }}
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

      {carregando ? (
        <CarregandoPainel />
      ) : erro ? (
        <ErroCarregar mensagem={t(erro)} onTentar={recarregar} />
      ) : !relatorio || !resumo ? (
        <EstadoVazio titulo={t('estado.vazioTitulo')} descricao={t('situacao.semDados')}
          acao={<Link to="/importar" className="acao-painel">{t('dash.importar')}</Link>} />
      ) : (
        <>
          <MesesRelatorio atual={relatorio.atual} anterior={relatorio.anterior} comparavel={relatorio.comparavel}
            titulo={t('situacao.mesesTitulo')} />
          {comparar && (
            <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="rotulo">{t('situacao.comparacaoTitulo')}</p>
                  <p className="mt-1 text-xs text-tinta-fraca">{t('situacao.comparacaoDescricao', { n: janela })}</p>
                </div>
                <span className="text-[11px] text-tinta-tenue">
                  {relatorio.comparavel ? t('situacao.comparacaoDisponivel') : t('situacao.comparacaoIndisponivel')}
                </span>
              </div>
              {relatorio.comparavel && resumoAnterior ? (
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

          <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-stretch">
            <div className="flex min-w-0 flex-col rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
              <p className="rotulo">{t('situacao.saldoAtual')}</p>
              <p className="tabular mt-4 whitespace-nowrap font-display text-[clamp(1.3rem,3vw,2.45rem)] leading-tight tracking-tight text-tinta">
                {saldos.length > 0 ? dinheiro(saldoAtual) : '—'}
              </p>
              <p className="mt-auto pt-4 text-sm leading-relaxed text-tinta-fraca">
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
              {relatorio && (
                <span className="text-[11px] text-tinta-tenue">
                  {rotuloMes(relatorio.atual.inicio)} — {rotuloMes(relatorio.atual.fim)}
                </span>
              )}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {relatorio.atual.meses.map((mes) => {
                  const ponto = serie.find((item) => item.competencia === mes.competencia)
                  if (!ponto) return <div key={mes.competencia}
                    role="img"
                    aria-label={t('fluxo.mesSemDados', { mes: rotuloMes(mes.competencia) })}
                    className="min-w-0 rounded-lg border border-dashed border-carvao-700 bg-afundado/50 p-3">
                    <span className="block truncate text-[11px] text-tinta-fraca">{rotuloMes(mes.competencia)}</span>
                    <span aria-hidden className="mt-3 flex h-14 items-center justify-center text-xl text-tinta-tenue">—</span>
                    <span className="mt-2 block min-h-8 text-[10px] leading-relaxed text-tinta-fraca">{t('relatorios.mesSemDados')}</span>
                  </div>
                  const ehMelhor = ponto.competencia === melhorMes?.competencia
                  const ehPior = ponto.competencia === piorMes?.competencia
                  const selecionado = ponto.competencia === ativo
                  const saldoMes = resultado(ponto)
                  const alturaBarra = Math.round(Math.abs(saldoMes) / maiorResultadoMensal * 100)
                  return (
                    <button
                      key={ponto.competencia}
                      type="button"
                      onClick={() => atualizarBusca('mes', ponto.competencia)}
                      aria-pressed={selecionado}
                      aria-label={t('situacao.selecionarMes', { mes: rotuloMes(ponto.competencia), valor: dinheiro(saldoMes) })}
                      className={`group min-w-0 rounded-lg border p-3 text-left transition-colors ${selecionado ? 'border-marca/60 bg-carvao-850' : 'border-carvao-700 bg-afundado hover:border-carvao-600'}`}
                    >
                      <span className={`block truncate text-[11px] ${selecionado ? 'font-semibold text-tinta' : 'text-tinta-fraca'}`}>
                        {rotuloMes(ponto.competencia)}
                      </span>
                      <span aria-hidden className="relative mt-3 block h-14">
                        <span className="absolute inset-x-0 top-1/2 h-px bg-carvao-700" />
                        <span className={`absolute left-1/2 w-3 -translate-x-1/2 rounded-sm ${saldoMes >= 0 ? 'bottom-1/2 bg-credito' : 'top-1/2 bg-debito'}`}
                          style={{ height: `${alturaBarra / 2}%` }} />
                      </span>
                      <span className={`tabular mt-2 block truncate text-[11px] ${saldoMes >= 0 ? 'text-credito' : 'text-debito'}`}>
                        {dinheiro(saldoMes)}
                      </span>
                      <span className="mt-1 block min-h-4 truncate text-[9px] text-tinta-tenue">
                        {ehMelhor ? t('situacao.melhorMes') : ehPior ? t('situacao.mesMaisCaro') : ''}
                      </span>
                    </button>
                  )
                })}
            </div>
          </section>

          <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="rotulo">{t('situacao.momentosTitulo')}</p>
                <p className="mt-1 text-xs text-tinta-fraca">{t('situacao.momentosDescricao', { n: relatorio.atual.mesesComDados })}</p>
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
                      <p className={`tabular mt-1 text-sm ${resultado(melhorMes) >= 0 ? 'text-credito' : 'text-debito'}`}>
                        {dinheiro(resultado(melhorMes))}
                      </p>
                    </div>
                    <div>
                      <p className="rotulo !text-[9px]">{t('situacao.taxaEconomia')}</p>
                      <p className={`tabular mt-1 text-sm ${resultado(melhorMes) >= 0 ? 'text-credito' : 'text-debito'}`}>
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
                                  backgroundColor: corCategoria(item.cat),
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
            <GraficoFluxo serie={serie} competencias={competencias} ativo={ativo} onSelecionar={(mes) => atualizarBusca('mes', mes)} />
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
