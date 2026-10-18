import { useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { evolucaoMensal, maioresSaidas, porEstabelecimento } from '../domain/agrupar'
import { analisarRelatorio, type JanelaRelatorio } from '../domain/relatorios'
import { mesAbrev } from '../domain/normalize/data'
import { useDados } from '../dados/DadosProvider'
import { useRecorte } from '../dados/useRecorte'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'
import { GraficoCategorias } from '../ui/graficos/GraficoCategorias'
import { GraficoFluxo } from '../ui/graficos/GraficoFluxo'
import { TransacoesDoMes } from '../ui/TransacoesDoMes'
import { Cartao } from '../ui/Cartao'
import { CarregandoPainel } from '../ui/CarregandoPainel'
import { EstadoVazio } from '../ui/EstadoVazio'
import { ErroCarregar } from '../ui/ErroCarregar'
import { Procedencia } from '../ui/Procedencia'
import { MesesRelatorio } from '../ui/MesesRelatorio'
import { DetalheRelatorio } from '../ui/DetalheRelatorio'
import { categoria, nomeCategoria } from '../domain/categorize/categorias'
import { normalizeMerchant } from '../domain/normalize/merchant'

type Detalhe = { tipo: 'categoria' | 'estabelecimento' | 'transacao'; chave: string }

function rotuloMes(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  return `${mesAbrev(new Date(ano, (mes ?? 1) - 1, 1))} ${ano}`
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
  const { todas, recarregar } = useDados()
  const { visiveis, carregando, erro, setFiltros, compAtiva } = useRecorte()
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const tipoDetalhe = search.get('detalhe')
  const chaveDetalhe = search.get('item')
  const detalhe: Detalhe | null = chaveDetalhe && (tipoDetalhe === 'categoria' || tipoDetalhe === 'estabelecimento' || tipoDetalhe === 'transacao')
    ? { tipo: tipoDetalhe, chave: chaveDetalhe } : null
  const gatilhoDetalhe = useRef<HTMLElement | null>(null)
  const tituloRelatorio = useRef<HTMLHeadingElement>(null)

  function semDetalhe() {
    const proxima = new URLSearchParams(search)
    proxima.delete('detalhe')
    proxima.delete('item')
    return proxima
  }

  function abrirDetalhe(proximo: Detalhe) {
    gatilhoDetalhe.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const proxima = semDetalhe()
    proxima.set('detalhe', proximo.tipo)
    proxima.set('item', proximo.chave)
    setSearch(proxima, { replace: true })
  }

  function fecharDetalhe() {
    setSearch(semDetalhe(), { replace: true })
    const alvo = gatilhoDetalhe.current?.isConnected ? gatilhoDetalhe.current : tituloRelatorio.current
    alvo?.focus()
  }

  function abrirDocumento(id: string) {
    const proxima = semDetalhe()
    proxima.set('documento', id)
    navigate(`/faturas?${proxima.toString()}`)
  }
  const parametroJanela = search.get('janela')
  const janela: JanelaRelatorio = parametroJanela === '3' ? 3 : parametroJanela === '6' ? 6 : 12

  function selecionarJanela(valor: JanelaRelatorio) {
    const proxima = semDetalhe()
    proxima.set('janela', String(valor))
    setSearch(proxima, { replace: true })
  }

  const historico = useMemo(() => visiveis ?? todas ?? [], [todas, visiveis])
  const relatorio = useMemo(() => analisarRelatorio(historico, janela), [historico, janela])
  const txs = useMemo(() => relatorio?.atual.transacoes ?? [], [relatorio])
  const serie = useMemo(() => evolucaoMensal(txs), [txs])
  const competencias = useMemo(() => relatorio?.atual.meses.map((mes) => mes.competencia), [relatorio])
  const resumo = relatorio?.atual.resumo
  const maiores = useMemo(() => maioresSaidas(txs, 6), [txs])
  const estabelecimentos = useMemo(() => porEstabelecimento(txs, 5), [txs])
  const intervalo = relatorio ? `${rotuloMes(relatorio.atual.inicio)} — ${rotuloMes(relatorio.atual.fim)}` : ''
  const taxaAtual = relatorio?.taxaEconomiaAtualPct ?? null
  const taxaAnterior = relatorio?.taxaEconomiaAnteriorPct ?? null
  const variacaoGasto = relatorio?.variacaoGastoPct ?? null
  const transacoesDetalhe = txs.filter((tx) => tx.kind === 'expense' && detalhe && (
    detalhe.tipo === 'categoria' ? (tx.category_slug ?? 'outros') === detalhe.chave :
    detalhe.tipo === 'estabelecimento' ? normalizeMerchant(tx.description) === detalhe.chave : tx.id === detalhe.chave
  ))
  const tituloDetalhe = detalhe && transacoesDetalhe.length > 0
    ? detalhe.tipo === 'categoria' ? nomeCategoria(categoria(detalhe.chave))
      : detalhe.tipo === 'estabelecimento' ? estabelecimentos.find((item) => item.merchant === detalhe.chave)?.rotulo ?? normalizeMerchant(transacoesDetalhe[0].description)
        : transacoesDetalhe[0].label ?? transacoesDetalhe[0].description
    : ''

  function selecionarMes(competencia: string) {
    const [ano, mes] = competencia.split('-').map(Number)
    setFiltros({ periodo: 'mes', ref: new Date(ano, (mes ?? 1) - 1, 1) })
  }

  return (
    <div className="pilha-paineis mt-6 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo">{t('relatorios.eyebrow')}</p>
          <h2 ref={tituloRelatorio} tabIndex={-1} className="mt-1 font-display text-3xl text-tinta sm:text-4xl">{t('relatorios.titulo')}</h2>
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
              onClick={() => selecionarJanela(valor)}
              aria-pressed={janela === valor}
              className={`min-h-11 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                janela === valor ? 'bg-carvao-850 text-tinta' : 'text-tinta-tenue hover:text-tinta'
              }`}
            >
              {t(chave)}
            </button>
          ))}
        </div>
      </header>

      {carregando ? (
        <CarregandoPainel />
      ) : erro ? (
        <ErroCarregar mensagem={t(erro)} onTentar={recarregar} />
      ) : !relatorio || !resumo ? (
        <EstadoVazio
          titulo={t('estado.vazioTitulo')}
          descricao={t('relatorios.semDados')}
          acao={<Link to="/importar" className="acao-painel">{t('dash.importar')}</Link>}
        />
      ) : (
        <>
          <Procedencia txs={txs} periodo={intervalo} />
          <MesesRelatorio atual={relatorio.atual} anterior={relatorio.anterior} comparavel={relatorio.comparavel} />
          <section aria-label={t('relatorios.resumoAria')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Cartao as="article">
              <p className="rotulo">{t('relatorios.receitas')}</p>
              <p className="tabular mt-3 text-2xl text-credito">{dinheiro(resumo.entradasCents)}</p>
              <p className="mt-1 text-xs text-tinta-fraca">{t('relatorios.mesesContagem', { n: relatorio.atual.mesesComDados, total: janela })}</p>
            </Cartao>
            <Cartao as="article">
              <p className="rotulo">{t('relatorios.despesas')}</p>
              <p className="tabular mt-3 text-2xl text-debito">{dinheiro(resumo.gastoCents)}</p>
              <p className="mt-1 text-xs text-tinta-fraca">
                {variacaoGasto === null ? t(relatorio.comparavel ? 'relatorios.semBaseGasto' : 'relatorios.semComparacao') : t('relatorios.variacao', { valor: percentual(variacaoGasto) })}
              </p>
            </Cartao>
            <Cartao as="article">
              <p className="rotulo">{t('relatorios.resultado')}</p>
              <p className={`tabular mt-3 text-2xl ${resumo.saldoCents < 0 ? 'text-falha' : 'text-tinta'}`}>
                {dinheiro(resumo.saldoCents)}
              </p>
              <p className="mt-1 text-xs text-tinta-fraca">{t('relatorios.resultadoDescricao')}</p>
            </Cartao>
            <Cartao as="article">
              <p className="rotulo">{t('relatorios.taxaEconomia')}</p>
              <p className={`tabular mt-3 text-2xl ${taxaAtual !== null && taxaAtual < 0 ? 'text-debito' : 'text-credito'}`}>{percentual(taxaAtual)}</p>
              <p className="mt-1 text-xs text-tinta-fraca">
                {taxaAnterior === null ? t(relatorio.comparavel ? 'relatorios.semBaseEntradas' : 'relatorios.semComparacao') : t('relatorios.comparadoAnterior', { valor: percentual(taxaAnterior) })}
              </p>
            </Cartao>
          </section>

          <Cartao>
            <GraficoFluxo serie={serie} competencias={competencias} ativo={compAtiva} onSelecionar={selecionarMes} />
            {serie.some((ponto) => ponto.competencia === compAtiva) && <TransacoesDoMes competencia={compAtiva} />}
          </Cartao>

          <div className="grid gap-6 lg:grid-cols-2">
            {resumo.porCategoria.length > 0 && (
              <Cartao>
                <GraficoCategorias categorias={resumo.porCategoria} totalCents={resumo.gastoCents}
                  onAbrir={(slug) => abrirDetalhe({ tipo: 'categoria', chave: slug })} />
              </Cartao>
            )}
            <Cartao>
              <p className="rotulo">{t('relatorios.insightsTitulo')}</p>
              <p className="mt-1 text-xs text-tinta-fraca">{t('relatorios.insightsDescricao')}</p>
              <div className="mt-5 space-y-4">
                {estabelecimentos.slice(0, 3).map((item) => (
                  <button type="button" key={item.merchant} className="flex min-h-11 w-full flex-wrap items-center gap-3 rounded-md p-2 text-left hover:bg-afundado"
                    onClick={() => abrirDetalhe({ tipo: 'estabelecimento', chave: item.merchant })}>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-marca" />
                    <span className="min-w-0 basis-32 flex-1 break-words text-sm text-tinta-fraca">{item.rotulo}</span>
                    <span className="tabular text-sm text-tinta">{dinheiro(item.totalCents)}</span>
                  </button>
                ))}
                {estabelecimentos.length === 0 && <p className="text-sm text-tinta-fraca">{t('relatorios.semInsights')}</p>}
              </div>
            </Cartao>
          </div>

          {detalhe && transacoesDetalhe.length > 0 && <DetalheRelatorio key={`${detalhe.tipo}:${detalhe.chave}`} titulo={tituloDetalhe}
            txs={transacoesDetalhe} periodo={intervalo} onFechar={fecharDetalhe} onVerDocumento={abrirDocumento} />}

          <div className="grid gap-6 lg:grid-cols-2">
            <Cartao>
              <p className="rotulo">{t('relatorios.maioresSaidasTitulo')}</p>
              <p className="mt-1 text-xs text-tinta-fraca">{t('relatorios.maioresSaidasDescricao')}</p>
              <ul className="mt-5 divide-y divide-carvao-700">
                {maiores.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="flex min-h-11 w-full flex-wrap items-center gap-3 rounded-md py-3 text-left hover:bg-afundado"
                      onClick={() => abrirDetalhe({ tipo: 'transacao', chave: item.id })}>
                    <span className="tabular w-6 text-xs text-tinta-tenue">{maiores.indexOf(item) + 1}</span>
                    <span className="min-w-0 basis-32 flex-1 break-words text-sm text-tinta-fraca">{item.label ?? item.description}</span>
                    <span className="tabular text-sm text-debito">{dinheiro(item.amount_cents)}</span>
                    </button>
                  </li>
                ))}
                {maiores.length === 0 && <li className="text-sm text-tinta-fraca">{t('relatorios.semSaidas')}</li>}
              </ul>
            </Cartao>
            <Cartao>
              <p className="rotulo">{t('relatorios.provenienciaTitulo')}</p>
              <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">{t('relatorios.provenienciaDescricao')}</p>
              <div className="mt-5 rounded-lg border border-dashed border-carvao-600 bg-afundado p-4 text-xs leading-relaxed text-tinta-tenue">
                {t('relatorios.provenienciaAviso')}
              </div>
            </Cartao>
          </div>
        </>
      )}
    </div>
  )
}
