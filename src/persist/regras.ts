import { neon } from '../lib/neon'
import type { Regra } from '../domain/categorize/regras'

/** Regras de categorização aprendidas com as correções do usuário.
 *
 *  A tabela `merchant_rules` e a lógica de domínio existiam desde o schema
 *  inicial, mas nada as ligava: o app categorizava só pelas regras globais
 *  e esquecia toda correção. Este módulo é a ponte que faltava.
 *
 *  Como toda leitura aqui, o RLS escopa ao usuário logado — não mandamos
 *  nem filtramos por `user_id`. */

type LinhaRegra = {
  padrao: string
  match_type: string
  categoria: string
  prioridade: number
}

/** Todas as regras do usuário, mais recentes primeiro (é a ordem que
 *  `mesclarRegras` usa para desempatar: correção nova vence a antiga).
 *  Nunca lança: sem banco ou com falha de rede, devolve vazio e o app
 *  segue com as regras globais. */
export async function puxarRegras(): Promise<Regra[]> {
  if (!neon) return []
  const { data, error } = await neon
    .from('merchant_rules')
    .select('padrao, match_type, categoria, prioridade')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as LinhaRegra[]).map((r) => ({
    padrao: r.padrao,
    tipo: r.match_type === 'cnpj' ? 'cnpj' : 'contains',
    categoria: r.categoria,
    prioridade: r.prioridade,
  }))
}

/** Grava a regra aprendida. Apaga antes as do MESMO padrão e tipo: sem
 *  isso, corrigir o mesmo estabelecimento várias vezes acumularia linhas
 *  concorrentes e a categoria valendo dependeria da ordem de leitura.
 *  Feito na camada de persistência (e não por índice único) para não exigir
 *  uma migração nova — a limpeza é escopada pelo RLS ao próprio usuário. */
export async function salvarRegra(regra: Regra): Promise<void> {
  if (!neon) return
  const tipo = regra.tipo === 'cnpj' ? 'cnpj' : 'contains'
  await neon.from('merchant_rules').delete().eq('padrao', regra.padrao).eq('match_type', tipo)
  const { error } = await neon.from('merchant_rules').insert({
    padrao: regra.padrao,
    match_type: tipo,
    categoria: regra.categoria,
    prioridade: regra.prioridade,
  })
  if (error) throw error
}

/** Esquece uma regra aprendida. Simétrico do `salvarRegra`: apaga pelo par
 *  (padrão, tipo), que é o que identifica a regra na prática — o insert já
 *  garante que existe no máximo uma linha por par.
 *
 *  Existe porque, até agora, o aprendizado era irreversível e invisível: o
 *  app decorava a correção e o usuário não tinha como ver nem desfazer. */
export async function apagarRegra(regra: Pick<Regra, 'padrao' | 'tipo'>): Promise<void> {
  if (!neon) return
  const tipo = regra.tipo === 'cnpj' ? 'cnpj' : 'contains'
  const { error } = await neon
    .from('merchant_rules')
    .delete()
    .eq('padrao', regra.padrao)
    .eq('match_type', tipo)
  if (error) throw error
}
