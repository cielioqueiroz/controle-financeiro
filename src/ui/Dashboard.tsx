import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'
import { puxarTudo, type TransacaoSalva } from '../persist/puxar'
import { puxarCategoriasUsuario } from '../persist/categoriasUsuario'
import { registrarCategoriasUsuario } from '../domain/categorize/categorias'
import {
  filtrar,
  agregar,
  porCategoriaDetalhado,
  porDia,
  evolucaoMensal,
  projecaoFutura,
  type Periodo,
  type PontoMes,
  type MesFuturo,
} from '../persist/agrupar'
import { GraficoCategorias } from './GraficoCategorias'
import { GraficoEvolucao } from './GraficoEvolucao'
import { CompromissosFuturos } from './CompromissosFuturos'
import { ListaPorCategoria } from './ListaPorCategoria'
import { ListaPorDia } from './ListaPorDia'
import { MenuAcoes } from './MenuAcoes'
import { ValorAnimado } from './ValorAnimado'
import { Documentos } from './Documentos'
import { EditarCompra } from './EditarCompra'
import { SaldoConta } from './SaldoConta'
import { ErroCarregar } from './ErroCarregar'
import { puxarSaldos } from '../persist/documentos'
import { saldosPorConta, type DocParaSaldo } from '../persist/saldos'
import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'

type Props = {
  onImportar: () => void
}

const PERIODOS: Array<{ id: Periodo; nome: string }> = [
  { id: 'dia', nome: 'Dia' },
  { id: 'semana', nome: 'Semana' },
  { id: 'mes', nome: 'Mês' },
  { id: 'ano', nome: 'Ano' },
]

/** Nome e cor de exibição de um banco no seletor, a partir do catálogo
 *  canônico (`domain/banks.ts`). Antes havia um mapa local que só conhecia
 *  Nubank e Bradesco, então BB/Sicredi/Sicoob apareciam como o slug cru e
 *  sem cor depois que o app passou a lê-los. */
function bancoInfo(b: string): { nome: string; cor?: string } {
  const tema = BANCOS[b as Bank]
  return tema ? { nome: tema.nome, cor: tema.accent } : { nome: b }
}

/** Mês/Ano agrupam por fatura (competência); Dia/Semana pela data real. */
function agrupamentoDe(periodo: Periodo): string {
  return periodo === 'mes' || periodo === 'ano' ? 'por fatura' : 'por data da compra'
}

/** Move a data de referência um período para trás/frente. */
function mover(periodo: Periodo, ref: Date, dir: -1 | 1): Date {
  const d = new Date(ref)
  switch (periodo) {
    case 'dia':
      d.setDate(d.getDate() + dir)
      break
    case 'semana':
      d.setDate(d.getDate() + dir * 7)
      break
    case 'mes':
      d.setMonth(d.getMonth() + dir)
      break
    case 'ano':
      d.setFullYear(d.getFullYear() + dir)
      break
  }
  return d
}

const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

function rotulo(periodo: Periodo, ref: Date): string {
  const d = ref
  switch (periodo) {
    case 'dia':
      return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
    case 'semana': {
      const dow = (d.getDay() + 6) % 7
      const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow)
      const fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6)
      return `${ini.getDate()} ${MESES[ini.getMonth()]} – ${fim.getDate()} ${MESES[fim.getMonth()]}`
    }
    case 'mes':
      return `${MESES[d.getMonth()]} ${d.getFullYear()}`
    case 'ano':
      return `${d.getFullYear()}`
  }
}

export function Dashboard({ onImportar }: Props) {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [ref, setRef] = useState<Date>(new Date())
  const [todas, setTodas] = useState<TransacaoSalva[] | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarDocs, setMostrarDocs] = useState(false)
  const [editando, setEditando] = useState<TransacaoSalva | null>(null)
  const [banco, setBanco] = useState<string>('geral')
  const [docsSaldo, setDocsSaldo] = useState<DocParaSaldo[]>([])
  const [gerandoPdf, setGerandoPdf] = useState(false)

  // Aplica a edição em memória (sem reidratar tudo do banco).
  function aplicarEdicao(id: string, campos: { label: string | null; category_slug: string }) {
    setTodas((atual) =>
      atual ? atual.map((t) => (t.id === id ? { ...t, ...campos } : t)) : atual,
    )
  }

  // Busca tudo uma vez; navegar entre períodos é fatiamento no cliente.
  // Reutilizado para recarregar após apagar um documento.
  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      // Carrega as categorias do usuário antes das transações, para que
      // categoria() já conheça as personalizadas ao renderizar.
      const [cats, dados, saldoDocs] = await Promise.all([
        puxarCategoriasUsuario().catch(() => []),
        puxarTudo(),
        puxarSaldos().catch(() => []),
      ])
      registrarCategoriasUsuario(cats)
      setTodas(dados)
      setDocsSaldo(saldoDocs)
      // Abre no mês da competência mais recente (faturas trazem meses passados).
      const maisRecente = dados
        .map((t) => t.competencia)
        .sort()
        .at(-1)
      if (maisRecente) {
        const [y, m] = maisRecente.split('-').map(Number)
        setRef(new Date(y, m - 1, 1))
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Saldo atual por conta, do extrato mais recente. Só aparece quando a
  // migração 0002 já rodou e há extrato salvo (senão puxarSaldos volta []).
  const saldos = useMemo(() => saldosPorConta(docsSaldo), [docsSaldo])

  // Bancos presentes e a fatia visível conforme o banco selecionado.
  const bancos = useMemo(
    () => [...new Set((todas ?? []).map((t) => t.bank))].filter(Boolean).sort(),
    [todas],
  )
  const visiveis = useMemo(
    () => (banco === 'geral' ? todas : (todas ?? []).filter((t) => t.bank === banco)),
    [todas, banco],
  )

  const txs = useMemo(
    () => (visiveis ? filtrar(visiveis, periodo, ref) : []),
    [visiveis, periodo, ref],
  )
  const resumo = useMemo(() => agregar(txs), [txs])
  const contagemPorDoc = useMemo(() => {
    const m = new Map<string, { qtd: number; totalCents: number }>()
    for (const t of todas ?? []) {
      const cur = m.get(t.document_id) ?? { qtd: 0, totalCents: 0 }
      cur.qtd += 1
      if (t.kind === 'expense') cur.totalCents += t.amount_cents
      m.set(t.document_id, cur)
    }
    return m
  }, [todas])
  const serie = useMemo(() => (visiveis ? evolucaoMensal(visiveis) : []), [visiveis])
  const futuros = useMemo(() => (visiveis ? projecaoFutura(visiveis) : []), [visiveis])
  const compAtiva = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`
  const vazio = !carregando && todas !== null && txs.length === 0
  const chave = `${periodo}-${ref.getTime()}`

  function irParaMes(competencia: string) {
    const [y, m] = competencia.split('-').map(Number)
    setPeriodo('mes')
    setRef(new Date(y, m - 1, 1))
  }

  // Gera o PDF do período e compartilha (celular) ou baixa (desktop). jsPDF
  // entra por import dinâmico só aqui — fora do bundle inicial.
  async function baixarPdf() {
    if (!txs || txs.length === 0) return
    setGerandoPdf(true)
    try {
      const { montarDadosRelatorio, gerarRelatorioPdf } = await import('../lib/relatorio-pdf')
      const { baixarOuCompartilhar } = await import('../lib/compartilhar')
      const label = rotulo(periodo, ref)
      const dados = montarDadosRelatorio({
        periodoLabel: label,
        agrupamento: agrupamentoDe(periodo),
        resumo,
        saldos: saldos.map((s) => ({ bank: s.bank, balanceCents: s.balanceCents, date: s.date })),
      })
      const blob = await gerarRelatorioPdf(dados)
      const slug = label.toLowerCase().replace(/\s+/g, '-')
      await baixarOuCompartilhar(blob, `relatorio-${slug}.pdf`, {
        title: `Relatório · ${label}`,
        text: `Meu relatório de ${label} — Capital Financeiro.`,
      })
    } catch {
      toast.error('Não consegui gerar o PDF.')
    } finally {
      setGerandoPdf(false)
    }
  }

  return (
    <div className="surgir">
      {/* Saldo atual por conta (extrato mais recente) */}
      {saldos.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {saldos.map((s) => (
            <SaldoConta
              key={`${s.bank}-${s.accountId ?? 'sem-conta'}`}
              bank={s.bank}
              balanceCents={s.balanceCents}
              date={s.date}
            />
          ))}
        </div>
      )}

      {/* Seletor de banco (só se houver mais de um) */}
      {bancos.length >= 2 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <BancoPill ativo={banco === 'geral'} onClick={() => setBanco('geral')} nome="Total geral" />
          {bancos.map((b) => {
            const info = bancoInfo(b)
            return (
              <BancoPill
                key={b}
                ativo={banco === b}
                onClick={() => setBanco(b)}
                nome={info.nome}
                cor={info.cor}
              />
            )
          })}
        </div>
      )}

      {/* Seletor de período + importar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-full border border-carvao-700 bg-carvao-900/60 p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              className={`relative rounded-full px-4 py-1.5 text-sm transition-colors ${
                periodo === p.id ? 'text-carvao-950' : 'text-tinta-fraca hover:text-tinta'
              }`}
            >
              {periodo === p.id && (
                <motion.span
                  layoutId="pilula-periodo"
                  className="absolute inset-0 rounded-full bg-tinta"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10">{p.nome}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop: ações inline */}
          <div className="hidden items-center gap-2 sm:flex">
            <button
              onClick={() => setMostrarDocs(true)}
              className="rounded-xl border border-carvao-700 px-4 py-2 text-sm text-tinta-fraca transition-all hover:-translate-y-0.5 hover:bg-carvao-850 hover:text-tinta hover:shadow-lg hover:shadow-black/20 active:translate-y-0"
              title="Ver e apagar documentos importados"
            >
              Documentos
            </button>
            {txs && txs.length > 0 && (
              <button
                onClick={baixarPdf}
                disabled={gerandoPdf}
                className="rounded-xl border border-carvao-700 px-4 py-2 text-sm text-tinta transition-all hover:-translate-y-0.5 hover:bg-carvao-850 hover:shadow-lg hover:shadow-black/20 active:translate-y-0 disabled:opacity-50"
                title="Gera um PDF do período e abre o compartilhamento (ou baixa)"
              >
                {gerandoPdf ? 'Gerando…' : 'Baixar / Compartilhar PDF'}
              </button>
            )}
            <button
              onClick={onImportar}
              className="rounded-xl bg-tinta px-4 py-2 text-sm font-medium text-carvao-950 transition-all hover:-translate-y-0.5 hover:opacity-90 hover:shadow-lg hover:shadow-black/20 active:translate-y-0"
            >
              + Importar PDF
            </button>
          </div>
          {/* Mobile: hambúrguer */}
          <div className="sm:hidden">
            <MenuAcoes
              onImportar={onImportar}
              onDocumentos={() => setMostrarDocs(true)}
              onBaixarPDF={txs && txs.length > 0 ? baixarPdf : undefined}
            />
          </div>
        </div>
      </div>

      {/* Cabeçalho do relatório — só aparece no PDF impresso */}
      <div className="somente-impressao mb-6">
        <p className="tabular text-[11px] uppercase tracking-[0.3em] text-tinta-tenue">
          Capital Financeiro
        </p>
        <h1 className="font-display text-3xl text-tinta">
          Relatório · <span className="capitalize">{rotulo(periodo, ref)}</span>
        </h1>
      </div>

      {/* Navegação de período */}
      <div className="mb-6 flex items-center justify-center gap-6">
        <button
          onClick={() => setRef((r) => mover(periodo, r, -1))}
          className="grid h-9 w-9 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
          aria-label="Período anterior"
        >
          ‹
        </button>
        <AnimatePresence mode="wait">
          <motion.div
            key={chave}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-center"
          >
            <h2 className="font-display text-2xl capitalize text-tinta">{rotulo(periodo, ref)}</h2>
            <p className="tabular mt-0.5 text-[10px] uppercase tracking-widest text-tinta-tenue">
              {agrupamentoDe(periodo)}
            </p>
          </motion.div>
        </AnimatePresence>
        <button
          onClick={() => setRef((r) => mover(periodo, r, 1))}
          className="grid h-9 w-9 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
          aria-label="Próximo período"
        >
          ›
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900 shadow-lg shadow-black/20">
        {carregando ? (
          <Esqueleto />
        ) : erro ? (
          <ErroCarregar mensagem={erro} onTentar={carregar} />
        ) : vazio ? (
          <Vazio onImportar={onImportar} />
        ) : (
          <Conteudo
            resumo={resumo}
            txs={txs}
            chave={chave}
            onEditar={setEditando}
            serie={serie}
            futuros={futuros}
            compAtiva={compAtiva}
            onIrParaMes={irParaMes}
          />
        )}
      </div>

      <AnimatePresence>
        {mostrarDocs && (
          <Documentos
            contagem={contagemPorDoc}
            onFechar={() => setMostrarDocs(false)}
            onMudou={carregar}
          />
        )}
        {editando && (
          <EditarCompra
            tx={editando}
            onFechar={() => setEditando(null)}
            onSalvo={aplicarEdicao}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Conteudo({
  resumo,
  txs,
  chave,
  onEditar,
  serie,
  futuros,
  compAtiva,
  onIrParaMes,
}: {
  resumo: ReturnType<typeof agregar>
  txs: TransacaoSalva[]
  chave: string
  onEditar: (t: TransacaoSalva) => void
  serie: PontoMes[]
  futuros: MesFuturo[]
  compAtiva: string
  onIrParaMes: (competencia: string) => void
}) {
  const [vista, setVista] = useState<'categoria' | 'dia'>('categoria')
  const grupos = useMemo(() => porCategoriaDetalhado(txs), [txs])
  const dias = useMemo(() => porDia(txs), [txs])
  const semMovimento = useReducedMotion()

  // Entrada escalonada e discreta — o dashboard "se monta" de cima para
  // baixo (tiles → resumo visual → tabelas) em vez de piscar inteiro. Curva
  // expo para dar peso. Restrição de propósito: app de dinheiro pede calma.
  const suave = [0.22, 1, 0.36, 1] as const
  const entra = (delay: number) =>
    semMovimento
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease: suave },
        }

  return (
    <motion.div key={chave} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Tiles de resumo — largura total, com números que "contam" */}
      <div className="grid grid-cols-1 gap-px bg-carvao-800 sm:grid-cols-3">
        <motion.div {...entra(0.05)}>
          <Tile rotulo="Gasto no período" destaque>
            <ValorAnimado valor={resumo.gastoCents} />
          </Tile>
        </motion.div>
        <motion.div {...entra(0.12)}>
          <Tile rotulo="Entradas" cor="var(--color-confere)">
            <ValorAnimado valor={resumo.entradasCents} />
          </Tile>
        </motion.div>
        <motion.div {...entra(0.19)}>
          <Tile rotulo="Lançamentos">
            <ValorAnimado valor={resumo.contagem} moeda={false} />
          </Tile>
        </motion.div>
      </div>

      {/* Duas colunas no desktop: resumo visual (esq.) + tabelas largas (dir.) */}
      <motion.div
        {...entra(0.28)}
        className="grid border-t border-carvao-800 xl:grid-cols-[minmax(300px,360px)_1fr]"
      >
        {/* Coluna do resumo visual. O aside estica para o divisor ir até o
            fim; o conteúdo é sticky para o donut acompanhar a rolagem da lista
            longa ao lado, em vez de deixar um vazio embaixo (só no layout de
            duas colunas, xl+). */}
        <aside className="border-carvao-800 p-5 xl:border-r">
          <div className="space-y-6 xl:sticky xl:top-4">
            {resumo.porCategoria.length > 0 && (
              <GraficoCategorias categorias={resumo.porCategoria} totalCents={resumo.gastoCents} />
            )}
            {serie.length >= 2 && (
              <div className="screen-only">
                <GraficoEvolucao serie={serie} ativo={compAtiva} onSelecionar={onIrParaMes} />
              </div>
            )}
            {futuros.length > 0 && <CompromissosFuturos meses={futuros} />}
          </div>
        </aside>

        {/* Coluna das tabelas */}
        <div className="min-w-0 border-t border-carvao-800 xl:border-t-0">
          <div className="flex items-center justify-between px-5 py-3">
            <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">
              Lançamentos
            </p>
            <div className="flex gap-0.5 rounded-full border border-carvao-700 bg-carvao-900 p-0.5">
              <AbaVista ativa={vista === 'categoria'} onClick={() => setVista('categoria')}>
                Por categoria
              </AbaVista>
              <AbaVista ativa={vista === 'dia'} onClick={() => setVista('dia')}>
                Por dia
              </AbaVista>
            </div>
          </div>

          {vista === 'categoria' ? (
            <ListaPorCategoria grupos={grupos} totalCents={resumo.gastoCents} onEditar={onEditar} />
          ) : (
            <ListaPorDia grupos={dias} onEditar={onEditar} />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function BancoPill({
  ativo,
  onClick,
  nome,
  cor,
}: {
  ativo: boolean
  onClick: () => void
  nome: string
  cor?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors ${
        ativo
          ? 'border-transparent text-carvao-950'
          : 'border-carvao-700 text-tinta-fraca hover:border-carvao-600 hover:text-tinta'
      }`}
    >
      {ativo && (
        <motion.span
          layoutId="pilula-banco"
          className="absolute inset-0 rounded-full bg-tinta"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      {cor && <span className="relative z-10 h-2 w-2 rounded-full" style={{ background: cor }} />}
      <span className="relative z-10">{nome}</span>
    </button>
  )
}

function AbaVista({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-full px-3 py-1 text-xs transition-colors ${
        ativa ? 'text-carvao-950' : 'text-tinta-fraca hover:text-tinta'
      }`}
    >
      {ativa && (
        <motion.span
          layoutId="pilula-vista"
          className="absolute inset-0 rounded-full bg-tinta"
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
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


function Vazio({ onImportar }: { onImportar: () => void }) {
  return (
    <div className="px-8 py-20 text-center">
      <p className="font-display text-xl text-tinta">Nada por aqui ainda</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-fraca">
        Não há lançamentos salvos neste período. Importe uma fatura ou extrato para começar a ver
        para onde o dinheiro foi.
      </p>
      <button
        onClick={onImportar}
        className="mt-6 rounded-sm bg-tinta px-5 py-2 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90"
      >
        + Importar PDF
      </button>
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
