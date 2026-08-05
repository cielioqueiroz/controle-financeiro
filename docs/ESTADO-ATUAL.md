# Estado atual do projeto — retomada

> Documento de continuidade. Última atualização: **2026-08-05**.
> Leia isto antes de continuar. O README explica o projeto; aqui está **onde paramos**,
> **o que já foi decidido** e **o que vem a seguir**.

## Rodada 2026-08-05 — funcionalidades derivadas (3 fatias)

### Code review da própria rodada — 3 bugs achados e corrigidos

Revisão feita depois das três fatias, sobre o código recém-escrito.

1. **Chave de React duplicada nos alertas.** `Alerta` tinha `chave` (o
   estabelecimento) mas não a série de origem. A mesma loja pode ter série de
   **saída** (a cobrança) e de **entrada** (o estorno), e as duas podem sumir
   no mesmo mês — dois alertas indistinguíveis, com a mesma chave na lista.
   Campo `origem` novo, pinado por teste.
2. **O filtro de categoria mentia ao trocar de período.** Se a categoria
   escolhida não existisse no mês novo, o `<select>` caía visualmente em
   "todas" (nenhuma `option` casava com o `value`) enquanto o estado seguia
   filtrando: a tela mostrava "0 lançamentos" com um filtro que ninguém via.
   Resolvido derivando `catEfetiva` em vez de guardar estado que pode
   apodrecer — o que se vê e o que se filtra não têm como divergir.
3. **Coluna lateral `sticky` podia ficar inalcançável.** A coluna ganhou dois
   cards nesta rodada e passou a poder ficar mais alta que a janela. Elemento
   `sticky` mais alto que a viewport gruda e o que sobra embaixo não é
   alcançável — a rolagem da página move o irmão, não ele. Resolvido com
   `max-h` + `overflow-y-auto` no contêiner grudado.

Mais dois acabamentos: os botões "Apagar" do painel de Categorias ganharam
`aria-label` com o nome da categoria (havia **dois botões "Apagar" idênticos**
na tela com a confirmação aberta — o teste tinha de adivinhar "o último"), e
`faturasQuitadas` saiu do corpo do render para um `useMemo`.

> **Nota de método:** o bug do casamento de faturas (a mais antiga roubando o
> pagamento da mais nova) foi achado porque o teste original só asseverava
> `size === 1` — passava com a implementação certa e com a errada. Vale a
> lição já registrada neste documento: *teste que passa dos dois jeitos é pior
> que nenhum*. A correção foi verificada por mutação.

### Tipografia e cores — medidas, não opinadas

**Tipografia.** Archivo passou a ser carregada como **fonte variável**
(`wdth 62–125`, `wght 400–800`) no lugar dos 5 pesos estáticos: um arquivo em
vez de cinco, e de quebra um eixo de LARGURA. `.font-display` agora usa
`font-stretch: 108%` — display e corpo são a mesma família em larguras
diferentes, então há hierarquia real **sem carregar uma segunda fonte**.
Também: `text-wrap: balance` nos títulos, `text-wrap: pretty` nos parágrafos.

`.tabular` (as cifras) foi **movida para `@layer components`** e ganhou peso
500 e tracking −0.015em. O layer importa: regra sem layer vence utilitário do
Tailwind — o inverso da armadilha do `@layer base` já anotada aqui — então uma
`letter-spacing` solta atropelaria o `tracking-widest` dos rótulos de 10px que
também usam `.tabular`.

**Cores.** Medi o contraste WCAG de todos os pares que o app usa. Seis
falhavam AA e foram corrigidos com o **menor ajuste possível preservando
matiz e saturação** (resolvidos por busca, não escolhidos a olho):

| Token | Antes | Depois | Motivo |
|---|---|---|---|
| `tinta-tenue` (escuro) | `#6f6a62` | `#8c867d` | 3,0–3,5:1 → 4,50–5,19:1 |
| `falha` (escuro) | `#d64545` | `#d95252` | 4,27:1 → 4,70:1 |
| `tinta-tenue` (claro) | `#776f63` | `#6f685d` | 4,06:1 na página → 4,50+ |
| `marca` (claro) | `#9a6a15` | `#8e6213` | 3,97:1 → 4,52:1 |
| `ressalva` (claro) | `#9c6415` | `#945f14` | 4,35:1 → 5,33:1 |

O caso do `tinta-tenue` escuro é o mais amplo: é a cor de **todos** os rótulos
de 10–11px do painel. O tema claro já tinha sido corrigido por esse motivo
numa rodada anterior; o escuro tinha ficado para trás.

**`--color-campo-borda`, token novo.** As bordas de campo estavam em ~1,8:1,
abaixo dos 3:1 que a WCAG pede para identificar um controle. Subir o token dos
cartões junto engrossaria o desenho inteiro, então campos ganharam token
próprio (`#6a635a` escuro / `#9c8f77` claro, ambos ≥3:1). Aplicado em
`estilos-campo.ts`, `ListaTodos`, `Categorias`, `EditarCompra` e
`EditarPerfil`. **As bordas de cartão não mudaram** — aquilo é decoração.

Origem: `docs/img/exemplo.jpeg`, print de um app de finanças de terceiro, usado
como referência **de funcionalidades** (nenhuma decisão de aparência foi tomada).
Spec em `docs/superpowers/specs/2026-08-05-funcionalidades-derivadas-design.md`;
plano da fatia 1 em `docs/superpowers/plans/2026-08-05-funcionalidades-derivadas-fatia-1.md`.

**Decisão estruturante:** metade do que o print mostra (falta pagar, contas
pagas, datas, recorrências, poupança) nasce, naquele app, de dado **digitado**.
O Capital Financeiro continua **100% retrospectivo** — só entrou o que dá para
**derivar** do que já é importado. Poupança/investimentos foi **descartado**.

### Fatia 1 — dado morto e derivações

1. **Saldo em aberto do cartão** (`persist/aberto.ts`, `ui/SaldoAberto.tsx`).
   O achado da rodada: `salvar.ts:74-77` gravava `total_open_balance`,
   `next_invoice_balance`, `next_close_date` e `future_installments_total`
   desde sempre e **nenhuma linha do app lia**. São colunas do schema **0001**,
   então não houve migração. `puxarSaldos()` alargou o select (mesmo
   `try/catch` defensivo) e passou a devolver `DocDoPainel`.
   O nome `puxarSaldos` **não** mudou de propósito: `Dashboard.pdf.test.tsx`
   mocka o módulo por nome.
2. **Fatura quitada vs em aberto** (`domain/quitacao.ts`, selo em `Documentos`).
   Conserta um buraco real: `vincular()` só cruza documentos do **lote da
   importação**, então fatura e extrato importados em dias diferentes nunca se
   encontravam. Aqui a regra roda sobre todo o histórico salvo.
   **Casa por par mais próximo primeiro, não fatura a fatura** — a primeira
   versão deixava a fatura mais antiga roubar o pagamento que casava exatamente
   com uma mais nova de igual valor. Pinado por teste e **verificado por
   mutação** (inverter a ordenação derruba 2 testes).
3. **Tile "Saldo do período"** (`agregar().saldoCents`).
4. **Card "Maiores saídas do período"** (`maioresSaidas()`, `ui/MaioresSaidas.tsx`).

### Fatia 2 — recorrências e alertas (`domain/recorrencias.ts`)

Detecção pura, sem cadastro. Cobre as abas *Recorrências* **e** *Datas do mês*
do print de uma vez: o `diaTipico` (mediana do dia) **é** o calendário.

Três filtros, cada um por um motivo registrado no código: parceladas ficam de
fora (já são `CompromissosFuturos`), vínculos ficam de fora (a quitação
lideraria a lista sem significar nada) e exige **mediana de 1 cobrança por
competência** — é o que separa assinatura de supermercado, que também aparece
todo mês mas com 27 compras.

**Alertas** (`valor-mudou`, `sumiu`) — a única funcionalidade da rodada que o
app do print **não tem**. Duas travas contra alerta que grita à toa:
`valor-mudou` só dispara para série de **valor fixo** (senão a conta de luz
alertaria todo mês) e exige **>10% E >R$ 5,00**; `sumiu` compara contra a
**competência mais recente com dado** (senão o mês sem fatura importada
acusaria tudo) e tem teto de 3 meses (senão série de 2024 gritaria para sempre).

### Fatia 3 — busca e gestão do aprendizado

- **Vista "Todos"** (`domain/busca.ts`, `ui/ListaTodos.tsx`): terceira opção do
  seletor que já existia, com busca por texto e filtro por categoria. A busca
  casa contra `label ?? description` e ignora acento e caixa.
- **Painel de Categorias** (`ui/Categorias.tsx`): renomear/ícone/cor/apagar as
  suas, **e ver/desfazer as regras aprendidas**. Fecha o terceiro achado da
  rodada: `merchant_rules` **não tinha nenhuma UI** — o usuário corrigia uma
  categoria, o app decorava e não havia como ver nem desfazer. Novos
  `apagarRegra` e `editarCategoria`. Apagar categoria em uso avisa **quantos
  lançamentos** vão passar a exibir "Outros".

### Verificação

**504 testes (66 arquivos)**, build e lint limpos (só os 3 avisos
pré-existentes), `medir-overflow.py` OK em 1280×800 e 390×844 depois da
mudança de largura de fonte.

⚠️ **`npm test` não checa tipos.** O erro de tipo introduzido pelo campo
`origem` nas fixtures passou pela suíte inteira e só caiu no `tsc -b` do
`npm run build`. **Rodar os dois sempre** — verde no Vitest não é verde.

⚠️ **Não verificado logado**: a senha da conta de teste não é versionada, então
as telas novas foram exercidas por teste de componente, não contra dados reais
no navegador. É o que falta o usuário conferir.

⚠️ **Referência de "Entradas" do diagnóstico está defasada.** O gasto real de
junho continua **R$ 41.012,25** (bate ao centavo), mas entradas deu
**R$ 50.281,18** contra os R$ 41.853,57 da tabela abaixo. **Não é regressão**:
`scripts/diagnostico.ts` importa só `domain/pdf`, `domain/parsers`,
`domain/link/vinculos`, `domain/categorize` e `normalize/merchant` — nenhum
arquivo tocado nesta rodada — e `git log` não mostra commit nessa cadeia desde
29/07. A causa é o conjunto de PDFs da pasta (há um
`BradescoCartoes14-07-2026`). **Confirmar e recalibrar a tabela.**

### Novos números de referência (2026-08-05)

| Medida | Valor |
|---|---|
| Gasto real total (junho, competência) | **R$ 41.012,25** (inalterado) |
| Entradas (junho, medido) | **R$ 50.281,18** (a confirmar) |
| Vinculado (fora da conta) | R$ 23.353,68 |
| Testes | **502** (66 arquivos) |

## Rodada 2026-07-29 — i18n fechado de verdade + performance + confete

Três entregas, todas verificadas (suíte completa, build, lint, tsc, medidor de
overflow e smoke de runtime no Chromium com troca pt→en sem erro de console):

1. **i18n 100%**: fatia final dos modais/Tutorial (planejada) **e** as superfícies
   que tinham ficado de fora — tela de importação inteira (Dropzone, ResultadoImport,
   toasts de importar/salvar do App), ThemeToggle, LinhaTransacao e o **relatório
   jsPDF** (via `tAtual` em `src/i18n/traduzir.ts`, t sem React). `interpolarNos`
   (`src/i18n/interpolarNos.tsx`) injeta spans estilizados em frase traduzida.
2. **Code-splitting do pdf.js**: import dinâmico memoizado em `domain/pdf/load.ts` —
   chunk inicial de 1.340 kB → ~938 kB (gzip 381 → 262). Só quem importa PDF baixa.
3. **Confete** (`src/ui/Celebracao.tsx`): dispara quando o total lido **confere ao
   centavo**; camada `fixed` + `overflow-hidden` + `pointer-events-none` (não entra
   no layout de rolagem) e respeita `prefers-reduced-motion`. Testado.

Também: teste direto de `limparTokenDaUrl` (dívida antiga quitada) e `rotuloTipo`
saiu do domain (rótulo é da UI). **374 testes (52 arquivos).**

### Code review completo (2026-07-29) — achados e correções

Revisão de segurança + design. **Nada explorável encontrado**; o modelo de
isolamento está correto (RLS nas 5 tabelas, políticas por `auth.user_id()`,
o cliente **nunca** manda `user_id`, e um usuário não consegue criar categoria
"global"). Sem XSS (zero `innerHTML`/`eval`), sem segredo versionado.

**Corrigido nesta rodada:**

1. **O aprendizado de categorias não existia na prática.** `aprendizado.ts`
   (`regraDaCorrecao`, `mesclarRegras`) só era chamado pelos próprios testes, e
   a tabela `merchant_rules` — criada no schema inicial, com RLS — nunca foi
   lida nem escrita. `salvar.ts` chamava `categoriaDe(t)` **sem regras**, então
   toda correção do usuário era esquecida e a mesma loja voltava errada todo
   mês. Docs afirmavam o contrário. Agora: `persist/regras.ts`
   (`puxarRegras`/`salvarRegra`, com limpeza do mesmo padrão antes de inserir
   para não acumular regras concorrentes), o App carrega as regras no login,
   `EditarCompra` grava a regra quando a categoria muda (falha aqui **não**
   desfaz a edição), e a prévia da importação já mostra as categorias
   corrigidas. **`salvarDocumento` agora exige `regras`** — parâmetro sem
   default de propósito, para o compilador impedir que outro ponto de chamada
   volte a categorizar só pelas globais. Contrato pinado em
   `aprendizado.round-trip.test.ts` (5 testes, sem rede).
2. **Sem cabeçalhos de segurança** → `vercel.json` com `X-Frame-Options: DENY`
   + CSP `frame-ancestors 'none'` (clickjacking), `nosniff`, HSTS,
   `Referrer-Policy` e `Permissions-Policy`. **CSP completo ficou de fora de
   propósito**: quebraria Google Fonts, o worker do pdf.js e a API do Neon, e
   `vercel.json` não vale no preview local — não daria para testar antes de
   publicar. Fazer com calma, medindo em preview deploy.
3. **Acessibilidade da tela de acesso**: os campos tinham só `placeholder`
   (não é nome acessível — some ao digitar). Agora têm `aria-label` + o
   `autoComplete` certo (`name`/`nickname`/`email`/`current-password` vs
   `new-password`). Sem `<label>` visível, para não mexer no desenho do card.
4. **Código morto removido**: `hashTransacao` (o dedupe real usa
   `chaveTransacao`+`sha256`), `dataLonga` e `removerCategoriaExtra`.

**Não corrigido, por decisão:** `npm audit` acusa 5 CVEs (1 crítica) no
`better-auth 1.4.18`, transitivo do `@neondatabase/neon-js`. **Todas** são de
recursos de *servidor* de auth (oidc-provider, mcp, organization, SCIM) que
este app não roda — quem roda é a Neon — e verifiquei que o bundle **não
contém** `oidc-provider`. A correção exige bump *major* de um SDK em beta, o
que mexeria em todo o login sem ganho real. **Não rodar `npm audit fix
--force`.** Reavaliar quando a Neon publicar SDK estável.

**395 testes (55 arquivos).**

### Correção 2026-07-29 (noite) — modais presos ao container + tema claro padrão

Usuário mostrou o véu do modal cobrindo só a faixa do painel e a confirmação
nascendo no rodapé, fora da tela.

**Causa raiz (medida no Chromium, não deduzida):** `.surgir` — a classe de
entrada do dashboard — anima `transform` com `animation-fill-mode: both`, e um
elemento assim **vira bloco de contenção para descendentes `fixed`, para
sempre**, mesmo depois da animação. Repro isolado: o mesmo `fixed inset-0`
media **1248×18px** dentro do `.surgir` e **1280×800** fora dele.

- **`ui/Portal.tsx`**: pendura os overlays no `<body>` via `createPortal`.
  Aplicado em Confirmacao, Documentos, EditarCompra, EditarPerfil, Tutorial e
  Celebracao. Renderiza no **mesmo commit** (sem gate de montagem) porque o
  Confirmacao foca o Cancelar num efeito de montagem — adiar deixava as refs
  nulas e derrubou 2 testes de foco. Imune a qualquer transform futuro.
- **`useTravarRolagem`** trava o scroll do fundo, com **contador** (Documentos
  + Confirmação empilhados: fechar o de cima não pode destravar).
- **`--color-veu`**: os véus usavam `bg-carvao-950/70`, que no tema **claro é
  creme** — não escurecia nada. Agora é uma cor própria, escura nos dois temas.
- Verificado no build de produção: overlay portado = 1280×800 = viewport.

**Tema claro virou o padrão** (`ThemeToggle.temaInicial`: escolha salva >
preferência do sistema > claro) + script no `index.html` que estampa
`data-theme` **antes da primeira pintura**, senão a página nascia escura e
piscava. Paleta clara refeita: página `#efebe2` e cartão `#fffefc` (no claro,
elevação = mais branco + sombra suave; antes eram dois cremes vizinhos e tudo
lia chapado), `--color-tinta-tenue` de `#8a8377` → `#776f63` (o anterior dava
~3:1 nos rótulos de 10–11px) e `.sombra-flutuante` com valor por tema.
**390 testes (54 arquivos).**

### Correção 2026-07-29 (tarde) — "Não consegui gerar o PDF"

Usuário relatou o toast de erro ao baixar, e que só existia compartilhar.
**Duas causas, ambas corrigidas:**

1. **Chunk obsoleto depois de deploy (a causa do erro).** O hash do chunk do
   jsPDF muda a cada build (`DQmrqhaM`→`y4HQsXkL`→`Mhhn8_ys` só nesta sessão).
   Aba aberta antes do deploy pede um arquivo que não existe mais e o import
   dinâmico rejeita com *"Failed to fetch dynamically imported module"* —
   **confirmado no Chromium contra o build de produção**. O `catch {}` sem
   binding transformava isso em "não consegui gerar o PDF", culpando o
   recurso errado. Agora `lib/chunk.ts` (`ehFalhaDeChunk`, 5 testes) detecta e
   o toast oferece **Recarregar**. Vale para qualquer import dinâmico futuro.
2. **Baixar e compartilhar eram uma decisão automática.** `baixarOuCompartilhar`
   escolhia sozinho: no Chrome/Edge do **Windows** `canShare({files})` é true,
   então o desktop caía sempre no share e o download sumia. Agora
   `lib/compartilhar.ts` expõe `baixarArquivo`, `compartilharArquivo` e
   `podeCompartilharArquivo` (7 testes), e a UI tem **dois botões** — o de
   compartilhar só aparece onde há suporte. Se o share falhar (ex.:
   `NotAllowedError` por user activation expirada durante a geração), **cai
   para o download** em vez de perder um PDF já pronto. Pinado em
   `Dashboard.pdf.test.tsx` (3 testes).

Todo `catch` de PDF agora faz `console.error` com o erro real.
**386 testes (53 arquivos).**

✅ **Migração 0002 CONFERIDA EM PRODUÇÃO (2026-07-29)**: o usuário verificou no
SQL Editor do Neon — `documents.end_balance_cents` existe e o CHECK de
`accounts.bank` já aceita os 5 bancos (aplicada por ele em 2026-07-24, 20:33).
O item 4 da fila está 100% encerrado; **nenhuma pendência de banco restante**.

## Últimas duas rodadas (2026-07-23) — tela de acesso + acabamento

Duas rodadas grandes, **verificadas no navegador pelo usuário** (rolagem e modais
confirmados OK) e enviadas ao ar:

1. **Tela de acesso em duas colunas** — frase à esquerda, card à direita, sem rolagem;
   `MoedaLogo` novo (donut animado, cor de tema); **fim do login automático** depois de
   redefinir a senha (o e-mail guardado só preenche o campo agora, nunca autentica —
   apaga a classe do bug F4). Ver `specs/plans 2026-07-19-tela-de-acesso*`.
2. **Acabamento e confirmações** — `Confirmacao.tsx`, um diálogo modal único (foco preso,
   Esc, foco inicial no Cancelar quando é perigo) ligado em **sair da conta, apagar
   documento, apagar tudo e salvar edição**; sistema de raio/elevação com **hover só no
   que é clicável**; favicon legível a 16px; card OG com donut. Ver
   `specs/plans 2026-07-19-acabamento-e-confirmacoes`.

**294 testes verdes** (31 arquivos), build e lint OK.

### Em andamento (2026-07-23): suporte a mais bancos

Iniciada a rodada de **novos parsers de banco** — spec em
`specs/2026-07-23-novos-bancos-bb-sicredi-sicoob-caixa-design.md`. Amostras reais
(de portais de transparência) guardadas em `.amostras-bancos/` (gitignored).
- **Banco do Brasil:** ✅ **PRONTO E NO AR** (commit `1e825e9`) — 3º banco que o app lê.
  Parser em `parsers/bb-extrato.ts`, confere pela progressão de saldo (novo
  `ParseResult.balance` + ramo no `checksum.ts`), e a varredura interna (aplicação
  automática) é marcada `internal_transfer` para não inflar o gasto. 11 testes.
  Falta só o layout A (2020, `bb-belem.pdf`) — a ordem das colunas de data inverte;
  o parser atual é do layout B (2023). Fazer quando aparecer um extrato nesse formato.
- **Sicoob e Sicredi:** amostras web de texto ricas; falta Task 0.
- **Caixa:** PARADA — o extrato pessoal do usuário veio como **imagem** (sem camada de
  texto); o app só lê texto. Retomar com PDF de texto (internet banking) ou decidir OCR.
- **Sicredi pessoal:** usuário traz depois.
- **Santander/Itaú:** sem material público; só com PDF real fornecido.
- Ferramenta de Task 0: `scripts/_dump-bb.ts` (gitignored) despeja linhas com `x`/`right`.
- Carrossel de bancos na tela de login: adiado até haver ~5 bancos reais.

**Dívida técnica desta rodada, anotada de propósito** (não bloqueia, mas registrar):
- `Confirmacao`: minors de teste em aberto — sem cobertura de `severidade:'normal'`, a
  invariante do `.replace` em `BOTAO_CONFIRMAR_NORMAL` não está pinada por teste, e a
  seção de TDD do relatório da Task 1 super-reportou o RED (2 dos 3 testes eram de
  caracterização). Detalhe no ledger `.superpowers/sdd/progress.md`.
- `EditarCompra` não tem teste próprio; a confirmação de salvar foi ligada sem teste
  de integração (o de `Documentos` foi escrito).
- Confirmar **toda** gravação de edição adiciona atrito a uma ação reversível e
  frequente. Foi escolha explícita do usuário; remover é trivial (uma linha) se incomodar.

## Onde o código está

- **Nome do sistema:** **Capital Financeiro** (era "Controle Financeiro", passou por
  "PayPulse" e voltou atrás — ver armadilha de domínio no fim).
- **Branch:** `main`, direto. A `feat/ingestao-documentos` foi mesclada (PR #1) e
  aposentada — **não se trabalha mais nela**.
- **Remoto:** `git@github.com:cielioqueiroz/controle-financeiro.git`
  (o repositório mantém o nome antigo de propósito: renomear quebraria caminhos).
- **No ar:** **https://capital-financeiro.vercel.app** — projeto `capital-financeiro`
  na Vercel, conectado ao GitHub. **Todo push na `main` publica sozinho** em ~1 min.
- `npm test` = **294 testes verdes** (31 arquivos), `npm run build` e `npm run lint` OK.
  As duas rodadas de 2026-07-23 foram verificadas no navegador antes do push.

## Como validar rapidamente que nada quebrou

```bash
npx tsx scripts/diagnostico.ts "D:/extratos/junho2026"   # PDFs reais, fora do repo
python scripts/medir-overflow.py                          # com npm run dev rodando
npm test && npm run build && npm run lint
```

**Números de referência** (se algum mudar sem motivo, algo regrediu):

| Medida | Valor esperado |
|---|---|
| Gasto real total (junho, competência) | **R$ 41.012,25** |
| Supermercado (junho) | **R$ 918,46** (27 lançamentos) |
| Fatura Nubank — total declarado | R$ 8.324,24 |
| Fatura Bradesco — total declarado | R$ 5.529,44 |
| Compromissos futuros | 34 parcelas · R$ 5.265,30 |
| Entradas (junho) | R$ 41.853,57 |
| Testes | **395** (55 arquivos) |

Conta de teste no Neon: `teste.migracao@exemplo.com` (senha **não** versionada).
⚠️ **Essa conta nunca recebe e-mail** — `exemplo.com` é domínio reservado. Serve
para logar, nunca para testar e-mail. Para isso use uma conta com caixa real.
Existe também `cielioqueirozz@gmail.com`, criada via Google (sem senha própria,
então não serve para testar redefinição), e `cielioqueiroz@hotmail.com`, criada
com e-mail e senha em 2026-07-19 justamente para testar a recuperação.

---

## ✅ Pronto e verificado

**Ingestão e cálculo**
- 4 parsers (fatura + extrato × Nubank + Bradesco), cada um conferindo o total contra o gabarito do PDF.
- Categorização por regras (30 categorias) + **aprendizado ligado em 2026-07-29** (corrigir a categoria de uma compra ensina o app para as próximas importações, via `merchant_rules`); dedupe por hash de documento e de transação.
- Vínculos entre documentos removem a dupla contagem (fatura × extrato).
- **Competência**: Mês/Ano agrupam pela fatura (`documents.period_end`); Dia/Semana pela data real.

**Persistência (Neon)**
- Data API + Neon Auth + RLS. Schema em `neon/migrations/0001_schema_inicial.sql`.
- Salvar, puxar tudo, apagar documento (cascade) ou tudo, editar transação, categorias do usuário.

**Interface**
- Dashboard por Dia/Semana/Mês/Ano com tiles, donut por categoria, evolução mês a mês e compromissos futuros.
- Lançamentos por categoria (drill-down) e por dia (com subtotais).
- Filtro por banco (Total geral / Nubank / Bradesco).
- Editar compra e criar categorias personalizadas.
- Painel de Documentos (apagar fatura ou tudo).
- Login com nome + apelido, saudação, tutorial guiado.
- **Editar perfil** (2026-07-24): menu da conta → "Editar perfil" troca o apelido da
  saudação (local) e o nome completo (Neon Auth via `updateUser`), com prévia ao vivo.
  Componente `src/ui/EditarPerfil.tsx` (6 testes). Tutorial ganhou o passo "Do seu jeito".
- Tema claro/escuro, responsivo, toasts no topo-centro.
- "Baixar PDF" via `window.print()` + `@media print` — **veja a ressalva no item 3 da fila**.

**Entregue em 2026-07-18**
- **Validação do acesso** — o toast nomeia exatamente os campos vazios e o foco pula para o primeiro (`src/ui/auth-validacao.ts`, puro e testado). Corrigido também um `if (!neon) return` que ficava no topo de `submeter` e engolia a validação em silêncio.
- **Olho de revelar senha**, com teste que prova o `type="button"` (validado por mutação: removi o atributo, o teste falhou; restaurei, passou).
- **Fundo animado** de partículas em three.js (`src/ui/FundoAnimado.tsx` + `src/ui/fundo/particulas.ts`), na camada `#bg-animation` (`position: fixed`, `z-index: 0`).
- **Logotipo** `src/ui/Marca.tsx` — "Capital" em tinta, "Financeiro" em âmbar, com salto em onda no hover (hover no pai, atraso por letra).
- **Paleta âmbar** substituindo o verde neon; **toasts** com presença de diálogo; **campos do login** com raio de 12px, hover e foco âmbar; **assinatura do rodapé** maior e na cor da marca.
- **Card de compartilhamento** (Open Graph) + `public/og.png` 1200×630, gerado por `scripts/gerar-og.py` a partir de `scripts/og-card.html`.
- **Deploy completo na Vercel**, com login funcionando.

---

**Entregue em 2026-07-19 — recuperação de senha (código pronto, falta verificar no navegador)**
- Fluxo em dois passos dentro do card do acesso: pedir o link e definir a nova senha.
- `lib/recuperar-senha.ts` (HTTP puro), `lib/url-token.ts`, `ui/RecuperarSenha.tsx`,
  `validarNovaSenha` e `emailValido` em `ui/auth-validacao.ts`.
- Extraídos para não duplicar: `ui/IconeOlho.tsx` e `ui/estilos-campo.ts`.
- **211 → 275 testes.** Ver a seção de armadilhas para o que quase escapou.

---

## 🚧 Fila do que falta — em ordem

> **Atualização 2026-07-24 (fim da sessão):** o usuário concluiu e **testou** os itens
> **0** (recuperação de senha ponta a ponta), **1** (nome no e-mail — trocou o
> *Application Name* no Neon) e **5** (filtro por banco e categorias personalizadas
> conferidos logado). Itens **2** (PDF real + compartilhar) e **4** (saldo por conta)
> foram entregues nesta sessão, junto do **polimento de design** (erro coeso, foco por
> teclado, alvos de toque, donut sticky, ações no topo-direito). **Atualização
> 2026-07-29: o item 3 (i18n) foi CONCLUÍDO** — resta só "mais bancos" (bloqueada até
> vir amostra de PDF de texto) e o passo gated do item 4 (migração 0002 no Neon).
> O envio por **e-mail** (antigo passo 3 do item 2) foi **descartado**.
> Spec/plano do design em `docs/superpowers/specs/2026-07-24-polimento-design-design.md`.

### 0. ~~Verificar a recuperação de senha no navegador~~ ✅ FEITO E TESTADO (2026-07-24)

⚠️ **Atualização 2026-07-23:** o login automático pós-reset foi **removido** (agora
sempre volta ao card de entrar com o e-mail preenchido). Isso muda o roteiro abaixo:
o passo 4 já não "entra direto", e o passo 7 (F1: reset com sessão de outra conta
ativa) precisa ser refeito contra o comportamento novo. O usuário verificou modais e
rolagem em 2026-07-23, mas **não** o fluxo de troca de senha real ponta a ponta.

O código está no ar e revisado; o fluxo de e-mail real ainda não foi exercido no navegador.

⚠️ **Este roteiro troca a senha de verdade** de `cielioqueiroz@hotmail.com` — não é
ambiente de teste. Anote a senha que usar.

Roteiro, em ordem (**1 e 2 já feitos em 2026-07-19**, o servidor sobe em
`http://localhost:5173/` e o medidor deu OK em 1280×800 e 390×844):

1. ~~`npm run dev`, `Ctrl+Shift+R` (nasceram arquivos novos).~~ ✅
2. ~~`python scripts/medir-overflow.py` — sem rolagem lateral.~~ ✅
3. "Esqueceu a senha?" → pedir link para `cielioqueiroz@hotmail.com`.
4. Abrir o link **no mesmo navegador** → trocar a senha → deve entrar direto,
   e o `?token=` deve sumir da barra de endereços.
5. Limpar `localStorage.removeItem('cf:email-reset')` antes de abrir outro link
   → a senha troca e o card volta ao login com aviso.
6. Reabrir um link já usado → "Este link expirou ou já foi usado." + botão de
   pedir outro.
7. **O caso que mais importa:** estando logado, abrir um link de redefinição e
   concluir. Tem que aparecer o card de login, não o dashboard. Foi um bug real
   (F1 do review final) e é onde um possível piscar do card apareceria.

Aproveite a sessão logada para conferir o **item 5** desta fila (filtro por banco
e categorias personalizadas, que nunca foram validados contra o banco).

### 1. ~~Nome errado no e-mail de redefinição~~ ✅ FEITO (2026-07-24 — Application Name trocado no Neon)

O e-mail sai como **"controle-financeiro"**, não "Capital Financeiro". Não é código.

**Onde corrigir (confirmado no painel em 2026-07-24):** *Neon → Auth → Configuration
→ Project Info → **Application Name***. O campo diz explicitamente *"This name appears
in verification emails and auth communications."* Trocar para **"Capital Financeiro"**
e salvar. **Não** é o "Sender address" (`auth@mail.myneon.app`, compartilhado) nem o
nome do projeto Neon/Vercel — é um texto de exibição, seguro de mudar (não toca URL de
Auth, JWKS ou domínio). Passo manual do usuário; nada a fazer no repositório.

Vale prioridade porque **é o único e-mail que pedimos ao usuário para confiar**,
e chegar sob um nome que ele não reconhece tem forma de phishing.

### 2. Relatório: PDF de verdade → compartilhar — ✅ CONCLUÍDO (2026-07-24)

Spec/plano em `docs/superpowers/specs|plans/2026-07-24-relatorio-pdf-compartilhar*`.

- **PDF real**: `src/lib/relatorio-pdf.ts` gera um Blob com **jsPDF + jspdf-autotable**
  (cabeçalho, totais, saldo por conta, tabela por categoria), a partir de
  `montarDadosRelatorio` (pura, testada). jsPDF entra por **import dinâmico** — fica em
  chunk próprio, fora do bundle inicial.
- **Compartilhar/baixar**: `src/lib/compartilhar.ts` — `navigator.share` com o arquivo no
  celular; download no desktop; cancelar a folha não é erro.
- O botão virou **"Baixar / Compartilhar PDF"** e o `window.print()` saiu de cena.
  (O CSS `@media print` e o bloco `somente-impressao` ficaram órfãos — limpeza trivial
  quando/se incomodar.)

**E-mail: descartado do roadmap (decisão do usuário, 2026-07-24).** Era o passo 3
(botão de enviar por e-mail via serverless + Resend). Não será feito.

### 3. i18n pt/en/es — ✅ COMPLETO (fatia final 2026-07-29)

**Fatia final (2026-07-29):** modais (EditarPerfil, EditarCompra, Documentos,
Confirmacao) e Tutorial 100% por `t()`; `Documentos` formata período/data pela
locale ativa (`mesAbrev`/`dataLongaDe`, fim do array `MESES` fixo) e as contagens
ganharam singular (`docs.contDoc1`/`docs.contLanc1`); destaque de números do
"apagar tudo" preservado por `realcarNumeros` (independe do idioma). Teste de
modal em en: `src/ui/Tutorial.i18n.test.tsx`. **Todas as superfícies + toasts
traduzidos; en/es seguem aguardando revisão do usuário nativo.**

Botão de idioma trocando **todo** o texto do sistema, **feito por fatias**.
Spec/plano em `docs/superpowers/specs|plans/2026-07-24-i18n-mecanismo-e-login*`.

**Entregue (fatia 1 — mecanismo + tela de acesso):**
- `src/i18n/idioma.ts` (detecção + storage `cf:idioma`), dicionários `pt/en/es`
  (pt = fonte da verdade; en/es tipados, chave faltando quebra o build),
  `IdiomaProvider` + `useT` (**default pt** → componentes funcionam sem provider, os
  testes atuais não precisaram de wrapper), `SeletorIdioma` (PT/EN/ES) no cabeçalho.
- Tela de acesso 100% traduzida (Auth, RecuperarSenha, CampoSenha, CarrosselBancos,
  TelaAcesso, Rodape). **en/es são minhas traduções — o usuário nativo revisa.**

**Deferido dentro da fatia:** a mensagem composta de "campos faltando"
(`mensagemCamposFaltando`) e os erros vindos de `lib/recuperar-senha`/`validarNovaSenha`
ficam em pt por ora (gramática de lista por idioma) — `auth-validacao.ts` intacto.

**Entregue (fatia 2 — dashboard, 2026-07-24):**
- **Moeda por locale**: `domain/normalize/locale.ts` (var de módulo + setter) →
  `formatBRL` usa a locale ativa (BRL sempre, só formata, **não converte**).
- **Datas por locale**: `domain/normalize/data.ts` (`mesAbrev`/`dataLonga` via `Intl`) —
  Dashboard, SaldoConta, CompromissosFuturos e o PDF.
- **Nomes das 30 categorias** traduzidos (`nomeCategoria` + mapa en/es em `categorias.ts`);
  categoria do usuário nunca traduz. Aplicado no donut, listas e PDF.
- **Chrome do dashboard + saudação do header + menu da conta** traduzidos (~45 chaves).
- `IdiomaProvider` aplica os setters de locale/categoria durante o render.

**Próximas fatias (em ordem sugerida):**
1. **Modais**: EditarCompra (inclui a grade de categorias), Documentos, EditarPerfil,
   Confirmação; e o **Tutorial**.
2. Toasts/erros ainda em pt (o deferido da fatia 1: campos-faltando e erros da lib de
   recuperação), quando valer o esforço da gramática de lista por idioma.

### 4. Saldo bancário por conta — ✅ CONCLUÍDO (migração conferida em produção 2026-07-29)

Implementado nesta rodada (spec/plano em `docs/superpowers/specs|plans/2026-07-24-saldo-bancario*`):
- Os **5 parsers de extrato** expõem `ParseResult.balance.final` (Nubank e Bradesco
  ganharam nesta rodada; BB/Sicredi/Sicoob já tinham). Cada um conferido contra a amostra.
- `persist/saldos.ts` — `saldosPorConta` deriva o saldo atual por conta (extrato de
  maior `period_end`), puro e testado.
- `salvar.ts` grava `documents.end_balance_cents`; `puxarSaldos()` lê. **Defensivo**:
  antes da migração, o insert refaz sem a coluna e a leitura volta `[]` — importar e o
  painel nunca quebram; a fileira de saldo só não aparece.
- `ui/SaldoConta.tsx` + fileira no Dashboard acima do filtro de banco.

✅ **Migração aplicada e conferida em produção (2026-07-29):**
`documents.end_balance_cents` existe e `accounts_bank_check` aceita
nubank/bradesco/bb/sicredi/sicoob/desconhecido (verificado via
`pg_get_constraintdef` no SQL Editor do Neon). Saldo por conta ativo.

### 5. ~~Verificações que nunca foram feitas contra o banco~~ ✅ FEITO E TESTADO (2026-07-24)

Duas features foram implementadas numa sessão em que a rede **perdeu o DNS do Neon**, e
ficaram validadas só por typecheck:
- **Filtro por banco** (Total geral / Nubank / Bradesco)
- **Categorias personalizadas** (criar categoria no editor de compra)

Ao retomar: logar (local ou produção) e conferir as duas na prática. O DNS voltou a
resolver em 2026-07-18.

---

## ⚠️ Notas de armadilha

**Testes e tipos** (todas de 2026-07-19)
- **`vi.stubEnv` NÃO alcança `import.meta.env`** neste setup — só `process.env`. Um teste
  que tente fixar `VITE_*` falha em silêncio, lendo o valor real do `.env.local`. Por isso
  `recuperar-senha.test.ts` assevera a **forma** da URL (absoluta + caminho), não o valor
  da base. **O `neon.ts` tem o mesmo padrão** e baterá na mesma parede se um dia for testado.
- **`tsconfig.test.json` precisou de `vite/client`.** O primeiro teste que renderiza o
  `App` puxa a cadeia até `domain/pdf/load.ts`, que importa o worker do pdf.js com sufixo
  `?url`. Quem declara esse formato é o `vite/client`, que só o `tsconfig.app.json` tinha.
  Os dois arquivos são quase-duplicatas mantidas à mão (17 chaves iguais) — extrair um
  `tsconfig.base.json` evitaria a próxima divergência.
- **Suíte verde não é suíte determinística** (2026-07-19). Três execuções seguidas do
  mesmo commit deram 4 falhas → 1 falha → 0 falhas. Não era regressão: os 4 testes que
  sobem o `<App/>` e dirigem a tela com `userEvent` levam ~2s isolados e passavam dos
  **5s do `testTimeout` padrão** quando os 27 arquivos disputavam CPU. Corrigido com
  `testTimeout: 15000` no `vite.config.ts` (35b4f84). O jeito de reproduzir esse tipo de
  falha é `--testTimeout` baixo: com 1200ms caem exatamente os mesmos 4 e sobra o único
  sem `userEvent`. **Se um teste falhar sem você ter mudado nada, rode de novo antes de
  investigar o código** — e verifique sob carga (`npm test` duplicado em paralelo), porque
  passar numa máquina ociosa não prova nada.
- **`git stash` sem `-u` não guarda arquivo novo não rastreado.** Um diagnóstico desta
  sessão concluiu "erro pré-existente" porque o arquivo recém-criado continuou no disco
  durante a comparação com o commit antigo. Para bissecar de verdade: `git stash -u`, e
  `tsc -b --force` (o `tsc -b` é incremental e mente com cache quente).

**Ferramentas e ambiente**
- **Vite não recarrega bem quando arquivos nascem ou mudam de lugar.** Depois de criar
  arquivo ou refatorar pastas, **reinicie o `npm run dev`** e dê `Ctrl+Shift+R`.
- **Build verde ≠ runtime verde.** Já aconteceu de o build passar e o app quebrar
  (duplicação de React com o sonner, resolvida com `resolve.dedupe` no `vite.config.ts`).
- **Nunca commitar PDFs reais** (`*.pdf` no `.gitignore`) — contêm CPF, conta e nomes de terceiros.
- `scripts/diagnostico.ts` é ferramenta local e está no `.gitignore`.

**Layout e efeitos**
- **Decoração nunca pode entrar no layout de rolagem.** O brilho da tela de login
  escalava até 1,25 sem ser recortado e entrava no `scrollWidth`, criando barra lateral
  que pulsava com a animação. Todo efeito de fundo vai na camada `#bg-animation`
  (`position: fixed`). Depois de mexer em decoração, rode `python scripts/medir-overflow.py`.
- **O medidor só reprova rolagem LATERAL.** Rolagem vertical é normal em página com
  conteúdo maior que a janela (o rodapé fica abaixo da dobra em telas de 800px).
- **Canvas precisa de `width/height` no CSS.** `renderer.setSize(w, h, false)` não escreve
  o style, e canvas sem dimensão CSS cai no tamanho intrínseco: em tela HiDPI fica com o
  dobro do viewport, mostrando só o quadrante superior esquerdo, borrado. **Isso é
  invisível em navegador headless, que roda em DPR 1.**
- **Utilitário do Tailwind vence regra do `@layer base`.** `focus:shadow-*` e `focus:ring-*`
  sobrescrevem o anel de foco definido em `index.css` e o apagam. Se for estilizar foco,
  faça tudo por utilitário **ou** tudo pela regra base, não misture.
- **`prefers-reduced-motion` desliga o loop**, então quem redimensiona a janela ou troca o
  tema precisa de repintura manual — senão o canvas fica em branco.

**Nomes e deploy**
- **Confira se o subdomínio `.vercel.app` está livre ANTES de adotar um nome.**
  `paypulse.vercel.app` pertencia a outro produto homônimo, e as meta tags OG apontaram
  para o site alheio até isso ser percebido. Checagem:
  `curl -s -o /dev/null -w "%{http_code}" https://NOME.vercel.app/` — **404 é livre**.
- **Renomear o projeto na Vercel NÃO renomeia os domínios.** Os antigos permanecem e o
  novo não é criado: é preciso *Settings → Domains → Edit*.
- **Deployment Protection deixa o site só para quem está logado na Vercel**, e o toggle
  **só vale depois de clicar em `Save`**. O sintoma engana: o dono, já logado, vê tudo
  normal enquanto ninguém mais entra — e o WhatsApp não busca a `og:image`.
- **GitHub Pages não serve para este app.** Ele publicava a raiz do repositório, cujo
  `index.html` é o arquivo-fonte do Vite apontando para `/src/main.tsx` → 404 e página em
  branco. Foi desativado; a hospedagem é a Vercel.
- **Variáveis `VITE_*` são assadas no build.** Mudar o valor no painel da Vercel **não**
  altera o site no ar até o próximo build — dispare um *Redeploy*.
- **Login rejeitado por origem** dá `403 {"code":"INVALID_CALLBACKURL"}` no
  `sign-in/social`. A lista fica em *Neon → Auth → Configuration → Domains*.
- **Não religue a Vercel Authentication.** Ela não protege dados — quem protege é o login
  do app + RLS + JWT. Ligada, as ~6 pessoas não entram.

---

## O que quase escapou na recuperação de senha (2026-07-19)

Vale ler antes de escrever o próximo plano. **Os dois bugs mais graves da rodada
vieram do código de exemplo do próprio plano**, transcrito fielmente pelos
implementadores. Plano detalhado não substitui review.

1. **`salvarSenha` sem `try/catch`.** Se o `signIn.email` *lançasse* em vez de
   devolver `error`, o usuário ficava com a senha já trocada, o token já apagado
   e o botão travado em `…` — sem toast, sem saída. O `Auth.tsx` já tratava a
   mesma chamada como lançável; o exemplo não.
2. **`tokenReset` era `const` sem setter**, então `precisaLogin` ficava `true`
   para sempre: quem redefinia a senha continuava vendo o formulário de nova
   senha, com o cabeçalho já dizendo que estava logado. **Nenhum teste pegava.**

Mais dois, achados só no review final, que **nenhum review por tarefa poderia
ver** porque só emergem com as peças montadas:

3. Com **sessão ativa**, um reset concluído sem login automático mostrava o
   dashboard enquanto o toast dizia "Entre com a senha nova".
4. O e-mail guardado em `cf:email-reset` era **entrada de uma chamada de
   autenticação sem verificação**. Duas contas da casa com a mesma senha → o
   auto-login entrava na conta errada, e a saudação usa o apelido local, então
   nem o cabeçalho denunciava. Hoje o registro tem carimbo de tempo e vale 1h,
   o mesmo tempo de vida do token.

E duas lições sobre testes:
- **Teste que passa dos dois jeitos é pior que nenhum.** O teste do olho de
  revelar clicava com os campos vazios: passaria igual se o botão fosse
  `type="submit"`. Encher os campos primeiro foi o que o tornou real.
- **Asserção positiva não guarda promessa negativa.** O teste "não afirma que o
  e-mail existe" só conferia a presença da frase condicional — enquanto a tela
  dizia "Enviamos um link" logo acima. O bug e o teste conviviam.

---

## Decisões de design já tomadas (não reabrir sem motivo)

- **`--color-marca` (âmbar) é separada de `--color-confere`.** A marca é identidade
  (logotipo, favicon, moeda, foco); o "confere" carrega **semântica** de "o total bate".
  Âmbar já era a cor de `--color-ressalva`: unificar faria o toast de sucesso parecer aviso.
- **O "confere" continua verde**, porém oliva dessaturado (`#6b8f4e`). Verde=certo /
  vermelho=errado é leitura aprendida; trocar prejudicaria a compreensão.
- **Cada tema tem seus próprios tons.** Âmbar claro não tem contraste sobre creme, então o
  tema claro usa versões escurecidas de marca, confere, ressalva e falha.
- **Partículas leem `--color-particula` e `--particula-alfa`**, variáveis próprias por tema,
  com **blending normal** nos dois — aditivo só clareia e apagaria cor escura.
- **`shadcn/ui` foi descartado** para este projeto: é Tailwind v4 puro, e adotar shadcn
  traria Radix + CVA + estrutura `components/ui`, uma troca de arquitetura não pedida.
- **O tutorial diz "Bem-vindo(a) ao seu controle financeiro"** — frase comum, não marca.
  Fica em português mesmo depois do rename.

---

## Melhorias futuras mapeadas (não urgentes)

**Adiados de propósito no review final da recuperação de senha (2026-07-19).**
Todos avaliados, nenhum bloqueia:
- `limparTokenDaUrl` não tem teste direto — roda de verdade só dentro do
  `App.test.tsx`, sem ninguém asseverar a URL depois. É a função cujo defeito
  reenviaria um token gasto, e é trivial de testar em jsdom.
- ~~**`CampoSenha` ficou duplicado**~~ ✅ **resolvido (2026-07-24)**: extraído para
  `src/ui/CampoSenha.tsx` e usado em `Auth.tsx` e `RecuperarSenha.tsx`.
- **Mesma frase, severidade diferente**: senha curta é `toast.warning` no login e
  `toast.error` na recuperação — cor diferente para o mesmo texto no mesmo card.
- ~~**`tsconfig.app.json` e `tsconfig.test.json` são quase-duplicatas**~~ ✅
  **resolvido (2026-07-24)**: criado `tsconfig.base.json` com as 15 chaves comuns;
  os dois o estendem e só sobrescrevem `tsBuildInfoFile`, `types` e `include/exclude`.
- **Classificação de erro do `/reset-password`**: hoje *qualquer* 400 vira "token
  expirado". Mapear os códigos do Better Auth exigiria sondar a taxonomia de erros
  dele, que nunca foi levantada. O único gatilho realista (senha > 128 caracteres)
  já está barrado por `maxLength` no campo.

- Refinar as policies de RLS para `auth.uid()`.
- Chaves próprias do Google OAuth (hoje usa as compartilhadas do Neon; só então será
  necessário mexer nos redirect URIs do Google Cloud Console).
- Code-splitting do bundle (o pdf.js deixa o chunk > 500 kB; o three.js já sai em chunk
  próprio, 515 kB cru / 129 kB gzip, por import dinâmico).
- Proteger **só os deploys de preview** na Vercel, mantendo a produção aberta.
- Promover `@testing-library/jest-dom/vitest` para `setupFiles` global quando houver um
  segundo teste de componente (hoje o import é local em `Auth.test.tsx`).
- `mensagemCamposFaltando([])` com lista vazia gera texto com espaço duplo. Inalcançável
  hoje (todos os chamadores guardam com `length > 0`) e já coberto por teste.

---

## Onde ficam os specs e planos

`docs/superpowers/specs/` e `docs/superpowers/plans/` — cada rodada tem o seu par:
2026-07-18 (ajustes do formulário de acesso; fundo animado + rename + card OG) e
2026-07-19 (`*-recuperacao-de-senha*`). O plano da recuperação guarda, na Task 0, o
formato real do link confirmado contra o servidor.

O ledger de execução fica em `.superpowers/sdd/progress.md` (git-ignored) — é ele que
registra, por tarefa, o que cada review achou e o que foi adiado de propósito.
