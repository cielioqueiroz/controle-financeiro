import type { DocumentoSalvo } from '../aplicacao/consultas/documentos'
import { temaDoBanco } from '../domain/banks'
import { dataLongaDe } from '../domain/normalize/data'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'
import { ComparacoesConferencia } from './ComparacoesConferencia'

type Props = {
  documento: DocumentoSalvo
  contagem: { qtd: number; totalCents: number } | null
  onApagar: () => void
}

function dataDocumento(data: string | null): string {
  if (!data) return '—'
  const [ano, mes, dia] = data.split('-').map(Number)
  return dataLongaDe(new Date(ano, mes - 1, dia))
}

export function DocumentoImportado({ documento: d, contagem: c, onApagar }: Props) {
  const { t } = useT()
  const dinheiro = useDinheiro()
  const tema = temaDoBanco(d.bank)
  const gabaritos = [
    { rotulo: 'conferencia.totalFatura', valor: d.declared_total },
    { rotulo: 'conferencia.entradas', valor: d.declared_income },
    { rotulo: 'conferencia.saidas', valor: d.declared_expense },
  ] as const
  const disponiveis = gabaritos.filter((g) => g.valor != null)

  return (
    <li className="cartao p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-semibold text-tinta"
          style={{ background: tema.wash }}>
          {tema.nome.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-tinta">
            {t(d.doc_type === 'fatura' ? 'doc.fatura' : 'doc.extrato')} · <span>{tema.nome}</span>
          </p>
          <p className="mt-1 text-xs text-tinta-tenue">
            {t('docs.importadoEm', { data: dataLongaDe(new Date(d.imported_at)) })}
          </p>
        </div>
        <button onClick={onApagar} aria-label={t('docs.apagarDoc')} title={t('docs.apagarDocTitle')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-tinta-tenue hover:bg-falha/15 hover:text-falha">
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
          </svg>
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-tinta-fraca">
        {c === null ? t('docs.contagemIndisponivel') : c.qtd === 0 ? t('docs.semTransacoes') : (
          <>{t('docs.nLancamentos', { n: c.qtd })} · {t('docs.gastoReal', { valor: dinheiro(c.totalCents) })}</>
        )}
      </p>
      <details className="mt-2">
        <summary className="min-h-11 py-3 text-sm text-tinta">{t('docs.verDados')}</summary>
        <dl className="space-y-3 border-t border-carvao-700 pt-3 text-xs">
          <div>
            <dt className="text-tinta-tenue">{t('docs.nomeArquivo')}</dt>
            <dd className="mt-1 break-words text-tinta">{d.filename ?? t('docs.nomeAusente')}</dd>
          </div>
          <div>
            <dt className="text-tinta-tenue">{t('docs.periodoDocumento')}</dt>
            <dd className="mt-1 text-tinta">{dataDocumento(d.period_start)} – {dataDocumento(d.period_end)}</dd>
          </div>
        </dl>
        <h3 className="mt-4 text-sm font-medium text-tinta">{t('docs.gabaritos')}</h3>
        {disponiveis.length > 0 ? (
          <>
            <dl className="mt-2 space-y-2 text-xs">
              {disponiveis.map((g) => (
                <div key={g.rotulo} className="flex flex-wrap justify-between gap-2">
                  <dt className="text-tinta-fraca">{t(g.rotulo)}</dt>
                  <dd className="tabular text-tinta">{dinheiro(g.valor!)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-tinta-fraca">{t('docs.gabaritoAjuda')}</p>
          </>
        ) : <p className="mt-2 text-xs leading-relaxed text-tinta-fraca">{t('docs.gabaritoAusente')}</p>}
        {d.conferencia ? (
          <section className="mt-5 border-t border-borda pt-4" aria-label={t('docs.conferenciaOriginal')}>
            <h3 className="text-sm font-medium text-tinta">{t('docs.conferenciaOriginal')}</h3>
            <p role="status" className={`mt-2 text-sm font-medium ${d.conferencia.status === 'confere' ? 'text-confere' : 'text-tinta-fraca'}`}>
              <span>{t(d.conferencia.status === 'confere' ? 'carimbo.confere' : 'carimbo.semGabarito')}</span>
              {' · '}{t('docs.nLancamentos', { n: d.conferencia.contagem })}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-tinta-fraca">{t('docs.conferenciaOriginalAjuda')}</p>
            <ComparacoesConferencia comparacoes={d.conferencia.comparacoes} />
          </section>
        ) : <p className="mt-3 text-xs leading-relaxed text-tinta-fraca">{t('docs.conferenciaNaoGuardada')}</p>}
      </details>
    </li>
  )
}
