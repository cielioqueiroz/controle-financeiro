import type { ReactNode } from 'react'
import { Fragment } from 'react'

/** Interpola `{nome}` de uma frase traduzida com nós React (spans estilizados,
 *  valores em destaque). Mantém a frase inteira no dicionário — a ordem dos
 *  pedaços pode mudar por idioma sem quebrar o layout. */
export function interpolarNos(template: string, nos: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/g).map((parte, i) => {
    const m = parte.match(/^\{(\w+)\}$/)
    return <Fragment key={i}>{m ? (nos[m[1]] ?? parte) : parte}</Fragment>
  })
}
