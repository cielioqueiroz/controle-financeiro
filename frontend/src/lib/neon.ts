import type { createClient } from '@neondatabase/neon-js'

/** Cliente único do Neon: auth + queries da Data API no mesmo objeto.
 *  URLs públicas por design (VITE_) — a proteção é o RLS no banco + o JWT.
 *  Ver docs/SETUP-NEON.md. */
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
const dataApiUrl = env.VITE_NEON_DATA_API_URL
const authUrl = env.VITE_NEON_AUTH_URL

/** O app funciona SEM Neon (modo "importa e vê"). A persistência liga
 *  quando as duas URLs estão configuradas.
 *
 *  **Continua SÍNCRONO de propósito**, e é o que a tela usa para decidir se
 *  desenha o menu de conta ou o botão de sair: são perguntas de renderização,
 *  respondidas por duas variáveis de ambiente, e não têm por que esperar um
 *  download. */
export const neonConfigurado = Boolean(dataApiUrl && authUrl)

type ClienteNeon = ReturnType<typeof createClient>

let promessa: Promise<ClienteNeon> | null = null

/** ## Por que o SDK entra por import DINÂMICO
 *
 *  Ele custa **242 kB** no chunk principal — 23,3% dele, mais que o
 *  `react-dom` —, e quase nada disso é o SDK: é o **`zod`**, que o
 *  `better-auth` arrasta por dentro do `@neondatabase/auth`. O
 *  `medir:peso` mediu: o SDK sozinho dá ~7%.
 *
 *  Nada disso é preciso para a PRIMEIRA PINTURA. A tela de acesso é o que o
 *  app desenha primeiro (`logado` começa `false`), e ela é HTML e CSS: o SDK
 *  só entra em cena quando alguém submete o formulário — ou quando o app vai
 *  confirmar se há sessão. Os dois acontecem depois da pintura.
 *
 *  ⚠️ **A memoização é o ponto.** `obterNeon()` é chamado de dezessete
 *  lugares, e todos podem chamar em paralelo: sem guardar a promessa, o mesmo
 *  chunk seria pedido várias vezes e — pior — existiriam DOIS clientes com
 *  duas sessões em memória. O `getSession` do SDK responde do cache dele
 *  (ver `sessao-remota.ts`), então dois clientes é ter dois caches que
 *  discordam.
 *
 *  ⚠️ **Falha zera a memoização**, como em `domain/pdf/load.ts`: uma queda de
 *  rede não pode condenar a aba a nunca mais conseguir falar com o banco. A
 *  próxima chamada baixa de novo.
 *
 *  A mensagem de um import dinâmico que não chega é `Failed to fetch
 *  dynamically imported module`, e o `chaveDeErro` já a reconhece como
 *  `erro.semConexao` pelo padrão `failed to fetch` — quem falhar aqui lê
 *  "sem conexão" em português, e não um erro de bundler em inglês. */
export function obterNeon(): Promise<ClienteNeon | null> {
  if (!neonConfigurado) return Promise.resolve(null)
  if (!promessa) {
    promessa = import('@neondatabase/neon-js')
      .then(({ createClient }) =>
        createClient({
          auth: { url: authUrl! },
          dataApi: { url: dataApiUrl! },
        }),
      )
      .catch((err: unknown) => {
        promessa = null
        throw err
      })
  }
  return promessa
}

/** Começa a baixar o SDK sem que ninguém espere por ele.
 *
 *  Chamado uma vez pelo `App`, logo depois da primeira pintura: quem vai
 *  digitar e-mail e senha leva alguns segundos, e nesse tempo o chunk já
 *  chegou. Sem isto, o custo do download apareceria inteiro no clique em
 *  "Entrar" — trocaríamos uma primeira pintura mais lenta por um botão que
 *  demora, o que é pior, porque aí a pessoa está esperando.
 *
 *  Engole a falha de propósito: é adiantamento, não requisito. Quem precisa
 *  do cliente de verdade chama `obterNeon()` e trata o erro lá. */
export function aquecerNeon(): void {
  void obterNeon().catch(() => {})
}
