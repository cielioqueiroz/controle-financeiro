import { useMemo, useState, type CSSProperties } from 'react'
import { BANCOS } from '../domain/banks'
import type { DocKind } from '../domain/pdf/detect'
import type { ParseResult } from '../domain/parsers/types'
import { formatBRL } from '../domain/normalize/money'
import { dataLongaDe } from '../domain/normalize/data'
import { localeAtual } from '../domain/normalize/locale'
import { validar } from '../domain/validate/checksum'
import { CarimboConferencia } from './CarimboConferencia'
import { construirInsights, type TxView } from '../domain/insights'
import type { Regra } from '../domain/categorize/regras'
import { CATEGORIAS, nomeCategoria } from '../domain/categorize/categorias'
import { useT } from '../i18n/IdiomaProvider'
import { interpolarNos } from '../i18n/interpolarNos'
import { GraficoCategorias } from './graficos/GraficoCategorias'

type Props = {
  kind: DocKind
  result: ParseResult
  /** Regras aprendidas do usuário — a prévia mostra as categorias já
   *  corrigidas, iguais às que serão gravadas ao salvar. */
  regras: Regra[]
  podeSalvar: boolean
  salvando: boolean
  onSalvar: () => void
  onLimpar: () => void
  /** Onde a fila está, quando há fila. */
  progresso?: { atual: number; total: number } | null
  onCancelarFila?: () => void
}

const dm = (d: Date) => dataLongaDe(d)

/** Dia/mês curtos na locale ativa (rótulo da linha de transação). */
const diaMes = (d: Date) =>
  new Intl.DateTimeFormat(localeAtual(), { day: '2-digit', month: '2-digit' }).format(d)

export function ResultadoImport({
  kind,
  result,
  regras,
  podeSalvar,
  salvando,
  onSalvar,
  onLimpar,
  progresso,
  onCancelarFila,
}: Props) {
  const { t } = useT()
  const tema = BANCOS[kind.bank]
  const conf = validar(result)
  const baseInsights = useMemo(
    () => construirInsights(result, kind, regras),
    [result, kind, regras],
  )

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
      className="surgir relative overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900"
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
            <span className="text-sm text-tinta-fraca">
              {t(
                kind.docType === 'fatura'
                  ? 'tipo.fatura'
                  : kind.docType === 'extrato'
                    ? 'tipo.extrato'
                    : 'tipo.desconhecido',
              )}
            </span>
          </div>
          {result.period && (
            <p className="tabular mt-3 text-xs uppercase tracking-widest text-tinta-tenue">
              {dm(result.period.start)} — {dm(result.period.end)}
              {result.account.last4 && ` · ${t('import.final', { n: result.account.last4 })}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* Onde a fila está. Fica JUNTO dos botões porque é ali que a
              decisão é tomada — quem vai clicar "salvar" pela terceira vez
              precisa saber que faltam duas. */}
          {progresso && progresso.total > 1 && (
            <span className="tabular text-[11px] uppercase tracking-widest text-tinta-tenue">
              {t('fila.progresso', { n: progresso.atual, total: progresso.total })}
            </span>
          )}
          {/* O halo só quando a conferência FECHA. Documento que divergiu não
              deve ser empurrado para o histórico com pressa — ali o que a
              pessoa precisa é olhar a diferença, não clicar rápido. */}
          {podeSalvar && (
            <button
              onClick={onSalvar}
              disabled={salvando}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 hover:opacity-90 hover:shadow-lg hover:shadow-black/20 active:translate-y-0 disabled:translate-y-0 disabled:opacity-50 ${
                conf.status === 'confere' && !salvando ? 'chamando' : ''
              }`}
              style={{ background: tema.accent, color: tema.tinta, '--halo': tema.accent } as CSSProperties}
            >
              {salvando ? t('geral.salvando') : t('import.salvarHistorico')}
            </button>
          )}
          <button
            onClick={onLimpar}
            className="tabular text-xs uppercase tracking-widest text-tinta-tenue transition-colors hover:text-tinta"
          >
            {t('import.limpar')} ✕
          </button>
          {/* Abandonar a leva inteira. Só aparece quando há resto: sem fila,
              "descartar os restantes" não descreve nada. */}
          {progresso && progresso.atual < progresso.total && onCancelarFila && (
            <button
              onClick={onCancelarFila}
              className="tabular text-xs uppercase tracking-widest text-tinta-tenue transition-colors hover:text-falha"
            >
              {t('fila.cancelar')}
            </button>
          )}
        </div>
      </header>

      <Veredito
        conf={conf}
        total={result.declaredTotal}
        accent={tema.accent}
        data={result.period?.end ?? null}
      />

      {/* Gráfico de categorias + gasto real */}
      {baseInsights.porCategoria.length > 0 && (
        <section className="border-y border-carvao-800 bg-carvao-950/40 px-8 py-7">
          <GraficoCategorias
            categorias={baseInsights.porCategoria}
            totalCents={baseInsights.gastoRealCents}
          />
          {houveDupla && (
            <p className="mt-5 flex items-start gap-2 rounded-md bg-carvao-800/60 px-4 py-3 text-xs text-tinta-fraca">
              <span className="text-ressalva">◆</span>
              <span>
                {interpolarNos(t('import.dupla'), {
                  removido: (
                    <span className="tabular text-tinta">
                      {formatBRL(baseInsights.gastoIngenuoCents - baseInsights.gastoRealCents)}
                    </span>
                  ),
                  real: (
                    <span className="tabular text-tinta">
                      {formatBRL(baseInsights.gastoRealCents)}
                    </span>
                  ),
                })}
              </span>
            </p>
          )}
        </section>
      )}

      {/* Sem `max-h`+`overflow-y-auto`: a prévia virou a página /importar em
          2026-08-07, e rolagem interna dentro de uma página que já rola é a
          barra dupla que esconde conteúdo atrás da própria barra. Aqui a
          lista flui e a pessoa confere a importação inteira com a rolagem
          normal da página. */}
      <ul className="px-3 py-2">
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
  const { t: tr } = useT()
  const [editando, setEditando] = useState(false)
  const interno = t.link !== null

  return (
    <li
      className={`surgir flex items-center gap-3 rounded-md px-4 py-2 transition-colors hover:bg-carvao-850 ${
        interno ? 'opacity-55' : ''
      }`}
    >
      <span className="tabular w-11 shrink-0 text-xs text-tinta-tenue">
        {diaMes(t.date)}
      </span>

      {/* Seletor de categoria */}
      <select
        value={t.categoriaSlug}
        onChange={(e) => onCategoria(e.target.value)}
        disabled={interno}
        title={tr('editar.categoria')}
        className="shrink-0 cursor-pointer appearance-none rounded-md bg-carvao-800 px-1.5 py-1 text-base leading-none"
      >
        {CATEGORIAS.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.icone} {nomeCategoria(c)}
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
            className="w-full rounded-md bg-carvao-800 px-2 py-0.5 text-sm text-tinta outline-none"
          />
        ) : (
          <button
            onClick={() => setEditando(true)}
            className="block max-w-full truncate text-left text-sm text-tinta hover:underline"
            title={tr('import.renomear')}
          >
            {t.label ?? t.description}
            {t.installment && (
              <span className="tabular ml-2 rounded-md bg-carvao-800 px-1.5 py-0.5 text-[10px] text-tinta-fraca">
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
  data,
}: {
  conf: ReturnType<typeof validar>
  total: number | null
  accent: string
  data: Date | null
}) {
  const cor =
    conf.status === 'confere'
      ? 'var(--color-confere)'
      : conf.status === 'sem-gabarito'
        ? 'var(--color-ressalva)'
        : 'var(--color-falha)'

  const { t } = useT()
  const titulo =
    conf.status === 'confere'
      ? t('import.confereTitulo')
      : conf.status === 'sem-gabarito'
        ? t('import.semGabaritoTitulo')
        : t('import.naoFechouTitulo')

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-6">
      {/* O carimbo primeiro, a frase depois: o carimbo é o veredito e a
          frase é a explicação dele. Antes havia um distintivo redondo com
          ✓/~/! que dizia a mesma coisa em símbolo — o carimbo diz por
          extenso E carrega o dado (a data e o valor que bateu, ou a
          diferença a caçar), que o símbolo não tinha onde pôr. */}
      <div className="flex flex-wrap items-center gap-5">
        <CarimboConferencia conf={conf} data={data} />
        <div>
          <p className="font-display text-lg" style={{ color: cor }}>
            {titulo}
          </p>
          <p className="tabular text-xs text-tinta-tenue">
            {t('docs.nLancamentos', { n: conf.contagem })}
          </p>
        </div>
      </div>

      {total != null && (
        <div className="text-right">
          <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">
            {t('import.totalDeclarado')}
          </p>
          <p className="tabular text-2xl" style={{ color: accent }}>
            {formatBRL(total)}
          </p>
        </div>
      )}
    </div>
  )
}
