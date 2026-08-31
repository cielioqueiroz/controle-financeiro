import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { definirDiscreto, formatarDinheiro } from '../domain/normalize/money'

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
 *  A máscara acontece no funil (`formatBRL`), e este provider guarda a
 *  escolha.
 *
 *  ⚠️ **Ele NÃO repinta a árvore** — dizia que sim, e essa frase custou o
 *  defeito de 2026-08-31: alternar o modo mascarava três lugares e deixava
 *  74 valores na tela. Mudar o valor de um contexto repinta quem CONSOME o
 *  contexto, e só isso. Como o `formatBRL` lê um estado de MÓDULO, todo
 *  componente que já tinha renderizado seguia mostrando a saída antiga.
 *
 *  Quem formata dinheiro na UI usa `useDinheiro()`, logo abaixo — é a
 *  assinatura do contexto que faz o componente repintar. Há um teste que
 *  falha se alguém em `ui/` ou `paginas/` importar `formatBRL` direto. */
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

/** O formatador de dinheiro da UI. **Use este, nunca o `formatBRL` direto.**
 *
 *  A diferença não é o resultado — é o `useContext` aqui dentro. Ele inscreve
 *  o componente no modo discreto, e é isso que o faz repintar quando alguém
 *  aperta o olho no cabeçalho. Importar `formatBRL` direto formata igual e
 *  não repinta nunca: o valor fica na tela até o componente renderizar por
 *  outro motivo.
 *
 *  A função é recriada quando o modo muda, de propósito: memo e
 *  `React.memo` mais abaixo na árvore também precisam enxergar a mudança. */
export function useDinheiro(): (cents: number) => string {
  const { discreto } = useContext(Ctx)
  // O modo vem do CONTEXTO, não do estado de módulo — é essa leitura que
  // inscreve o componente e o faz repintar. Passá-lo adiante como argumento
  // é o que fecha o circuito: o `formatBRL` de módulo formataria igual e o
  // React não teria motivo nenhum para repintar.
  return useCallback((cents: number) => formatarDinheiro(cents, discreto), [discreto])
}
