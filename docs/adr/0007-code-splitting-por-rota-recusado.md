# Code-splitting por rota: medido e recusado

Fatiar as rotas em chunks separados é a otimização óbvia para um SPA com sete
páginas, e foi medida com build A/B em 2026-08-13: rende **2,6% de gzip**. O peso
não está nas páginas — está no SDK do Neon, que responde por **39% da primeira
pintura**, precisa carregar no boot para decidir se há sessão, e importa `zod`
estaticamente. Recusada.

## Consequences

- **Não reabrir sem número novo.** A conclusão é de medição, não de opinião; quem
  quiser reverter precisa trazer outra medição.
- O custo não é zero: rota fatiada cria uma **falha de navegação depois de cada
  deploy**, porque o chunk que a aba aberta tenta buscar já não existe no servidor.
  Pagar isso por 2,6% seria um mau negócio mesmo se o ganho fosse real.
- O caminho que teria efeito é reduzir ou adiar o SDK do Neon — trabalho de outra
  ordem de grandeza, e hoje bloqueado por [ADR-0008](./0008-o-login-nao-tem-rede-de-testes.md).

## Número novo (2026-09-06): o alvo não é o SDK, é o `zod`

A recusa segue valendo — ninguém trouxe medição contra ela. Mas a frase "o SDK
do Neon responde por 39%" nomeava o alvo errado, e isso importa porque ela é o
que aponta para onde trabalhar. Medindo a atribuição por sourcemap
(`npm run medir:peso`), num chunk de 1033 kB minificado:

| origem | fatia | | origem | fatia |
|---|---|---|---|---|
| código do app | 29,8% | | motion-dom | 9,0% |
| **`zod`** | **23,4%** | | framer-motion | 3,6% |
| react-dom | 17,4% | | sonner | 3,2% |

O SDK do Neon **sozinho** — `better-auth`, `@neondatabase/auth`,
`@neondatabase/postgrest-js`, `@supabase/postgrest-js`, `@better-fetch/fetch`,
`better-call` — soma **~7%**. O `zod` que ele arrasta dá 23,4%: **três vezes e
meia todo o resto do SDK junto.** O ADR original já dizia que o SDK "importa
`zod` estaticamente"; o que faltava era a proporção.

Duas consequências práticas:

1. **Adiar o SDK inteiro rende pouco se o `zod` continuar no boot.** E há uma
   pista de que dá para separá-los: `lib/sessao-remota.ts` já pergunta ao
   `/get-session` com `fetch` puro, sem tocar no SDK. Se a decisão de "há
   sessão?" no boot puder sair por ali, o SDK — e o `zod` — passam a ser
   carregados só quando alguém de fato entra.
2. **A animação pesa mais que o SDK.** `motion-dom` + `framer-motion` = 12,6%,
   contra os ~7% do SDK. Não é argumento para tirar a animação; é para parar de
   tratar o SDK como o único suspeito.

⚠️ São bytes **minificados**, não gzip: bibliotecas comprimem em taxas
diferentes, então isto ordena candidatos, não promete economia. E a fatia de CSS
fica de fora (o plugin do Tailwind não gera sourcemap).
