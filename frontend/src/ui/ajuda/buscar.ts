import { normalizar } from '../../domain/consulta'
import type { Dicionario } from '../../i18n/dicionarios/pt'
import type { Topico } from './topicos'

/** Traduz uma chave. É a assinatura do `t` do `useT`, recortada ao que a
 *  busca precisa — assim a função continua pura e testável sem provider. */
type Traduz = (chave: keyof Dicionario) => string

/** Acha os tópicos que contêm o que foi digitado.
 *
 *  ⚠️ **Casa por SUBSTRING, não por palavra inteira.** Foi o pedido, e é o
 *  certo para ajuda: quem digita "categor" está a meio caminho de
 *  "categoria" e de "categorias", e exigir a palavra completa devolveria
 *  nada justamente para quem ainda não sabe o nome da coisa.
 *
 *  Procura no TÍTULO, no CORPO e nos termos escondidos — o corpo entra
 *  porque a dúvida raramente usa a palavra do título: quem quer saber de
 *  competência costuma digitar "mês errado".
 *
 *  Reusa o `normalizar` de `domain/consulta`, o mesmo que a busca de
 *  lançamentos usa. Duas opiniões sobre "o que casa" divergiriam, e a que o
 *  usuário sente é sempre a que não foi corrigida.
 *
 *  Várias palavras se somam com E: "apagar fatura" pede as duas. Ou faria a
 *  segunda palavra alargar o resultado em vez de estreitá-lo, que é o
 *  contrário do que digitar mais significa. */
export function buscarTopicos(topicos: Topico[], termo: string, t: Traduz): Topico[] {
  const palavras = normalizar(termo).split(' ').filter(Boolean)
  if (palavras.length === 0) return topicos

  return topicos.filter((topico) => {
    const alvo = normalizar(
      `${t(topico.titulo)} ${t(topico.corpo)} ${t(topico.termos)}`,
    )
    return palavras.every((p) => alvo.includes(p))
  })
}
