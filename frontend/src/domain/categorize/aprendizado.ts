import { normalizeMerchant } from '../normalize/merchant'
import { casaRegra, extrairCNPJ, type Regra } from './regras'

/** Cria uma regra do usuário a partir de uma correção manual.
 *
 *  Corrigir a categoria de uma transação ensina o app para sempre: a
 *  próxima ocorrência do mesmo estabelecimento já entra certa. Usa o CNPJ
 *  quando há (chave estável); senão, o merchant normalizado. Prioridade
 *  alta (1000) para vencer qualquer regra global. Ver spec, "Aprendizado".
 *
 *  Pede só `description` (e não uma RawTransaction inteira) porque quem
 *  corrige é o editor de compras, que trabalha com uma TransacaoSalva —
 *  e a regra sai da descrição, nada mais. */
export function regraDaCorrecao(tx: { description: string }, categoria: string): Regra {
  const cnpj = extrairCNPJ(tx.description)
  if (cnpj) {
    return { padrao: cnpj, tipo: 'cnpj', categoria, prioridade: 1000 }
  }
  return {
    padrao: normalizeMerchant(tx.description),
    tipo: 'contains',
    categoria,
    prioridade: 1000,
  }
}

/** Mescla regras do usuário com as globais, do usuário primeiro (maior
 *  prioridade). Deduplica: uma correção nova do mesmo padrão substitui a
 *  anterior. */
export function mesclarRegras(usuario: Regra[], globais: Regra[]): Regra[] {
  const vistos = new Set<string>()
  const resultado: Regra[] = []
  for (const r of [...usuario, ...globais]) {
    const chave = `${r.tipo}:${r.padrao}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    resultado.push(r)
  }
  return resultado
}

/** Transação já gravada, reduzida ao que a regra precisa enxergar. */
export type TxAlcancavel = {
  id: string
  description: string
  category_slug: string | null
}

/** Quais transações JÁ GRAVADAS esta regra corrigiria.
 *
 *  Existe porque aprender a regra só arrumava o futuro. A categoria mora numa
 *  coluna, decidida na importação, e nada a relê: corrigir "ATACADAO" hoje
 *  acertava as próximas compras e deixava as 26 já salvas na categoria errada.
 *  O toast dizia "vou lembrar desta categoria" — verdade pela metade.
 *
 *  Duas exclusões, cada uma por um motivo: a transação em edição (quem chama
 *  já a gravou por conta própria) e quem já está na categoria de destino (um
 *  update sem efeito que só inflaria o número mostrado na prévia).
 *
 *  Casa pela `description`, o texto do banco — nunca pelo `label`. O rótulo é
 *  do usuário, e renomear UMA compra não pode mudar o alcance de uma regra. */
export function alcancadasPelaRegra<T extends TxAlcancavel>(
  regra: Regra,
  txs: T[],
  excetoId: string,
): T[] {
  return txs.filter(
    (t) =>
      t.id !== excetoId &&
      (t.category_slug ?? 'outros') !== regra.categoria &&
      casaRegra(regra, t.description),
  )
}
