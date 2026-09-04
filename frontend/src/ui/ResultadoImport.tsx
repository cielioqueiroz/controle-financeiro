import { useMemo, useState, type CSSProperties } from 'react'
import { BANCOS } from '../domain/banks'
import type { DocKind } from '../domain/pdf/detect'
import type { ParseResult } from '../domain/parsers/types'

import { dataLongaDe } from '../domain/normalize/data'
import { localeAtual } from '../domain/normalize/locale'
import { validar } from '../domain/validate/checksum'
import { CarimboConferencia } from './CarimboConferencia'
import { construirInsights, type TxView } from '../domain/insights'
import type { Regra } from '../domain/categorize/regras'
import { CATEGORIAS, categoria, nomeCategoria } from '../domain/categorize/categorias'
import { useT } from '../i18n/IdiomaProvider'
import { interpolarNos } from '../i18n/interpolarNos'
import { GraficoCategorias } from './graficos/GraficoCategorias'
import { useDinheiro } from '../dados/DiscretoProvider'

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
  const formatBRL = useDinheiro()
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

      {/* `sticky` no celular: as ações do documento — salvar, limpar —
          moram aqui, e um extrato de 40 linhas empurrava esses botões para
          fora da tela no primeiro deslize. Quem terminava de conferir tinha
          de subir a lista inteira para decidir.

          `sticky`, e não `fixed`: o cartão entra com a animação `surgir`,
          que aplica `transform` nos primeiros 350ms, e `transform` num
          ancestral faz `fixed` ancorar no ancestral em vez da viewport
          (a armadilha que o projeto já registrou). `sticky` não passa por
          isso, e ainda tem o comportamento certo — gruda enquanto o
          documento está na tela, e vai embora com ele. */}
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-carvao-800 bg-carvao-900 px-5 py-5 max-sm:sticky max-sm:top-0 max-sm:z-20 sm:px-8 sm:py-7">
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
              className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium transition-all hover:-translate-y-0.5 hover:opacity-90 hover:shadow-lg hover:shadow-black/20 active:translate-y-0 disabled:translate-y-0 disabled:opacity-50 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs ${
                conf.status === 'confere' && !salvando ? 'chamando' : ''
              }`}
              style={{ background: tema.accent, color: tema.tinta, '--halo': tema.accent } as CSSProperties}
            >
              {salvando ? t('geral.salvando') : t('import.salvarHistorico')}
            </button>
          )}
          <button
            onClick={onLimpar}
            className="tabular inline-flex min-h-11 items-center px-1 text-xs uppercase tracking-widest text-tinta-tenue transition-colors hover:text-tinta sm:min-h-0 sm:px-0"
          >
            {t('import.limpar')} ✕
          </button>
          {/* Abandonar a leva inteira. Só aparece quando há resto: sem fila,
              "descartar os restantes" não descreve nada. */}
          {progresso && progresso.atual < progresso.total && onCancelarFila && (
            <button
              onClick={onCancelarFila}
              className="tabular inline-flex min-h-11 items-center px-1 text-xs uppercase tracking-widest text-tinta-tenue transition-colors hover:text-falha sm:min-h-0 sm:px-0"
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
        <section className="border-y border-carvao-800 bg-carvao-950/40 px-4 py-6 sm:px-8 sm:py-7">
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
      <ul className="px-1 py-2 sm:px-3">
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
  const formatBRL = useDinheiro()
  const { t: tr } = useT()
  const [editando, setEditando] = useState(false)
  const interno = t.link !== null

  return (
    <li
      className={`surgir flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-carvao-850 sm:gap-3 sm:px-4 sm:py-2 ${
        interno ? 'opacity-55' : ''
      }`}
    >
      <span className="tabular w-11 shrink-0 text-xs text-tinta-tenue">
        {diaMes(t.date)}
      </span>

      <SeletorCategoria slug={t.categoriaSlug} desabilitado={interno} onCategoria={onCategoria} />

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
        className={`tabular shrink-0 text-right text-xs sm:text-sm ${
          t.amountCents < 0 ? 'text-confere' : 'text-tinta'
        }`}
      >
        {formatBRL(t.amountCents)}
      </span>
    </li>
  )
}

/** O ícone da categoria, tocável, com o `<select>` nativo por cima.
 *
 *  ## O defeito que isto conserta (medido em 2026-09-04, tela de 390px)
 *
 *  O seletor era um `<select>` cru com `appearance-none`. O navegador
 *  dimensiona um `<select>` pela option MAIS LARGA da lista, e a lista aqui
 *  tem "⛽ Combustível & Carro": ele ficava com **185px** de uma linha de
 *  332px. O que sobrava para a descrição da transação era **zero** — ela
 *  sumia — e o valor era empurrado para 384px, além da borda do cartão em
 *  361px, onde o `overflow-hidden` o cortava no meio ("R$ 200,0").
 *
 *  Ou seja: na tela em que a pessoa confere o documento antes de confiar,
 *  no celular ela não via nem o que foi comprado nem quanto custou.
 *
 *  ## Por que o `<select>` continua aqui, invisível
 *
 *  Porque ele é o controle de verdade: abre a roda nativa do Android e do
 *  iOS, funciona com teclado e é anunciado por leitor de tela. Trocá-lo por
 *  um menu próprio custaria foco, teclas e rótulos para ganhar aparência.
 *  Ele fica transparente por cima do ícone, ocupando os 44px inteiros do
 *  alvo de toque; quem vê, vê o emoji; quem toca, toca no `<select>`. */
function SeletorCategoria({
  slug,
  desabilitado,
  onCategoria,
}: {
  slug: string
  desabilitado: boolean
  onCategoria: (slug: string) => void
}) {
  const { t: tr } = useT()
  const cat = categoria(slug)

  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-md bg-carvao-800 text-base">
      <span aria-hidden>{cat.icone}</span>
      <select
        value={slug}
        onChange={(e) => onCategoria(e.target.value)}
        disabled={desabilitado}
        aria-label={tr('editar.categoria')}
        title={nomeCategoria(cat)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-default"
      >
        {CATEGORIAS.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.icone} {nomeCategoria(c)}
          </option>
        ))}
      </select>
    </span>
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
  const formatBRL = useDinheiro()
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
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
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
