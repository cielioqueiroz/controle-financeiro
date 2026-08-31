# Capital Financeiro — instruções do repositório

App de finanças pessoais **retrospectivo**: o usuário importa PDF de fatura e
extrato, e o app diz para onde o dinheiro foi. Nada é digitado à mão — todo número
na tela veio de um documento do banco. React 19 + TS + Vite + Tailwind v4 + Neon.
No ar em https://capital-financeiro.vercel.app — **todo push na `main` publica
sozinho** em ~1 min. Trabalha-se direto na `main`, sem branch de feature.

| Onde | O quê |
|---|---|
| [`CONTEXT.md`](./CONTEXT.md) | Glossário do domínio. **Leia antes de nomear qualquer coisa.** |
| [`docs/adr/`](./docs/adr/) | As decisões que um leitor acharia erradas sem contexto. |
| [`docs/ESTADO-ATUAL.md`](./docs/ESTADO-ATUAL.md) | Diário de rodadas: o que foi feito, quando e por quê. |
| [`docs/VALIDACAO-MANUAL.md`](./docs/VALIDACAO-MANUAL.md) | O que só o usuário, com conta real, consegue conferir. |
| [`docs/SETUP-NEON.md`](./docs/SETUP-NEON.md) | Como o banco e o Auth foram configurados. |

---

# 1. Mapa do repositório

**Monorepo npm** (workspaces `frontend` e `backend`). Comandos rodam da **raiz**.

```
├── frontend/          o app inteiro: src, testes, index.html, vite.config.ts
│   ├── index.html     ponto de entrada do Vite (NÃO fica na raiz)
│   ├── demo.html      segunda entrada, só para gerar os prints do README
│   ├── src/           fonte e teste lado a lado (~135 + ~90 arquivos)
│   └── tests/fixtures/  um JSON por documento de referência — hoje 9,
│                        dois por banco de cartão e um por banco de conta
├── backend/db/migrations/   0001 schema · 0002 saldo e bancos ·
│                            0003 integridade entre usuários · 0004 Mercado Pago
├── scripts/           medidores em Python + ferramentas em tsx
├── docs/              ADRs, estado atual, imagens
├── vercel.json        headers, CSP e rewrites — só valem EM PRODUÇÃO
└── .env.local         na RAIZ, não em frontend/ (vite.config tem envDir: '..')
```

## 1.1 Onde cada coisa mora, em `frontend/src/`

| Pasta | O que entra |
|---|---|
| `domain/` | **Regras de dinheiro, puras.** Sem React, sem rede. Parser, normalização, categorização, vínculo, recorrência, validação de gabarito, busca, diagnósticos. |
| `persist/` | Conversa com o Neon + a agregação de leitura (`agrupar.ts`). |
| `dados/` | Estado de tela compartilhado: os três providers, filtros da URL, recorte. |
| `paginas/` | As seis telas **roteadas e autenticadas**. |
| `ui/acesso/` | As telas de **anônimo** (entrar, criar conta, recuperar, confirmar) e o que só elas usam — inclusive o `FundoAcesso`, a atmosfera em camada `fixed`. |
| `ui/graficos/` | Os quatro gráficos e a escala robusta de barras. |
| `ui/listas/` | Quem desenha linhas sobre transações: os dois rankings e as três listas. |
| `ui/` (raiz) | O que não pertence a um grupo só — primitivos (`Portal`, `ValorAnimado`), marca (`Marca`, `MoedaLogo`), casco (`Cabecalho`, `Rodape`) e peças usadas por mais de um grupo (`MarcaCategoria`, `CarimboConferencia`). |
| `lib/` | Cliente do Neon, perfil, erros, PDF de relatório e utilidades de plataforma. |
| `i18n/`, `navegacao/` | Dicionários (pt, en, es) e rotas. `navegacao/` tem **duas** navegações sobre a mesma `ROTAS`: `NavLateral` (a calha, `lg`+) e `NavPrincipal` (a barra horizontal, abaixo de `lg`). |

**A regra que decide um caso novo:** uma peça usada por **um** grupo mora nele;
usada por **dois**, sobe para `ui/`. Foi o que manteve `MarcaCategoria` na raiz
(gráfico + lista) e `MoedaLogo` também (é marca, irmã de `Marca.tsx`, mesmo sendo
usada hoje só pelo `Auth`).

**Lógica pura de apresentação não vai para `domain/`.** `escala-barras`,
`auth-validacao` e `mensagem-campos` são puras e testadas, e mesmo assim moram na
UI: `domain/` é o vocabulário do dinheiro, e diluí-lo com validação de formulário
tira o sentido de ter a pasta.

## 1.2 O ponto de entrada, em três degraus

1. **`frontend/index.html`** — `<div id="root">`, o script inline que estampa o
   tema **antes da primeira pintura** (sem ele a página pisca do escuro para o
   claro) e o `<script type="module" src="/src/main.tsx">`.
2. **`src/main.tsx`** — `createRoot` + `StrictMode` › `IdiomaProvider` ›
   `DiscretoProvider` › `<App/>`.
3. **`src/App.tsx`** — sessão, o galho anônimo (`TelaAcesso`) e, no galho logado,
   `BrowserRouter` › `ImportacaoProvider` › casco em duas colunas
   (`NavLateral` + `<main>` com `Cabecalho`) › `DadosProvider` › `<Routes>`.
   Os modais de **tutorial** e de **perfil** moram aqui, não no `Cabecalho`:
   dois lugares os abrem (a calha no desktop, o cabeçalho no celular) e estado
   duplicado seria um tutorial aberto por um e fechado pelo outro.

## 1.3 O caminho do dinheiro

**Importar** (tudo no navegador — ver [ADR-0003](./docs/adr/0003-o-pdf-e-lido-no-navegador.md)):

```
arquivo → domain/pdf/load.ts        pdf.js extrai os text items
        → domain/pdf/extract.ts     pareceDigitalizado() barra PDF sem texto
        → domain/pdf/lines.ts       buildLines() agrupa itens em linhas
        → domain/pdf/detect.ts      detectDocument() → { bank, docType }
        → domain/parsers/index.ts   parse() despacha para o parser do emissor
        → domain/validate/checksum  validar() confronta com o gabarito
        → [prévia na tela]
        → persist/salvar.ts         categoriza, vincula, deduplica e grava
```

⚠️ **Gravou, o histórico tem que reler.** O `ImportacaoProvider` incrementa
`salvos`, e o `DadosProvider` escuta esse contador e chama `recarregar()`. Sem
esse último passo o documento só aparece depois de um F5 — foi defeito real até
2026-08-31, e o comentário que estava no lugar dele afirmava que voltar ao
Painel "recarrega e mostra o que acabou de entrar". **Voltar é navegar, e
navegar não remonta o `DadosProvider`**, que fica acima das `<Routes>`.

`persist/salvar.ts` é onde três regras de domínio se encontram na gravação:
`categorize/regras` (categoria), `link/vinculos` (o que não conta como gasto) e
`dedupe/hash` (o que já está no banco). **É também onde mora o discriminador de
transações idênticas** — ele conta ocorrências e sufixa `#2`; não está no
`dedupe/hash.ts`, como o nome faria supor.

**Ler:**

```
persist/puxar.ts + documentos.ts + categoriasUsuario.ts
        → dados/DadosProvider      busca na montagem do galho logado, e de
                                   novo a cada documento gravado (ver acima)
        → persist/agrupar.ts       competência, filtrar por período, agregar
        → dados/useFiltros         o recorte vem da URL
        → paginas/*                ui/graficos + ui/listas desenham
```

## 1.4 Modelo de dados (Neon Postgres)

Cinco tabelas, **todas com RLS por `user_id`**: `accounts`, `documents`,
`categories`, `merchant_rules`, `transactions`. As políticas comparam
`(select auth.user_id())::uuid = user_id`; `categories` é a exceção, porque lê
também as globais (`user_id is null`).

Três índices em `transactions`: `(user_id, date)`, `(document_id)` e
`(user_id, category_slug)`.

**RLS não é a única defesa.** A migração `0003` acrescentou uma função e dois
gatilhos que recusam relação apontando para linha de OUTRO usuário — chave
estrangeira sozinha não garante isso. Ver
[ADR-0010](./docs/adr/0010-cqrs-e-integridade-de-dados.md).

⚠️ **`accounts.bank` tem CHECK**, e ele é a razão de banco novo exigir migração
(ver §2.3). Hoje aceita os seis do catálogo mais `desconhecido`.

O que protege o dado é **login + RLS + JWT**, não obscuridade: as `VITE_*` são
URLs públicas por design.

## 1.5 As seis rotas

`navegacao/rotas.ts` é **fonte da verdade única**: a `NavPrincipal` e o `<Routes>`
leem a mesma lista, então não existe link para rota inexistente nem rota alcançável
só por URL digitada.

`/` Painel · `/lancamentos` · `/faturas` · `/importar` · `/categorias` ·
`/recorrencias`. URL desconhecida redireciona ao Painel.

## 1.6 Cobertura de bancos

**Seis** bancos no catálogo (`nubank`, `bradesco`, `bb`, `sicredi`, `sicoob`,
`mercadopago`) e **nove parsers**: fatura e extrato do Nubank, do Bradesco e do
Mercado Pago, mais o extrato do BB, do Sicredi e do Sicoob. Ver
[ADR-0006](./docs/adr/0006-detector-de-layout-e-um-parser-por-banco.md).

⚠️ **A migração `0004` precisa estar aplicada no Neon** antes do primeiro
documento do Mercado Pago — sem ela o insert bate no `accounts_bank_check` e a
importação falha inteira, com uma mensagem de Postgres que não diz ao usuário o
que aconteceu.

**Duas coisas que só o Mercado Pago faz**, e que qualquer mexida nesses parsers
precisa preservar:

- **No extrato, a descrição pode ficar ACIMA e ABAIXO da linha do valor ao
  mesmo tempo.** O que junta os três é a **distância** (5–7pt), não a
  vizinhança: entre dois lançamentos há ~30pt, e a linha logo abaixo de um
  valor pode ser o prefixo do *próximo*.
- **Na fatura, a palavra "Total" aparece três vezes**, em páginas diferentes e
  com sentidos diferentes — o total da fatura (p. 1 e 2) e o dos lançamentos
  futuros (p. 4). Cada leitura é ancorada num título; confundi-las faria o
  gabarito conferir contra o número errado, que é pior que não conferir.

---

# 2. Padrões

## 2.1 Nomes

**`CONTEXT.md` manda.** Antes de batizar variável, função, arquivo ou coluna,
confira o glossário — ele traz o termo canônico *e* a lista do que **não** escrever
no lugar. "Transação", não "lançamento". "Competência", não "mês de referência".
"Conferência", não "validação". A UI pode mostrar outra palavra ao usuário (a
página de transações se chama "Lançamentos"), e isso é escolha de produto, não
sinônimo autorizado em código.

## 2.2 Dinheiro

- **Sempre centavos, em inteiro.** `amountCents`. Nunca float, nunca string.
- **Sinal:** positivo = saiu dinheiro; negativo = entrou.
- **A formatação passa por `formatBRL`** (`domain/normalize/money`), que é também
  o funil do modo discreto. Formatar dinheiro na mão fura a máscara.
- ⚠️ **Na UI, `useDinheiro()` — nunca o `formatBRL` direto.** Os dois formatam
  igual; só o hook **inscreve o componente** no modo discreto e o faz repintar.
  Trocar o valor de um contexto repinta quem CONSOME o contexto, e o
  `formatBRL` lê um estado de MÓDULO: o componente que o importa direto segue
  mostrando a saída da renderização anterior. Em 31/08 isso deixou **74
  valores na tela** com o modo ligado, mascarando três. Há teste que varre
  `ui/` e `paginas/` e falha no import direto.

## 2.3 Adicionar um banco

**Nada a jusante da leitura muda**, porque todo parser devolve o mesmo
`ParseResult` — transações, gabaritos, período, `AccountHint` e `Forward`. Mas
"a jusante" não é o repositório inteiro, e a lista abaixo é a conta completa:

1. **O parser**, em `domain/parsers/`. Escrito contra um PDF real: assinatura de
   layout é um conjunto de marcadores lidos do documento, e inventar um é
   escrever um detector que nunca casa ou, pior, que casa com o errado.
2. **A assinatura** em `domain/pdf/detect.ts` e o despacho em
   `domain/parsers/index.ts`.
3. **O valor no tipo `Bank`** e o tema em `domain/banks.ts` (o `Record<Bank, …>`
   é exaustivo e cobra isso).
4. ⚠️ **UMA MIGRAÇÃO**, ampliando o CHECK de `accounts.bank`. **Sem ela a
   primeira importação daquele banco FALHA INTEIRA**, com uma mensagem de
   Postgres que não diz ao usuário o que aconteceu — e ela precisa estar
   aplicada no Neon, não só escrita em `backend/db/migrations/`.
5. **O fixture**, por `npm run fixtures -- <pasta> [outra-pasta...]`, com as
   regras de anonimização do banco novo. A auditoria do script **só sabe
   procurar o que já lhe ensinaram**: em 31/08 dois dados atravessaram todas as
   gerações anteriores porque ninguém os tinha posto na lista `PROIBIDOS`.
6. **O carrossel da tela de acesso**, `ui/CarrosselBancos.tsx` — **e só depois
   de os passos 1 e 2 existirem**. Aquilo diz "já lê os extratos de", e um nome
   ali sem parser é o app mentindo na vitrine.

No `detect.ts` a **ordem das assinaturas importa**: o extrato do Bradesco também
contém "Fatura" no rodapé, então a assinatura mais específica vem primeiro.
Melhor ainda é a assinatura que **não depende de ordem** — duas marcas
exclusivas daquele emissor, como as do Mercado Pago (`DETALHE DOS MOVIMENTOS` +
`ID da operação`). "EXTRATO DE CONTA" sozinho casaria por prefixo com o
"Extrato de Conta Corrente" do BB.

## 2.4 Conferência antes de confiar

Todo parser devolve o gabarito que o documento declara — `declaredTotal` na
fatura, `declaredIncome`/`declaredExpense` ou a progressão de `balance` no extrato.
`validar()` confronta e devolve **`confere`, `diverge` ou `sem-gabarito`**.

Divergir faz o app **avisar**, não mostrar número errado. Esse é o mecanismo de
confiança do sistema — não o contorne.

## 2.5 Estado de tela

- **A URL é o estado do recorte.** `useFiltros` não tem `useState` atrás:
  recarregar mantém o filtro, Voltar desfaz um de cada vez, e mandar a tela para
  alguém é copiar o endereço. Escrever filtro usa `replace: true`, senão cada
  caractere digitado na busca vira uma entrada no histórico.
- **Estado que precisa sobreviver à navegação vai acima das `<Routes>`.** É por
  isso que o `ImportacaoProvider` existe: um PDF já lido não pode se perder porque
  a pessoa foi ao Painel conferir uma coisa.

## 2.6 Provider + hook no mesmo arquivo

É o padrão daqui: `IdiomaProvider`/`useT`, `DadosProvider`/`useDados`,
`DiscretoProvider`/`useDiscreto`, `ImportacaoProvider`/`useImportacao`,
`Portal`/`useTravarRolagem`.

O hook **lança fora do provider** quando a ausência é erro de programação
(`useDados`, `useImportacao`) e **devolve um padrão seguro** quando não é
(`useDiscreto`: um componente isolado num teste não deve quebrar por causa de um
modo de exibição).

⚠️ **Cada par novo exige uma entrada em `allowExportNames` no `.oxlintrc.json`** —
senão o lint `--deny-warnings` derruba a verificação inteira.

## 2.7 Texto e erro

- **Nenhuma string de usuário fica no componente.** Tudo por `t('chave')`, com os
  três dicionários (`pt`, `en`, `es`) em pé de igualdade — acrescentar chave num só
  quebra o tipo `Dicionario`.
- **Erro vira chave de tradução** por `chaveDeErro(err, 'fallback')`, e o toast
  mostra a mensagem traduzida. Não jogue `err.message` cru na tela.

## 2.8 Testes

- **Teste ao lado do arquivo:** `x.test.ts` mora junto de `x.ts`. Só os fixtures
  são centralizados, em `frontend/tests/fixtures/`.
- **Teste de domínio é puro** — entra `Line[]` ou `RawTransaction[]`, sai número.
  São eles que sustentam o projeto; a UI é testada por comportamento visível
  (Testing Library), não por implementação.

## 2.9 Regras gerais de código

- **Sem `any`.**
- **Nada de dado mockado silencioso:** número que não pode ser calculado vira
  estado vazio, **nunca zero**.
- **Comentário só onde a regra de negócio não é dedutível do código** — as
  armadilhas abaixo merecem; o resto, não.
- **Toda decisão que um leitor acharia errada vira ADR**, em `docs/adr/`.

## 2.10 Desenho

**A direção é o "livro-razão"**: IBM Plex Sans / Condensed / Mono, a escala de
raio do Tailwind, cartão com sombra, e o gradiente do botão "Entrar" como o
**único** gradiente do sistema (a tela de acesso é vitrine; o resto é
ferramenta). Os tokens e o porquê de cada cor moram em `frontend/src/index.css`.

⚠️ **Não reintroduzir o "impresso e terminal"** — Courier Prime, raio zero, sem
cartão, cor racionada. Ele existiu entre 25 e 31/08 e foi revertido a pedido do
dono; a história inteira está na
[ADR-0012](./docs/adr/0012-o-livro-razao-volta-e-a-calha-lateral-nasce.md). Não
houve achado técnico contra ele: perdeu por gosto, que é critério suficiente.

**A consequência que vale para a próxima direção:** ela tem que caber num
commit reversível. O `f4bd601` cabia — `index.css`, `fontes.css`, `index.html` e
retoques — e por isso o `git revert` resolveu com dois conflitos. Redesenho
espalhado por cinquenta arquivos de componente deixa de ser reversível e vira
reescrita.

**Cor é medida, não opinada.** `python scripts/medir-contraste.py` depois de
mexer em qualquer cor. Texto sobre GRADIENTE passa nas duas pontas, não na
média — o ciano da referência dava 3.94:1 no tema claro e foi recusado por isso.

---

# 3. Antes de dizer que algo está pronto

```bash
npm run verificar          # typecheck · testes · lint · caminhos · build · CSP
npm run verificar:rapido   # o mesmo sem build e sem CSP, para o meio do trabalho
```

Roda os seis na **ordem certa**, imprime o tempo de cada um e sai com código 1 na
primeira falha, com as últimas 25 linhas do erro. A ordem não é opcional, e é por
isso que ela virou script em vez de continuar sendo uma tabela num documento:

- **O lint é `--deny-warnings`: aviso é erro.** O projeto conviveu meses com 4
  avisos "pré-existentes", e 4 avisos fixos treinam qualquer um a não ler a saída
  do lint — o quinto entraria sem ninguém notar. Hoje são **zero**, e qualquer
  aviso novo derruba a verificação. Os pares `provider + hook no mesmo arquivo`
  estão em `allowExportNames` no `.oxlintrc.json`: é o padrão idiomático do React,
  e separá-los custaria 40 arquivos reescritos para ganhar hot-reload em arquivos
  que ninguém edita.
- **`npm test` NÃO checa tipos.** Essa armadilha já mordeu quatro vezes. Quem roda
  só ele acha que está verde.
- **`medir-csp.py` mede o `dist/`, não o código.** Rodar sem `npm run build` antes
  aprova o build anterior, e não reclama — um `dist` velho é um `dist` válido.

**Ficam de fora, de propósito** (o script diz isso no fim):

```bash
python scripts/medir-contraste.py   # se mexeu em COR
npm run dev                         # e então, noutro terminal:
python scripts/medir-overflow.py    # se mexeu em LAYOUT (mede 5 jornadas)
python scripts/gerar-prints.py http://localhost:5173   # regerar a folha de provas
```

- Números de referência do diagnóstico (gasto real de junho = R$ 41.012,25 sobre os
  4 PDFs de `D:/extratos/junho2026`) estão em `docs/ESTADO-ATUAL.md`. Mudou sem
  motivo? Regrediu.

---

# 4. Armadilhas

## 4.1 Testes e tipos

- **`vi.stubEnv` NÃO alcança `import.meta.env`** neste setup, só `process.env`. Um
  teste que tente fixar `VITE_*` falha em silêncio, lendo o valor real do
  `.env.local`. Por isso `recuperar-senha.test.ts` assevera a **forma** da URL, não
  o valor da base. `neon.ts` tem o mesmo padrão e baterá na mesma parede.
- **Suíte verde não é suíte determinística.** Três execuções do mesmo commit já
  deram 4 → 1 → 0 falhas: os testes que sobem o `<App/>` com `userEvent` estouravam
  o `testTimeout` sob disputa de CPU (hoje 15000ms). **Se um teste falhar sem você
  ter mudado nada, rode de novo antes de investigar o código** — e verifique sob
  carga, porque passar numa máquina ociosa não prova nada.
- **`git stash` sem `-u` não guarda arquivo novo não rastreado**, e um diagnóstico
  já concluiu "erro pré-existente" por causa disso. Para bissecar: `git stash -u` e
  `tsc -b --force` (o `tsc -b` é incremental e mente com cache quente).
- **Nada que exercite o pdf.js de verdade está na suíte.** Os fixtures são JSON já
  extraído e `domain/pdf/load.ts` é mockado em jsdom (que não tem `DOMMatrix`): a
  suíte passa verde com o parser quebrado. Upgrade de pdf.js exige prova à parte.
- **A suíte mocka o SDK do Neon inteiro.** Regressão de login não é pega por teste
  nenhum — ver [ADR-0008](./docs/adr/0008-o-login-nao-tem-rede-de-testes.md).
- **`vi.mock('../x')` recebe STRING, não import.** Nem o `tsc` nem o build reclamam
  quando o caminho deixa de resolver: o módulo **real** entra no lugar do dublê e o
  teste passa a exercitar outra coisa. Mover um arquivo de teste de pasta quebra
  todos os `vi.mock` relativos dele **em silêncio** — e nem sempre com teste
  vermelho: dois `Auth.test` continuaram verdes com o mock morto, porque o módulo
  real por acaso se comportava igual. Depois de mover teste, rode
  `npm run caminhos` (já incluso no `npm run verificar`).
- **`tsconfig.test.json` precisa de `vite/client` em `types`**: um teste que
  renderiza o `App` puxa a cadeia até `domain/pdf/load.ts`, que importa o worker do
  pdf.js com sufixo `?url`. Sem isso o `tsc` reprova o que o app compila.

## 4.2 Estrutura e ambiente

- **`vite.config.ts` tem `envDir: '..'`** — o `.env.local` fica na RAIZ, não em
  `frontend/`. Sem isso as `VITE_*` viram `undefined` **em silêncio**, o app cai no
  modo "importa e vê" e nenhum build reclama.
- **`frontend/tests/fixtures/` é onde os fixtures moram**, de propósito: 13 testes
  fazem `readFileSync('tests/fixtures/…')` relativo ao CWD e o Vitest roda de
  `frontend/`. Os scripts da raiz apontam para `frontend/tests/fixtures/`.
- **O Vite serve em `localhost`, e `127.0.0.1` pode dar `ERR_CONNECTION_REFUSED`**
  nesta máquina: `localhost` resolve para `::1` primeiro. O padrão de
  `gerar-prints.py` é `http://127.0.0.1:5173` e por isso ele falha sem
  argumento — passe a URL que o `npm run dev` imprimiu. E confira a PORTA: com
  um `dev` já de pé o Vite sobe na seguinte (5174, 5175…) e o medidor apontado
  para a porta velha mede um servidor morto ou, pior, o build anterior.
- **Vite não recarrega bem quando arquivos nascem ou mudam de lugar.** Depois de
  criar arquivo ou refatorar pastas: reinicie `npm run dev` e dê `Ctrl+Shift+R`.
- **Build verde ≠ runtime verde.** Já quebrou com React duplicado pelo sonner
  (resolvido com `resolve.dedupe`).
- **Editar arquivo versionado com `io.open(..., 'w')` no Python, no Windows,
  converte todo `\n` em `\r\n` em silêncio.** O README inteiro já virou CRLF assim,
  e o validador passou a achar zero blocos mermaid. Use `newline=''`.
- **Nunca commitar PDF real** (`*.pdf` no `.gitignore`): contém CPF, conta e nomes
  de terceiros. `scripts/diagnostico.ts` também é local e git-ignored.

- **A sessão vive em estado do React, lido UMA vez na montagem.** Nada no app
  reconsulta sozinho — então tudo o que muda a sessão de fora precisa ser
  EMPURRADO para as outras abas (`lib/sessao-canal.ts`). Sair da conta era o
  caso que faltava: as outras abas seguiam com `logado = true` até o F5.
- ⚠️ **Não dá para descobrir logout perguntando ao SDK.** O
  `@neondatabase/auth` guarda a sessão em memória e o `getSession` responde do
  CACHE, sem tocar na rede, com TTL igual à validade do JWT. Uma aba que
  reconsultasse depois do logout de outra ouviria "ainda logado" — quem recebe
  o aviso derruba direto. É o mesmo cache que fez o aviso de e-mail confirmado
  não sumir em 13/08.

## 4.3 Segurança e cabeçalhos

- **Nada do `vercel.json` vale localmente** — nem em `npm run dev`, nem em `vite
  preview`. Headers e rewrites são da Vercel. Foi por isso que a CSP ficou dois
  meses de fora. `scripts/medir-csp.py` serve o `dist` com os headers lidos do
  próprio `vercel.json`.
- **O hash de script inline é sobre o texto em LF.** No Windows o git entrega o
  `index.html` em CRLF, e o parser de HTML normaliza para LF **antes** de o
  navegador somar o hash. Quem calcular sobre os bytes do disco acha um hash que
  navegador nenhum produz — e "corrige" a política que estava certa.
- **Violação de CSP nem sempre é defeito.** O `eval` da carga é a sonda de
  capacidade do zod (via neon-js), em `try/catch`: negada, o zod só valida pelo
  caminho interpretado. Antes de afrouxar diretiva, procure o `catch` — e não ache
  o culpado com `grep eval`, porque o minificador deixa `Function('')`. O caminho é
  o `SecurityPolicyViolationEvent` (`sourceFile` + `lineNumber` + `columnNumber`).
- **Mexeu no endpoint do Neon? A CSP tem os dois hosts no `connect-src`**, escritos
  à mão no `vercel.json`. Trocar de projeto no Neon sem trocá-los derruba login e
  consulta em produção — e só em produção.

## 4.4 Layout e efeitos

- **Decoração nunca pode entrar no layout de rolagem.** Todo efeito de fundo vai na
  camada `#bg-animation` (`position: fixed`); o brilho da tela de login já criou
  barra lateral pulsante por escalar dentro do `scrollWidth`.
- **O medidor só reprova rolagem LATERAL** — vertical é normal.
- **`animation-fill-mode: both` faz o último quadro VENCER o `style` inline.**
  A classe `.carimbo` é assim: quem escrever `transform` no componente vê o
  valor ser ignorado, e o teste que lê texto passa dos dois jeitos. O ângulo
  do carimbo virou a variável `--giro`, que o último quadro consome.
- **Aba em segundo plano CONGELA a linha do tempo das animações.** No painel
  do navegador embutido, `playState` fica `running` com `currentTime: 0` — o
  ângulo/opacidade que se lê ali é o do PRIMEIRO quadro. Para medir o estado
  final, leia os keyframes (`getAnimations()[0].effect.getKeyframes()`) ou
  chame `.finish()` antes.
- **Filho de `grid` ou `flex` não encolhe sozinho: o padrão é `min-width: auto`**,
  que recusa ficar menor que o min-content do conteúdo. Foi assim que a página de
  Recorrências rolou de lado em 390px por semanas — os dois cards de compromissos
  ficavam com 414px numa coluna de 342, e `overflow-hidden` no filho não resolve,
  porque o que estoura é o próprio filho. A cura é `min-w-0` **no item do grid**.
- **`medir-overflow.py` mede JORNADAS, não uma URL.** Cada peça que só existe
  depois de um clique ou de um foco tem uma entrada em `JORNADAS`, e cada jornada
  tem uma **prova** — a asserção de que a peça está mesmo na tela. Sem a prova,
  medir depois de um clique que não aconteceu devolve OK, o mesmo OK de uma tela
  sã. Peça nova interativa **entra na lista**, senão ela não é medida por
  ninguém.
- **Canvas precisa de `width/height` no CSS.** `renderer.setSize(w, h, false)` não
  escreve o style, e canvas sem dimensão CSS cai no tamanho intrínseco: em HiDPI
  fica com o dobro do viewport, borrado. **Invisível em navegador headless, que
  roda em DPR 1.**
- **Utilitário do Tailwind vence regra do `@layer base`.** `focus:shadow-*` e
  `focus:ring-*` apagam o anel de foco do `index.css`. Estilize foco tudo por
  utilitário **ou** tudo pela regra base, nunca misturado.
- **`prefers-reduced-motion` desliga o loop**, então redimensionar a janela ou
  trocar o tema exige repintura manual — senão o canvas fica branco.
- **Modal vai por `<Portal>`** (`Tutorial`, `EditarPerfil`, `Confirmacao`,
  `Celebracao`). Fora dele, um `fixed` dentro de container com `transform` ancora no
  container, não na viewport.

## 4.5 Nomes e deploy

- **Confira se o subdomínio `.vercel.app` está livre ANTES de adotar um nome.**
  `paypulse.vercel.app` era de outro produto, e as meta tags OG apontaram para o
  site alheio. `curl -s -o /dev/null -w "%{http_code}" https://NOME.vercel.app/` —
  **404 é livre**.
- **Renomear o projeto na Vercel NÃO renomeia os domínios**: *Settings → Domains →
  Edit*.
- **Deployment Protection deixa o site só para quem está logado na Vercel**, e o
  toggle só vale depois de `Save`. O dono, já logado, vê tudo normal enquanto
  ninguém mais entra. **Não religue** — quem protege dado é o login + RLS + JWT.
- **Variáveis `VITE_*` são assadas no build.** Mudar o valor no painel da Vercel
  não altera o site no ar até o próximo *Redeploy*.
- **Login rejeitado por origem** dá `403 {"code":"INVALID_CALLBACKURL"}` em
  `sign-in/social`. A lista fica em *Neon → Auth → Configuration → Domains*.
- **GitHub Pages não serve para este app** (publicava a raiz, cujo `index.html` é o
  arquivo-fonte do Vite → 404). A hospedagem é a Vercel.

---

# 5. Ao escrever código aqui

- **Plano detalhado não substitui review.** Os dois bugs mais graves de uma rodada
  vieram do código de exemplo do próprio plano, transcrito fielmente.
- **Ler o arquivo que nomeia a função não basta; leia quem a chama.** O
  discriminador de transações idênticas não está em `dedupe/hash.ts`, e sim em
  `persist/salvar.ts`, que conta ocorrências e sufixa `#2`.
- **Antes de mover estado, pergunte quem depende de ele sobreviver.** Estado acima
  das rotas costuma estar lá por um motivo que nenhum teste cobre.
- **Push na `main` publica.** Não existe ambiente de homologação: verificar antes é
  a única rede.
