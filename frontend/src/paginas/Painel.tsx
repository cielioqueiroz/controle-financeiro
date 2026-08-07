import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { Link, useNavigate } from 'react-router-dom'
import { maioresSaidas, evolucaoMensal } from '../persist/agrupar'
import { saldosPorConta } from '../persist/saldos'
import { faturasAbertas } from '../persist/aberto'
import { nomeCategoria } from '../domain/categorize/categorias'
import type { TransacaoSalva } from '../persist/puxar'
import { useDados } from '../dados/DadosProvider'
import { useRecorte } from '../dados/useRecorte'
import { BarraFiltros } from '../ui/BarraFiltros'
import { rotuloPeriodo } from '../dados/periodo'
import { GraficoCategorias } from '../ui/GraficoCategorias'
import { GraficoEvolucao } from '../ui/GraficoEvolucao'
import { MaioresSaidas } from '../ui/MaioresSaidas'
import { SaldoConta } from '../ui/SaldoConta'
import { SaldoAberto } from '../ui/SaldoAberto'
import { ErroCarregar } from '../ui/ErroCarregar'
import { ValorAnimado } from '../ui/ValorAnimado'
import { EditarCompra } from '../ui/EditarCompra'
import { podeCompartilharArquivo } from '../lib/compartilhar'
import { ehFalhaDeChunk } from '../lib/chunk'
import { useT } from '../i18n/IdiomaProvider'
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
  const navigate = useNavigate()
  const { docsSaldo, recarregar, aplicarEdicao } = useDados()
  const { txs, resumo, visiveis, filtros, setFiltros, compAtiva, carregando, erro, vazio } =
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
  const serie = useMemo(() => (visiveis ? evolucaoMensal(visiveis) : []), [visiveis])

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
      const { baixarArquivo } = await import('../lib/compartilhar')
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
      const { compartilharArquivo, baixarArquivo } = await import('../lib/compartilhar')
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

      <div className="overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900">
        {carregando ? (
          <Esqueleto />
        ) : erro ? (
          <ErroCarregar mensagem={erro} onTentar={recarregar} />
        ) : vazio ? (
          <Vazio />
        ) : (
          <>
            {/* Tiles de resumo */}
            <div className="grid grid-cols-1 gap-px bg-carvao-800 sm:grid-cols-2 lg:grid-cols-4">
              <motion.div {...entra(0.05)}>
                <Tile rotulo={t('dash.gasto')} destaque>
                  <ValorAnimado valor={resumo.gastoCents} />
                </Tile>
              </motion.div>
              <motion.div {...entra(0.12)}>
                <Tile rotulo={t('dash.entradas')} cor="var(--color-confere)">
                  <ValorAnimado valor={resumo.entradasCents} />
                </Tile>
              </motion.div>
              <motion.div {...entra(0.19)}>
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
              <motion.div {...entra(0.26)}>
                <Tile rotulo={t('dash.lancamentos')}>
                  <ValorAnimado valor={resumo.contagem} moeda={false} />
                </Tile>
              </motion.div>
            </div>

            {/* Gráficos lado a lado. Sem sticky e sem rolagem interna: o que
                exigia aquilo (a pilha de cinco cards) foi para outras
                páginas. */}
            <motion.div
              {...entra(0.28)}
              className="grid gap-px border-t border-carvao-800 bg-carvao-800 lg:grid-cols-2"
            >
              <div className="bg-carvao-900 p-5">
                {resumo.porCategoria.length > 0 && (
                  <GraficoCategorias
                    categorias={resumo.porCategoria}
                    totalCents={resumo.gastoCents}
                  />
                )}
              </div>
              <div className="bg-carvao-900 p-5">
                {serie.length >= 2 && (
                  <div className="screen-only">
                    <GraficoEvolucao serie={serie} ativo={compAtiva} onSelecionar={irParaMes} />
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div {...entra(0.34)} className="border-t border-carvao-800 p-5">
              <MaioresSaidas itens={maiores} onEditar={setEditando} />
              <Link
                to="/lancamentos"
                className="mt-4 inline-block text-sm text-tinta-tenue transition-colors hover:text-tinta"
              >
                {t('dash.lancamentos')} →
              </Link>
            </motion.div>
          </>
        )}
      </div>

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
  children,
}: {
  rotulo: string
  cor?: string
  destaque?: boolean
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
