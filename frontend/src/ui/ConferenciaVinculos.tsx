import { useMemo } from 'react'
import { conferirVinculos, type DocumentoParaConferencia, type TransacaoParaConferencia, type PontaVinculo } from '../domain/link/conferencia-vinculos'
import { temaDoBanco } from '../domain/banks'
import { dataLongaDe } from '../domain/normalize/data'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'

type Props = {
  transacoes: TransacaoParaConferencia[] | null
  documentos: DocumentoParaConferencia[]
  onVerDocumento: (id: string) => void
}

export function ConferenciaVinculos({ transacoes, documentos, onVerDocumento }: Props) {
  const { t } = useT()
  const pares = useMemo(() => conferirVinculos(transacoes ?? [], documentos), [transacoes, documentos])
  return (
    <details className="border-b border-carvao-800 px-6 py-3">
      <summary className="min-h-11 py-3 font-display text-lg text-tinta">{t('vinculos.titulo')}</summary>
      <p className="mb-4 text-sm text-tinta-fraca">{t('vinculos.explicacao')}</p>
      {transacoes === null ? <p role="status" className="text-sm text-tinta-fraca">{t('vinculos.indisponiveis')}</p>
        : pares.length === 0 ? <p className="text-sm text-tinta-fraca">{t('vinculos.vazio')}</p>
          : <ul className="space-y-4">
            {pares.map((par) => <li key={par.id} className="rounded-xl border border-carvao-700 p-4">
              <h3 className="mb-3 font-medium text-tinta">{t(par.criterio === 'quitacao-fatura' ? 'vinculos.quitacao' : 'vinculos.transferencia')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Ponta ponta={par.origem} rotulo={t(par.criterio === 'quitacao-fatura' ? 'vinculos.pagamento' : 'vinculos.saida')} onVerDocumento={onVerDocumento} />
                <Ponta ponta={par.destino} rotulo={t(par.criterio === 'quitacao-fatura' ? 'doc.fatura' : 'vinculos.entrada')} onVerDocumento={onVerDocumento} />
              </div>
              <p className="mt-3 text-xs text-tinta-fraca">{t(par.criterio === 'quitacao-fatura' ? 'vinculos.criterioFatura' : 'vinculos.criterioTransferencia')}</p>
            </li>)}
          </ul>}
    </details>
  )
}

function Ponta({ ponta, rotulo, onVerDocumento }: { ponta: PontaVinculo | null; rotulo: string; onVerDocumento: Props['onVerDocumento'] }) {
  const { t } = useT()
  const dinheiro = useDinheiro()
  const data = ponta?.date ? dataLongaDe(new Date(`${ponta.date}T12:00:00`)) : null
  return <div className="min-w-0">
    <p className="rotulo">{rotulo}</p>
    {ponta ? <>
      <p className="mt-2 text-sm text-tinta">{temaDoBanco(ponta.documento.bank).nome}</p>
      <p className="mt-1 break-words text-xs text-tinta-fraca">{ponta.description ?? ponta.documento.filename ?? t('docs.nomeAusente')}</p>
      {data && <p className="mt-1 text-xs text-tinta-fraca">{data}</p>}
      <p className="tabular mt-2 text-sm text-tinta">{ponta.amountCents === null ? t('vinculos.valorIndisponivel') : dinheiro(ponta.amountCents)}</p>
      <button type="button" className="acao-painel mt-2 text-sm" onClick={() => onVerDocumento(ponta.documento.id)}>
        {t('relatorios.verDocumento')}
      </button>
    </> : <p className="mt-2 text-sm text-tinta-fraca">{t('vinculos.contraparteIndisponivel')}</p>}
  </div>
}
