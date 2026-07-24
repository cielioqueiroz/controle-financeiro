import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

type Props = {
  nome: string
  onFechar: () => void
}

type Passo = { icone: string; titulo: string; corpo: string }

const PASSOS: Passo[] = [
  {
    icone: '📄',
    titulo: 'Importe um PDF',
    corpo:
      'Clique em “+ Importar PDF” e solte a fatura ou o extrato do banco. Eu leio tudo aqui no navegador e guardo só os lançamentos — o PDF nunca sai do seu computador.',
  },
  {
    icone: '🗓️',
    titulo: 'Veja por período',
    corpo:
      'Alterne entre Dia, Semana, Mês e Ano. O Mês agrupa pela fatura (competência), então bate com o valor que você realmente paga naquele mês.',
  },
  {
    icone: '🏷️',
    titulo: 'Ajuste as compras',
    corpo:
      'Cada compra ganha uma categoria automática. Passe o mouse sobre a linha e clique no lápis para renomear o estabelecimento ou trocar a categoria do seu jeito.',
  },
  {
    icone: '🗂️',
    titulo: 'Seus documentos',
    corpo:
      'No botão “Documentos” você vê tudo que importou e pode apagar uma fatura específica — ou recomeçar do zero, se algo saiu errado.',
  },
  {
    icone: '🖨️',
    titulo: 'Leve o relatório',
    corpo:
      'O botão “Baixar PDF” monta um relatório limpo do período e abre o diálogo de impressão — é só escolher “Salvar como PDF” para guardar ou imprimir no papel.',
  },
]

/** Tutorial guiado de boas-vindas: passos curtos mostrando como usar o
 *  app. Aparece uma vez para quem nunca viu (flag no navegador) e pode ser
 *  reaberto pelo menu de conta. */
export function Tutorial({ nome, onFechar }: Props) {
  const [i, setI] = useState(-1) // -1 = tela de boas-vindas
  const total = PASSOS.length
  const boasVindas = i < 0
  const passo = boasVindas ? null : PASSOS[i]
  const ultimo = i === total - 1

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-900 shadow-2xl shadow-black/50"
      >
        <div className="relative px-8 pb-6 pt-9">
          <button
            onClick={onFechar}
            className="absolute right-4 top-4 text-[11px] uppercase tracking-widest text-tinta-tenue transition-colors hover:text-tinta"
          >
            Pular
          </button>

          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="min-h-[168px]"
            >
              {boasVindas ? (
                <>
                  <div className="text-4xl">👋</div>
                  <h2 className="mt-3 font-display text-2xl text-tinta">Olá, {nome}!</h2>
                  <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">
                    Bem-vindo(a) ao seu controle financeiro. Importe faturas e extratos em PDF e veja,
                    com clareza, para onde o seu dinheiro foi — sem digitar nada. Em 30 segundos eu
                    te mostro como.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-4xl">{passo!.icone}</div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="tabular text-xs text-tinta-tenue">
                      {i + 1}/{total}
                    </span>
                    <h2 className="font-display text-2xl text-tinta">{passo!.titulo}</h2>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-tinta-fraca">{passo!.corpo}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t border-carvao-800 px-8 py-4">
          {/* Pontinhos de progresso */}
          <div className="flex gap-1.5">
            {PASSOS.map((_, k) => (
              <span
                key={k}
                className={`h-1.5 rounded-full transition-all ${
                  k === i ? 'w-5 bg-tinta' : 'w-1.5 bg-carvao-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!boasVindas && (
              <button
                onClick={() => setI((v) => v - 1)}
                className="rounded-lg px-3 py-1.5 text-sm text-tinta-fraca transition-colors hover:text-tinta"
              >
                Voltar
              </button>
            )}
            {ultimo ? (
              <button
                onClick={onFechar}
                className="rounded-lg bg-marca px-4 py-1.5 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90"
              >
                Começar!
              </button>
            ) : (
              <button
                onClick={() => setI((v) => v + 1)}
                className="rounded-lg bg-tinta px-4 py-1.5 text-sm font-medium text-carvao-950 transition-opacity hover:opacity-90"
              >
                {boasVindas ? 'Bora ver' : 'Próximo'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
