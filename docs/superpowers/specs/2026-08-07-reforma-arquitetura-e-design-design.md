# Reforma: arquitetura, backend real, páginas e design novo

> Spec de 2026-08-07. Quatro fatias independentes, entregues em ordem.
> Origem: pedido do usuário em 2026-08-07 (barra de rolagem, gráficos
> interativos, páginas, design novo, separar frontend/backend, endurecer o
> servidor, tirar o seletor de idioma).

## Por que quatro fatias e não um commit

Backend real, reorganização de pastas, navegação por páginas e redesenho
completo são projetos independentes. Entregues juntos, uma quebra em produção
não teria como ser atribuída a uma causa. Cada fatia abaixo termina com o app
funcionando e a suíte verde.

## Decisões tomadas com o usuário (2026-08-07)

| Pergunta | Decisão |
|---|---|
| nginx/apache | **Descartado.** O app está na Vercel; não há servidor próprio nem painel de banco exposto. Endurecer o `vercel.json`. |
| Separar frontend/backend | **Backend de verdade**, não só mover pastas. O usuário escolheu ciente de que reescreve a camada `persist/`. |
| Direção visual | Livre, decidida aqui. Requisitos dados: barra de navegação, filtros, "totalmente diferente" do atual, nada que remeta a IA. |
| Poupança/investimentos | **Fora**, como já estava decidido na rodada de 2026-08-05. |

---

## Fatia 1 — Arquitetura e backend real

### O problema que resolve

Hoje o navegador fala direto com a Neon Data API. As URLs vão no bundle como
`VITE_*` e a única fronteira é o RLS. Funciona, mas: qualquer endurecimento de
regra tem de ser feito em SQL, não há onde pôr lógica de servidor, e a
superfície pública é o banco inteiro filtrado por policy.

### Estrutura de pastas

```
frontend/            app React/Vite (o src/ de hoje, movido inteiro)
  src/
  index.html
  vite.config.ts
backend/
  api/               Vercel Functions — o backend
    transacoes.ts    GET (lista), PATCH (editar)
    documentos.ts    GET (painel), DELETE (um ou todos)
    importar.ts      POST (salva documento + transações, transacional)
    categorias.ts    GET, POST, PATCH, DELETE
    regras.ts        GET, POST, DELETE
  lib/
    db.ts            pool de conexão (@neondatabase/serverless)
    autenticar.ts    verificação do JWT por JWKS
    comRls.ts        transação com claims injetados (o guarda)
  db/migrations/     os .sql de hoje, movidos de neon/
scripts/             ferramentas locais, permanece na raiz
tests/fixtures/      permanece na raiz (usado pelos dois lados)
```

`package.json` na raiz com workspaces (`frontend`, `backend`). A Vercel já
entende `backend/api/*` como funções serverless por convenção de pasta; o
`vercel.json` aponta o build do frontend.

### O guarda de RLS — o ponto crítico

Conectar como admin e filtrar por `user_id` em JavaScript trocaria uma
fronteira do banco por uma fronteira de código: um `where` esquecido vazaria
dado entre contas, sem nada embaixo para segurar. **O RLS continua valendo.**

Toda query passa por `comRls(jwt, fn)`, que:

1. abre transação,
2. `SELECT set_config('request.jwt.claims', $1, true)` com os claims do JWT
   verificado (o `true` faz valer só na transação),
3. roda a função com uma role **sem BYPASSRLS**,
4. commita ou faz rollback.

> ⚠️ **Segunda incerteza da Task 0.** `authenticated` é a role que já carrega
> os GRANTs do schema 0001, mas ela foi criada pela Data API e pode não ser
> uma role **de login** (sem `LOGIN`/senha, não serve numa connection string).
> A Task 0 confirma isso. Se não servir, o plano cria uma role de aplicação
> com `LOGIN`, `NOBYPASSRLS` e `GRANT authenticated TO app` — o que exige uma
> migração `0003`. É por isso que a Task 0 precede o código: ela decide se há
> migração de banco nesta fatia, e migração é passo manual do usuário no
> console do Neon.

As policies do schema 0001 não mudam uma linha: continuam avaliando
`(select auth.user_id())::uuid = user_id`.

> ⚠️ **Verificação obrigatória antes de construir (Task 0 do plano).**
> `auth.user_id()` é provida hoje pela Data API. Não está confirmado que ela
> existe e lê `request.jwt.claims` sob conexão direta por connection string.
> Se não existir, o plano usa `current_setting('request.jwt.claims', true)`
> diretamente numa função própria com o mesmo nome e assinatura — o que
> mantém as policies intactas. **Nada da Fatia 1 é escrito antes desta
> resposta**, porque ela decide se há ou não migração de banco envolvida.

### Autenticação

Não mexe no que funciona: o login continua sendo Neon Auth pelo cliente
(`neon.auth.*` em `Auth.tsx`, `ContaMenu.tsx`, `EditarPerfil.tsx` ficam como
estão). O que muda é que o JWT passa a ser **enviado ao nosso backend** no
header `Authorization`, e `autenticar.ts` o verifica contra o JWKS da Neon
(cacheado). JWT inválido ou ausente → 401, sem tocar o banco.

### Variáveis de ambiente

| Antes | Depois |
|---|---|
| `VITE_NEON_DATA_API_URL` (pública, no bundle) | removida |
| `VITE_NEON_AUTH_URL` (pública, no bundle) | **permanece** — o login é no cliente |
| — | `DATABASE_URL` (servidor, connection string com role `authenticated`) |
| — | `NEON_JWKS_URL` (servidor, para verificar o JWT) |

A connection string nunca é `VITE_`, então não entra no bundle.

### Impacto no código existente

Os 6 arquivos de `persist/` que tocam a rede trocam `neon.from(...)` por
`fetch('/api/...')`, **preservando a assinatura de cada função exportada**.
`agrupar.ts`, `saldos.ts` e `aberto.ts` são puros, não tocam rede e não mudam
— junto com todo o `domain/`, são a maior parte dos 504 testes, que seguem
válidos.

`lib/neon.ts` perde a parte de `dataApi` e mantém só `auth`.

### Erros

O backend responde `{ erro: string }` com status HTTP. O cliente ganha
`lib/api.ts`, um `fetch` único que: anexa o JWT, converte não-2xx em `Error`
com a mensagem do corpo, e trata 401 deslogando (a sessão expirou). Isso
substitui o `{ data, error }` do neon-js, que hoje cada arquivo desembrulha
à mão.

### Testes

- `comRls` ganha teste de integração que **prova o isolamento**: dois usuários,
  cada um vê só o seu. É o teste que justifica a fatia inteira — sem ele, a
  troca de fronteira é uma afirmação, não um fato.
- `autenticar` testado com JWT expirado, assinatura errada e ausente.
- Cada handler de `api/` testado com o banco mockado.
- Os testes de `persist/` passam a mockar `fetch` em vez do neon-js.

---

## Fatia 2 — Páginas e navegação

### Rotas

Barra superior fixa, espelhando o `docs/img/exemplo.jpeg` **sem Poupança**:

| Rota | Página | Conteúdo |
|---|---|---|
| `/` | Painel | tiles, gráficos, filtros — a visão geral |
| `/lancamentos` | Lançamentos | lista completa, busca, filtro por categoria |
| `/faturas` | Faturas | documentos importados, quitação, apagar |
| `/importar` | Importação | dropzone e prévia |
| `/categorias` | Categorias | editar as suas + regras aprendidas |
| `/recorrencias` | Recorrências | séries detectadas e alertas |
| `/datas` | Datas | calendário do mês, vencimentos típicos |

React Router. `vercel.json` ganha rewrite de SPA (`/(.*)` → `/index.html`),
senão recarregar em `/faturas` dá 404 na Vercel.

### Estado dos filtros na URL

Período, banco, categoria e busca viram query string (`?p=mes&ref=2026-09&banco=nubank`).
Recarregar não perde o contexto, e um link leva outra pessoa ao mesmo recorte.
Uma função pura `lerFiltros(search)` / `escreverFiltros(f)`, testada, evita
espalhar parsing de URL pelos componentes.

### Como isso mata a barra de rolagem

A barra de `Dashboard.tsx:681` — hoje em `src/ui/`, depois da Fatia 1 em
`frontend/src/ui/` — (`xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto`) foi posta em 2026-08-05
porque a coluna sticky passou a ficar mais alta que a janela — com donut,
maiores saídas, evolução, recorrências e compromissos empilhados. Distribuído
o conteúdo em sete páginas, **nenhuma coluna volta a ser mais alta que a
janela**, e a regra sai sem reintroduzir o bug original (conteúdo inalcançável
embaixo do sticky).

Isso também resolve o "informações ficando atrás da barra": não há mais barra.

### Dados

O carregamento continua sendo um `puxarTudo()` único (volumes de uso pessoal),
agora num contexto React que as sete páginas consomem — não sete requisições.

---

## Fatia 3 — Design novo e gráficos interativos

### O que sai

Café escuro, âmbar/dourado, cantos de 16px, brilho, grão de papel e as
partículas three.js. As partículas levam junto **515 kB** de bundle. O visual
atual é o padrão de dashboard escuro que o usuário identificou como "cara de
IA", e é exatamente o que a fatia troca.

### O que entra

**Tipografia** — IBM Plex Sans (interface), IBM Plex Mono (tabelas e valores
pequenos, tabular), **Instrument Serif nos números grandes**. Número-herói em
serifada de alto contraste é a decisão que mais distancia o resultado de um
template: lê como relatório financeiro impresso.

**Cor** — azul-tinta como marca (sai o âmbar); verde-garrafa e vermelho-tijolo
como semântica de entrada/saída. A paleta categórica dos gráficos é montada
pela skill `dataviz` e **tem contraste medido** nos dois temas, como já foi
feito em 2026-08-05 — a tabela de contrastes daquela rodada é refeita para os
tokens novos, não herdada.

**Forma** — raio de 2–4px, réguas de 1px, sem sombra difusa, sem gradiente,
densidade alta. Barra de navegação superior e barra de filtros próprias.

### Gráficos

SVG próprio animado com `motion` (já é dependência), **não** biblioteca de
gráficos: o projeto já desenha SVG à mão, evita mais uma dependência, e
gráfico com aparência padrão de biblioteca é justamente a aparência a evitar.

| Gráfico | Onde | Interação |
|---|---|---|
| Donut de categorias | Painel | hover destaca fatia, clique filtra |
| Entradas × Saídas, 12 meses | Painel | tooltip por mês, clique navega |
| Linha de evolução do saldo | Painel | tooltip com valor e mês |
| Heatmap do mês | Datas | hover mostra o dia |
| Sparkline | tiles | sem interação, contexto apenas |

Todos com acesso por teclado (foco, setas) e `aria-label` descrevendo o dado —
não só a forma. Respeitam `prefers-reduced-motion`.

### Testes

Cada gráfico tem teste de que **renderiza o dado certo** (valores, não pixels)
e de que a interação dispara o callback. Testes de componentes que deixam de
existir são removidos junto, não adaptados à força.

---

## Fatia 4 — Acabamento e segurança

### Seletor de idioma

`<SeletorIdioma/>` sai do cabeçalho. **`src/i18n/` fica inteiro**, o
`IdiomaProvider` continua envolvendo o app e `useT()` segue funcionando, fixo
em pt. Reativar é devolver uma linha ao cabeçalho. Os dicionários en/es e os
testes de i18n permanecem — apagá-los é que tornaria a volta cara.

### CSP completa

Hoje o `vercel.json` só tem `frame-ancestors 'none'`. A CSP completa ficou de
fora em 2026-07-29 por um motivo registrado: quebraria Google Fonts, o worker
do pdf.js e a API do Neon, e `vercel.json` **não vale em preview local**.

O motivo não sumiu, então a CSP é construída **medindo em preview deploy**,
não localmente: publicar em `Report-Only` primeiro, ler as violações, e só
então promover a bloqueante. Fontes passam a ser servidas do próprio domínio
(elimina o `font-src` externo e uma ida de rede), o que a Fatia 3 já faz ao
trocar a família tipográfica.

Também: negar acesso a `/.git`, `/.env*`, `/backend`, `/scripts` por rewrite
para 404 — defesa em profundidade, já que a Vercel não serve essas pastas de
qualquer forma.

---

## O que este spec deliberadamente NÃO faz

- **Poupança e investimentos** — pedido explicitamente de fora.
- **nginx/apache** — descartado com o usuário; não há servidor próprio.
- **Trocar o provedor de auth** — o Neon Auth continua; a fatia 1 só põe um
  porteiro na frente do banco.
- **Novos bancos/parsers** — a fila de 2026-07-23 segue bloqueada por falta de
  amostra, e nada aqui a toca.

## Riscos registrados

1. **`auth.user_id()` sob conexão direta** — incerteza real, resolvida na
   Task 0 da Fatia 1 antes de qualquer código.
2. **Suíte vermelha no meio do caminho** — as fatias 1 e 3 invalidam testes de
   telas que deixam de existir. Esperado; cada fatia termina verde.
3. **`npm test` não checa tipos** (armadilha de 2026-08-05). Rodar
   `npm test && npm run build && npm run lint` nas duas pastas, sempre.
4. **Vite não recarrega bem quando arquivos mudam de lugar** (armadilha
   registrada). A Fatia 1 move o `src/` inteiro: reiniciar o dev server e dar
   `Ctrl+Shift+R` é parte do procedimento, não sinal de defeito.
5. **Variáveis `VITE_*` são assadas no build** — remover a `VITE_NEON_DATA_API_URL`
   do painel da Vercel só faz efeito no próximo deploy.
