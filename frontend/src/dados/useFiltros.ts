import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { lerFiltros, escreverFiltros, type Filtros } from './filtros'

/** Liga os filtros da tela à barra de endereços.
 *
 *  Não há `useState` por trás: a URL **é** o estado. Isso significa que
 *  recarregar mantém o recorte, voltar/avançar do navegador desfaz um
 *  filtro de cada vez, e mandar a tela para alguém é copiar o endereço.
 *
 *  `replace: true` de propósito ao mexer num filtro: sem isso, cada
 *  caractere digitado na busca viraria uma entrada no histórico e o botão
 *  Voltar levaria vinte cliques para sair da página. */
export function useFiltros() {
  const [search, setSearch] = useSearchParams()

  const filtros = useMemo(() => lerFiltros(`?${search.toString()}`), [search])

  const setFiltros = useCallback(
    (mudanca: Partial<Filtros>) => {
      const alvo = { ...lerFiltros(`?${search.toString()}`), ...mudanca }
      setSearch(escreverFiltros(alvo).slice(1), { replace: true })
    },
    [search, setSearch],
  )

  return { filtros, setFiltros }
}
