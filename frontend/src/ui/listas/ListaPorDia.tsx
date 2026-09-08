import { LinhaTransacao, CabecalhoLancamentos } from './LinhaTransacao'

import type { GrupoDia } from '../../domain/agrupar'
import type { TransacaoSalva } from '../../aplicacao/consultas/historico'
import { useDinheiro } from '../../dados/DiscretoProvider'
import { useT } from '../../i18n/IdiomaProvider'
import { diaSemanaAbrev, mesAbrev } from '../../domain/normalize/data'

type Props = {
  grupos: GrupoDia<TransacaoSalva>[]
  onEditar: (t: TransacaoSalva) => void
}

/** ⚠️ `new Date(y, m - 1, d)`, e não `new Date(iso)`: a segunda forma lê a
 *  string como UTC e, a oeste de Greenwich, mostra o DIA ANTERIOR no
 *  cabeçalho — a compra de sexta apareceria como quinta.
 *
 *  Os nomes saem do `Intl`, na locale ativa. Eram dois arrays em português
 *  cravados aqui, e por isso o cabeçalho continuava dizendo "sex, 5 jun" com
 *  o app em inglês. */
function cabecalhoDia(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${diaSemanaAbrev(dt)}, ${d} ${mesAbrev(dt)}`
}

/** Lançamentos agrupados por dia: cada dia tem um cabeçalho com a data e o
 *  subtotal (gasto e entradas), e abaixo tudo o que rolou naquele dia —
 *  compras, débitos, créditos, estornos. */
export function ListaPorDia({ grupos, onEditar }: Props) {
  const formatBRL = useDinheiro()
  // O `useT` não é só pelas frases: `cabecalhoDia` lê a locale de um estado de
  // MÓDULO, e estado de módulo não repinta ninguém. É o hook que inscreve este
  // componente na troca de idioma — a mesma armadilha do `formatBRL` direto.
  const { t } = useT()
  if (grupos.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-tinta-fraca">{t('lista.semLancamentos')}</p>
    )
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
