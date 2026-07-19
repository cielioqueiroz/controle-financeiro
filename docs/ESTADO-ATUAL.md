# Estado atual do projeto — retomada

> Documento de continuidade. Última atualização: **2026-07-19**.
> Leia isto antes de continuar. O README explica o projeto; aqui está **onde paramos**,
> **o que já foi decidido** e **o que vem a seguir**.

## Onde o código está

- **Nome do sistema:** **Capital Financeiro** (era "Controle Financeiro", passou por
  "PayPulse" e voltou atrás — ver armadilha de domínio no fim).
- **Branch:** `main`, direto. A `feat/ingestao-documentos` foi mesclada (PR #1) e
  aposentada — **não se trabalha mais nela**.
- **Remoto:** `git@github.com:cielioqueiroz/controle-financeiro.git`
  (o repositório mantém o nome antigo de propósito: renomear quebraria caminhos).
- **No ar:** **https://capital-financeiro.vercel.app** — projeto `capital-financeiro`
  na Vercel, conectado ao GitHub. **Todo push na `main` publica sozinho** em ~1 min.
- Árvore limpa, `main` sincronizada com o remoto em **`83775ee`** (push feito em
  2026-07-19). `npm test` = **275 testes verdes** (27 arquivos), `npm run build` e
  `npm run lint` OK. Foram 26 commits em 2026-07-18 e 18 em 2026-07-19.

> ⚠️ **A recuperação de senha está no ar sem nunca ter rodado num navegador.**
> Revisada e com testes, mas tudo em jsdom. É o **item 0** da fila — faça isso antes
> de qualquer coisa nova. Se algo estiver quebrado: `git revert 83775ee` e push,
> que republica em ~1 min.

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
| Testes | **275** (27 arquivos) |

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
- Categorização por regras (30 categorias) + aprendizado; dedupe por hash de documento e de transação.
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

### 0. Verificar a recuperação de senha no navegador — PRÓXIMA, é só isso

O código está no ar e revisado; **nada foi testado contra o navegador ainda**.

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

### 1. Nome errado no e-mail de redefinição

O e-mail sai como **"controle-financeiro"**, não "Capital Financeiro" — é o nome
do projeto no painel do Neon vazando para o usuário. Não é código.

Vale prioridade porque **é o único e-mail que pedimos ao usuário para confiar**,
e chegar sob um nome que ele não reconhece tem forma de phishing. Cuidado com a
armadilha de renomeação registrada no fim deste documento.

### 2. Relatório: PDF de verdade → compartilhar → e-mail

**Decisão tomada:** fazer a corrente completa numa rodada própria, com spec.

O elo que trava tudo: **o app nunca produz um arquivo PDF**. `Baixar PDF` chama
`window.print()` ([Dashboard.tsx](../src/ui/Dashboard.tsx)), que entrega o trabalho ao
diálogo de impressão do sistema. Não há arquivo para anexar nem compartilhar.

Verificado nesta sessão: **não existe `navigator.share` no código** — o tooltip do botão
diz "Baixar ou compartilhar em PDF", mas ele só imprime. A palavra "compartilhar"
promete o que não entrega; corrigir isso faz parte da rodada.

Ordem obrigatória:
1. **PDF real** — jsPDF/pdfmake gerando arquivo no cliente.
2. **Compartilhar** — `navigator.share` com o arquivo (abre WhatsApp, Telegram etc. no celular).
3. **E-mail** — botão ao lado do compartilhar, corpo já personalizado com o nome do
   usuário cadastrado. Exige **serverless function na Vercel** (a chave do serviço de
   e-mail, tipo Resend, não pode ficar no navegador). Agora que o deploy existe, é viável.

### 3. i18n pt/en/es

Botão de idioma trocando **todo** o texto do sistema.

**Decisão pendente, importante:** a moeda deve apenas **formatar** conforme a locale
(`R$ 1.234,56` → `R$ 1,234.56`), mantendo real. **Não converter** — exigiria cotação e
faria os números mentirem sobre as finanças do usuário.

### 4. Saldo bancário por conta

Objetivo: acumular o saldo de cada banco conforme novos extratos entram.

Investigação já feita — **os parsers não extraem saldo hoje**:
- `domain/parsers/bradesco-extrato.ts` lê a coluna de saldo (`COL.saldoRight`, marcador
  `SALDO_INICIAL`), mas só para ancorar datas; não expõe o valor.
- `domain/parsers/nubank-extrato.ts` não captura o "Saldo final do período".

Três partes: **parser** (puro, testável offline) → **migração no Neon** (a tabela
`accounts` não tem coluna de saldo; mostrar o SQL e aplicar em branch antes da produção)
→ **card de saldo** por conta.

### 5. Verificações que nunca foram feitas contra o banco

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
- **`CampoSenha` ficou duplicado**: existe local no `RecuperarSenha.tsx` enquanto
  o `Auth.tsx` mantém a mesma marcação inline. A extração de 2026-07-19 hoisted
  `CAMPO`, `BOTAO_PRIMARIO` e `IconeOlho` exatamente para evitar isso, mas parou
  antes do composto que os junta.
- **Mesma frase, severidade diferente**: senha curta é `toast.warning` no login e
  `toast.error` na recuperação — cor diferente para o mesmo texto no mesmo card.
- **`tsconfig.app.json` e `tsconfig.test.json` são quase-duplicatas** mantidas à
  mão (17 chaves iguais). Foi essa divergência que quebrou o build nesta rodada.
  Um `tsconfig.base.json` que os dois estendam torna a próxima impossível.
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
