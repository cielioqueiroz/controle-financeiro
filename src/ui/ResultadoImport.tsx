import { useMemo, useState } from 'react'
import { BANCOS, rotuloTipo } from '../banks'
import type { DocKind } from '../pdf/detect'
import type { ParseResult } from '../parsers/types'
import { formatBRL } from '../normalize/money'
import { validar } from '../validate/checksum'
import { construirInsights, type TxView } from '../insights'
import { CATEGORIAS } from '../categorize/categorias'
import { GraficoCategorias } from './GraficoCategorias'

type Props = {
  kind: DocKind
  result: ParseResult
  podeSalvar: boolean
  salvando: boolean
  onSalvar: () => void
  onLimpar: () => void
}

const dm = (d: Date) => d.toLocaleDateString('pt-BR')

export function ResultadoImport({
  kind,
  result,
  podeSalvar,
  salvando,
  onSalvar,
  onLimpar,
}: Props) {
  const tema = BANCOS[kind.bank]
  const conf = validar(result)
  const baseInsights = useMemo(() => construirInsights(result, kind), [result, kind])

  // Correções locais de categoria e rótulo (persistência vem na fatia 1).
  const [override, setOverride] = useState<Record<number, string>>({})
  const [labels, setLabels] = useState<Record<number, string>>({})

  const transacoes: TxView[] = baseInsights.transacoes.map((t) => ({
    ...t,
    categoriaSlug: override[t.id] ?? t.categoriaSlug,
    label: labels[t.id] ?? null,
  }))

  const houveDupla = baseInsights.gastoIngenuoCents > baseInsights.gastoRealCents

  return (
    <div
      className="surgir relative overflow-hidden rounded-sm border border-carvao-700 bg-carvao-900"
      style={{ boxShadow: `0 0 0 1px ${tema.wash}, 0 30px 80px -40px ${tema.wash}` }}
    >
      <div className="h-1.5 w-full" style={{ background: tema.accent }} />

      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-carvao-800 px-8 py-7">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="carimbo inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold"
              style={{ background: tema.accent, color: tema.tinta }}
            >
              {tema.nome}
            </span>
            <span className="text-sm text-tinta-fraca">{rotuloTipo(kind.docType)}</span>
          </div>
          {result.period && (
            <p className="tabular mt-3 text-xs uppercase tracking-widest text-tinta-tenue">
              {dm(result.period.start)} — {dm(result.period.end)}
              {result.account.last4 && ` · final ${result.account.last4}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {podeSalvar && (
            <button
              onClick={onSalvar}
              disabled={salvando}
              className="rounded-sm px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: tema.accent, color: tema.tinta }}
            >
              {salvando ? 'Salvando…' : 'Salvar no histórico'}
            </button>
          )}
          <button
            onClick={onLimpar}
            className="tabular text-xs uppercase tracking-widest text-tinta-tenue transition-colors hover:text-tinta"
          >
            Limpar ✕
          </button>
        </div>
      </header>

      <Veredito conf={conf} total={result.declaredTotal} accent={tema.accent} />

      {/* Gráfico de categorias + gasto real */}
      {baseInsights.porCategoria.length > 0 && (
        <section className="border-y border-carvao-800 bg-carvao-950/40 px-8 py-7">
          <GraficoCategorias
            categorias={baseInsights.porCategoria}
            totalCents={baseInsights.gastoRealCents}
          />
          {houveDupla && (
            <p className="mt-5 flex items-start gap-2 rounded-sm bg-carvao-800/60 px-4 py-3 text-xs text-tinta-fraca">
              <span className="text-ressalva">◆</span>
              <span>
                Removi{' '}
                <span className="tabular text-tinta">
                  {formatBRL(baseInsights.gastoIngenuoCents - baseInsights.gastoRealCents)}
                </span>{' '}
                de pagamentos de fatura e transferências entre suas contas — dinheiro que
                apareceria contado duas vezes. O gasto real é{' '}
                <span className="tabular text-tinta">{formatBRL(baseInsights.gastoRealCents)}</span>.
              </span>
            </p>
          )}
        </section>
      )}

      <ul className="max-h-[46vh] overflow-y-auto px-3 py-2">
        {transacoes.map((t) => (
          <LinhaTransacao
            key={t.id}
            t={t}
            onCategoria={(slug) => setOverride((o) => ({ ...o, [t.id]: slug }))}
            onLabel={(txt) =>
              setLabels((l) => {
                const novo = { ...l }
                if (txt.trim()) novo[t.id] = txt.trim()
                else delete novo[t.id]
                return novo
              })
            }
          />
        ))}
      </ul>
    </div>
  )
}

function LinhaTransacao({
  t,
  onCategoria,
  onLabel,
}: {
  t: TxView
  onCategoria: (slug: string) => void
  onLabel: (txt: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const interno = t.link !== null

  return (
    <li
      className={`surgir flex items-center gap-3 rounded-sm px-4 py-2 transition-colors hover:bg-carvao-850 ${
        interno ? 'opacity-55' : ''
      }`}
    >
      <span className="tabular w-11 shrink-0 text-xs text-tinta-tenue">
        {dm(t.date).slice(0, 5)}
      </span>

      {/* Seletor de categoria */}
      <select
        value={t.categoriaSlug}
        onChange={(e) => onCategoria(e.target.value)}
        disabled={interno}
        title="Categoria"
        className="shrink-0 cursor-pointer appearance-none rounded-sm bg-carvao-800 px-1.5 py-1 text-base leading-none"
      >
        {CATEGORIAS.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.icone} {c.nome}
          </option>
        ))}
      </select>

      <div className="min-w-0 flex-1">
        {editando ? (
          <input
            autoFocus
            defaultValue={t.label ?? ''}
            placeholder={t.description}
            onBlur={(e) => {
              onLabel(e.target.value)
              setEditando(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditando(false)
            }}
            className="w-full rounded-sm bg-carvao-800 px-2 py-0.5 text-sm text-tinta outline-none"
          />
        ) : (
          <button
            onClick={() => setEditando(true)}
            className="block max-w-full truncate text-left text-sm text-tinta hover:underline"
            title="Clique para renomear"
          >
            {t.label ?? t.description}
            {t.installment && (
              <span className="tabular ml-2 rounded-sm bg-carvao-800 px-1.5 py-0.5 text-[10px] text-tinta-fraca">
                {t.installment.current}/{t.installment.total}
              </span>
            )}
            {t.label && (
              <span className="ml-2 text-[10px] text-tinta-tenue">({t.description})</span>
            )}
          </button>
        )}
        {t.linkNote && <p className="text-[10px] text-tinta-tenue">{t.linkNote}</p>}
      </div>

      <span
        className={`tabular shrink-0 text-sm ${
          t.amountCents < 0 ? 'text-confere' : 'text-tinta'
        }`}
      >
        {formatBRL(t.amountCents)}
      </span>
    </li>
  )
}

function Veredito({
  conf,
  total,
  accent,
}: {
  conf: ReturnType<typeof validar>
  total: number | null
  accent: string
}) {
  const cor =
    conf.status === 'confere'
      ? 'var(--color-confere)'
      : conf.status === 'sem-gabarito'
        ? 'var(--color-ressalva)'
        : 'var(--color-falha)'

  const titulo =
    conf.status === 'confere'
      ? 'Confere com o banco'
      : conf.status === 'sem-gabarito'
        ? 'Lido, sem total para conferir'
        : 'O total não fechou'

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-6">
      <div className="flex items-center gap-4">
        <span
          className="carimbo grid h-11 w-11 place-items-center rounded-full text-lg"
          style={{ background: `${cor}22`, color: cor }}
        >
          {conf.status === 'confere' ? '✓' : conf.status === 'sem-gabarito' ? '~' : '!'}
        </span>
        <div>
          <p className="font-display text-lg" style={{ color: cor }}>
            {titulo}
          </p>
          <p className="tabular text-xs text-tinta-tenue">
            {conf.contagem} lançamentos
            {conf.diferenca != null &&
              conf.diferenca !== 0 &&
              ` · faltam ${formatBRL(Math.abs(conf.diferenca))}`}
          </p>
        </div>
      </div>

      {total != null && (
        <div className="text-right">
          <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">
            Total declarado
          </p>
          <p className="tabular text-2xl" style={{ color: accent }}>
            {formatBRL(total)}
          </p>
        </div>
      )}
    </div>
  )
}
