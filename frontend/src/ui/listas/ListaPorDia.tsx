import { LinhaTransacao, CabecalhoLancamentos } from './LinhaTransacao'
import { formatBRL } from '../../domain/normalize/money'
import type { GrupoDia } from '../../persist/agrupar'
import type { TransacaoSalva } from '../../persist/puxar'

type Props = {
  grupos: GrupoDia<TransacaoSalva>[]
  onEditar: (t: TransacaoSalva) => void
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function cabecalhoDia(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DIAS[dt.getDay()]}, ${d} ${MESES[m - 1]}`
}

/** Lançamentos agrupados por dia: cada dia tem um cabeçalho com a data e o
 *  subtotal (gasto e entradas), e abaixo tudo o que rolou naquele dia —
 *  compras, débitos, créditos, estornos. */
export function ListaPorDia({ grupos, onEditar }: Props) {
  if (grupos.length === 0) {
    return <p className="px-6 py-10 text-center text-sm text-tinta-fraca">Sem lançamentos neste período.</p>
  }

  return (
    <div>
      <CabecalhoLancamentos mostrarCategoria />
      <div className="divide-y divide-carvao-800">
        {grupos.map((g) => (
          <section key={g.dia}>
            <header className="flex items-baseline justify-between gap-3 bg-carvao-850/60 px-5 py-2">
              <span className="text-sm font-semibold capitalize text-tinta">{cabecalhoDia(g.dia)}</span>
              <span className="tabular flex items-baseline gap-3 text-xs">
                {g.entradasCents > 0 && (
                  <span className="text-confere">+{formatBRL(g.entradasCents)}</span>
                )}
                {g.gastoCents > 0 && <span className="text-tinta-fraca">−{formatBRL(g.gastoCents)}</span>}
              </span>
            </header>
            <ul>
              {g.itens.map((t) => (
                <LinhaTransacao key={t.id} t={t} onEditar={onEditar} mostrarCategoria />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
