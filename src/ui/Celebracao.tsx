import { useEffect, useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/** Cores do confete: marca (âmbar), confere (oliva) e neutros do tema.
 *  Vars de CSS para acompanhar o tema claro/escuro automaticamente. */
const CORES = [
  'var(--color-marca)',
  'var(--color-confere)',
  'var(--color-ressalva)',
  'var(--color-tinta-fraca)',
]

type Particula = {
  id: number
  x: number // deslocamento horizontal final (vw relativo ao centro)
  atraso: number
  duracao: number
  rotacao: number
  cor: string
  largura: number
  altura: number
}

function gerarParticulas(n: number): Particula[] {
  return Array.from({ length: n }, (_, id) => ({
    id,
    x: (Math.random() - 0.5) * 90,
    atraso: Math.random() * 0.25,
    duracao: 1.1 + Math.random() * 0.7,
    rotacao: (Math.random() - 0.5) * 720,
    cor: CORES[id % CORES.length],
    largura: 5 + Math.random() * 5,
    altura: 8 + Math.random() * 6,
  }))
}

type Props = {
  /** Dispara a chuva. O componente avisa `onFim` e some sozinho. */
  ativo: boolean
  onFim: () => void
}

/** Confete de comemoração — usado quando o total lido bate com o banco ao
 *  centavo. Camada `fixed` com `overflow-hidden` e `pointer-events-none`:
 *  decoração NUNCA entra no layout de rolagem (ver ESTADO-ATUAL, armadilhas).
 *  Com `prefers-reduced-motion`, não anima nada. */
export function Celebracao({ ativo, onFim }: Props) {
  const semMovimento = useReducedMotion()
  const particulas = useMemo(() => (ativo ? gerarParticulas(28) : []), [ativo])

  useEffect(() => {
    if (!ativo) return
    // Some sozinho depois da partícula mais lenta (duração + atraso máximos).
    const tempo = semMovimento ? 0 : 2100
    const timer = setTimeout(onFim, tempo)
    return () => clearTimeout(timer)
  }, [ativo, semMovimento, onFim])

  if (!ativo || semMovimento) return null

  return (
    <div
      aria-hidden
      data-testid="celebracao"
      className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
    >
      {particulas.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            x: `${p.x}vw`,
            y: ['0vh', '-18vh', '110vh'],
            rotate: p.rotacao,
            opacity: [1, 1, 0.9],
            scale: [1, 1, 0.85],
          }}
          transition={{
            delay: p.atraso,
            duration: p.duracao,
            ease: [0.15, 0.6, 0.45, 1],
            times: [0, 0.25, 1],
          }}
          style={{
            position: 'absolute',
            left: '50%',
            top: '28%',
            width: p.largura,
            height: p.altura,
            borderRadius: 2,
            background: p.cor,
          }}
        />
      ))}
    </div>
  )
}
