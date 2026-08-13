import { useMemo, useState } from 'react'
import {
  detectarRecorrencias,
  alertasDe,
  competenciaMaisRecente,
} from '../domain/recorrencias'
import { useRecorte } from '../dados/useRecorte'
import { BarraFiltros } from '../ui/BarraFiltros'
import { Recorrencias as ListaRecorrencias } from '../ui/Recorrencias'
import { CompromissosFuturos } from '../ui/CompromissosFuturos'
import { GraficoCompromissos } from '../ui/GraficoCompromissos'
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
  // Um estado só para as duas peças: clicar numa barra do gráfico abre
  // aquele mês na lista ao lado. Com o estado dentro da lista, as duas
  // discordariam sobre qual mês está aberto.
  const [mesAberto, setMesAberto] = useState<string | null>(null)

  return (
    <div className="mt-6">
      {/* Sem o seletor de período: esta página olha o histórico inteiro e o
          ignora. Com o filtro de BANCO, que ela obedece — desde que a barra
          de navegação passou a levar o recorte junto entre páginas, chegar
          aqui filtrado por um banco é rotina, e um filtro que age sem
          aparecer é o mesmo defeito que o do seletor de categoria de
          2026-08-05: a tela mostrando menos do que existe, sem dizer por quê
          nem oferecer como desfazer. */}
      <BarraFiltros mostrarPeriodo={false} />

      {/* Largura maior que a de antes (max-w-4xl): com o gráfico ao lado da
          lista, o que sobrava à direita virou informação. As recorrências
          ficam por cima, em linha cheia — são uma tabela, e tabela estreita
          trunca nome de estabelecimento. */}
      <div className="mx-auto max-w-6xl space-y-6">
        <ListaRecorrencias recorrencias={recorrencias} alertas={alertas} />
        {futuros.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <CompromissosFuturos
              meses={futuros}
              aberto={mesAberto}
              onAlternar={setMesAberto}
            />
            <GraficoCompromissos meses={futuros} onSelecionar={setMesAberto} />
          </div>
        )}
      </div>
    </div>
  )
}
