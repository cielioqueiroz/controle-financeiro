import type { ReactNode } from 'react'
import { Cartao } from './Cartao'

type Props = {
  titulo: string
  descricao: string
  acao: ReactNode
}

export function EstadoVazio({ titulo, descricao, acao }: Props) {
  return (
    <Cartao className="text-center">
      <div className="mx-auto max-w-md py-8 sm:py-12">
        <h2 className="font-display text-2xl text-tinta">{titulo}</h2>
        <p className="mt-3 text-sm leading-relaxed text-tinta-fraca">{descricao}</p>
        <div className="mt-6">{acao}</div>
      </div>
    </Cartao>
  )
}
