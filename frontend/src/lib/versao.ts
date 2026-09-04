/** Descobre que o site publicou uma versão nova enquanto esta aba estava
 *  aberta.
 *
 *  ## Por que isto existe
 *
 *  Todo push na `main` publica em ~1 min, e cada build gera nomes de arquivo
 *  com hash novo. Uma aba aberta ANTES do deploy segue rodando o JavaScript
 *  velho para sempre — e o velho pede chunks que já não existem no servidor.
 *  O `lib/chunk.ts` trata o sintoma (o import que falha); aqui se trata a
 *  causa: a aba está desatualizada, e ninguém avisou.
 *
 *  O gatilho foi concreto, em 2026-09-04. Uma correção de importação subiu
 *  para produção e a pergunta natural foi "como faço todo mundo pegar a
 *  versão nova?". A resposta que parece óbvia — **deslogar todo mundo** —
 *  não funciona: derrubar a sessão leva a aba à tela de entrar DENTRO do
 *  bundle velho, que continua em memória. A pessoa entra de novo, no mesmo
 *  código antigo, com o mesmo defeito. O que troca o código é recarregar a
 *  página, e é só isso.
 *
 *  ## Como se sabe
 *
 *  O `index.html` é o único arquivo sem hash no nome — é ele que aponta para
 *  o bundle da vez. Buscá-lo com `cache: 'no-store'` e comparar o `src` do
 *  módulo de entrada com o que ESTA aba carregou responde a pergunta sem
 *  precisar de endpoint próprio, de service worker nem de número de versão
 *  para manter.
 *
 *  Em desenvolvimento o Vite serve `/src/main.tsx` sempre com o mesmo
 *  caminho, então a comparação nunca acusa nada — que é o comportamento
 *  desejado, e não um caso a tratar. */

/** O módulo de entrada que ESTA aba carregou. */
export function moduloDaAba(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
  return script?.src ? new URL(script.src, window.location.href).pathname : null
}

/** O módulo de entrada que o servidor está publicando AGORA.
 *
 *  Devolve `null` em qualquer tropeço — offline, 500, HTML inesperado. Não
 *  saber é o estado normal de quem está sem rede, e "não sei" nunca pode
 *  virar "há versão nova": recarregar por engano é perder o que a pessoa
 *  está fazendo. */
export async function moduloNoServidor(): Promise<string | null> {
  try {
    const resposta = await fetch(window.location.origin + '/', {
      cache: 'no-store',
      headers: { Accept: 'text/html' },
    })
    if (!resposta.ok) return null
    const html = await resposta.text()
    const m = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i)
    return m ? new URL(m[1], window.location.href).pathname : null
  } catch {
    return null
  }
}

/** `true` só quando se tem CERTEZA de que a aba está velha. */
export async function abaEstaVelha(): Promise<boolean> {
  const aqui = moduloDaAba()
  if (!aqui) return false
  const la = await moduloNoServidor()
  if (!la) return false
  return la !== aqui
}
