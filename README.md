# 💰 Capital Financeiro

Importe a **fatura ou o extrato do banco em PDF** e veja, com clareza, para onde o seu dinheiro foi. O app lê o PDF **dentro do navegador**, extrai os lançamentos, classifica em categorias e guarda só as transações — o PDF nunca é enviado a lugar nenhum.

Bancos suportados hoje: **Nubank**, **Bradesco**, **Banco do Brasil**, **Sicredi** e **Sicoob** (fatura de cartão e/ou extrato de conta, conforme o banco).

**🔗 No ar:** [capital-financeiro.vercel.app](https://capital-financeiro.vercel.app)

![Capital Financeiro — seu extrato vira gráfico, em menos de um minuto](public/og.png)

---

## 🖼️ Telas

A tela de acesso, nos dois temas — café e papel:

| Tema escuro | Tema claro |
|:---:|:---:|
| ![Login, tema escuro](docs/img/login-escuro.png) | ![Login, tema claro](docs/img/login-claro.png) |

> Tema claro/escuro, fundo de partículas em three.js, e o card de acesso à direita com a frase à esquerda — sem rolagem, do desktop ao celular.

---

## ✨ O que ele faz

- 📄 **Importa PDF** de fatura/extrato e extrai os lançamentos automaticamente (pdf.js, no navegador)
- ✅ **Confere com o banco ao centavo** — cada parser valida o total lido contra o total declarado no PDF
- 🏷️ **Categoriza sozinho** (30 categorias embutidas) e deixa você **criar as suas**
- 🔗 **Evita contar o mesmo dinheiro duas vezes** — cruza fatura × extrato e marca pagamento de fatura e transferência entre contas próprias
- 📅 **Dia / Semana / Mês / Ano** — Mês e Ano agrupam **por fatura (competência)**; Dia e Semana pela data real da compra
- 🏦 **Filtro por banco** — Total geral ou uma conta específica, de qualquer banco suportado
- 💵 **Saldo por conta** — mostra quanto há em cada conta, lido do extrato mais recente (com a data a que se refere)
- 📊 **Gráficos** — donut por categoria e evolução do gasto mês a mês
- 🔮 **Compromissos futuros** — projeta as parcelas que ainda vão cair, sem duplicar quando a fatura chegar
- ✏️ **Editar compra** — renomear o estabelecimento e trocar a categoria
- 🗂️ **Documentos** — ver o que foi importado e apagar uma fatura (ou tudo)
- 📤 **Relatório em PDF** — gera um arquivo PDF do período (jsPDF) e **compartilha** (WhatsApp etc. no celular) ou baixa (no desktop)
- 👋 **Boas-vindas** — saudação pelo nome/apelido, **editar perfil** (apelido e nome) e tutorial guiado no primeiro acesso
- 🌗 **Tema claro/escuro**, responsivo (desktop largo → mobile com menu hambúrguer)

---

## 🚀 Como rodar

```bash
npm install
npm run dev          # http://localhost:5173
```

Outros comandos:

```bash
npm run build        # typecheck (tsc -b) + build de produção
npm test             # Vitest (350 testes)
npm run lint         # oxlint
npm run fixtures -- <pasta-com-os-pdfs>   # regenera fixtures anonimizados
```

Ferramenta local de diagnóstico (roda o pipeline real nos seus PDFs e mostra o total por categoria):

```bash
npx tsx scripts/diagnostico.ts <pasta-com-os-pdfs>
```

### Variáveis de ambiente

Crie um `.env.local` na raiz (o arquivo é ignorado pelo git):

```
VITE_NEON_DATA_API_URL=https://<seu-endpoint>.apirest.<região>.aws.neon.tech/neondb/rest/v1
VITE_NEON_AUTH_URL=https://<seu-endpoint>.neonauth.<região>.aws.neon.tech/neondb/auth
```

> ⚠️ Tudo com prefixo `VITE_` **vai parar no bundle público**. Estes dois valores são públicos por design (a proteção real é o **RLS** no banco + o JWT). **Nunca** coloque aqui a string de conexão do Postgres (com senha).

Sem essas variáveis o app roda em modo local: lê o PDF e mostra os insights, mas não salva nada.

---

## 🧱 Arquitetura

Camadas separadas por responsabilidade — o domínio é puro (sem React, sem I/O) e é onde vivem as regras que fazem o dinheiro fechar.

```
src/
├── domain/            # regras de negócio puras (testáveis sem browser)
│   ├── normalize/     # dinheiro (centavos), datas, parcelas, estabelecimento
│   ├── pdf/           # extração de texto com coordenadas, linhas, detecção do banco
│   ├── parsers/       # parsers de fatura/extrato: Nubank, Bradesco, BB, Sicredi, Sicoob
│   ├── categorize/    # catálogo de categorias, regras e aprendizado
│   ├── dedupe/        # hash de documento e de transação
│   ├── link/          # vínculos entre documentos (dupla contagem)
│   ├── validate/      # conferência contra o gabarito do banco
│   ├── insights.ts    # insights de um documento recém-importado
│   └── banks.ts       # temas visuais por banco
├── persist/           # acesso a dados (Neon Data API) + agregação de leitura
│   ├── puxar.ts       # busca tudo uma vez, calcula a competência
│   ├── agrupar.ts     # competência, filtros por período, agregações, projeções
│   ├── salvar.ts      # grava documento + transações (dedup por hash)
│   ├── documentos.ts  # listar/apagar documentos + saldos por conta
│   ├── saldos.ts      # deriva o saldo atual de cada conta (puro)
│   ├── editar.ts      # editar rótulo/categoria de uma transação
│   └── categoriasUsuario.ts  # categorias personalizadas
├── lib/               # cliente Neon e perfil local (apelido, flag do tutorial)
├── ui/                # componentes React
└── App.tsx, main.tsx, index.css
```

**Banco:** Neon (Postgres) via **Data API** (PostgREST) + **Neon Auth** (Better Auth) + **RLS desde o dia 1**. Migrações em `neon/migrations/`.

**Stack:** React 19 · TypeScript · Vite · Tailwind v4 · Motion · sonner · pdf.js · Vitest · oxlint.

---

## 🧠 Três regras que não são óbvias

Quem for mexer no código precisa saber destas — elas são a diferença entre um número certo e um número que mente:

1. **Fatura e extrato contam o mesmo dinheiro duas vezes.** Somar cru infla os gastos ~2×. A fatura manda no detalhe; o pagamento dela no extrato é quitação (`card_payment`), não despesa nova. Ver `domain/link/vinculos.ts`.

2. **Mês = competência (a fatura), não a data da compra.** Uma fatura de cartão cobre um ciclo que atravessa dois meses. Agrupar pela data real partia a fatura em dois (o supermercado de junho aparecia R$ 287 em vez dos R$ 918 reais). A competência é o mês do `documents.period_end` (vencimento na fatura; fim do período no extrato). **Dia e Semana** continuam pela data real. Ver `persist/agrupar.ts`.

3. **O PDF do banco declara totais que servem de gabarito.** O parser se autoconfere contra eles. Nunca exiba um número que não bateu com o gabarito sem avisar. Ver `domain/validate/checksum.ts`.

E uma quarta, sobre projeção: **compromissos futuros nunca vão para o banco.** São calculados na hora, a partir da parcela mais recente de cada série — por isso não duplicam quando a próxima fatura é importada.

---

## 🔐 Privacidade e segurança

- O **PDF é lido no navegador** e nunca sai da máquina; só as transações extraídas são salvas.
- **PDFs reais são ignorados pelo git** (`*.pdf`) — contêm CPF, agência, conta e nomes de terceiros, e o histórico do git é permanente. Os fixtures em `tests/fixtures/` são **anonimizados** (ver `scripts/gerar-fixtures.ts`).
- **RLS** no Neon garante que cada usuário só enxerga as próprias linhas.
- `.env.local` é ignorado pelo git.

---

## 📌 Estado atual

Funcionando e verificado ponta a ponta contra o Neon real: importação de fatura e extrato dos bancos suportados, conferência ao centavo, categorização, vínculos, persistência, login, dashboard por período, filtro por banco, saldo por conta, editar perfil, edição e exclusão de lançamentos, gráficos, compromissos futuros, tutorial e relatório em PDF.

> A feature de **saldo por conta** depende da migração `neon/migrations/0002_saldo_e_bancos.sql`. Enquanto ela não for aplicada, a fileira de saldo simplesmente não aparece (degradação prevista, sem erro).

**O que falta** está documentado em [`docs/ESTADO-ATUAL.md`](docs/ESTADO-ATUAL.md) — leia esse arquivo para retomar o trabalho de onde parou.

---

## 👤 Autor

**Cielio Queiroz** — [portfólio](https://cielio-portfolio.vercel.app/)

---

## 📄 Licença

Projeto de uso livre para fins pessoais e de estudo.
