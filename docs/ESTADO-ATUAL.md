# Estado atual do projeto — retomada

> Documento de continuidade. Última atualização: **2026-09-08** (a `Promise.try`, e o polyfill do worker que nunca rodou).
> Leia isto antes de continuar. O README explica o projeto; aqui está **onde paramos**,
> **o que já foi decidido** e **o que vem a seguir**.

> **Regra de retenção** (desde 2026-09-06): as **três rodadas mais recentes**
> ficam aqui; as anteriores vão para [`HISTORICO.md`](./HISTORICO.md), sem
> edição. O que descreve o estado — retomada, fila do que falta, onde o código
> está — nunca sai daqui. O arquivo tinha 2.693 linhas e era o primeiro a ser
> lido numa retomada: a rodada de hoje competia em pé de igualdade com a de 12
> de agosto.

> **Atualização 2026-08-29:** a migração `0003_integridade_referencias_por_usuario.sql` foi aplicada e conferida na branch `production` do Neon (`neondb`). A função e os dois gatilhos de integridade entre usuários estão ativos.

> **Atualização 2026-09-01:** a migração `0005_deduplicacao_por_conteudo.sql` foi aplicada e conferida na branch `production` do Neon (`neondb`). A importação agora calcula `content_hash` a partir do conteúdo financeiro normalizado, ignorando nome e metadados variáveis do PDF; Documentos anteriores à migração também são comparados pelos dados já persistidos.

## Rodada 2026-09-08 — a `Promise.try`, e o polyfill que nunca rodou

O item que abria a fila de código era pequeno: *"medir se a `Promise.try` é
alcançável no pdf.js"*. Ele era pequeno mesmo. O que ele destampou não era.

Ao fim: **1.035 testes (119 arquivos)**, `npm run verificar` verde nos seis
passos, `npm run medir:pdf` verde nos **quatro** cenários novos.

### 1. A `Promise.try` é alcançável, e falha pior que a de 04/09

Medida por sonda, não por dedução: um contador embrulhando as duas APIs, na
página e dentro do worker, durante uma importação de verdade.

| API | thread principal | worker |
|---|---|---|
| `Promise.withResolvers` | 12 chamadas | 6 chamadas |
| `Promise.try` | **0** | **4** |

Ela é usada **só dentro do worker** — o `MessageHandler` do pdf.js a usa para
despachar ação e stream —, e o piso dela é mais alto que o da outra: Chrome
**128** / Safari **18.2**, contra Chrome 119 / Safari 17.4. Todo aparelho entre
esses dois pisos (Chrome 119–127, iOS 17.4–18.1) importava PDF hoje, em
produção, e quebrava.

⚠️ **E quebrava mudo.** O `TypeError` estoura numa thread que ninguém escuta:
não vira toast, não vira erro, não vira nada — a tela fica em **"Lendo o
documento…" para sempre**. O defeito de 04/09 ao menos dizia a frase errada.

### 2. O medidor não alcançava o worker — e por isso passava verde

O primeiro cenário escrito (`delete Promise.try` na página, no molde do que já
existia) passou **verde**, com o defeito presente e reproduzível. O
`add_init_script` do Playwright roda em página e frame; **worker é outra thread,
com outro `globalThis`** — e o worker era o único lugar onde a API é chamada.

A frase do cabeçalho do `medir-pdf.py` dizia, desde 04/09, que a segunda passada
"cobre o worker". Nunca cobriu. Hoje cada cenário apaga a API nos **dois**
contextos: init script na página, e um prelude prependido ao arquivo do worker
pelo próprio servidor do medidor.

⚠️ **O prelude apaga só o que for NATIVO** (`[native code]` no `toString`).
Um `delete` cego apagaria o polyfill que o app acabou de instalar naquele mesmo
global, e o cenário nunca poderia passar — mediria sabotagem, não aparelho
antigo.

### 3. O defeito de verdade: o polyfill do worker nunca rodou

Com o medidor enxergando o worker, o cenário da `withResolvers` — que passava
desde 04/09 — **ficou vermelho**. Não era regressão: era a primeira medição
honesta.

O `carregarPdfjs()` fazia, nesta ordem:

```
polyfillAqui()                          // remenda a thread principal
urlDoWorker(url)  →  if (!faltaWithResolvers()) return url   // "não falta!"
```

O gate perguntava *"falta a API?"* **depois** de a própria função ter posto a
API ali. A resposta era sempre "não falta", o worker recebia a URL crua, e o
`blob:` com o polyfill — as seis linhas que o `AGENTS.md` e o comentário do
`load.ts` descrevem em detalhe — **nunca foi criado uma única vez**. Confirmado
espionando o `new Worker`: URL do arquivo, `{type:"module"}`, zero blobs.

Dois defeitos que se cancelavam num verde: o medidor não alcançava a thread que
precisava do desvio, e a thread que precisava do desvio não o recebia. Nenhum
dos dois era visível pelo outro.

A pergunta agora é feita **antes** do polyfill e viaja como parâmetro:

```ts
const precisaDeDesvio = faltaApiDePromise()   // antes de remendar
polyfillAqui()
… urlDoWorker(worker.default, precisaDeDesvio)
```

### 4. O que mudou no código

- **`POLYFILL_PROMISE`** (era `POLYFILL_WITH_RESOLVERS`) cobre as duas APIs, e
  cada uma por si: um Chrome 126 tem a `withResolvers` nativa e precisa só da
  `try`. Trocar a implementação do navegador pela nossa em quem não pediu seria
  o preço errado.
- **O gate virou `faltaApiDePromise()`** — falta **qualquer** uma das duas. O
  antigo só perguntava pela `withResolvers`, e um Chrome 119–127 a tem: ele
  seguia sem polyfill nenhum.
- **`urlDoWorker(url, precisa)`** recebe a decisão em vez de refazê-la.
- O `import` do Blob **continua estático**, e agora com o porquê escrito: ele é
  içado, então o worker de verdade avalia antes do polyfill — e está certo,
  porque foi medido que o `pdf.worker.min.mjs` não toca nessas APIs na
  avaliação, só ao tratar mensagem, que chega em tarefa posterior. Trocar por
  `import()` dinâmico **é pior**: o corpo do Blob terminaria antes de o worker
  registrar o `onmessage`, e as primeiras mensagens do pdf.js seriam entregues
  a um global sem ouvinte.

### 5. O CI achou o de sempre: teste que media o ambiente

O PR subiu verde aqui e **reprovou no CI**, em dois casos. Não era instabilidade:
os testes do polyfill abriam com `expect(faltaPromiseTry()).toBe(false)` — uma
linha que mede o **ambiente**, não o código. O ambiente de teste do CI não tem
`Promise.try`; o daqui tem.

É a armadilha do `.env.test` de 06/09 com outra roupa, e a mesma frase serve
para as duas: **o que difere entre a máquina do dono e o CI vira teste que só
passa aqui**. Agora cada caso estabelece o estado que vai medir, e quando
precisa de "a API já existe" instala uma **sentinela** — que serve melhor que a
nativa, porque dá para afirmar identidade sobre ela ("não sobrescreveu"
vira `toBe(sentinela)`).

Conferido nos dois runtimes: com as APIs nativas e com as duas apagadas no topo
do arquivo, os 17 casos passam.

### 6. As provas, nos dois sentidos

`load.test.ts` foi de 5 para 12 casos no bloco do polyfill — a `Promise.try` tem
os três que o `MessageHandler` exige (repassa argumentos, transforma exceção
síncrona em promise rejeitada, adota a promise devolvida). **Tirando o polyfill
da `try` e estreitando o gate, 5 testes ficam vermelhos.**

E no navegador, cada defeito foi reintroduzido de propósito:

| o que foi desfeito | o que o `medir:pdf` disse |
|---|---|
| o gate voltar a se perguntar sozinho | cenários 2, 3 e 4 **vermelhos** |
| tirar o polyfill da `Promise.try` | cenário 2 verde, 3 e 4 **vermelhos** |
| nada (código como está) | os quatro **verdes** |

A segunda linha é o que justifica quatro cenários em vez de um: o vermelho diz
**qual** das duas APIs faltou.

### 7. O PR #9 caiu, e a fila de PRs zerou

O último motivo do #9 estar vermelho era o mesmo buraco de higiene do sonner que
o PR #12 tratou em 07/09 — só que noutro arquivo. O #12 consertou
`RecuperarSenha.test.tsx` porque foi lá que o sonner 2.0.8 reclamou; **o buraco
nunca foi daquele arquivo**. A fila de toasts é de MÓDULO, e o `cleanup()` da
Testing Library só desmonta a árvore.

Com a árvore de dependências exata do #9 instalada, `Auth.confirmacao.test.tsx`
reprovava com *"Found multiple elements with the text: /código de 6 dígitos
para …/"* — o toast do caso anterior seguia montado. `Auth.test.tsx` ainda não
reclamava e entrou pelo mesmo motivo. São os três arquivos que importam
`sonner`; agora os três limpam a fila (PR #15).

O #9 então passou, e as **duas provas que o `verificar` não faz** foram
refeitas — desta vez com o medidor que enxerga o worker, o que as torna bem mais
fortes que as de 07/09:

- `npm run medir:pdf`: **OK nos quatro cenários** com o `pdfjs-dist` 6.3.289;
- o grep do piso: as mesmas duas APIs de `Promise` (ambas com polyfill agora) e
  nada acima de `structuredClone` (Chrome 98). **O #9 não sobe o piso.**

Mergeado por rebase. **Zero PRs abertos**, `main` linear, CI verde, produção no
ar com o pdf.js novo.

### 8. Os testes de UI que faltavam, e a dívida de i18n que apareceu debaixo

As cinco peças que nenhum teste cobria ganharam rede: `Diagnosticos`,
`BarraFiltros`, `CompromissosFuturos` e as duas listas que faltavam (por dia e
por categoria). São 42 casos, cada um mirando uma **regra** — a faixa de
diagnósticos que some vazia, o filtro de banco que não aparece com um banco só,
o `NaN` que não pode chegar à tela, o subtotal que separa gasto de entrada.
Provados por cinco mutações, uma por componente.

Duas armadilhas de teste saíram daí, e ficaram escritas no próprio arquivo:

- o **`AnimatePresence` mantém o nó no DOM enquanto ele sai**, então fechar
  exige `waitForElementToBeRemoved` — um `queryByText` logo após o clique ainda
  o encontra, e o teste passaria igual se o fechamento não existisse;
- **valor de fixture igual ao total da seção** faz o teste passar mesmo se a
  soma sumir da tela.

⚠️ **E apareceu que "i18n 100%" era falso desde 13/08.** Ver o parágrafo da
retomada: a conferência daquele dia procurou chave faltando, e o que restava não
era chave faltando — eram textos que nunca passaram por `t()`, invisíveis a um
`grep` por `t('`. Estava todo em `ui/listas/`, e traduzir não bastava: faltava
**repintar**, porque a locale mora num estado de módulo.

### 9. A rede de testes do login passou a existir

A [ADR-0008](./adr/0008-o-login-nao-tem-rede-de-testes.md) abria dizendo que
"uma regressão de login passa verde do começo ao fim, e só o usuário, entrando
com conta real, descobre". **Isso deixou de ser verdade inteira em 08/09.**

`scripts/medir-login.py` sobe um **Auth de mentira** em `127.0.0.1:4599`, serve
o `dist` no mesmo endereço e dirige a tela num Chromium. O SDK de verdade roda —
com o `better-auth` e o `zod` que ele arrasta —, e o que está sendo medido é o
diálogo dele, endpoint por endpoint. O protocolo foi descoberto **espiando**, não
lendo documentação: `GET /get-session` na montagem, `POST /sign-in/email` com o
que foi digitado, e `get-session` de novo.

Cinco cenários: sem sessão, login aceito, login recusado, sessão já existente e
sair. Provados nos dois sentidos por mutação no app:

| mutação | o que reprovou |
|---|---|
| `sair` deixa de avisar o servidor | só o cenário "sair" |
| o app para de perguntar se há sessão | 4 dos 5 |
| o `Auth` para de avisar a recusa | só "login recusado" |

⚠️ **Três coisas que a construção ensinou, e que estão no cabeçalho do script:**

1. **A conta do cenário não pode estar vazia.** O `AberturaTutorial` abre
   sozinho quando `todas.length === 0`, e o modal cobre a tela: todo clique
   depois do login estourava o tempo contra o overlay. A Data API de mentira
   devolve uma transação — é o estado fiel de quem já usa o app.
2. **O medidor mede o `dist`, não o código.** Uma mutação que não compilava
   deixou o build falhar, e os cinco cenários passaram verdes contra o build
   anterior. Mesma armadilha do `medir-csp.py`.
3. **"Algum toast" não é asserção.** O cenário de recusa exigia apenas que
   houvesse um toast, e passava verde com o app engolindo a recusa do servidor
   (havia outro toast na tela). Agora exige a **frase**.

⚠️ **O que ele NÃO cobre continua no roteiro manual**: o Neon de verdade, a
entrega de e-mail, o OAuth do Google e o RLS. Ele prova que o app faz a sua
parte, não que o servidor faz a dele — e por isso a ADR-0008 foi **atualizada,
não revogada**.

Achado de lambuja: o `.env.semlogin.local` é **gitignored**, então o
`build:semlogin` depende da máquina do dono (num clone limpo ele passa por
acaso, porque a ausência das `VITE_*` leva ao mesmo modo). O `.env.login` não
repete o erro — é versionado, com dois endereços de localhost e nenhum segredo.

### 10. O modo "importa e vê" também dependia da máquina

O achado de lambuja virou conserto. Numa máquina com `.env.local` de valores
reais — a do dono —, um `build:semlogin` **sem** o `.env.semlogin.local` caía nos
valores reais e não era semlogin nenhum. Medido: os **dois** valores vazaram para
o bundle.

A consequência era pior que o desperdício: o `medir-pdf.py` mediria um app
**pedindo login**, e diria *"nenhum desfecho conhecido em 25s"* — que não é a
mesma frase que "o app está na tela de acesso". O medidor do motor de PDF
passaria a medir a tela de entrar sem ninguém notar.

`.env.semlogin` agora é versionado e vazio por definição. Provado nos dois
sentidos, com o `.local` escondido: com o arquivo novo, 0 de 2 valores no bundle
e `medir:pdf` OK; sem ele, 2 de 2.

### 11. Os medidores entraram no CI, e o CI achou o defeito deles

`medir:pdf` e `medir:login` ficam fora do `verificar` porque cada um precisa de
um build com `VITE_*` próprias — mas **ficar fora do `verificar` não é motivo
para ficar fora do CI**. Job `medidores`, em paralelo, 1m31s.

E o job novo reprovou de primeira, com o melhor tipo de vermelho:

```
[FALHOU] motor atual: nenhum desfecho conhecido em 25s.
   Tela: Your statement becomes a chart | ... | I can't read this document yet.
```

O app **funcionou nos quatro cenários** e disse a frase certa. Quem estava errado
era o medidor: ele procura os desfechos por **texto em português**, e o app
escolhe o idioma por `navigator.language` — no runner, `en-US`.

⚠️ **Cinco scripts tinham a mesma exposição, e nenhum fixava o locale:**
`medir-pdf`, `medir-overflow` (as provas das jornadas são frases em português),
`medir-a11y` (importa as `JORNADAS` do overflow, então herda), `medir-csp` e
`gerar-prints` — este último geraria a folha de provas do README **em inglês**.
Todos ganharam `locale='pt-BR'`.

**Medidor cujo veredito depende do idioma da máquina não mede o app: mede a
máquina.**

### 12. A mesma armadilha, quatro vezes num dia

Vale registrar junto, porque o padrão é mais útil que os quatro casos:

| onde | o que presumia | quem pegou |
|---|---|---|
| casos do polyfill | que o runtime tem `Promise.try` | o CI |
| listas | que o `IdiomaProvider` começa em `pt` | eu, escrevendo o teste |
| `medir-login` | que o Chromium fala português | eu, antes de subir o CI |
| cinco medidores | que o Chromium fala português | o CI |

**Teste e medidor não presumem o ambiente: estabelecem o que vão medir.** Nas
duas vezes em que essa regra foi seguida antes de subir, o vermelho não chegou ao
CI; nas duas em que não foi, o CI cobrou.

## Rodada 2026-09-07 — o PR #9 destravado pelas duas pontas, e o primeiro fluxo por PR

A primeira rodada inteira em branch: três PRs abertos, conferidos pelo CI e
mergeados por **rebase**, para a `main` continuar linear. Ao fim: `main` em
`b60dd75`, publicada, CI verde, **1.029 testes (119 arquivos)**.

O alvo era o **PR #9** do Dependabot, vermelho por **dois** motivos que não têm
nada a ver um com o outro. Os dois caíram.

### 1. Os 6 avisos do `oxlint` 1.81 (PR #10)

O 1.81 liga três regras novas do plugin `react`, e o lint roda com
`--deny-warnings`: aviso é erro. Cada um pedia um conserto diferente.

| Arquivo | Regra | O que era |
|---|---|---|
| `Auth.tsx` (2×) | `react/refs` | `refs` era um `Record` de três `useRef`, e ler `refs.email` para entregar ao `ref=` é acesso a ref **durante a pintura**. Viraram três refs soltas; o `Record` desceu para dentro de `submeter`, o único lugar onde o campo a focar é escolhido em tempo de execução |
| `AvisoVersaoNova.tsx` | `react/refs` | `ocupadoRef.current` era escrito no corpo do componente. A escrita foi para um efeito |
| `ThemeToggle.tsx` | `react/set-state-in-effect` | o efeito de montagem lia o `localStorage`, chamava `setState` e reestampava o `data-theme` |
| `GraficoCategorias.tsx` | `react/immutability` | o acumulado do donut era somado dentro do `map` do JSX. Virou `geometriaDonut`, função pura que deriva arco e offset antes de desenhar |
| `DadosProvider.tsx` | `react/set-state-in-effect` | **aqui a regra está errada**: buscar na montagem é sincronizar com um sistema externo, que é o caso de uso do efeito. Suprimido na linha, com o porquê escrito |

⚠️ **O `ThemeToggle` mudou de comportamento** — deixou de estampar o `data-theme`
ao montar. Quem faz isso é o script inline do `index.html` (e o do `demo.html`),
pela MESMA regra, antes da primeira pintura: o efeito só reescrevia o que já
estava lá, ao preço de uma renderização em cascata por montagem. Como a leitura
do `localStorage` saiu de um efeito e foi para a pintura, `temaInicial` ganhou o
mesmo `try/catch` que o script inline sempre teve — sem ele, armazenamento
bloqueado deixaria de derrubar só o botão e passaria a derrubar a árvore.

Era o único dos cinco arquivos **sem teste**, e é o único que mudou de
comportamento: ganhou `ThemeToggle.test.tsx`, 5 casos, dois deles **provados nos
dois sentidos** contra a fonte antiga.

### 2. A fila do sonner vazava entre os testes (PR #12)

Seis testes de `RecuperarSenha` reprovavam com o sonner 2.0.8. A causa não era o
sonner nem o componente: **a fila de toasts do sonner é de MÓDULO**, e o
`cleanup()` do Testing Library só desmonta a árvore. Do **quarto** toast do
arquivo em diante, o `<Toaster>` — 3 visíveis por padrão — empilhava o novo atrás
dos velhos e nunca o pintava. O `findByText` estourava o tempo procurando um
texto que o componente produzia direitinho.

Dava para ver no DOM que o próprio erro despeja: o `data-title` visível era o
toast de **outro** teste, ainda montado.

Um `afterEach` com `toast.dismiss()`. O 2.0.8 só mudou *quando* a fila é
esvaziada — o buraco de higiene sempre esteve ali, e o conserto passa nas duas
versões.

### 3. As duas provas que o `verificar` não faz

O #9 sobe o `pdfjs-dist` de 6.2.108 para 6.3.289, e o `AGENTS.md` §3 manda provar
isso à parte. Feito com a árvore de dependências **exata** do #9 instalada:

- **`npm run medir:pdf`** — OK nos dois cenários, inclusive o que apaga
  `Promise.withResolvers` antes de qualquer script;
- **o `grep` do piso de API** — o #9 **não sobe o piso do navegador**. A única
  diferença é que a 6.3.289 deixou de usar `Object.values`.

⚠️ **Achado anterior ao #9 — FECHADO em 08/09, e era pior do que parecia.** A
`Promise.try` já estava no bundle de produção, com piso mais alto que o da
`withResolvers`, e o `load.ts` só remendava a segunda. Medido: ela é
alcançável (4 chamadas por importação, todas no worker), e ao medir isso
apareceu que o polyfill do worker **nunca havia rodado**. Ver a rodada de 08/09.

### 4. O `AGENTS.md` mandava commitar direto na `main`

A regra mudou em 06/09, e a **linha 7** do `AGENTS.md` continuava dizendo
*"Trabalha-se direto na `main`, sem branch de feature"*. O `ESTADO-ATUAL.md`
tinha sido corrigido na mesma rodada; ele não — e é o primeiro arquivo que
qualquer agente lê. É a armadilha que o próprio `CLAUDE.md` descreve sobre si
mesmo: duas cópias da mesma regra divergem, e a errada é sempre a que se leu.

## Rodada 2026-09-06 — a auditoria, e o CI que mostrou que a suíte só passava aqui

Começou como "me traga uma análise deste projeto" e virou a rodada mais longa até
hoje: auditoria de segurança de 20 pontos, o caminho de escrita ganhando teste
pela primeira vez, três medidores novos e o primeiro CI do repositório — que na
primeira execução provou seu valor achando um defeito de anos.

**Estado ao fim da rodada:** `main` em `6cde9b2`, publicada e com CI verde. Os dois
últimos commits (testes de `CarrosselBancos` e `Dropzone`) estão na branch
`testes-ui-restantes`, **ainda sem merge**.

### 1. O caminho por onde o dinheiro entra não tinha um teste

`persist/salvar.ts` — 286 linhas onde se encontram dedupe, vínculo, categorização
e o discriminador `#2` — era o **único** ponto por onde dado entra no banco, e não
tinha nenhum teste. Os três que existiam em `persist/` cobriam os arquivos puros,
que já eram os fáceis.

Hoje tem 21, com um dublê do cliente Neon (`persist/neon-falso.ts`). Dois defeitos
reais caíram junto:

- **`file_hash` era comparado e NUNCA selecionado.** `doc.file_hash` era sempre
  `undefined`, então aquele lado do `||` jamais era verdadeiro. Ficava mascarado
  porque o mesmo arquivo também produz o mesmo `content_hash` — mudaria de figura
  no dia em que `hashConteudoDocumento` mudasse de fórmula, e o sintoma seria
  **dupla contagem**.
- **O `.or()` montava o filtro por interpolação de string.** Os valores são hashes
  nossos, então não havia injeção; o padrão é que estava errado. Virou dois `.eq()`
  pelo builder. De quebra, a consulta parou de puxar **todo documento legado com
  as transações aninhadas** a cada importação (há zero documentos legados no banco
  — a ramificação estava morta).

### 2. A leitura ganhou a metade que faltava da promessa

A **Conferência** cobre a extração. A leitura do banco não tinha equivalente, e era
o único trecho do caminho do dinheiro sem um. `puxarTudo` passou a pedir
`{ count: 'exact' }` e a recusar a resposta quando vêm menos linhas do que o banco
declara (`RecorteIncompletoError`). O `as number` virou conferência de forma em
runtime. Termo novo no `CONTEXT.md`: **Integridade do recorte**.

⚠️ O `db_max_rows` da Data API está **vazio** hoje — conferido. É um campo de
formulário no console do Neon, e ligá-lo trunca toda leitura **sem erro**.

### 3. A fronteira das telas deixou de ser promessa

`aplicacao/` eram 17 linhas de reexportação que ~30 arquivos contornavam, enquanto
dois ADRs prometiam que ela era a fronteira. Virou regra de lint
(`no-restricted-imports`), conferida com uma violação proposital. E `persist/`
virou só o adaptador: 501 linhas puras de regra de dinheiro (`agrupar`, `saldos`,
`aberto`) foram para `domain/`. Ver [ADR-0013](./adr/0013-a-fronteira-das-telas-deixa-de-ser-promessa.md).

### 4. Minimizar em vez de criptografar

Três colunas eram escritas e **nunca lidas**: `transactions.raw` (360 de 360),
`accounts.holder_name` (6 de 7) e `transactions.counterparty_doc` (0 de 360). Dado
sensível sem consumidor é risco puro. A migração `0006` apagou o que havia e trocou
o GRANT de tabela por **GRANT de coluna** — `UPDATE` em `transactions` agora só
alcança `label`, `category_slug` e `kind`, o que faz a frase de abertura do README
virar regra do Postgres em vez de convenção do TypeScript.
Ver [ADR-0014](./adr/0014-minimizar-em-vez-de-criptografar.md).

### 5. O app passou a saber quando quebra

Não havia telemetria nenhuma: em 04/09 o app quebrou no celular de uma parente e a
única razão de alguém ter descoberto foi ela ter contado. A migração `0007` criou
`client_errors`, escrita pelo cliente pela Data API com RLS — sem backend, sem
credencial nova, sem SaaS. Guarda **classe do erro, contexto, rota (sem a query),
build e navegador reduzido**; sem mensagem, sem pilha, sem nome de arquivo, sem
valor. Há teste asseverando cada ausência.
Ver [ADR-0015](./adr/0015-registro-de-falhas-do-cliente.md).

⚠️ **Limite declarado:** sem sessão não há JWT, então falha em tela deslogada não é
registrada.

### 6. Três medidores novos

| comando | o que prova |
|---|---|
| `npm run medir:pdf` | o motor de PDF abre um arquivo num Chromium de verdade, inclusive com `Promise.withResolvers` apagado (em 08/09 virou quatro cenários, e passou a apagar dentro do worker também) |
| `npm run medir:a11y` | axe-core (WCAG 2.1 A/AA) nas MESMAS jornadas do medidor de overflow |
| `npm run medir:peso` | atribui os bytes do chunk principal por sourcemap |

Os três foram **provados nos dois sentidos** — cada um reprova quando o defeito que
ele vigia é reintroduzido de propósito.

O `medir:peso` **corrigiu o ADR-0007**: "o SDK do Neon é 39%" nomeava o alvo errado.
O SDK sozinho dá ~7%; o `zod` que ele arrasta dá **23,4%**. E a animação
(`motion-dom` + `framer-motion`, 12,6%) pesa mais que o SDK inteiro.

### 7. O CI nasceu e achou um defeito de anos no primeiro push

Não havia CI nenhum — a única rede era alguém lembrar de rodar `npm run verificar`.
Agora roda a cada push, mais `npm audit` e `gitleaks`.

E ele ficou **vermelho no primeiro commit**, enquanto o mesmo comando estava verde
na máquina do dono. A causa: **cinco testes de `lib/sessao-remota.test.ts` liam o
`.env.local` REAL**, que é gitignored. Ou seja, **a suíte só passava aqui** — um
clone limpo veria cinco vermelhos. Consertado com um `.env.test` versionado
(valores `.invalid`, RFC 2606).

⚠️ **Duas lições caras desta rodada, ambas já no `AGENTS.md` §4:**
- **Ligar um bot é publicação, não configuração.** O `dependabot.yml` entrou na
  `main` e abriu **7 PRs em dois minutos**. A config corrigida ignora major e
  limita a 1 PR.
- **Tabela nova nasce com privilégio que ninguém concedeu.** A `client_errors`
  apareceu com `UPDATE` apesar do `grant` listar só três: o banco tem
  `DEFAULT PRIVILEGES`. Conceder não tira o que veio de graça.

### 8. Documentação

`ESTADO-ATUAL.md` tinha 2.693 linhas e era o primeiro arquivo de uma retomada.
Ganhou **regra de retenção**: as três rodadas mais recentes ficam, o resto vai para
[`HISTORICO.md`](./HISTORICO.md) sem edição. Os dois prompts que descreviam um
produto em Next.js + Supabase saíram.

## 🚀 Retomada em 30 segundos

**O app está no ar e saudável** em https://capital-financeiro.vercel.app —
**1.082 testes (125 arquivos)**, `npm run verificar` verde nos seis passos e
**zero PRs abertos** (o #9 do Dependabot caiu em 08/09, com o `pdfjs-dist` em
6.3.289 e as duas provas à parte refeitas).

⚠️ **O fluxo mudou em 2026-09-06: trabalho vai para BRANCH, não direto na
`main`.** Todo push na `main` publica em produção em ~1 min, e o dono pediu
para ver antes. **Não commitar nem dar push sem pedido explícito na conversa em
andamento** — uma autorização dada semanas atrás não cobre publicar trabalho que
ninguém viu.

⚠️ **Rebobinar o git NÃO reverte a Vercel.** Desfazer um deploy exige *Instant
Rollback* ou *Promote* no painel. E enquanto um rollback estiver ativo, push na
`main` **não promove sozinho**.

**Há CI desde 2026-09-06** (`.github/workflows/verificar.yml`), em **três
jobs**: `verificar` (os seis passos), `seguranca` (`npm audit` + `gitleaks`) e,
desde 08/09, `medidores` — o `medir:pdf` e o `medir:login`, que precisam de
builds próprios e por isso ficam fora do `verificar`. Ele achou um defeito de
anos no primeiro commit (rodada de 09-06, item 7) e, no primeiro dia dos
medidores, achou que **eles** dependiam do idioma da máquina.

**Cinco medidores fora do `verificar`**, cada um provado nos dois sentidos:
`medir-contraste.py` (cor), `medir-overflow.py` (layout), `npm run medir:a11y`
(marcação, mesmas jornadas do overflow) e `npm run medir:pdf` (o motor de PDF
abre arquivo, em **quatro** pisos de navegador — e desde 08/09 apagando a API
também DENTRO do worker, que é onde ela é usada) e `npm run medir:login` (o
login, contra um Auth de mentira, em cinco cenários — a rede que a ADR-0008
dizia não existir). Mais o `npm run medir:peso`, que atribui os bytes do bundle.

**O desenho é o "livro-razão"** (IBM Plex, raio, cartão com sombra) desde a
reversão de 31/08 — ver [ADR-0012](./adr/0012-o-livro-razao-volta-e-a-calha-lateral-nasce.md).
A navegação é a **calha lateral** a partir de `lg`; abaixo disso, a barra
horizontal. **Não sugerir voltar ao "impresso e terminal".**

**Seis bancos, nove parsers.** O Mercado Pago entrou em 31/08 (fatura e
extrato), com a migração `0004` aplicada e conferida em produção.

✅ **As quatro peças que "nenhum medidor alcançava" agora são medidas** — o
editor de compra, a dica de sintaxe da busca, os diagnósticos e o modo discreto
viraram jornadas de `medir-overflow.py` (31/08). Peça interativa nova **entra na
lista `JORNADAS`**, senão volta a não ser medida por ninguém.

✅ **`npm audit`: zero falhas** (31/08). O SDK do Neon está em `0.7.0-beta` desde
28/08, e as 5 falhas que restavam eram do `@vercel/node`, que saiu junto com a
Fatia 1b. Vermelho no `audit` voltou a significar descuido, não decisão.

⚠️ **O repositório é PÚBLICO** desde 25/08. Nada vazou (a varredura de 13/08 vale:
nunca houve `.env`, PDF ou credencial versionados), mas a regra "nunca commitar
PDF real" mudou de peso. Ver a rodada de 31/08, item 5.

**O QUE DEPENDE DE VOCÊ — ninguém mais pode fazer:**

| O que | Por que está parado |
|---|---|
| **`allow_localhost: true` em produção** | Desligar quebra o login no `npm run dev`. Decisão de produto |
| **Cadastro sem verificação de e-mail** | `require_email_verification: false` + sem captcha: qualquer um cria conta com e-mail alheio |
| **CORS do Neon Auth** | Reflete QUALQUER origem com credenciais. **Não tem conserto no repositório** — é chamado para o Neon |
| **Pentest da Strix** | A CLI está instalada; falta Docker de pé + `STRIX_LLM`/`LLM_API_KEY` |
| **Importar os PDFs do Mercado Pago pelo app** | Os parsers conferem contra fixture; ninguém ainda gravou no banco de verdade. É a prova que falta |
| **Rodar o [`VALIDACAO-MANUAL.md`](./VALIDACAO-MANUAL.md)** | Precisa de conta real e caixa de entrada real — substitui o teste de login que não existe |
| **Amostra da Caixa / layout A do BB** | O extrato da Caixa veio como imagem, e o app lê texto |
| **Revisão de en/es** | As traduções são minhas; falta olho de nativo |

**O QUE DÁ PARA ESCREVER EM CÓDIGO** (a fila voltou a existir em 31/08, depois
de ter acabado em 13/08):

| O que | Tamanho |
|---|---|
| **Tirar o `zod` da primeira pintura** — 23,3% do chunk principal (242 kB), mais que o `react-dom` | médio, mas **BLOQUEADO**: ver abaixo |
| **Conciliação em duas colunas** — a dupla contagem, que hoje é um número que pede fé | rodada inteira: exige o vínculo registrar COM QUEM casou |
| **Regra de categorização com operadores** | exige migração de `merchant_rules`; o avaliador (`consulta.ts`) já está pronto |

⚠️ **O `zod` foi investigado em 08/09 e NÃO é só técnico.** Medido: são 242 kB
(23,3%) do chunk principal, vindos do `better-auth` por dentro do SDK do Neon. O
caminho existe — a tela de acesso é a PRIMEIRA pintura (`logado` começa
`false`), então o SDK poderia carregar depois dela. Só que:

1. **Piora o piscar.** Quem já está logado veria a tela de entrar por mais
   tempo, porque `checarSessao()` passaria a esperar um download. É decisão de
   produto, do mesmo naipe da reversão do desenho: não se resolve por medição.
2. **É mexer em autenticação**, e a [ADR-0008](./adr/0008-o-login-nao-tem-rede-de-testes.md)
   manda isso para o roteiro manual, com o dono presente.

✅ **A metade técnica do impedimento caiu no mesmo dia**: o
`npm run medir:login` existe, e mexer no carregamento do SDK agora tem rede — os
cinco cenários reprovam se o login parar de funcionar. **Falta só a decisão de
produto do item 1**, que é do dono: aceitar (ou não) que quem já está logado veja
a tela de entrar por mais tempo. Medido o ganho, ele decide; sem isso, o `zod`
fica onde está.

> Os testes de UI e o `zod` vêm da prancheta de 31/08. Duas propostas daquela lista
> morreram na reversão do desenho: a régua do banco (o argumento era gastar a
> única exceção de raio zero, e não há mais raio zero) e a impressão de verdade
> (era "a piada funcionando" num app que parecia impresso).

> A **Fatia 1b** saiu daqui: foi descartada em 31/08, com
> [ADR-0011](./adr/0011-backend-serverless-descartado.md). Não está parada — não
> existe mais.

**O que o usuário precisa conferir na próxima vez que abrir** (nesta ordem):

1. **Criar uma conta de verdade e ver o e-mail de confirmação chegar.** O fluxo
   está pinado por teste e os endpoints foram sondados, mas a **entrega**
   depende do remetente da Neon e não dá para verificar sem uma caixa real.
2. **O card "Próximas faturas" do Bradesco** — a fileira de saldos agora mostra
   um card por banco com o número que cada um declara (ver a rodada de 12/08).
3. **O gráfico de saídas por dia**, que ocupou a metade vazia do painel.

**Antes de dizer que algo está pronto**, rode **`npm run verificar`** (17/08).
Um comando só: typecheck, testes, lint, caminhos em string, build e CSP, na
ordem certa e falhando alto. Cor e layout continuam à mão (`medir-contraste.py`,
`medir-overflow.py`) porque um precisa de escolha e o outro do `dev` de pé.
**`npm test` NÃO checa tipos** — essa armadilha já mordeu quatro vezes.

⚠️ **A dívida de i18n NÃO tinha acabado**, e este parágrafo dizia que sim
desde 13/08 — "conferida arquivo a arquivo, não presumida". A conferência
daquele dia procurou **chave faltando**, e o que restava não era chave faltando:
eram textos que nunca tinham passado por `t()`. Ficaram invisíveis porque
`grep` por `t('` não acha o que nunca foi escrito assim.

O resto era todo em `ui/listas/`, achado em 08/09 ao escrever os testes das
listas: dois arrays de dias e meses cravados em português no `cabecalhoDia`, as
quatro colunas do `CabecalhoLancamentos` (Data, Descrição, Categoria, Valor) e
as duas frases de estado vazio. Os nomes de data agora saem do `Intl` na locale
ativa, como o `mesAbrev` já fazia, e as frases viraram seis chaves `lista.*` nos
três dicionários.

⚠️ **Traduzir não bastava: faltava repintar.** `cabecalhoDia` lê a locale de um
estado de MÓDULO, e estado de módulo não inscreve componente nenhum — é a mesma
armadilha do `formatBRL` direto, que deixou 74 valores sem o modo discreto em
31/08. Quem inscreve é o `useT()`, e é por isso que ele entrou na `ListaPorDia`
mesmo onde a frase já viria certa.

Agora a afirmação tem prova em vez de conferência: `listas.i18n.test.tsx` troca
o idioma **com a tela montada** e exige que o texto acompanhe — cinco casos, e
devolver o array de dias derruba o do cabeçalho.

## ⚠️ A REFORMA (leia antes de tudo)

**A estrutura de pastas mudou.** O que era `src/` agora é `frontend/src/`.
Monorepo com npm workspaces: `frontend/` (app React) e `backend/`
(migrations SQL hoje; a API é a Fatia 1b). `scripts/` continua na raiz.
`neon/migrations/` virou `backend/db/migrations/`.

Spec: `docs/superpowers/specs/2026-08-07-reforma-arquitetura-e-design-design.md`
Plano da fatia 1a: `docs/superpowers/plans/2026-08-07-reforma-fatia-1a-arquitetura.md`

**Duas armadilhas novas desta mudança:**

1. **`vite.config.ts` tem `envDir: '..'`.** O `.env.local` fica na RAIZ, não em
   `frontend/`. Sem isso o Vite não acharia as `VITE_*` e elas virariam
   `undefined` **em silêncio** — `neonConfigurado` daria false e o app cairia
   no modo "importa e vê", sem login e sem erro de build para denunciar.
2. **`tests/fixtures/` foi para `frontend/tests/fixtures/`** de propósito: 13
   testes fazem `readFileSync('tests/fixtures/…')` relativo ao CWD, e com o
   Vitest rodando de `frontend/` eles continuam resolvendo sem edição. Os
   scripts da raiz, esses sim, apontam para `frontend/tests/fixtures/`.

### Estado das fatias

| Fatia | O que é | Estado |
|---|---|---|
| 1a | `frontend/` + `backend/` com workspaces | ✅ **no ar** (07/08) |
| 4a | seletor de idioma fora da UI (código i18n intacto) | ✅ **no ar** (07/08) |
| 2 | router + páginas de navegação (a 7ª, "Datas", saiu em 12/08) | ✅ **no ar** (07/08) |
| 3 | design "livro-razão" + gráficos interativos | ✅ **no ar** (07/08) |
| 4b | CSP completa, medida contra o build | ✅ **no ar** (09/08) |
| 1b | backend real (Vercel Functions) | ❌ **descartada** (31/08) — [ADR-0011](./adr/0011-backend-serverless-descartado.md) |

~~**A fatia 1b é o único item aberto da reforma**~~ — **descartada em
2026-08-31**. O código chegou a ser escrito em 28/08 e nunca foi commitado; o
cliente segue falando direto com a Data API, que funciona, com RLS, como sempre
funcionou. O porquê está na [ADR-0011](./adr/0011-backend-serverless-descartado.md).
**A reforma acabou: as seis fatias estão resolvidas.**

**Decisões da reforma:** nginx/apache foi **descartado** (o app está na
Vercel, não há servidor próprio nem painel de banco exposto); o backend será
**real**, em Vercel Functions, com o RLS preservado via
`set_config('request.jwt.claims')` numa role sem BYPASSRLS.

**567 testes (75 arquivos)**, build e lint limpos, medidor de overflow OK,
contraste OK nos dois temas, CSP aprovada nas duas jornadas e contra o site no ar.

## Onde o código está

- **Nome do sistema:** **Capital Financeiro** (era "Controle Financeiro", passou por
  "PayPulse" e voltou atrás — ver armadilha de domínio no fim).
- **Branch:** `main`, direto. A `feat/ingestao-documentos` foi mesclada (PR #1) e
  aposentada — **não se trabalha mais nela**.
- **Remoto:** `git@github.com:cielioqueiroz/controle-financeiro.git`
  (o repositório mantém o nome antigo de propósito: renomear quebraria caminhos).
- **No ar:** **https://capital-financeiro.vercel.app** — projeto `capital-financeiro`
  na Vercel, conectado ao GitHub. **Todo push na `main` publica sozinho** em ~1 min.
- **Pastas:** monorepo npm — `frontend/` (o app React, onde vivem os testes e o
  `index.html`), `backend/` (por ora só `db/migrations/`), `scripts/` na raiz.
- `npm test` = **567 testes verdes** (75 arquivos), `npm run build` e `npm run lint` OK.

## Como validar rapidamente que nada quebrou

```bash
npm test && npm run build && npm run lint      # os três, sempre: test NÃO checa tipos
npx tsx scripts/diagnostico.ts "D:/extratos/junho2026"   # PDFs reais, fora do repo
python scripts/medir-overflow.py                          # com npm run dev rodando
python scripts/medir-contraste.py                         # WCAG dos pares em uso
python scripts/medir-csp.py                               # DEPOIS de npm run build
```

**O `medir-csp.py` mede o `dist/`, não o código.** Rodar sem `npm run build`
antes aprova o build anterior — e ele nem reclama, porque um `dist` velho é um
`dist` válido. Duas jornadas cobrem o app inteiro, porque a tela depende de o
build ter ou não as `VITE_*`:

```bash
npm run build && python scripts/medir-csp.py             # tela de acesso + login real
# e a de importação, que precisa de um build SEM Neon (modo "importa e vê"):
cd frontend && VITE_NEON_DATA_API_URL= VITE_NEON_AUTH_URL= npx vite build --outDir /tmp/dist-anon
python scripts/medir-csp.py --dist /tmp/dist-anon --pdf .amostras-bancos/bb-cmbf.pdf
```

**Depois do deploy, uma terceira medição**, que é a única que prova que a
Vercel entrega os headers — até a borda dela aplicar, o `vercel.json` é uma
intenção. Nesse modo o script lê a CSP **da resposta do servidor**, não do
repositório (divergência entre as duas é justamente o que se quer descobrir),
e confere que `/.env`, `/.git/config` e `/scripts/*` não respondem 200:

```bash
python scripts/medir-csp.py --url https://capital-financeiro.vercel.app
```

**Números de referência** (se algum mudar sem motivo, algo regrediu). O
diagnóstico **soma o que a pasta tem**, sem filtrar competência — número de
referência sem o conjunto de arquivos ao lado não é reproduzível, e foi o que
gerou a dúvida das "Entradas" que durou de 05 a 09/08:

| Medida | Valor esperado | Conjunto |
|---|---|---|
| Gasto real total | **R$ 41.012,25** | os 4 PDFs de `D:/extratos/junho2026` |
| Entradas | **R$ 50.281,18** | idem |
| Vinculado (fora da conta) | **R$ 23.353,68** | idem |
| Supermercado | **R$ 918,46** (27 lançamentos) | idem |
| Fatura Nubank — total declarado | R$ 8.324,24 | idem |
| Fatura Bradesco — total declarado | R$ 5.529,44 | idem |
| Compromissos futuros | 34 parcelas · R$ 5.265,30 | idem |
| Gasto real / Entradas | R$ 40.955,46 / R$ 45.441,75 | **só os 3 PDFs de junho** |
| Extrato BB de amostra (`bb-cmbf.pdf`) | **94 lançamentos**, bate ao centavo | — |
| Testes | **567** (75 arquivos) | — |

Conta de teste no Neon: `teste.migracao@exemplo.com` (senha **não** versionada).
⚠️ **Essa conta nunca recebe e-mail** — `exemplo.com` é domínio reservado. Serve
para logar, nunca para testar e-mail. Para isso use uma conta com caixa real.
Existe também uma conta criada via Google (sem senha própria, então não serve
para testar redefinição), e uma conta criada com e-mail e senha justamente para
testar a recuperação.

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

> **Estado em 2026-08-29:** a correção de integridade da migração `0003` foi aplicada
> em produção. O que permanece na fila são três frentes, duas dependentes de
> configuração/amostra e uma de validação manual:
>
> 1. **Fatia 1b (backend real)** — precisa da `DATABASE_URL` do Neon (role
>    `authenticated`, sem BYPASSRLS) no `.env.local` da raiz. Sem ela não há o
>    que testar contra o banco.
> 2. **Mais bancos** — parada desde 2026-07-23 por falta de amostra: a Caixa só
>    veio como imagem (o app lê texto), e o layout A do BB (2020) espera um PDF
>    nesse formato aparecer.
> 3. **Conferir logado, no navegador** — as telas das rodadas de agosto (as sete
>    páginas, os gráficos novos) foram exercidas por teste de componente e pelo
>    Chromium sem sessão. A senha da conta de teste não é versionada, então
>    quem valida contra dado real é o usuário.
>
> A fila histórica abaixo fica como registro do que foi decidido em cada item.

> **Atualização 2026-07-24 (fim da sessão):** o usuário concluiu e **testou** os itens
> **0** (recuperação de senha ponta a ponta), **1** (nome no e-mail — trocou o
> *Application Name* no Neon) e **5** (filtro por banco e categorias personalizadas
> conferidos logado). Itens **2** (PDF real + compartilhar) e **4** (saldo por conta)
> foram entregues nesta sessão, junto do **polimento de design** (erro coeso, foco por
> teclado, alvos de toque, donut sticky, ações no topo-direito). **Atualização
> 2026-07-29: o item 3 (i18n) foi CONCLUÍDO** — resta só "mais bancos" (bloqueada até
> vir amostra de PDF de texto). As migrações `0002` e `0003` já foram aplicadas e
> conferidas em produção.
> O envio por **e-mail** (antigo passo 3 do item 2) foi **descartado**.
> Spec/plano do design em `docs/superpowers/specs/2026-07-24-polimento-design-design.md`.

### 0. ~~Verificar a recuperação de senha no navegador~~ ✅ FEITO E TESTADO (2026-07-24)

⚠️ **Atualização 2026-07-23:** o login automático pós-reset foi **removido** (agora
sempre volta ao card de entrar com o e-mail preenchido). Isso muda o roteiro abaixo:
o passo 4 já não "entra direto", e o passo 7 (F1: reset com sessão de outra conta
ativa) precisa ser refeito contra o comportamento novo. O usuário verificou modais e
rolagem em 2026-07-23, mas **não** o fluxo de troca de senha real ponta a ponta.

O código está no ar e revisado; o fluxo de e-mail real ainda não foi exercido no navegador.

⚠️ **Este roteiro troca a senha de verdade** da conta de teste — não é
ambiente de teste. Anote a senha que usar.

Roteiro, em ordem (**1 e 2 já feitos em 2026-07-19**, o servidor sobe em
`http://localhost:5173/` e o medidor deu OK em 1280×800 e 390×844):

1. ~~`npm run dev`, `Ctrl+Shift+R` (nasceram arquivos novos).~~ ✅
2. ~~`python scripts/medir-overflow.py` — sem rolagem lateral.~~ ✅
3. "Esqueceu a senha?" → pedir link para a conta de teste.
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

## ⚠️ Notas de armadilha — mudaram para o `CLAUDE.md`

As ~35 armadilhas de ferramenta e ambiente que viviam aqui (o `vi.stubEnv` que não
alcança `import.meta.env`, o hash de CSP em CRLF, o canvas em HiDPI, a Deployment
Protection da Vercel) foram para [`CLAUDE.md`](../CLAUDE.md) em 2026-08-17, **sem
perda de conteúdo**.

O motivo: elas mordem *toda* sessão de trabalho neste repositório, e num arquivo que
o agente carrega sozinho elas chegam **antes** do erro. Aqui dependiam de alguém
rolar 1.500 linhas de diário até encontrá-las — que é exatamente como elas foram
redescobertas na marra, mais de uma vez.

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

> Só decisões **visuais** ficam aqui: são baratas de reverter e não valem um ADR.
> As nove decisões duras — competência, vínculo, PDF no cliente, Neon, escopo
> retrospectivo, parser por banco, code-splitting, SDK do Neon e o descarte do
> shadcn/ui — foram para [`docs/adr/`](./adr/) em 2026-08-17.

- **`--color-marca` (âmbar) é separada de `--color-confere`.** A marca é identidade
  (logotipo, favicon, moeda, foco); o "confere" carrega **semântica** de "o total bate".
  Âmbar já era a cor de `--color-ressalva`: unificar faria o toast de sucesso parecer aviso.
- **O "confere" continua verde**, porém oliva dessaturado (`#6b8f4e`). Verde=certo /
  vermelho=errado é leitura aprendida; trocar prejudicaria a compreensão.
- **Cada tema tem seus próprios tons.** Âmbar claro não tem contraste sobre creme, então o
  tema claro usa versões escurecidas de marca, confere, ressalva e falha.
- **Partículas leem `--color-particula` e `--particula-alfa`**, variáveis próprias por tema,
  com **blending normal** nos dois — aditivo só clareia e apagaria cor escura.
- **O tutorial diz "Bem-vindo(a) ao seu controle financeiro"** — frase comum, não marca.
  Fica em português mesmo depois do rename.

---

## Melhorias futuras mapeadas (não urgentes)

**Adiados de propósito no review final da recuperação de senha (2026-07-19).**
Todos avaliados, nenhum bloqueia:
- ~~`limparTokenDaUrl` não tem teste direto~~ ✅ **resolvido**: `lib/url-token.test.ts`
  tem o `describe` próprio dele (conferido em 13/08).
- ~~**`CampoSenha` ficou duplicado**~~ ✅ **resolvido (2026-07-24)**: extraído para
  `src/ui/CampoSenha.tsx` e usado em `Auth.tsx` e `RecuperarSenha.tsx`.
- ~~**Mesma frase, severidade diferente**: senha curta é `toast.warning` no login e
  `toast.error` na recuperação~~ ✅ **resolvido (2026-08-13)**: `error` nos dois.
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
- ~~Code-splitting do bundle~~ ❌ **MEDIDO E RECUSADO (2026-08-13)**: fatiar as rotas
  rende **2,6%** de gzip e cria uma falha de navegação depois de cada deploy. O peso é do
  SDK do Neon (**39%** da primeira pintura, medido com build A/B), que precisa carregar no
  boot e importa `zod` estaticamente. Detalhes e a tabela na rodada de 13/08, item 7.
  **Não reabrir sem número novo.**
- Proteger **só os deploys de preview** na Vercel, mantendo a produção aberta.
- Promover `@testing-library/jest-dom/vitest` para `setupFiles` global — a condição que o
  item esperava ("quando houver um segundo teste de componente") aconteceu faz tempo:
  são **35** arquivos repetindo o import (conferido em 13/08).
- ~~`mensagemCamposFaltando([])` com lista vazia gera texto com espaço duplo~~ ✅ **sem
  objeto**: a função não existe mais (conferido em 13/08).

---

## Onde ficam os specs e planos

`docs/superpowers/specs/` e `docs/superpowers/plans/` — cada rodada tem o seu par:
2026-07-18 (ajustes do formulário de acesso; fundo animado + rename + card OG) e
2026-07-19 (`*-recuperacao-de-senha*`). O plano da recuperação guarda, na Task 0, o
formato real do link confirmado contra o servidor.

O ledger de execução fica em `.superpowers/sdd/progress.md` (git-ignored) — é ele que
registra, por tarefa, o que cada review achou e o que foi adiado de propósito.
