import { obterNeon } from '../lib/neon'
import { consultaDeRegraValida, type Regra } from '../domain/categorize/regras'

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
  const neon = await obterNeon()
  if (!neon) return []
  const { data, error } = await neon
    .from('merchant_rules')
    .select('padrao, match_type, categoria, prioridade')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as LinhaRegra[]).map((r) => ({
    padrao: r.padrao,
    tipo: r.match_type === 'consulta' ? 'consulta' : r.match_type === 'cnpj' ? 'cnpj' : 'contains',
    categoria: r.categoria,
    prioridade: r.prioridade,
  }))
}

/** A RPC substitui o MESMO padrão e tipo numa transação, sob RLS. Falhar
 *  ao inserir não pode apagar a regra anterior. Requer a migração 0010. */
export async function salvarRegra(regra: Regra): Promise<void> {
  if (regra.tipo === 'consulta' && (!consultaDeRegraValida(regra.padrao) || !regra.categoria.trim())) {
    throw new Error('Condição de regra inválida')
  }
  const neon = await obterNeon()
  if (!neon) {
    if (regra.tipo === 'consulta') throw new Error('Persistência indisponível')
    return
  }
  const { error } = await neon.rpc('salvar_regra_atomica', {
    p_regra: {
      padrao: regra.padrao,
      match_type: regra.tipo,
      categoria: regra.categoria,
      prioridade: regra.prioridade,
    },
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
  const neon = await obterNeon()
  if (!neon) return
  const tipo = regra.tipo
  const { error } = await neon
    .from('merchant_rules')
    .delete()
    .eq('padrao', regra.padrao)
    .eq('match_type', tipo)
  if (error) throw error
}
