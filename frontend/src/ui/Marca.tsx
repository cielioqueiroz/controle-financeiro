import { motion, useReducedMotion } from 'motion/react'

type Props = {
  /** `cabecalho` é a versão pequena e espaçada do topo da página;
   *  `destaque` é a versão grande, usada no cartão de login. */
  variante?: 'cabecalho' | 'destaque'
}

const NOME = 'Capital Financeiro'
/** Índice a partir do qual começa "Financeiro" (a segunda palavra). */
const INICIO_SEGUNDA = NOME.indexOf(' ') + 1

/** Logotipo do sistema: "Capital" em tinta, "Financeiro" em verde.
 *
 *  Ao passar o mouse sobre o conjunto, as letras saltam em sequência — o
 *  hover fica no elemento-pai e cada letra herda o estado com um atraso
 *  proporcional à posição, produzindo a onda. Com `whileHover` em cada letra
 *  o salto só aconteceria na letra sob o cursor, que não é o efeito desejado.
 *
 *  Respeita `prefers-reduced-motion`: quem pede menos movimento recebe o
 *  logotipo estático. */
export function Marca({ variante = 'cabecalho' }: Props) {
  const semMovimento = useReducedMotion()

  const cabecalho = variante === 'cabecalho'
  // O topo já foi 11px com tracking 0.35em: nesse tamanho o espaçamento
  // largo dissolvia a palavra em letras soltas e o logotipo sumia na
  // página. Mais corpo, mais peso e menos tracking — continua sendo a
  // versão discreta do topo, mas agora se lê como um nome.
  // No celular o nome divide a linha com o seletor de idioma e o botão de
  // tema: com o tracking do desktop a linha estourava os 375px (o toggle
  // saía da tela). Menos espaçamento e um corpo menor até `sm` resolvem sem
  // devolver o logotipo ao tamanho de rodapé que ele tinha.
  const classe = cabecalho
    ? 'tabular text-[12px] font-semibold uppercase tracking-[0.12em] sm:text-[15px] sm:tracking-[0.2em]'
    : 'font-display text-[30px] font-semibold tracking-tight sm:text-[34px]'

  return (
    <motion.span
      className={`inline-flex cursor-default select-none ${classe}`}
      aria-label={NOME}
      role="img"
      initial="parado"
      whileHover={semMovimento ? undefined : 'salto'}
    >
      {NOME.split('').map((letra, i) => (
        <motion.span
          key={i}
          aria-hidden
          className={i < INICIO_SEGUNDA ? 'text-tinta' : 'text-marca'}
          // O espaço não pode colapsar no flex: damos largura explícita.
          style={letra === ' ' ? { width: '0.3em' } : undefined}
          variants={{ parado: { y: 0 }, salto: { y: -7 } }}
          transition={{
            type: 'spring',
            stiffness: 520,
            damping: 13,
            delay: i * 0.03,
          }}
        >
          {letra === ' ' ? ' ' : letra}
        </motion.span>
      ))}
    </motion.span>
  )
}
