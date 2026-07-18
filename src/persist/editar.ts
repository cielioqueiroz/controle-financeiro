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
