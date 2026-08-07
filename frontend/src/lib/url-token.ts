/** O token de redefinição de senha chega pela URL, no link do e-mail.
 *  Isolado aqui para ser testável sem navegador — e porque o formato é do
 *  Better Auth, não nosso: se ele mudar, muda só este arquivo. */

const PARAMETRO = 'token'

/** Token da query string, ou null. Aceita com ou sem '?' inicial.
 *  Valor em branco conta como ausente: '?token=' é lixo, não credencial. */
export function lerTokenDaUrl(search: string): string | null {
  const token = new URLSearchParams(search).get(PARAMETRO)
  return token?.trim() ? token : null
}

/** Tira o token da barra de endereços sem recarregar a página. Sem isto, um
 *  F5 reenviaria um token já gasto e o usuário veria um erro que não é dele. */
export function limparTokenDaUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete(PARAMETRO)
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}
