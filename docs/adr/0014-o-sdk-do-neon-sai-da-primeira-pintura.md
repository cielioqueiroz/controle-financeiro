# O SDK do Neon sai da primeira pintura, e quem decide a tela é um `fetch` puro

O `@neondatabase/neon-js` custava **242 kB** no chunk principal — 23,3% dele,
mais que o `react-dom`. Quase nada disso é o SDK: é o **`zod`**, que o
`better-auth` arrasta por dentro do `@neondatabase/auth`. O `medir:peso` já
tinha corrigido o ADR-0007 sobre isso — o SDK sozinho dá ~7%.

Ele agora entra por **import dinâmico** (`obterNeon()`), e a primeira pintura
não o espera.

| | antes | depois |
|---|---|---|
| chunk principal | 1.037 kB | **694 kB** |
| gzip | ~304 kB | **218 kB** |

## A objeção não era técnica, e por isso ela decidia

Tirar o SDK da primeira pintura é fácil. O problema é que **quem decide se a
tela é a de entrar ou a do Painel é a resposta de "há sessão?"** — e essa
pergunta era feita ao SDK. Adiar o SDK adiaria a decisão: quem já está logado
veria a tela de entrar por **mais** tempo do que antes.

Isso não se resolve por medição de bytes, e piscada é exatamente o que o script
inline do `index.html` existe para evitar no tema. Trocar 242 kB por uma piscada
maior seria mau negócio, e foi por isso que este item ficou parado na fila com o
rótulo de "decisão de produto".

## A saída: a pergunta não precisa do SDK

`GET /get-session` é uma requisição HTTP com o cookie da sessão, e o
`lib/sessao-remota.ts` já a fazia por `fetch` puro — ele existe desde 09-04 para
não perguntar ao cache do SDK se a sessão morreu. Ganhou um irmão,
`usuarioDaSessao()`, que devolve do **mesmo endpoint** o que a tela precisa para
se desenhar inteira: nome, e-mail e se o e-mail foi confirmado.

Na montagem saem **duas** perguntas em paralelo:

1. `usuarioDaSessao()` — uma requisição, sem SDK. Chega primeiro e já troca a
   tela.
2. `checarSessao()` — o SDK de verdade, que é quem assina as consultas com o
   JWT. **Sobrescreve** o que a primeira disse.

A segunda vence por construção: ela chama `setLogado` com o que o SDK
respondeu, sem consultar o que está na tela. Se as duas discordarem — sessão que
morreu entre uma e outra —, quem fica é o SDK.

## O resultado, medido

`scripts/medir-piscada.py`, 3G emulado, sessão existente, mediana de 5:

| medida | antes | depois | ganho |
|---|---|---|---|
| a tela aparece | 13.840 ms | 9.867 ms | **−3.973 ms** |
| o Painel aparece | 14.214 ms | 10.234 ms | **−3.980 ms** |
| **a piscada** | 382 ms | 366 ms | −16 ms |

**A piscada não aumentou** — encolheu de leve, dentro do ruído — e o app aparece
**quatro segundos antes** em 3G. A objeção caiu por medição, não por
argumentação.

## Consequences

- **Obter o cliente virou assíncrono**, e dezessete arquivos passaram a
  `await obterNeon()`. A promessa é **memoizada**: sem isso existiriam dois
  clientes com dois caches de sessão que discordam. Falha zera a memoização,
  como em `domain/pdf/load.ts` — uma queda de rede não pode condenar a aba.
- **`neonConfigurado` continua síncrono**, e é ele que a tela usa para decidir se
  desenha o menu de conta. São perguntas de renderização respondidas por duas
  variáveis de ambiente: não têm por que esperar um download.
- **`registrarFalha` continua síncrona**, porque o contrato dela é não fazer
  ninguém esperar — quem chama está no meio de um tratador de erro. O guard dela
  virou `neonConfigurado`, e só o envio espera o SDK.
- **O `aquecerNeon()` do `App` começa o download logo depois da primeira
  pintura**, sem ninguém esperando: quem vai digitar e-mail e senha leva alguns
  segundos, e nesse tempo o chunk chega. Sem ele, o custo apareceria inteiro no
  clique em "Entrar" — e aí a pessoa está esperando, que é pior.
- **Um import dinâmico pode falhar**, e o que era impossível passou a ser
  possível. A mensagem (`Failed to fetch dynamically imported module`) já casa o
  padrão `failed to fetch` do `chaveDeErro`, então quem falhar lê "sem conexão"
  em português — não um erro de bundler em inglês.
- **Isto é mexer em autenticação**, e a
  [ADR-0008](./0008-o-login-nao-tem-rede-de-testes.md) manda isso para o roteiro
  manual. Foi feito com a rede que nasceu no mesmo dia: `npm run medir:login`,
  cinco cenários contra um Auth de mentira, verde antes e depois. O que o
  medidor não cobre (o Neon de verdade, o OAuth do Google, o RLS) continua
  pedindo o roteiro manual — **este ADR não revoga aquele**.
