import { Link, useSearchParams } from 'react-router-dom'
import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'
import { resumirSaldos, type SaldoConta } from '../domain/saldos'
import { dataLongaDe } from '../domain/normalize/data'
import { useDinheiro } from '../dados/DiscretoProvider'
import { useT } from '../i18n/IdiomaProvider'
import { Cartao } from './Cartao'

export function SaldoImportado({ saldos }: { saldos: SaldoConta[] }) {
  const { t } = useT()
  const dinheiro = useDinheiro()
  const [search] = useSearchParams()
  const { totalCents, datasDiferentes } = resumirSaldos(saldos)
  return (
    <Cartao className="saldo-importado flex min-w-0 flex-col justify-center" aria-label={t('saldoImportado.titulo')}>
      <div className="flex flex-col items-center gap-3 py-5 text-center">
        <h3 className="rotulo">{t('saldoImportado.titulo')}</h3>
        <p className="saldo-importado-valor tabular w-full font-semibold leading-tight tracking-tight text-tinta">
          {totalCents === null ? '—' : dinheiro(totalCents)}
        </p>
        <p className="max-w-64 text-sm leading-relaxed text-tinta-fraca">
          {totalCents === null ? t('situacao.saldoIndisponivel') : t('saldoImportado.descricao', { n: saldos.length })}
        </p>
      </div>
      {saldos.length > 0 && <details className="mt-2 border-t border-borda pt-2">
        <summary className="cursor-pointer py-3 text-center text-sm font-medium text-marca">{t('saldoImportado.detalhar')}</summary>
        <p className="mb-3 text-xs leading-relaxed text-tinta-fraca">
          {t(datasDiferentes ? 'saldoImportado.datasDiferentes' : 'saldoImportado.aviso')}
        </p>
        <ul className="space-y-3">
          {saldos.map((conta, i) => {
            const [ano, mes, dia] = conta.date.split('-').map(Number)
            const params = new URLSearchParams(search)
            if (conta.documentId) params.set('documento', conta.documentId)
            return <li key={conta.accountId ?? conta.bank} className="rounded-lg bg-afundado p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-tinta">{(BANCOS[conta.bank as Bank] ?? BANCOS.desconhecido).nome}
                  <span className="ml-2 text-xs text-tinta-fraca">{t('saldoImportado.conta', { n: i + 1 })}</span>
                </span>
                <span className="tabular text-tinta">{dinheiro(conta.balanceCents)}</span>
              </div>
              <p className="mt-1 text-xs text-tinta-fraca">{t('saldo.em', { data: dataLongaDe(new Date(ano, mes - 1, dia)) })}</p>
              {conta.documentId && <Link className="acao-painel mt-2" to={`/faturas?${params.toString()}`}>{t('relatorios.verDocumento')}</Link>}
            </li>
          })}
        </ul>
      </details>}
    </Cartao>
  )
}
