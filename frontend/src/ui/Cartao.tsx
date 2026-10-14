import type { ComponentPropsWithoutRef } from 'react'

type Props = ComponentPropsWithoutRef<'section'> & {
  as?: 'section' | 'article' | 'div'
}

export function Cartao({ as: Elemento = 'section', className = '', ...props }: Props) {
  return <Elemento className={`cartao p-5 sm:p-6 ${className}`} {...props} />
}
