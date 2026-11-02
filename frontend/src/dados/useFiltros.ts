import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { lerFiltros, escreverFiltros, type Filtros } from './filtros'
import { lerPeriodoPadrao } from '../lib/preferencias'

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

  // O padrão é lido a cada pintura: a sincronização do login pode trocá-lo
  // depois que a tela já abriu, e o `App` repinta quando isso acontece.
  const padrao = lerPeriodoPadrao()
  const filtros = useMemo(() => lerFiltros(`?${search.toString()}`, padrao), [search, padrao])

  const setFiltros = useCallback(
    (mudanca: Partial<Filtros>) => {
      const alvo = { ...lerFiltros(`?${search.toString()}`, padrao), ...mudanca }
      const proxima = new URLSearchParams(search)
      for (const chave of ['p', 'ref', 'banco', 'cat', 'q']) proxima.delete(chave)
      new URLSearchParams(escreverFiltros(alvo)).forEach((valor, chave) => proxima.set(chave, valor))
      setSearch(proxima, { replace: true })
    },
    [search, setSearch, padrao],
  )

  return { filtros, setFiltros }
}
