import { motion } from 'motion/react'
import { formatBRL } from '../domain/normalize/money'
import { useT } from '../i18n/IdiomaProvider'
import type { GrupoEstabelecimento } from '../persist/agrupar'

type Props = {
  /** Já vem somado, ordenado e cortado por `porEstabelecimento`. */
  itens: GrupoEstabelecimento[]
  /** Abre os lançamentos daquele estabelecimento. Recebe a CHAVE
   *  normalizada, não o rótulo exibido — ver o comentário no clique. */
  onAbrir: (merchant: string) => void
}

/** Onde o dinheiro saiu, somando as compras repetidas.
 *
 *  Vive ao lado de `MaioresSaidas`, e a dupla é proposital: aquela responde
 *  "qual foi a maior compra" (o empréstimo, a geladeira), esta responde "que
 *  lugar mais consumiu dinheiro". Um gasto de R$ 80 três vezes no mês não
 *  aparece em nenhum ranking de maior compra e pode ser maior que a compra
 *  única do topo — é justamente o gasto que passa despercebido, e o único
 *  jeito de vê-lo é somando. */
export function TopEstabelecimentos({ itens, onAbrir }: Props) {
  const { t } = useT()
  if (itens.length === 0) return null

  return (
    <div>
      <p className="tabular mb-2 text-[10px] uppercase tracking-widest text-tinta-tenue">
        {t('estab.titulo')}
      </p>
      <ul className="space-y-0.5">
        {itens.map((item, i) => (
          <motion.li
            key={item.merchant}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.3 }}
          >
            <button
              // A busca recebe `merchant` (a chave), nunca `rotulo`: com o
              // rótulo, clicar num grupo renomeado acharia só as compras que
              // receberam aquele nome, e não o estabelecimento inteiro.
              onClick={() => onAbrir(item.merchant)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-carvao-850"
              aria-label={t('estab.rotulo', {
                nome: item.rotulo,
                valor: formatBRL(item.totalCents),
                n: item.contagem,
              })}
            >
              <span className="tabular w-3 shrink-0 text-[11px] text-tinta-tenue">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-tinta">{item.rotulo}</span>
                {/* A contagem é o que distingue este ranking do outro: sem
                    ela, "R$ 240" não deixa ver que foram três compras. */}
                <span className="mt-0.5 block text-[10px] text-tinta-tenue">
                  {item.contagem === 1
                    ? t('estab.compra1')
                    : t('estab.compras', { n: item.contagem })}
                </span>
              </span>
              <span className="tabular shrink-0 text-sm text-tinta">
                {formatBRL(item.totalCents)}
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
