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

  const historico = useMemo(() => visiveis ?? [], [visiveis])
  const serieCompleta = useMemo(() => evolucaoMensal(historico), [historico])
  const serie = useMemo(() => serieCompleta.slice(-janela), [janela, serieCompleta])
  const competencias = useMemo(() => new Set(serie.map((p) => p.competencia)), [serie])
  const txsJanela = useMemo(
    () => historico.filter((tx) => competencias.has(tx.competencia)),
    [competencias, historico],
  )
  const resumo = useMemo(() => agregar(txsJanela), [txsJanela])
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

  if (carregando) return null

  return (
    <div className="mt-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo">{t('situacao.eyebrow')}</p>
          <h2 className="mt-1 font-display text-3xl text-tinta sm:text-4xl">{t('situacao.evolucaoTitulo')}</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-tinta-fraca">{t('situacao.descricao')}</p>
        </div>
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
      </header>

      {serie.length === 0 ? (
        <section className="rounded-xl border border-carvao-700 bg-carvao-900 p-6 text-sm text-tinta-fraca sombra-flutuante">
          {t('situacao.semDados')}
        </section>
      ) : (
        <>
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
