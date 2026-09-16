import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { Link, useNavigate } from 'react-router-dom'
import {
  maioresSaidas,
  porEstabelecimento,
  evolucaoMensal,
  porDia,
  doMesCalendario,
  isoLocal,
} from '../domain/agrupar'
import { saldosPorConta } from '../domain/saldos'
import { faturasAbertas } from '../domain/aberto'
import { nomeCategoria } from '../domain/categorize/categorias'
import { dataLongaDe } from '../domain/normalize/data'
import type { TransacaoSalva } from '../aplicacao/consultas/historico'
import { useDados } from '../dados/DadosProvider'
import { useRecorte } from '../dados/useRecorte'
import { escreverFiltros } from '../dados/filtros'
import { BarraFiltros } from '../ui/BarraFiltros'
import { rotuloPeriodo } from '../dados/periodo'
import { Procedencia } from '../ui/Procedencia'
import { GraficoCategorias } from '../ui/graficos/GraficoCategorias'
import { GraficoFluxo } from '../ui/graficos/GraficoFluxo'
import { ComparativoFinanceiro } from '../ui/graficos/ComparativoFinanceiro'
import { LeiturasFinanceiras, type LeituraFinanceira } from '../ui/LeiturasFinanceiras'
import { GraficoDiario } from '../ui/graficos/GraficoDiario'
import { MaioresSaidas } from '../ui/listas/MaioresSaidas'
import { TopEstabelecimentos } from '../ui/listas/TopEstabelecimentos'
import { Diagnosticos } from '../ui/Diagnosticos'
import { diagnosticar } from '../domain/diagnosticos'
import { SaldoConta } from '../ui/SaldoConta'
import { SaldoAberto } from '../ui/SaldoAberto'
import { ErroCarregar } from '../ui/ErroCarregar'
import { ValorAnimado } from '../ui/ValorAnimado'
import { EditarCompra } from '../ui/EditarCompra'
// Estático, e os três juntos. Havia `await import('../lib/compartilhar')`
// dentro das funções, mas `podeCompartilharArquivo` já era importado aqui de
// forma estática — o módulo entrava no chunk de qualquer jeito e o build
// reclamava (INEFFECTIVE_DYNAMIC_IMPORT). Dividir também não valeria a pena:
// o arquivo tem 1,5 kB e nenhuma dependência. O peso do PDF está em
// `relatorio-pdf`/`jspdf`, que continuam carregando sob demanda.
import { podeCompartilharArquivo, baixarArquivo, compartilharArquivo } from '../lib/compartilhar'
import { ehFalhaDeChunk } from '../lib/chunk'
import { useT } from '../i18n/IdiomaProvider'
import { useDinheiro } from '../dados/DiscretoProvider'
import type { Dicionario } from '../i18n/dicionarios/pt'

type Props = {
  onAprendeu?: () => void
}

function agrupamentoDe(periodo: string): keyof Dicionario {
  return periodo === 'mes' || periodo === 'ano' ? 'dash.porFatura' : 'dash.porData'
}

/** A visão geral do mês: números, gráficos e as maiores saídas.
 *
 *  As listas longas, as recorrências e os compromissos futuros saíram daqui
 *  para páginas próprias em 2026-08-07. Foi isso que permitiu remover o
 *  `max-h`+`overflow-y-auto` da coluna lateral: ela acumulava donut, maiores
 *  saídas, evolução, recorrências e compromissos, passava da altura da
 *  janela, e um `sticky` mais alto que a viewport gruda deixando o que sobra
 *  embaixo inalcançável. Com o conteúdo distribuído, a coluna não alcança
 *  mais esse tamanho — a regra sai sem trazer de volta o bug que ela
 *  consertava. */
export function Painel({ onAprendeu }: Props) {
  const { t } = useT()
  const dinheiro = useDinheiro()
  const navigate = useNavigate()
  const { docsSaldo, recarregar, aplicarEdicao } = useDados()
  const { txs, resumo, variacao, visiveis, filtros, setFiltros, compAtiva, carregando, erro, vazio } =
    useRecorte()
  const [editando, setEditando] = useState<TransacaoSalva | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  // Capacidade do navegador, estável na sessão: decidida uma vez, não a
  // cada render. Some no desktop sem Web Share — lá só existe baixar.
  const [podeCompartilhar] = useState(podeCompartilharArquivo)
  const semMovimento = useReducedMotion()

  const saldos = useMemo(() => saldosPorConta(docsSaldo), [docsSaldo])
  const abertos = useMemo(() => faturasAbertas(docsSaldo), [docsSaldo])
  const maiores = useMemo(() => maioresSaidas(txs, 5), [txs])
  const estabelecimentos = useMemo(() => porEstabelecimento(txs, 5), [txs])
  const diagnosticos = useMemo(() => diagnosticar(txs), [txs])
  const serie = useMemo(() => (visiveis ? evolucaoMensal(visiveis) : []), [visiveis])

  /** O ritmo diário desenha o MÊS quando o recorte é Dia ou Semana.
   *
   *  Antes recebia só o recorte, e num Dia isso é um dia: `GraficoDiario` se
   *  apagava e a metade direita do painel voltava a ser o buraco branco que
   *  ele foi criado para tapar. E o conserto não é baixar o limite e desenhar
   *  uma barra sozinha — uma barra é o mesmo número do tile, redesenhado.
   *  "Onde estão os picos" é pergunta que só existe contra um pano de fundo,
   *  então o pano de fundo passa a ser o mês, com o dia aberto em destaque.
   *
   *  Pelo mês de CALENDÁRIO (`doMesCalendario`), não por competência: o eixo
   *  x deste gráfico é a data real, e recortar por competência poria uma
   *  barra de 20/mai dentro do desenho de junho. Ver ADR-0001. */
  const ampliado = filtros.periodo === 'dia' || filtros.periodo === 'semana'
  const dias = useMemo(
    () => porDia(ampliado && visiveis ? doMesCalendario(visiveis, filtros.ref) : txs),
    [ampliado, visiveis, filtros.ref, txs],
  )
  const temRitmo = dias.some((d) => d.gastoCents > 0)
  const pico = useMemo(
    () =>
      dias.reduce<(typeof dias)[number] | null>(
        (maior, dia) => (maior === null || dia.gastoCents > maior.gastoCents ? dia : maior),
        null,
      ),
    [dias],
  )

  const leituras: LeituraFinanceira[] = (() => {
    const maiorCategoria = resumo.porCategoria[0]
    const maiorEstabelecimento = estabelecimentos[0]
    const itens: LeituraFinanceira[] = []

    if (maiorCategoria && resumo.gastoCents > 0) {
      itens.push({
        id: 'maior-categoria',
        titulo: t('leituras.maiorCategoria'),
        texto: t('leituras.maiorCategoriaTexto', {
          categoria: nomeCategoria(maiorCategoria.cat),
          valor: dinheiro(maiorCategoria.totalCents),
          pct: Math.round((maiorCategoria.totalCents / resumo.gastoCents) * 100),
        }),
        tom: 'alerta',
        rotuloAcao: t('leituras.verLancamentos'),
        onAbrir: () => irParaCategoria(maiorCategoria.cat.slug),
      })
    }

    if (maiorEstabelecimento) {
      itens.push({
        id: 'maior-estabelecimento',
        titulo: t('leituras.maiorEstabelecimento'),
        texto: t('leituras.maiorEstabelecimentoTexto', {
          estabelecimento: maiorEstabelecimento.rotulo,
          valor: dinheiro(maiorEstabelecimento.totalCents),
          n: maiorEstabelecimento.contagem,
        }),
        tom: 'neutro',
        rotuloAcao: t('leituras.verLancamentos'),
        onAbrir: () => irParaEstabelecimento(maiorEstabelecimento.merchant),
      })
    }

    if (pico && pico.gastoCents > 0) {
      const [ano, mes, dia] = pico.dia.split('-').map(Number)
      itens.push({
        id: 'pico-gasto',
        titulo: t('leituras.picoGasto'),
        texto: t('leituras.picoGastoTexto', {
          data: dataLongaDe(new Date(ano, mes - 1, dia)),
          valor: dinheiro(pico.gastoCents),
        }),
        tom: 'alerta',
        rotuloAcao: t('leituras.verDia'),
        onAbrir: () => irParaDia(pico.dia),
      })
    }

    if (resumo.entradasCents > 0) {
      const pct = (resumo.saldoCents / resumo.entradasCents) * 100
      itens.push({
        id: 'taxa-economia',
        titulo: t('leituras.economia'),
        texto: t('leituras.economiaTexto', {
          pct: pct.toFixed(1).replace('.', ','),
          valor: dinheiro(resumo.saldoCents),
        }),
        tom: pct >= 0 ? 'positivo' : 'alerta',
      })
    }

    return itens
  })()

  // Entrada escalonada e discreta — o painel "se monta" de cima para baixo
  // em vez de piscar inteiro. Restrição de propósito: app de dinheiro pede
  // calma.
  const suave = [0.22, 1, 0.36, 1] as const
  const entra = (delay: number) =>
    semMovimento
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease: suave },
        }

  function irParaMes(competencia: string) {
    const [y, m] = competencia.split('-').map(Number)
    setFiltros({ periodo: 'mes', ref: new Date(y, m - 1, 1) })
  }

  /** Clicar num estabelecimento abre os lançamentos dele — como clicar numa
   *  fatia do donut abre a categoria. Vai pela BUSCA (`q`), e não por um
   *  filtro novo de estabelecimento: a consulta já procura na descrição do
   *  banco, e a chave normalizada é sempre um trecho dela (o normalizador só
   *  remove — prefixo de adquirente, sufixo de parcela). Leva o recorte
   *  junto para a lista abrir no mesmo período do painel. */
  function irParaEstabelecimento(merchant: string) {
    navigate(`/lancamentos${escreverFiltros({ ...filtros, busca: merchant })}`)
  }

  function irParaCategoria(categoria: string) {
    navigate(`/lancamentos${escreverFiltros({ ...filtros, categoria })}`)
  }

  /** O diagnóstico "X% está sem categoria" vira o gesto de resolvê-lo: abre
   *  a lista já filtrada, no mesmo recorte, com o operador que o próprio
   *  campo de busca aceita. Observação que não vira ação é só reclamação. */
  function irParaSemCategoria() {
    navigate(`/lancamentos${escreverFiltros({ ...filtros, busca: 'sem:categoria' })}`)
  }

  /** Clicar num dia do ritmo leva a tela para aquele dia — o mesmo gesto que
   *  clicar num mês na evolução. Data local: `new Date('2026-07-14')` seria
   *  UTC e, no Brasil, voltaria o dia 13. */
  function irParaDia(dia: string) {
    const [y, m, d] = dia.split('-').map(Number)
    setFiltros({ periodo: 'dia', ref: new Date(y, m - 1, d) })
  }

  // Aba aberta antes de um deploy pede um chunk que não existe mais. Culpar
  // o PDF nesse caso manda a pessoa investigar a coisa errada — o conserto
  // é recarregar, então o toast oferece exatamente isso.
  function avisarFalha(e: unknown) {
    if (ehFalhaDeChunk(e)) {
      toast.error(t('app.versaoNova'), {
        action: { label: t('app.recarregar'), onClick: () => window.location.reload() },
        duration: 10000,
      })
      return
    }
    toast.error(t('pdf.erroGerar'))
  }

  async function montarPdf(): Promise<{ blob: Blob; nome: string; label: string }> {
    const { montarDadosRelatorio, gerarRelatorioPdf } = await import('../lib/relatorio-pdf')
    const label = rotuloPeriodo(filtros.periodo, filtros.ref)
    const dados = montarDadosRelatorio({
      periodoLabel: label,
      agrupamento: t(agrupamentoDe(filtros.periodo)),
      resumo: {
        gastoCents: resumo.gastoCents,
        entradasCents: resumo.entradasCents,
        porCategoria: resumo.porCategoria.map((c) => ({
          cat: { nome: nomeCategoria(c.cat) },
          totalCents: c.totalCents,
        })),
      },
      saldos: saldos.map((s) => ({ bank: s.bank, balanceCents: s.balanceCents, date: s.date })),
    })
    const blob = await gerarRelatorioPdf(dados)
    const slug = label.toLowerCase().replace(/\s+/g, '-')
    return { blob, nome: `relatorio-${slug}.pdf`, label }
  }

  async function baixarPdf() {
    if (!txs || txs.length === 0 || gerandoPdf) return
    setGerandoPdf(true)
    try {
      const { blob, nome } = await montarPdf()
      baixarArquivo(blob, nome)
      toast.success(t('pdf.baixado'))
    } catch (e) {
      // O erro real vai para o console: sem isso, um defeito de geração
      // fica indistinguível de um de download para quem for depurar.
      console.error('Falha ao gerar/baixar o PDF:', e)
      avisarFalha(e)
    } finally {
      setGerandoPdf(false)
    }
  }

  async function compartilharPdf() {
    if (!txs || txs.length === 0 || gerandoPdf) return
    setGerandoPdf(true)
    try {
      const { blob, nome, label } = await montarPdf()
      try {
        await compartilharArquivo(blob, nome, {
          title: `${t('pdf.relatorio')} · ${label}`,
          text: t('pdf.textoCompartilhar', { periodo: label }),
        })
      } catch (e) {
        // Compartilhar falhou (sem suporte, ou user activation expirada
        // enquanto o PDF era gerado). O arquivo já existe: baixar é a saída
        // útil, muito melhor que só dizer "não consegui".
        console.warn('Compartilhar indisponível, baixando:', e)
        baixarArquivo(blob, nome)
        toast.success(t('pdf.baixado'))
      }
    } catch (e) {
      console.error('Falha ao gerar o PDF:', e)
      avisarFalha(e)
    } finally {
      setGerandoPdf(false)
    }
  }

  return (
    <div className="mt-6">
      {/* Ações do período */}
      <div className="screen-only mb-4 flex flex-wrap justify-end gap-2">
        {txs && txs.length > 0 && (
          <>
            <button
              onClick={baixarPdf}
              disabled={gerandoPdf}
              className="flex items-center gap-2 rounded-xl border border-carvao-700 px-4 py-2 text-sm text-tinta transition-all hover:-translate-y-0.5 hover:bg-carvao-850 active:translate-y-0 disabled:opacity-50"
              title={t('dash.baixarTooltip')}
            >
              <IconeBaixar />
              {gerandoPdf ? t('dash.gerando') : t('dash.baixarPdf')}
            </button>
            {podeCompartilhar && (
              <button
                onClick={compartilharPdf}
                disabled={gerandoPdf}
                className="flex items-center gap-2 rounded-xl border border-carvao-700 px-4 py-2 text-sm text-tinta-fraca transition-all hover:-translate-y-0.5 hover:bg-carvao-850 hover:text-tinta active:translate-y-0 disabled:opacity-50"
                title={t('dash.compartilharTooltip')}
              >
                <IconeCompartilhar />
                {t('dash.compartilharPdf')}
              </button>
            )}
          </>
        )}
        <button
          onClick={() => navigate('/importar')}
          className="rounded-xl bg-tinta px-4 py-2 text-sm font-medium text-carvao-950 transition-all hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0"
        >
          {t('dash.importar')}
        </button>
      </div>

      {/* Saldo atual por conta (extrato) + saldo em aberto do cartão (fatura) */}
      {(saldos.length > 0 || abertos.length > 0) && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {saldos.map((s) => (
            <SaldoConta
              key={`saldo-${s.bank}-${s.accountId ?? 'sem-conta'}`}
              bank={s.bank}
              balanceCents={s.balanceCents}
              date={s.date}
            />
          ))}
          {abertos.map((a) => (
            <SaldoAberto
              key={`aberto-${a.bank}-${a.accountId ?? 'sem-conta'}`}
              bank={a.bank}
              abertoCents={a.abertoCents}
              futurasCents={a.futurasCents}
              proximoFechamento={a.proximoFechamento}
            />
          ))}
        </div>
      )}

      <BarraFiltros />

      {/* Cabeçalho que só aparece no PDF impresso */}
      <div className="somente-impressao mb-6">
        <p className="tabular text-[11px] uppercase tracking-[0.3em] text-tinta-tenue">
          Capital Financeiro
        </p>
        <h1 className="font-display text-3xl text-tinta">
          {t('pdf.relatorio')} ·{' '}
          <span className="capitalize">{rotuloPeriodo(filtros.periodo, filtros.ref)}</span>
        </h1>
      </div>

      {/* A procedência antes de qualquer número: é ela que diz de QUE
          documentos os totais abaixo saíram. Fica fora do bloco dos tiles
          de propósito — descreve o bloco, não é um item dele. */}
      {!carregando && !erro && !vazio && (
        <Procedencia txs={txs} periodo={rotuloPeriodo(filtros.periodo, filtros.ref)} />
      )}

      <>
        {carregando ? (
          <Esqueleto />
        ) : erro ? (
          <ErroCarregar mensagem={t(erro)} onTentar={recarregar} />
        ) : vazio ? (
          <Vazio />
        ) : (
          <>
            <div className="space-y-4">
              {/* Tiles de resumo: o espaço entre eles faz cada leitura respirar
                  e deixa o tratamento de cartão consistente com os gráficos. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <motion.div {...entra(0.05)} className="overflow-hidden rounded-xl border border-carvao-700 bg-carvao-900 sombra-flutuante">
                <Tile rotulo={t('dash.gasto')} destaque variacao={variacao.gasto} subirEhRuim>
                  <ValorAnimado valor={resumo.gastoCents} />
                </Tile>
              </motion.div>
              <motion.div {...entra(0.12)} className="overflow-hidden rounded-xl border border-carvao-700 bg-carvao-900 sombra-flutuante">
                <Tile
                  rotulo={t('dash.entradas')}
                  cor="var(--color-confere)"
                  variacao={variacao.entradas}
                >
                  <ValorAnimado valor={resumo.entradasCents} />
                </Tile>
              </motion.div>
              <motion.div {...entra(0.19)} className="overflow-hidden rounded-xl border border-carvao-700 bg-carvao-900 sombra-flutuante">
                {/* Saldo negativo em --color-falha; positivo fica na tinta
                    normal. Verde é de --color-confere ("o total bate") e
                    usar aqui diluiria essa semântica. */}
                <Tile
                  rotulo={t('dash.saldoMes')}
                  cor={resumo.saldoCents < 0 ? 'var(--color-falha)' : undefined}
                >
                  <ValorAnimado valor={resumo.saldoCents} />
                </Tile>
              </motion.div>
              <motion.div {...entra(0.26)} className="overflow-hidden rounded-xl border border-carvao-700 bg-carvao-900 sombra-flutuante">
                <Tile rotulo={t('dash.lancamentos')}>
                  <ValorAnimado valor={resumo.contagem} moeda={false} />
                </Tile>
              </motion.div>
              </div>

              <Diagnosticos itens={diagnosticos} onVerSemCategoria={irParaSemCategoria} />

              <motion.div {...entra(0.27)} className="screen-only">
                <ComparativoFinanceiro
                  gastoCents={resumo.gastoCents}
                  entradasCents={resumo.entradasCents}
                  saldoCents={resumo.saldoCents}
                />
              </motion.div>

              <LeiturasFinanceiras itens={leituras} />

              {/* Cada visual tem seu próprio cartão: a estrutura fica mais
                  próxima de uma leitura analítica, e um gráfico não parece
                  continuação acidental do outro. O conteúdo continua sendo
                  alimentado pelos mesmos agregadores puros do domínio. */}
              <motion.div {...entra(0.28)} className="screen-only grid gap-4 lg:grid-cols-2">
                <section className="min-w-0 rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante">
                  {resumo.porCategoria.length > 0 && (
                    <GraficoCategorias
                      categorias={resumo.porCategoria}
                      totalCents={resumo.gastoCents}
                    />
                  )}
                </section>

                <section className="min-w-0 rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante">
                  {temRitmo ? (
                    <GraficoDiario
                      dias={dias}
                      onSelecionar={irParaDia}
                      destaque={filtros.periodo === 'dia' ? isoLocal(filtros.ref) : null}
                      contexto={ampliado ? rotuloPeriodo('mes', filtros.ref) : null}
                    />
                  ) : (
                    <SemGrafico />
                  )}
                </section>
              </motion.div>

              {serie.length >= 2 && (
                <motion.section
                  {...entra(0.32)}
                  className="screen-only min-w-0 rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante"
                >
                  <GraficoFluxo serie={serie} ativo={compAtiva} onSelecionar={irParaMes} />
                </motion.section>
              )}

              <motion.div {...entra(0.36)} className="grid gap-4 lg:grid-cols-2">
                <section className="min-w-0 rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante">
                  <MaioresSaidas itens={maiores} onEditar={setEditando} />
                  <Link
                    to={{ pathname: '/lancamentos', search: escreverFiltros(filtros) }}
                    className="mt-4 inline-block text-sm text-tinta-tenue transition-colors hover:text-tinta"
                  >
                    {t('dash.lancamentos')} →
                  </Link>
                </section>
                <section className="min-w-0 rounded-xl border border-carvao-700 bg-carvao-900 p-5 sombra-flutuante">
                  <TopEstabelecimentos itens={estabelecimentos} onAbrir={irParaEstabelecimento} />
                  <Link
                    to={{ pathname: '/lancamentos', search: escreverFiltros(filtros) }}
                    className="mt-4 inline-block text-sm text-tinta-tenue transition-colors hover:text-tinta"
                  >
                    {t('dash.lancamentos')} →
                  </Link>
                </section>
              </motion.div>

            </div>
          </>
        )}
      </>

      {editando && (
        <EditarCompra
          tx={editando}
          onFechar={() => setEditando(null)}
          onSalvo={aplicarEdicao}
          onAprendeu={onAprendeu}
        />
      )}
    </div>
  )
}

function IconeBaixar() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

function IconeCompartilhar() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  )
}

function Tile({
  rotulo,
  cor,
  destaque,
  variacao,
  /** `true` quando subir é RUIM (gasto). Entradas invertem: subir é bom. */
  subirEhRuim,
  children,
}: {
  rotulo: string
  cor?: string
  destaque?: boolean
  variacao?: number | null
  subirEhRuim?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="bg-carvao-900 px-6 py-5">
      <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">{rotulo}</p>
      <p
        className={`tabular mt-1.5 ${destaque ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'} text-tinta`}
        style={cor ? { color: cor } : undefined}
      >
        {children}
      </p>
      {variacao !== undefined && variacao !== null && (
        <ComparacaoPeriodo pct={variacao} subirEhRuim={subirEhRuim} />
      )}
    </div>
  )
}

/** A linha "12% acima do período anterior" abaixo do número.
 *
 *  Só aparece quando HÁ período anterior com dado (`variacaoPct` devolve
 *  `null` caso contrário, e o `Tile` não renderiza). Sem essa guarda, o
 *  primeiro mês importado estamparia "+100%" em tudo — que não significa
 *  "gastou o dobro", significa "não havia nada antes".
 *
 *  A cor depende do que o tile mede: gastar 12% a mais é vermelho, receber
 *  12% a mais é verde. Um sinal único para "subiu" pintaria de vermelho um
 *  aumento de salário. */
function ComparacaoPeriodo({ pct, subirEhRuim }: { pct: number; subirEhRuim?: boolean }) {
  const { t } = useT()
  // Arredonda ANTES de decidir o texto: 0,4% viraria "0% acima", que soa a
  // defeito. Abaixo de meio ponto o período empatou, e é isso que se diz.
  const arredondado = Math.round(Math.abs(pct) * 100)
  const subiu = pct > 0

  const texto =
    arredondado === 0
      ? t('variacao.igual')
      : t(subiu ? 'variacao.subiu' : 'variacao.caiu', { pct: arredondado })

  const cor =
    arredondado === 0
      ? 'text-tinta-tenue'
      : subiu === Boolean(subirEhRuim)
        ? 'text-debito'
        : 'text-credito'

  return <p className={`mt-1 text-[11px] ${cor}`}>{texto}</p>
}

/** A metade direita do painel quando não há ritmo nem histórico para desenhar.
 *
 *  Não é "sem dados": diz o que falta e como sair dali, porque o motivo é
 *  sempre o mesmo — importar mais um documento. Discreto de propósito: a
 *  coluna da esquerda tem o donut com o dado que existe, e um vazio gritando
 *  ao lado dele daria a impressão de que a tela quebrou. */
function SemGrafico() {
  const { t } = useT()
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-carvao-700 px-6 py-10 text-center">
      <p className="text-sm text-tinta-fraca">{t('diario.semRitmo')}</p>
      <Link
        to="/importar"
        className="text-sm text-marca underline-offset-4 transition-colors hover:underline"
      >
        {t('dash.importar')}
      </Link>
    </div>
  )
}

function Vazio() {
  const { t } = useT()
  return (
    <div className="px-8 py-20 text-center">
      <p className="font-display text-xl text-tinta">{t('estado.vazioTitulo')}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-fraca">{t('estado.vazioCorpo')}</p>
      <Link
        to="/importar"
        className="mt-6 inline-block rounded-sm bg-tinta px-5 py-2 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90"
      >
        {t('dash.importar')}
      </Link>
    </div>
  )
}

function Esqueleto() {
  return (
    <div className="animate-pulse space-y-px">
      <div className="grid grid-cols-3 gap-px bg-carvao-800">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 bg-carvao-900" />
        ))}
      </div>
      <div className="h-40 bg-carvao-900" />
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 rounded-sm bg-carvao-850" />
        ))}
      </div>
    </div>
  )
}
