import { normalizeMerchant } from '../normalize/merchant'
import { extrairCNPJ, type Regra } from './regras'

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
