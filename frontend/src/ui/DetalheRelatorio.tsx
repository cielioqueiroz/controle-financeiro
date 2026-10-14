import { useEffect, useId, useRef } from 'react'
import type { TransacaoSalva } from '../aplicacao/consultas/historico'
import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'
import { Cartao } from './Cartao'
import { Procedencia } from './Procedencia'

type Props = { titulo: string; txs: TransacaoSalva[]; periodo: string; onFechar: () => void }

/** Recebe exatamente as transações que compõem o valor clicado, sem refazer
 * o recorte pela URL de mês (um relatório pode atravessar dois anos). */
export function DetalheRelatorio({ titulo, txs, periodo, onFechar }: Props) {
  const { t } = useT()
  const dinheiro = useDinheiro()
  const id = useId()
  const cabecalho = useRef<HTMLHeadingElement>(null)
  useEffect(() => { cabecalho.current?.focus() }, [])
  const documentos = new Map<string, TransacaoSalva[]>()
  for (const tx of txs) {
    const grupo = documentos.get(tx.document_id) ?? []
    grupo.push(tx)
    documentos.set(tx.document_id, grupo)
  }
  return (
    <Cartao aria-labelledby={id} data-prova="detalhe-relatorio">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="rotulo">{t('relatorios.detalheTitulo')}</p>
          <h3 id={id} ref={cabecalho} tabIndex={-1} className="mt-1 break-words text-lg font-semibold">{titulo}</h3>
          <p className="tabular mt-2 text-xl">{dinheiro(txs.reduce((soma, tx) => soma + tx.amount_cents, 0))}</p>
        </div>
        <button type="button" className="acao-painel" onClick={onFechar}>{t('relatorios.voltarGrafico')}</button>
      </div>
      <Procedencia txs={txs} periodo={periodo} />
      <p className="mb-4 text-sm text-tinta-fraca">{t('relatorios.detalheDescricao')}</p>
      <div className="space-y-3">
        {[...documentos].map(([documento, transacoes]) => {
          const primeira = transacoes[0]
          return (
            <details key={documento} className="rounded-lg border border-borda p-3">
              <summary className="min-h-11 cursor-pointer text-sm leading-relaxed">
                {BANCOS[primeira.bank as Bank]?.nome ?? primeira.bank} · {t(primeira.doc_type === 'fatura' ? 'proc.fatura1' : 'proc.extrato1')} · {primeira.competencia}
                <span className="tabular ml-2">{dinheiro(transacoes.reduce((soma, tx) => soma + tx.amount_cents, 0))}</span>
              </summary>
              <p className="mb-3 break-all text-xs text-tinta-tenue">{t('relatorios.documentoId', { id: documento })}</p>
              <ul className="divide-y divide-borda">
                {transacoes.map((tx) => (
                  <li key={tx.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                    <div className="min-w-0 basis-40 flex-1">
                      <time className="tabular text-xs text-tinta-tenue" dateTime={tx.date}>{tx.date.split('-').reverse().join('/')}</time>
                      <p className="break-words">{tx.label ?? tx.description}</p>
                      {tx.label && <p className="break-words text-xs text-tinta-fraca">{tx.description}</p>}
                    </div>
                    <span className="tabular">{dinheiro(tx.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )
        })}
      </div>
    </Cartao>
  )
}
