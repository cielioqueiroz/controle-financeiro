import { useId } from 'react'

import type { CalendarioDoMes, ItemDoDia } from '../domain/calendario'
import { temaDoBanco } from '../domain/banks'
import { diaSemanaAbrev } from '../domain/normalize/data'
import { localeAtual } from '../domain/normalize/locale'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'

type Props = { calendario: CalendarioDoMes }

function mesPorExtenso(comp: string): string {
  const [y, m] = comp.split('-').map(Number)
  return new Intl.DateTimeFormat(localeAtual(), { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

/** O que deve cair no próximo mês, dia a dia (item 2.6 da auditoria).
 *
 *  Agenda, e não grade de sete colunas: em 375px a grade daria 45px por dia,
 *  pouco para um nome e um valor, e a maioria dos dias ficaria vazia. A
 *  lista mostra só os dias com alguma coisa, na ordem em que chegam. */
export function CalendarioProximoMes({ calendario }: Props) {
  const { t } = useT()
  const dinheiro = useDinheiro()
  const titulo = useId()
  const mes = mesPorExtenso(calendario.competencia)
  const [ano, mesNum] = calendario.competencia.split('-').map(Number)

  return (
    <section aria-labelledby={titulo} className="cartao min-w-0" data-prova="calendario">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-carvao-800 px-5 py-4">
        <div className="min-w-0 basis-64 flex-1">
          <h2 id={titulo} className="rotulo">{t('cal.titulo', { mes })}</h2>
          <p className="mt-1 text-xs leading-relaxed text-tinta-fraca">{t('cal.descricao')}</p>
        </div>
        <dl className="flex gap-6 text-right">
          <div>
            <dt className="text-xs text-tinta-tenue">{t('cal.sai')}</dt>
            <dd className="tabular text-lg text-debito">{dinheiro(calendario.saidaCents)}</dd>
          </div>
          {calendario.entradaCents > 0 && (
            <div>
              <dt className="text-xs text-tinta-tenue">{t('cal.entra')}</dt>
              <dd className="tabular text-lg text-credito">{dinheiro(calendario.entradaCents)}</dd>
            </div>
          )}
        </dl>
      </div>

      <ol className="divide-y divide-carvao-800">
        {calendario.dias.map(({ dia, itens }) => (
          <li key={dia ?? 'sem-dia'} className="flex gap-4 px-5 py-3">
            <div className="w-12 shrink-0 text-center">
              {dia === null ? (
                <p className="text-xs leading-tight text-tinta-tenue">{t('cal.semDia')}</p>
              ) : (
                <>
                  <p className="tabular text-lg leading-none text-tinta">{String(dia).padStart(2, '0')}</p>
                  <p className="mt-1 text-xs text-tinta-tenue">{diaSemanaAbrev(new Date(ano, mesNum - 1, dia))}</p>
                </>
              )}
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {itens.map((item) => (
                <li key={item.tipo === 'recorrencia' ? item.chave : `parcelas|${item.bank}`}>
                  <Item item={item} semDia={dia === null} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Item({ item, semDia }: { item: ItemDoDia; semDia: boolean }) {
  const { t } = useT()
  const dinheiro = useDinheiro()

  if (item.tipo === 'recorrencia') {
    const entrada = item.sentido === 'entrada'
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <div className="min-w-0 basis-40 flex-1">
          <p className="break-words text-tinta">{item.descricao}</p>
          {item.variacao === 'variavel' && <p className="text-xs text-tinta-tenue">{t('cal.variavel')}</p>}
        </div>
        <span className={`tabular whitespace-nowrap ${entrada ? 'text-credito' : 'text-tinta'}`}>
          {entrada && <span className="sr-only">{t('cal.entra')}: </span>}
          {entrada ? '+' : ''}{dinheiro(item.valorCents)}
        </span>
      </div>
    )
  }

  const banco = temaDoBanco(item.bank)
  return (
    <details className="group text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-3 rounded-md [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 basis-40 flex-1 items-center gap-2">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: banco.accent }} />
          <span className="break-words text-tinta">
            {t('cal.parcelas', { banco: banco.nome })}{' '}
            <span className="text-tinta-tenue">
              ({t(item.parcelas.length === 1 ? 'cal.nParcelas1' : 'cal.nParcelasN', { n: item.parcelas.length })})
            </span>
          </span>
        </span>
        <span className="tabular whitespace-nowrap text-tinta">{dinheiro(item.valorCents)}</span>
      </summary>
      {semDia && <p className="mt-1 text-xs text-tinta-tenue">{t('cal.semFatura')}</p>}
      <ul className="mt-1 space-y-1 border-l border-carvao-700 pl-3">
        {item.parcelas.map((p, i) => (
          <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-tinta-fraca">
            <span className="min-w-0 basis-32 flex-1 break-words">{p.descricao} <span className="tabular">{p.parcela}/{p.total}</span></span>
            <span className="tabular whitespace-nowrap">{dinheiro(p.amountCents)}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
