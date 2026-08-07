import { useMemo } from 'react'
import { detectarRecorrencias } from '../domain/recorrencias'
import { formatBRL } from '../domain/normalize/money'
import { categoria, nomeCategoria } from '../domain/categorize/categorias'
import { useRecorte } from '../dados/useRecorte'
import { diasDoMes } from '../dados/calendario'
import { BarraFiltros } from '../ui/BarraFiltros'

const SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

/** Calendário do mês com os compromissos que se repetem.
 *
 *  Derivado, não cadastrado: o `diaTipico` das recorrências detectadas é a
 *  data. Nenhum campo aqui é digitado — o sistema continua 100%
 *  retrospectivo. */
export function Datas() {
  const { visiveis, filtros } = useRecorte()

  const recorrencias = useMemo(
    () => (visiveis ? detectarRecorrencias(visiveis) : []),
    [visiveis],
  )

  const ano = filtros.ref.getFullYear()
  const mes = filtros.ref.getMonth() + 1
  const dias = useMemo(() => diasDoMes(recorrencias, ano, mes), [recorrencias, ano, mes])

  // Quantas células vazias antes do dia 1, para a semana começar na segunda.
  // getDay() devolve 0 para domingo; o `+6 % 7` roda a régua.
  const vaziosAntes = (new Date(ano, mes - 1, 1).getDay() + 6) % 7

  const totalCompromissos = dias.reduce((s, d) => s + d.itens.length, 0)

  return (
    <div className="mt-6">
      <BarraFiltros />

      {totalCompromissos === 0 ? (
        <div className="rounded-2xl border border-carvao-700 bg-carvao-900 px-6 py-16 text-center">
          <p className="font-display text-lg text-tinta">Nenhuma data recorrente ainda</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-tinta-fraca">
            As datas aparecem sozinhas quando uma cobrança se repete por alguns meses. Importe
            mais faturas e extratos para o sistema reconhecer o padrão.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900 p-4">
          <div className="mb-2 grid grid-cols-7 gap-px">
            {SEMANA.map((d) => (
              <div
                key={d}
                className="tabular py-1 text-center text-[10px] uppercase tracking-widest text-tinta-tenue"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-carvao-800">
            {Array.from({ length: vaziosAntes }, (_, i) => (
              <div key={`vazio-${i}`} className="min-h-24 bg-carvao-900" />
            ))}

            {dias.map((d) => (
              <div
                key={d.dia}
                className={`min-h-24 bg-carvao-900 p-1.5 ${
                  d.itens.length > 0 ? '' : 'opacity-60'
                }`}
              >
                <p className="tabular mb-1 text-[11px] text-tinta-tenue">
                  {String(d.dia).padStart(2, '0')}
                </p>
                <ul className="space-y-0.5">
                  {d.itens.map((r) => (
                    <li
                      key={`${r.chave}-${r.tipo}`}
                      title={`${r.descricao} · ${nomeCategoria(categoria(r.categoriaSlug))} · ${formatBRL(r.valorTipicoCents)}`}
                      className={`truncate rounded px-1 py-0.5 text-[10px] ${
                        r.tipo === 'entrada'
                          ? 'bg-confere/15 text-confere'
                          : 'bg-carvao-800 text-tinta-fraca'
                      }`}
                    >
                      {r.descricao}
                    </li>
                  ))}
                </ul>
                {d.saidasCents > 0 && (
                  <p className="tabular mt-1 text-[10px] text-tinta-tenue">
                    −{formatBRL(d.saidasCents).replace('R$', '').trim()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
