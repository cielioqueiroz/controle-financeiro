import { motion, useReducedMotion } from 'motion/react'

/** A atmosfera da tela de acesso: um facho diagonal, um brilho atrás do
 *  cartão e dois anéis pontilhados girando devagar.
 *
 *  ⚠️ **Tudo aqui é `fixed` e `pointer-events-none`, e não é negociável.**
 *  Decoração que entra no fluxo de rolagem entra no `scrollWidth`: o brilho
 *  desta mesma tela já criou uma barra de rolagem lateral que aparecia e
 *  sumia no ritmo da animação, e é o defeito que `scripts/medir-overflow.py`
 *  existe para vigiar. `overflow-hidden` no contêiner fecha a conta: os
 *  anéis são maiores que a janela de propósito, e sem ele o corte não
 *  aconteceria.
 *
 *  `aria-hidden` porque não há informação nenhuma aqui — é clima. E o loop
 *  todo desliga em `prefers-reduced-motion`: quem pediu menos movimento
 *  recebe a mesma composição parada, não uma tela vazia. */
export function FundoAcesso() {
  const semMovimento = useReducedMotion()

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Facho diagonal: uma faixa de luz cruzando a tela, como o reflexo de
          uma janela sobre o vidro do cartão. */}
      <div
        className="absolute -top-1/4 left-1/4 h-[150%] w-[36rem] rotate-12 opacity-[0.05]"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--color-tinta) 45%, var(--color-tinta) 55%, transparent)',
        }}
      />

      {/* Brilho atrás do cartão. No mobile o cartão ocupa o meio, no desktop
          a coluna da direita — por isso o centro do brilho acompanha. */}
      <div
        className="absolute top-1/2 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 opacity-25 lg:left-[74%]"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--color-marca) 42%, transparent), transparent 68%)',
        }}
      />

      {/* Os anéis. Giram em sentidos opostos e MUITO devagar (2 e 3 minutos
          por volta): o movimento não deve ser percebido como animação, só
          como a tela não estar morta. */}
      <motion.svg
        viewBox="0 0 400 400"
        className="absolute top-1/2 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 text-marca opacity-[0.16] lg:left-[74%]"
        animate={semMovimento ? undefined : { rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
      >
        <circle
          cx="200"
          cy="200"
          r="150"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 10"
          strokeLinecap="round"
        />
      </motion.svg>
      <motion.svg
        viewBox="0 0 400 400"
        className="absolute top-1/2 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 text-marca opacity-[0.22] lg:left-[74%]"
        animate={semMovimento ? undefined : { rotate: -360 }}
        transition={{ duration: 180, repeat: Infinity, ease: 'linear' }}
      >
        <circle
          cx="200"
          cy="200"
          r="150"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="1 14"
          strokeLinecap="round"
        />
      </motion.svg>
    </div>
  )
}
