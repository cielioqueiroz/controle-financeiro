import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { filtrar, agregar, variacaoPct } from '../persist/agrupar'
import { mover } from './periodo'
import { useDados } from './DadosProvider'
import { useFiltros } from './useFiltros'

/** A fatia do histórico que os filtros da URL descrevem.
 *
 *  Painel, Lançamentos, Recorrências e Datas mostram recortes diferentes do
 *  MESMO conjunto — sem isto, cada página repetiria o `filtrar`+`agregar` e
 *  elas divergiriam na primeira mudança de regra. */
export function useRecorte() {
  const { todas, carregando, erro, competenciaInicial } = useDados()
  const { filtros, setFiltros } = useFiltros()
  const [search] = useSearchParams()

  // Sem `ref` na URL, abre na competência mais recente COM DADO em vez de
  // no mês corrente: faturas trazem meses passados, e quem importou a
  // fatura de junho em agosto veria uma tela vazia sem entender por quê.
  //
  // Escreve na URL (em vez de guardar num estado à parte) para que o resto
  // do app tenha uma fonte da verdade só — e para que o link copiado a
  // partir daí já leve o mês certo.
  const semRefNaUrl = !search.get('ref')
  useEffect(() => {
    if (!semRefNaUrl || !competenciaInicial) return
    const [y, m] = competenciaInicial.split('-').map(Number)
    setFiltros({ ref: new Date(y, m - 1, 1) })
  }, [semRefNaUrl, competenciaInicial, setFiltros])

  const visiveis = useMemo(
    () =>
      filtros.banco === 'geral' ? todas : (todas ?? []).filter((t) => t.bank === filtros.banco),
    [todas, filtros.banco],
  )

  const txs = useMemo(
    () => (visiveis ? filtrar(visiveis, filtros.periodo, filtros.ref) : []),
    [visiveis, filtros.periodo, filtros.ref],
  )

  const resumo = useMemo(() => agregar(txs), [txs])

  /** O MESMO recorte, um período atrás — é o que dá sentido ao número do
   *  tile: "R$ 918 em supermercado" só vira notícia comparado com o mês
   *  passado. Calculado aqui, e não no Painel, porque o recorte anterior tem
   *  que usar exatamente o mesmo `filtrar` (mesmo banco, mesma regra de
   *  competência) — repetir essa lógica na página seria o caminho para as
   *  duas divergirem na primeira mudança. */
  const variacao = useMemo(() => {
    if (!visiveis) return { gasto: null, entradas: null }
    const anterior = agregar(filtrar(visiveis, filtros.periodo, mover(filtros.periodo, filtros.ref, -1)))
    return {
      gasto: variacaoPct(resumo.gastoCents, anterior.gastoCents),
      entradas: variacaoPct(resumo.entradasCents, anterior.entradasCents),
    }
  }, [visiveis, filtros.periodo, filtros.ref, resumo.gastoCents, resumo.entradasCents])

  const compAtiva = `${filtros.ref.getFullYear()}-${String(filtros.ref.getMonth() + 1).padStart(2, '0')}`

  return {
    /** Transações do período e banco escolhidos. */
    txs,
    /** Totais do recorte (gasto, entradas, saldo, contagem, por categoria). */
    resumo,
    /** Variação de gasto e entradas contra o mesmo recorte um período atrás.
     *  `null` em cada campo quando não há base de comparação — a UI esconde,
     *  em vez de estampar um "+100%" que só significa "não havia nada antes". */
    variacao,
    /** Todo o histórico do banco escolhido, sem recorte de período. Séries
     *  temporais e recorrências precisam disto: detectar "se repete todo
     *  mês" exige mais de um mês. */
    visiveis,
    filtros,
    setFiltros,
    compAtiva,
    carregando,
    erro,
    vazio: !carregando && todas !== null && txs.length === 0,
  }
}
