import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { puxarTudo, type TransacaoSalva } from '../persist/puxar'
import {
  filtrar,
  agregar,
  porCategoriaDetalhado,
  porDia,
  evolucaoMensal,
  projecaoFutura,
  type Periodo,
} from '../persist/agrupar'
import { formatBRL } from '../normalize/money'
import { GraficoCategorias } from './GraficoCategorias'
import { GraficoEvolucao } from './GraficoEvolucao'
import { CompromissosFuturos } from './CompromissosFuturos'
import { ListaPorCategoria } from './ListaPorCategoria'
import { ListaPorDia } from './ListaPorDia'
import { Documentos } from './Documentos'
import { EditarCompra } from './EditarCompra'

type Props = {
  onImportar: () => void
}

const PERIODOS: Array<{ id: Periodo; nome: string }> = [
  { id: 'dia', nome: 'Dia' },
  { id: 'semana', nome: 'Semana' },
  { id: 'mes', nome: 'Mês' },
  { id: 'ano', nome: 'Ano' },
]

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
      const dados = await puxarTudo()
      setTodas(dados)
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

  const txs = useMemo(
    () => (todas ? filtrar(todas, periodo, ref) : []),
    [todas, periodo, ref],
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
  const serie = useMemo(() => (todas ? evolucaoMensal(todas) : []), [todas])
  const futuros = useMemo(() => (todas ? projecaoFutura(todas) : []), [todas])
  const compAtiva = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`
  const vazio = !carregando && todas !== null && txs.length === 0
  const chave = `${periodo}-${ref.getTime()}`

  function irParaMes(competencia: string) {
    const [y, m] = competencia.split('-').map(Number)
    setPeriodo('mes')
    setRef(new Date(y, m - 1, 1))
  }

  return (
    <div className="surgir">
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
          <button
            onClick={() => setMostrarDocs(true)}
            className="rounded-sm border border-carvao-700 px-4 py-2 text-sm text-tinta-fraca transition-colors hover:bg-carvao-850 hover:text-tinta"
            title="Ver e apagar documentos importados"
          >
            Documentos
          </button>
          {txs && txs.length > 0 && (
            <button
              onClick={() => window.print()}
              className="rounded-sm border border-carvao-700 px-4 py-2 text-sm text-tinta transition-colors hover:bg-carvao-850"
              title="Baixar ou compartilhar em PDF"
            >
              Baixar PDF
            </button>
          )}
          <button
            onClick={onImportar}
            className="rounded-sm bg-tinta px-4 py-2 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90"
          >
            + Importar PDF
          </button>
        </div>
      </div>

      {/* Cabeçalho do relatório — só aparece no PDF impresso */}
      <div className="somente-impressao mb-6">
        <p className="tabular text-[11px] uppercase tracking-[0.3em] text-tinta-tenue">
          Controle Financeiro
        </p>
        <h1 className="font-display text-3xl text-tinta">
          Relatório · <span className="capitalize">{rotulo(periodo, ref)}</span>
        </h1>
      </div>

      {/* Navegação de período */}
      <div className="mb-6 flex items-center justify-center gap-6">
        <button
          onClick={() => setRef((r) => mover(periodo, r, -1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
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
          className="grid h-8 w-8 place-items-center rounded-full border border-carvao-700 text-tinta-fraca transition-colors hover:border-carvao-600 hover:text-tinta"
          aria-label="Próximo período"
        >
          ›
        </button>
      </div>

      {!carregando && (serie.length >= 2 || futuros.length > 0) && (
        <div
          className={`mb-4 grid gap-4 ${
            serie.length >= 2 && futuros.length > 0 ? 'lg:grid-cols-2' : ''
          }`}
        >
          {serie.length >= 2 && (
            <div className="screen-only">
              <GraficoEvolucao serie={serie} ativo={compAtiva} onSelecionar={irParaMes} />
            </div>
          )}
          {futuros.length > 0 && <CompromissosFuturos meses={futuros} />}
        </div>
      )}

      <div className="overflow-hidden rounded-sm border border-carvao-700 bg-carvao-900">
        {carregando ? (
          <Esqueleto />
        ) : erro ? (
          <p className="px-8 py-16 text-center text-sm text-falha">{erro}</p>
        ) : vazio ? (
          <Vazio onImportar={onImportar} />
        ) : (
          <Conteudo resumo={resumo} txs={txs} chave={chave} onEditar={setEditando} />
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
}: {
  resumo: ReturnType<typeof agregar>
  txs: TransacaoSalva[]
  chave: string
  onEditar: (t: TransacaoSalva) => void
}) {
  const [vista, setVista] = useState<'categoria' | 'dia'>('categoria')
  const grupos = useMemo(() => porCategoriaDetalhado(txs), [txs])
  const dias = useMemo(() => porDia(txs), [txs])

  return (
    <motion.div
      key={chave}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Tiles de resumo */}
      <div className="grid grid-cols-2 gap-px bg-carvao-800 sm:grid-cols-3">
        <Tile rotulo="Gasto no período" valor={formatBRL(resumo.gastoCents)} destaque />
        <Tile rotulo="Entradas" valor={formatBRL(resumo.entradasCents)} cor="var(--color-confere)" />
        <Tile rotulo="Lançamentos" valor={String(resumo.contagem)} />
      </div>

      {/* Donut de categorias */}
      {resumo.porCategoria.length > 0 && (
        <div className="border-t border-carvao-800 px-8 py-7">
          <GraficoCategorias categorias={resumo.porCategoria} totalCents={resumo.gastoCents} />
        </div>
      )}

      {/* Alternador de visão + lista (sem rolagem interna) */}
      <div className="flex items-center justify-between border-t border-carvao-800 px-5 py-3">
        <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">Lançamentos</p>
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
    </motion.div>
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
  valor,
  cor,
  destaque,
}: {
  rotulo: string
  valor: string
  cor?: string
  destaque?: boolean
}) {
  return (
    <div className="bg-carvao-900 px-6 py-5">
      <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">{rotulo}</p>
      <p
        className={`tabular mt-1.5 ${destaque ? 'text-2xl' : 'text-xl'} text-tinta`}
        style={cor ? { color: cor } : undefined}
      >
        {valor}
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
