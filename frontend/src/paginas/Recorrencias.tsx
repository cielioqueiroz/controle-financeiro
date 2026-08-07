import { useMemo } from 'react'
import {
  detectarRecorrencias,
  alertasDe,
  competenciaMaisRecente,
} from '../domain/recorrencias'
import { useRecorte } from '../dados/useRecorte'
import { Recorrencias as ListaRecorrencias } from '../ui/Recorrencias'
import { CompromissosFuturos } from '../ui/CompromissosFuturos'
import { projecaoFutura } from '../persist/agrupar'

/** Séries que se repetem e os alertas sobre elas.
 *
 *  Detecção pura, sem cadastro: nada aqui é digitado, tudo é derivado do
 *  que já foi importado. Por isso a página olha `visiveis` (todo o
 *  histórico do banco escolhido) e NÃO `txs` — reconhecer "se repete todo
 *  mês" exige mais de um mês, e o recorte de período esconderia justamente
 *  a evidência. */
export function Recorrencias() {
  const { visiveis } = useRecorte()

  const recorrencias = useMemo(
    () => (visiveis ? detectarRecorrencias(visiveis) : []),
    [visiveis],
  )
  const alertas = useMemo(
    () => alertasDe(recorrencias, competenciaMaisRecente(visiveis ?? [])),
    [recorrencias, visiveis],
  )
  const futuros = useMemo(() => (visiveis ? projecaoFutura(visiveis) : []), [visiveis])

  return (
    <div className="mx-auto mt-6 grid max-w-4xl gap-6 lg:grid-cols-2">
      <ListaRecorrencias recorrencias={recorrencias} alertas={alertas} />
      {futuros.length > 0 && <CompromissosFuturos meses={futuros} />}
    </div>
  )
}
