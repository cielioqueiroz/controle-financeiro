import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'

import { useDiscreto } from '../dados/DiscretoProvider'
import { useDinheiro } from '../dados/DiscretoProvider'

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
  const formatBRL = useDinheiro()
  // O valor não é lido: o que importa é ASSINAR o contexto. Alternar o modo
  // discreto não muda `valor`, então sem esta linha o componente não
  // repintaria — e `useTransform` só recalcula quando o componente repinta.
  //
  // ⚠️ Chegou a haver aqui um curto-circuito devolvendo a máscara antes do
  // motion value, supondo que `useTransform` guardasse a função da primeira
  // renderização. Não guarda — e as duas metades foram MEDIDAS, uma de cada
  // vez, contra um teste que espera a animação parar antes de alternar (sem
  // essa espera o motion value recalcula sozinho e qualquer versão passa):
  // sem esta linha o teste fica vermelho; sem o curto-circuito, verde.
  useDiscreto()
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
