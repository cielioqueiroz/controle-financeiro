import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { formatBRL } from '../domain/normalize/money'

/** Número que "conta" do valor anterior até o novo — dá vida aos totais.
 *  `moeda` formata em BRL; senão mostra inteiro. */
export function ValorAnimado({
  valor,
  moeda = true,
  className,
}: {
  valor: number
  moeda?: boolean
  className?: string
}) {
  const mv = useMotionValue(0)
  const texto = useTransform(mv, (v) =>
    moeda ? formatBRL(Math.round(v)) : String(Math.round(v)),
  )

  useEffect(() => {
    const controls = animate(mv, valor, { duration: 0.9, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [valor, mv])

  return <motion.span className={className}>{texto}</motion.span>
}
