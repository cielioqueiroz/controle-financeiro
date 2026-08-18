import { neon } from '../lib/neon'

/** Campos que o usuário pode editar numa transação. A `description`
 *  (texto original do banco) é imutável — o apelido vive em `label`. */
export type EdicaoTransacao = {
  label?: string | null
  category_slug?: string
}

/** Atualiza uma transação do usuário (RLS garante que só a dele).
 *  Usado para renomear o estabelecimento e/ou trocar a categoria. */
export async function editarTransacao(id: string, campos: EdicaoTransacao): Promise<void> {
  if (!neon) return
  const { error } = await neon.from('transactions').update(campos).eq('id', id)
  if (error) throw error
}

/** Teto de ids por chamada. A Data API monta o filtro na query string, e uma
 *  correção de estabelecimento frequente alcança facilmente centenas de
 *  linhas. `salvar.ts` já manda listas grandes em `.in('hash', …)` sem
 *  lotear e funciona — mas aquilo é um SELECT, e um 414 num UPDATE deixaria
 *  metade do histórico corrigido e metade não. */
const TAM_LOTE = 200

/** Recategoriza em bloco as transações já gravadas que a regra aprendida
 *  alcança. Devolve quantos ids foram enviados em lotes que voltaram sem
 *  erro — a Data API não informa o número de linhas afetadas sem um `select`
 *  extra, e como os ids saem de uma leitura recente do próprio histórico, a
 *  diferença entre "enviado" e "afetado" só apareceria numa corrida com
 *  outra aba.
 *
 *  Falha alto de propósito: quem chama já gravou a transação em foco, e
 *  engolir o erro aqui faria a tela anunciar "mais 26 corrigidas" sem que
 *  nenhuma tivesse sido. */
export async function recategorizarEmLote(
  ids: string[],
  categoria: string,
): Promise<number> {
  if (!neon || ids.length === 0) return 0

  let atualizadas = 0
  for (let i = 0; i < ids.length; i += TAM_LOTE) {
    const lote = ids.slice(i, i + TAM_LOTE)
    const { error } = await neon
      .from('transactions')
      .update({ category_slug: categoria })
      .in('id', lote)
    if (error) throw error
    atualizadas += lote.length
  }
  return atualizadas
}
