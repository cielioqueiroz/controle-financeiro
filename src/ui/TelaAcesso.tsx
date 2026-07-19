import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Marca } from './Marca'
import { ThemeToggle } from './ThemeToggle'
import { Rodape } from './Rodape'

/** Frase de quem ainda não entrou — usada aqui embaixo e também no header
 *  do App quando não há Neon configurado (o modo "importa e vê" também é
 *  visitante anônimo, então vê a mesma frase de deslogado, não a saudação).
 *  Sem tag h1 nem classes de framing: cada chamador decide isso, porque o
 *  card de acesso e o header usam tamanhos de fonte diferentes. */
export function FraseDeslogado() {
  return (
    <>
      Seu extrato vira gráfico,{' '}
      <br />
      <span className="text-tinta-fraca">em menos de um minuto.</span>
    </>
  )
}

/** Tela inteira enquanto ninguém está logado: marca e tema no topo, frase à
 *  esquerda e card à direita em telas largas, tudo empilhado no celular.
 *
 *  Existe porque o <header> do App serve ao estado LOGADO — largura total,
 *  saudação, menu de conta. A tela de acesso herdava esse cabeçalho e caía
 *  embaixo dele, o que produzia uma página de 1044px num viewport de 800px
 *  com as laterais vazias.
 *
 *  A altura usa dvh, não vh: em navegador de celular a barra de endereço
 *  retrátil faz 100vh ser maior que a área visível, o que traria de volta
 *  exatamente a rolagem que este componente remove. */
export function TelaAcesso({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col px-4 py-6 sm:px-6 lg:px-10">
      <header className="mx-auto flex w-full max-w-[104rem] items-center justify-between gap-4">
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="tabular flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-tinta-tenue"
        >
          <motion.span
            className="inline-block h-1.5 w-1.5 rounded-full bg-marca"
            animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Marca />
        </motion.p>
        <ThemeToggle />
      </header>

      <div className="mx-auto grid w-full max-w-[104rem] flex-1 items-center gap-10 py-10 lg:grid-cols-2 lg:gap-16">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="font-display text-4xl leading-[1.05] text-tinta sm:text-5xl lg:text-6xl"
        >
          <FraseDeslogado />
        </motion.h1>

        <div className="w-full">{children}</div>
      </div>

      <Rodape />
    </div>
  )
}
