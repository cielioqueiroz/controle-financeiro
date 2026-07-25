/** Locale de formatação ativa (moeda e datas). Estado de módulo, ajustado
 *  pelo IdiomaProvider ao trocar de idioma. O domínio NÃO importa i18n — só
 *  expõe o setter; quem chama é a camada de UI. Default pt-BR mantém os
 *  testes atuais (que fixam o formato brasileiro) verdes. */
export type LocaleBCP47 = 'pt-BR' | 'en-US' | 'es-ES'

let ativo: LocaleBCP47 = 'pt-BR'

export function definirLocale(l: LocaleBCP47): void {
  ativo = l
}

export function localeAtual(): LocaleBCP47 {
  return ativo
}
