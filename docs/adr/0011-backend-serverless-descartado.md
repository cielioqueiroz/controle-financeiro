# O backend serverless foi descartado; o cliente fala com a Data API

A Fatia 1b — mover a leitura e a escrita para Vercel Functions — foi escrita em
2026-08-28 e **descartada em 2026-08-31 sem nunca ter sido commitada**. Eram
quatro arquivos (`api/data.ts`, `backend/api/{data,_auth,_db}.ts`, ~72 linhas) e
três dependências novas. O cliente continua falando direto com a Data API do
Neon, com RLS, como sempre falou.

O motivo do descarte não é a dificuldade: é que **o backend duplicava a
autorização que o banco já faz**. O handler recebia o `Bearer`, perguntava a
sessão ao servidor de auth da Neon, extraía o `sub` e o injetava por
`set_config('request.jwt.claims')` numa role sem `BYPASSRLS` — para então deixar
o RLS decidir, exatamente como decide hoje quando o navegador fala com a Data
API. O ganho era uma indireção; o custo, três.

1. **Uma superfície de ataque nova.** O handler despachava por um campo `action`
   sobre SQL escrito à mão. Toda consulta que a tela precisasse viraria mais um
   `if` nesse arquivo, e o dia em que um deles esquecesse o `set_config` seria um
   vazamento entre usuários que o RLS não pegaria — porque a role já teria a
   conexão aberta sem claims.
2. **A `DATABASE_URL` que nunca veio.** A fatia estava bloqueada desde 2026-08-07
   por uma credencial. Três semanas de código escrito contra um bloqueio que
   ninguém removeu é o sinal de que o bloqueio não incomodava.
3. **`@vercel/node` trouxe 5 vulnerabilidades** (`path-to-regexp` e `undici`,
   3 `high`), e o conserto exigia um major com quebra. Removida a dependência,
   `npm audit` foi de 5 falhas a **zero**.

## Consequences

- **`persist/` continua sendo o adaptador do Neon**, e o [ADR-0010](./0010-cqrs-e-integridade-de-dados.md)
  segue valendo: `aplicacao/consultas` e `aplicacao/comandos` são a fronteira das
  telas, e é lá que um backend entraria se um dia entrasse — não espalhado por
  `persist/`.
- **O que protege o dado continua sendo login + RLS + JWT**, mais os gatilhos de
  integridade entre usuários da migração `0003`. Não há camada intermediária que
  possa errar sozinha.
- **O gatilho para reabrir é uma capacidade que o navegador não tem**, não uma
  preferência de arquitetura: agendamento, webhook de banco, ou processar
  documento fora da aba. Nenhuma delas existe hoje — o app é retrospectivo
  ([ADR-0005](./0005-o-app-e-retrospectivo.md)) e lê o PDF no cliente
  ([ADR-0003](./0003-o-pdf-e-lido-no-navegador.md)).
- **`vercel.json` mantém `api/` na exclusão do rewrite.** Não custa nada e evita
  que uma pasta `api/` futura seja servida como `index.html` sem ninguém entender
  por quê.
