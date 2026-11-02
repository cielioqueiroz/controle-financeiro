/** Como a descrição do banco aparece na TELA. A Descrição gravada não muda:
 *  é ela que se audita contra o PDF, e a chave do estabelecimento, as regras
 *  e o hash de dedupe leem o texto cru. Isto é só a leitura.
 *
 *  Só desce a caixa de quem GRITA: texto com alguma minúscula já foi escrito
 *  por alguém (o Nubank, por exemplo, manda "Transferência recebida") e fica
 *  como está. */

const MINUSCULA = /\p{Ll}/u
const VOGAL = /[AEIOUYÁÀÂÃÉÊÍÓÔÕÚÜ]/

/** Siglas que têm vogal e por isso escapariam da regra do "sem vogal". */
const SIGLAS = new Set(['TED', 'DOC', 'IOF', 'IPVA', 'IPTU', 'INSS', 'CDB', 'LCI', 'LCA'])

const CONECTIVOS = new Set([
  'a', 'o', 'as', 'os', 'e', 'de', 'da', 'do', 'das', 'dos',
  'em', 'na', 'no', 'nas', 'nos', 'com', 'para', 'por',
])

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function palavra(trecho: string, depoisDePonto: boolean, conectivoPossivel: boolean): string {
  const minusculo = trecho.toLowerCase()
  // "AMAZON.COM.BR" é endereço; "S.A." continua sigla, por isso o mínimo de 2.
  if (depoisDePonto && trecho.length >= 2) return minusculo
  if (SIGLAS.has(trecho)) return trecho
  // "MP", "SP", "BR", "CPF": sem vogal não se pronuncia, então é sigla.
  if (!trecho.includes("'") && !VOGAL.test(trecho)) return trecho
  if (conectivoPossivel && CONECTIVOS.has(minusculo)) return minusculo
  // "D'AVILA" → "D'Avila", mas "DONALD'S" → "Donald's".
  return minusculo
    .split("'")
    .map((p, i) => (i > 0 && p.length === 1 ? p : capitalizar(p)))
    .join("'")
}

export function caixaDeTitulo(texto: string): string {
  if (MINUSCULA.test(texto)) return texto
  let primeira = true
  return texto
    .split(/(\s+)/)
    .map((token) => {
      if (token.trim() === '') return token
      // Palavra com dígito costuma ser código de terminal ou de pedido.
      const saida = /\d/.test(token)
        ? token
        : token.replace(/\p{Lu}+(?:'\p{Lu}+)*/gu, (trecho, pos: number) =>
            palavra(trecho, token[pos - 1] === '.', !primeira && trecho === token),
          )
      primeira = false
      return saida
    })
    .join('')
}

/** O nome de uma transação na tela: o rótulo do usuário como ele escreveu,
 *  senão a descrição do banco em caixa de título. */
export function nomeExibido(tx: { label: string | null; description: string }): string {
  return tx.label ?? caixaDeTitulo(tx.description)
}
