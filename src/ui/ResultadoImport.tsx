import { BANCOS, rotuloTipo } from '../banks'
import type { DocKind } from '../pdf/detect'
import type { ParseResult } from '../parsers/types'
import { formatBRL } from '../normalize/money'
import { validar } from '../validate/checksum'

type Props = {
  kind: DocKind
  result: ParseResult
  onLimpar: () => void
}

const dm = (d: Date) => d.toLocaleDateString('pt-BR')

export function ResultadoImport({ kind, result, onLimpar }: Props) {
  const tema = BANCOS[kind.bank]
  const conf = validar(result)

  return (
    <div
      className="surgir relative overflow-hidden rounded-sm border border-carvao-700 bg-carvao-900"
      style={{ boxShadow: `0 0 0 1px ${tema.wash}, 0 30px 80px -40px ${tema.wash}` }}
    >
      {/* Faixa da identidade do banco — a "inundação" da cor no momento
          em que o documento é reconhecido */}
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

        <button
          onClick={onLimpar}
          className="tabular text-xs uppercase tracking-widest text-tinta-tenue transition-colors hover:text-tinta"
        >
          Limpar ✕
        </button>
      </header>

      {/* O herói: o veredito da conferência contra o total do banco */}
      <Veredito conf={conf} total={result.declaredTotal} accent={tema.accent} />

      <ul className="max-h-[42vh] overflow-y-auto px-3 py-2">
        {result.transactions.map((t, i) => (
          <li
            key={i}
            className="surgir flex items-baseline gap-4 rounded-sm px-5 py-2.5 transition-colors hover:bg-carvao-850"
            style={{ animationDelay: `${Math.min(i * 12, 400)}ms` }}
          >
            <span className="tabular w-16 shrink-0 text-xs text-tinta-tenue">
              {dm(t.date).slice(0, 5)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-tinta">
              {t.description}
              {t.installment && (
                <span className="tabular ml-2 rounded-sm bg-carvao-800 px-1.5 py-0.5 text-[10px] text-tinta-fraca">
                  {t.installment.current}/{t.installment.total}
                </span>
              )}
              {t.fx && (
                <span className="tabular ml-2 text-[10px] text-tinta-tenue">
                  {t.fx.currency} {(t.fx.amount / 100).toFixed(2)}
                </span>
              )}
            </span>
            <span
              className={`tabular shrink-0 text-sm ${
                t.amountCents < 0 ? 'text-confere' : 'text-tinta'
              }`}
            >
              {formatBRL(t.amountCents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
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
