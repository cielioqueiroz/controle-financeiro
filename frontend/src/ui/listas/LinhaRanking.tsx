import { motion } from 'motion/react'
import type { ReactNode } from 'react'

type Props = {
  /** Posição no ranking, 1-based. */
  posicao: number
  titulo: string
  /** A linha de baixo. O CONTEÚDO muda entre os dois rankings (a categoria
   *  num, a contagem de compras no outro); o tratamento tipográfico, não. É
   *  ele que faz as linhas terem a mesma altura. */
  meta: ReactNode
  /** Já formatado — a linha não sabe de centavos. */
  valor: string
  onClick: () => void
  rotuloAcessivel?: string
  /** Índice para o atraso da entrada em cascata. */
  ordem: number
}

/** A linha de um ranking do painel.
 *
 *  Existe porque `MaioresSaidas` e `TopEstabelecimentos` são irmãs: vivem
 *  lado a lado num grid de duas colunas respondendo perguntas paralelas sobre
 *  o mesmo período. Vinham desenhando a linha de baixo de dois jeitos —
 *  uma com pílula colorida de fundo tingido, outra com texto solto — e o
 *  resultado era o que se via na tela: alturas diferentes, linha 2 de uma
 *  coluna desencontrada da linha 2 da outra, e a dupla lendo como dois
 *  componentes sem parentesco em vez de duas leituras do mesmo recorte.
 *
 *  A regra que esta peça carrega: **estrutura idêntica, conteúdo livre.** A
 *  cor de categoria não sumiu — desceu para um ponto de 6px antes do nome,
 *  onde continua amarrando a linha ao donut sem alterar a caixa da linha. */
export function LinhaRanking({
  posicao,
  titulo,
  meta,
  valor,
  onClick,
  rotuloAcessivel,
  ordem,
}: Props) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(ordem * 0.05, 0.3), duration: 0.3 }}
    >
      <button
        onClick={onClick}
        aria-label={rotuloAcessivel}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-carvao-850"
      >
        <span className="tabular w-4 shrink-0 text-[11px] text-tinta-tenue">{posicao}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-tinta">{titulo}</span>
          {/* `truncate` também aqui: a linha de baixo é a que tem texto de
              tamanho imprevisível (nome de categoria traduzido, contagem em
              três idiomas) e era por ela que a coluna estourava. */}
          <span className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-tinta-tenue">
            {meta}
          </span>
        </span>
        <span className="tabular shrink-0 text-sm text-tinta">{valor}</span>
      </button>
    </motion.li>
  )
}
