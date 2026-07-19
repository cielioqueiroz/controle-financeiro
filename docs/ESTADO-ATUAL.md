# Estado atual do projeto — retomada

> Documento de continuidade. Última atualização: **2026-07-18, fim do dia**.
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
- Árvore limpa. `npm test` = **211 testes verdes** (21 arquivos), `npm run build` e
  `npm run lint` OK. Foram **26 commits** em 2026-07-18.

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

Conta de teste no Neon: `teste.migracao@exemplo.com` (senha **não** versionada).
Existe também `cielioqueirozz@gmail.com`, criada via Google.

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

## 🚧 Fila do que falta — em ordem

### 1. Recuperação de senha ("Esqueceu a senha?") — PRÓXIMA, já investigada

Pedida em 2026-07-18. **Não precisa de servidor nosso**: o Neon Auth (Better Auth) já
tem os endpoints e o Neon envia o e-mail (*Email provider: Shared*, `auth@mail.myneon.app`).

Sondagem feita contra o servidor real — o cliente `neon-js` **não** expõe esses métodos,
então é chamada HTTP direta ao `VITE_NEON_AUTH_URL`:

| Endpoint | Resultado da sondagem |
|---|---|
| `POST /forget-password` | **404** — não existe, não use |
| `POST /request-password-reset` | **200** `{"status":true,"message":"If this email exists…"}` |
| `POST /reset-password` | **400** `[body.newPassword] expected string` — existe, exige `newPassword` + `token` |

Fluxo a implementar:
1. Link "Esqueceu a senha?" no `Auth.tsx` → pede o e-mail.
2. `POST /request-password-reset` com `{ email, redirectTo }`. O `redirectTo` **precisa
   estar nos Domains do Neon Auth** (produção já está; `Allow Localhost` cobre o dev).
3. O Neon envia o e-mail com link contendo `token`.
4. O app detecta o `token` na URL e mostra o formulário de nova senha.
5. `POST /reset-password` com `{ newPassword, token }`.

Ainda a confirmar: o formato exato do parâmetro que volta na URL (`?token=` é o padrão
do Better Auth, mas vale conferir com um e-mail real).

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

`docs/superpowers/specs/` e `docs/superpowers/plans/` — cada rodada de 2026-07-18 tem o
seu par (ajustes do formulário de acesso; fundo animado + rename + card OG). O ledger de
execução fica em `.superpowers/sdd/progress.md` (git-ignored).
