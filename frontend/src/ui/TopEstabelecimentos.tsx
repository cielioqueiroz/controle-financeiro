import { formatBRL } from '../domain/normalize/money'
import { useT } from '../i18n/IdiomaProvider'
import { LinhaRanking } from './LinhaRanking'
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
 *  jeito de vê-lo é somando.
 *
 *  Desenha pela mesma `LinhaRanking` da irmã: perguntas diferentes, caixa
 *  igual. Sem isso as duas colunas do painel não alinham. */
export function TopEstabelecimentos({ itens, onAbrir }: Props) {
  const { t } = useT()
  if (itens.length === 0) return null

  return (
    <div>
      <p className="rotulo mb-3">{t('estab.titulo')}</p>
      <ul>
        {itens.map((item, i) => (
          <LinhaRanking
            key={item.merchant}
            ordem={i}
            posicao={i + 1}
            titulo={item.rotulo}
            // A contagem é o que distingue este ranking do outro: sem ela,
            // "R$ 240" não deixa ver que foram três compras.
            meta={
              <span className="truncate">
                {item.contagem === 1
                  ? t('estab.compra1')
                  : t('estab.compras', { n: item.contagem })}
              </span>
            }
            valor={formatBRL(item.totalCents)}
            // A busca recebe `merchant` (a chave), nunca `rotulo`: com o
            // rótulo, clicar num grupo renomeado acharia só as compras que
            // receberam aquele nome, e não o estabelecimento inteiro.
            onClick={() => onAbrir(item.merchant)}
            rotuloAcessivel={t('estab.rotulo', {
              nome: item.rotulo,
              valor: formatBRL(item.totalCents),
              n: item.contagem,
            })}
          />
        ))}
      </ul>
    </div>
  )
}
