import { formatBRL } from '../domain/normalize/money'
import { categoria, nomeCategoria } from '../domain/categorize/categorias'
import { useT } from '../i18n/IdiomaProvider'
import { LinhaRanking } from './LinhaRanking'
import { MarcaCategoria } from './MarcaCategoria'
import type { TransacaoSalva } from '../persist/puxar'

type Props = {
  /** Já vem cortado e ordenado por `maioresSaidas`. */
  itens: TransacaoSalva[]
  onEditar: (t: TransacaoSalva) => void
}

/** Ranking das maiores despesas do período — a compra única e grande.
 *
 *  Irmã de `TopEstabelecimentos`, com quem divide a linha (`LinhaRanking`)
 *  para que as duas colunas alinhem. A diferença entre elas é a pergunta,
 *  não o desenho: esta acha o empréstimo e a geladeira. */
export function MaioresSaidas({ itens, onEditar }: Props) {
  const { t } = useT()
  if (itens.length === 0) return null

  return (
    <div>
      <p className="rotulo mb-3">{t('maiores.titulo')}</p>
      <ul>
        {itens.map((item, i) => {
          const cat = categoria(item.category_slug ?? 'outros')
          return (
            <LinhaRanking
              key={item.id}
              ordem={i}
              posicao={i + 1}
              titulo={item.label ?? item.description}
              meta={
                <>
                  <MarcaCategoria cor={cat.cor} />
                  <span className="truncate">{nomeCategoria(cat)}</span>
                </>
              }
              valor={formatBRL(item.amount_cents)}
              onClick={() => onEditar(item)}
            />
          )
        })}
      </ul>
    </div>
  )
}
