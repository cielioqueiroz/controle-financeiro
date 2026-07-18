import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { puxarTudo, type TransacaoSalva } from '../persist/puxar'
import { filtrar, agregar, type Periodo } from '../persist/agrupar'
import { categoria } from '../categorize/categorias'
import { formatBRL } from '../normalize/money'
import { GraficoCategorias } from './GraficoCategorias'

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

  // Busca tudo uma vez; navegar entre períodos é fatiamento no cliente.
  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setErro(null)
    puxarTudo()
      .then((dados) => {
        if (!vivo) return
        setTodas(dados)
        // Abre no mês da competência mais recente (faturas trazem meses
        // passados; a lista já vem ordenada por data desc).
        const maisRecente = dados
          .map((t) => t.competencia)
          .sort()
          .at(-1)
        if (maisRecente) {
          const [y, m] = maisRecente.split('-').map(Number)
          setRef(new Date(y, m - 1, 1))
        }
      })
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : 'Falha ao carregar'))
      .finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
  }, [])

  const txs = useMemo(
    () => (todas ? filtrar(todas, periodo, ref) : []),
    [todas, periodo, ref],
  )
  const resumo = useMemo(() => agregar(txs), [txs])
  const vazio = !carregando && todas !== null && txs.length === 0
  const chave = `${periodo}-${ref.getTime()}`

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

      <div className="overflow-hidden rounded-sm border border-carvao-700 bg-carvao-900">
        {carregando ? (
          <Esqueleto />
        ) : erro ? (
          <p className="px-8 py-16 text-center text-sm text-falha">{erro}</p>
        ) : vazio ? (
          <Vazio onImportar={onImportar} />
        ) : (
          <Conteudo resumo={resumo} txs={txs} chave={chave} />
        )}
      </div>
    </div>
  )
}

function Conteudo({
  resumo,
  txs,
  chave,
}: {
  resumo: ReturnType<typeof agregar>
  txs: TransacaoSalva[]
  chave: string
}) {
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

      {/* Lista — sem rolagem interna; flui com a página (usa o espaço). */}
      <ul className="border-t border-carvao-800 px-3 py-2">
        {txs.map((t) => (
          <Linha key={t.id} t={t} />
        ))}
      </ul>
    </motion.div>
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

function Linha({ t }: { t: TransacaoSalva }) {
  const cat = categoria(t.category_slug ?? 'outros')
  const interno = t.kind === 'internal_transfer' || t.kind === 'card_payment'
  return (
    <li
      className={`flex items-center gap-3 rounded-sm px-4 py-2 transition-colors hover:bg-carvao-850 ${
        interno ? 'opacity-55' : ''
      }`}
    >
      <span className="tabular w-11 shrink-0 text-xs text-tinta-tenue">
        {t.date.slice(8, 10)}/{t.date.slice(5, 7)}
      </span>
      <span className="text-base" title={cat.nome}>
        {cat.icone}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-tinta">
        {t.label ?? t.description}
        {t.installment && (
          <span className="tabular ml-2 rounded-sm bg-carvao-800 px-1.5 py-0.5 text-[10px] text-tinta-fraca">
            {t.installment.current}/{t.installment.total}
          </span>
        )}
      </span>
      <span
        className={`tabular shrink-0 text-sm ${
          t.amount_cents < 0 ? 'text-confere' : 'text-tinta'
        }`}
      >
        {formatBRL(t.amount_cents)}
      </span>
    </li>
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
