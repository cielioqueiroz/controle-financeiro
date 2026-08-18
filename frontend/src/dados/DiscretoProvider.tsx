import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { definirDiscreto } from '../domain/normalize/money'

const CHAVE = 'discreto'

type Discreto = {
  /** Valores em dinheiro saem mascarados na tela. */
  discreto: boolean
  alternar: () => void
}

const Ctx = createContext<Discreto>({ discreto: false, alternar: () => {} })

/** Modo discreto: esconde todo valor em dinheiro da TELA, mantendo as
 *  formas — as barras, as fatias e os percentuais continuam lá. Para abrir
 *  o app em público, projetar, ou tirar print.
 *
 *  A máscara acontece no funil (`formatBRL`); este provider existe para
 *  duas coisas que o estado de módulo não faz sozinho: guardar a escolha e
 *  fazer o React repintar a árvore ao alternar. */
export function DiscretoProvider({ children }: { children: ReactNode }) {
  const [discreto, setDiscreto] = useState(() => {
    // O flag é ajustado JÁ no inicializador, não num efeito. Num efeito, o
    // primeiro render sairia com os valores reais e só depois mascararia —
    // um piscar de dinheiro de verdade a cada recarga, que é justamente o
    // que quem liga isto está tentando evitar.
    const salvo = localStorage.getItem(CHAVE) === '1'
    definirDiscreto(salvo)
    return salvo
  })

  const alternar = useCallback(() => {
    const novo = !discreto
    definirDiscreto(novo)
    localStorage.setItem(CHAVE, novo ? '1' : '0')
    setDiscreto(novo)
  }, [discreto])

  const valor = useMemo(() => ({ discreto, alternar }), [discreto, alternar])
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

/** Não lança fora do provider (ao contrário de `useDados`): o padrão
 *  "desligado" é seguro e correto, e um componente montado isolado num
 *  teste não deve quebrar por causa de um modo de exibição. */
export function useDiscreto(): Discreto {
  return useContext(Ctx)
}
