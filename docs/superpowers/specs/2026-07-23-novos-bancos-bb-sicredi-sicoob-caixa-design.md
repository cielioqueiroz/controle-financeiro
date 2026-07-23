# Novos bancos: Banco do Brasil, Sicredi, Sicoob e Caixa — design

> Data: 2026-07-23 · Branch: `main`
> Arquivos afetados: `src/domain/pdf/detect.ts`, `src/domain/parsers/index.ts`,
> novos parsers em `src/domain/parsers/`, novos fixtures em `tests/fixtures/`,
> `src/domain/banks.ts` (tema visual por banco). Depois: carrossel na tela de acesso.

## Problema

O app só lê **Nubank** e **Bradesco**. Qualquer outro banco cai em `desconhecido` e o
usuário vê "Não reconheci este documento. Em breve." O usuário quer cobrir mais bancos
brasileiros, e **não tem extratos próprios** para fornecer — pediu que o material viesse
da web.

## O que a caça na web encontrou (2026-07-23)

Extratos **reais** foram obtidos de **portais de transparência** (órgãos públicos publicam
seus extratos por lei). Cada PDF foi baixado e teve a camada de texto inspecionada. As
amostras estão em `.amostras-bancos/` (gitignored — `*.pdf`).

| Banco | Amostras | Qualidade | Fonte |
|---|---|---|---|
| **Banco do Brasil** | 3 (2 layouts) | Rica: PIX env/rec, TED, tarifas, resgate, transferências | fazenda.pr, cmbf.pr, belemdemaria.pe |
| **Sicredi** | 1 | Rica: PIX, DARF, TED, cobrança | camaracarlinda.mt |
| **Sicoob** | 1 | Rica (multi-linha) | camaraapiacas.mt |
| **Caixa** | 2 | **Magra**: contas de investimento sem movimento | cohapar.pr, registro.sp |
| Santander / Itaú | 0 | Só specs/Scribd travado — sem conta pública | — |

**Santander e Itaú ficam fora deste round** por falta de material real. Só entram com um PDF
real fornecido por alguém, ou pelo caminho de IA (descartado pelo usuário por privacidade).

## Layouts observados (do texto extraído — as coordenadas vêm na Task 0)

**BB layout A** (2020): `Dt. movimento · Dt. balancete · Histórico · Documento · Valor R$ · Saldo`
**BB layout B** (2023): `Dt. balancete · Dt. movimento · Ag.origem · Lote · Histórico · Documento · Valor R$ · Saldo`
- Sinal por **sufixo C/D** no valor (C = crédito/entrada, D = débito/saída).
- Linhas de **detalhe** abaixo de alguns lançamentos (data/hora + contraparte, ou ag/conta/CPF).

**Sicredi**: `Data · Descrição · Documento · Valor (R$) · Saldo (R$)`
- Sinal por **menos** no valor (`-2.230,00`). Saldo corrente ao lado.

**Sicoob**: `Data · Documento · Histórico · Valor`
- Sinal por sufixo **C/D**; `*` para saldo bloqueado. Lançamentos **multi-linha** (PIX abre
  em várias linhas de detalhe). Plataforma SISBR.

**Caixa** (GovConta): `Data Mov · Nr.Doc · Histórico · Valor (R$) · Saldo (R$)`, sufixo C/D.
- Amostra sem movimento real — estrutura conhecida, conteúdo por validar.

## Solução

Seguir a arquitetura que já existe. O próprio `parsers/index.ts` diz: *"adicionar banco é
acrescentar uma entrada aqui — nada a jusante muda, porque todos devolvem `ParseResult`."*
Cada banco novo é: **assinatura de detecção** + **parser** + **fixture anonimizado** +
**testes** + **tema visual** em `banks.ts`.

### A. Detecção (`detect.ts`)

Ampliar o `type Bank` para incluir `'bb' | 'sicredi' | 'sicoob' | 'caixa'` e acrescentar
assinaturas. Marcadores candidatos (a confirmar contra as coordenadas reais):

- **BB**: `/Extrato conta corrente/i` + `/Dt\.?\s*(movimento|balancete)/i`
- **Sicredi**: `/Cooperativa:/i` + `/Associado:/i` (e o típico `PAGAMENTO PIX SICREDI`)
- **Sicoob**: `/SICOOB/i` + `/SISBR|PLATAFORMA DE SERVI[çc]OS FINANCEIROS/i`
- **Caixa**: `/GOVCONTA CAIXA/i` ou `/Extrato das Contas Individuais/i`

Ordem importa (a mais específica primeiro), como já é hoje com o Bradesco.

### B. Parsers

Todos são de **extrato** (conta), então preenchem `declaredIncome`/`declaredExpense` e
deixam `declaredTotal` nulo. Cada um:

1. Localiza o cabeçalho de colunas e deriva as **fronteiras de x** de cada coluna.
2. Lê cada lançamento: data, descrição (juntando linhas de detalhe quando houver),
   documento, valor com sinal, e ignora as linhas de "Saldo"/"SALDO ANTERIOR".
3. Classifica o `kind`: `entrada` (crédito/PIX recebido/rendimento/estorno), `compra`/saída
   (débito/PIX enviado/pagamento), `encargo` (tarifa/IOF), `pagamento` (quitação de fatura —
   raro em extrato de conta). A convenção do `amountCents`: **positivo = saiu**, negativo =
   entrou (é o contrário do sinal do banco, atenção).
4. Autoconfere: soma das entradas e das saídas tem que bater com os gabaritos declarados no
   PDF, quando o extrato os traz; senão, deriva do saldo inicial → final. **Nunca exibir
   número que não fecha sem avisar** (`domain/validate/checksum.ts`).

### C. Fixtures e privacidade

Para cada parser, gerar um fixture **anonimizado** via `scripts/gerar-fixtures.ts` (embaralha
CPF, conta, nomes). Só o anonimizado é commitado em `tests/fixtures/` (a exceção do
`.gitignore`: `!tests/fixtures/**/*.pdf`). Os PDFs reais em `.amostras-bancos/` **nunca**
entram no git.

### D. Tema visual (`banks.ts`)

Cada banco ganha suas cores (BB amarelo/azul, Sicredi verde, Sicoob turquesa, Caixa
azul/laranja) — a parte trivial, para os selos e o futuro carrossel.

### E. Carrossel (depois, não neste round)

Quando os quatro entrarem, o app terá **6 bancos**. Aí o carrossel monocromático e infinito
na tela de login faz sentido — alimentado pela lista real de bancos suportados, nunca por
bancos que não funcionam. Fica para um round próprio.

## Testes

- Um teste por parser, contra o fixture anonimizado, **conferindo o total ao centavo** —
  o mesmo padrão dos 4 parsers atuais.
- Teste de detecção: cada assinatura reconhece o seu, e um texto genérico cai em
  `desconhecido`.
- Caso de borda por banco: linha multi-linha (Sicoob/BB), valor negativo por menos
  (Sicredi) vs por sufixo C/D (BB/Sicoob/Caixa), linhas de saldo ignoradas.
- **Caixa nasce com teste fraco de variedade** (amostra sem movimento) — registrar isso no
  teste e no ESTADO-ATUAL como dívida, para refino quando surgir extrato com movimento.

## Riscos e trabalho de investigação

- **Task 0 obrigatória: rodar a extração do app (`domain/pdf/load` → `lines`) em cada
  amostra** para ver as coordenadas reais. O texto do pypdf mostra o conteúdo, mas o parser
  chaveia nas posições x das colunas, que só a extração do app revela. As fronteiras acima
  são hipóteses até isso.
- **BB tem dois layouts.** O parser precisa detectar qual e tratar os dois, ou serão dois
  sub-parsers. A ordem das colunas de data inverte entre eles.
- **Linhas de detalhe multi-linha** (Sicoob especialmente) são o ponto mais frágil: juntar a
  descrição sem confundir com o próximo lançamento.
- Amostras são **contas públicas** (governo). O layout de uma conta **pessoal** pode diferir
  em detalhes. O autoconferimento protege: no pior caso, "não bateu", nunca número errado.

## Fora de escopo

- Santander e Itaú (sem material).
- O carrossel (round próprio, depois dos 4).
- Faturas de cartão desses bancos (só extrato de conta neste round).
- A fila original do `ESTADO-ATUAL.md`.

## Verificação

- `npm test` (cada parser com total batendo), `npm run build`, `npm run lint`.
- Rodar `npx tsx scripts/diagnostico.ts .amostras-bancos/` e conferir que cada banco é
  reconhecido e que os totais fecham.
- Verificação humana só quando/se um extrato **pessoal** real aparecer — aí confirmar que o
  parser feito de conta pública também serve para conta de pessoa física.

---

## Task 0 REALIZADA — BB layout B (2023), coordenadas reais (2026-07-23)

Rodei a extração do próprio app (`extractFromDocument` → `buildLines`, via
`pdfjs-dist/legacy`) na amostra `bb-cmbf.pdf`. Ferramenta temporária em
`scripts/_dump-bb.ts` (gitignored por `scripts/_*.ts`). As fronteiras de coluna
**deixaram de ser hipótese** — são estas:

| Coluna | `x` (esq.) | `right` (dir.) | Exemplo |
|---|---|---|---|
| Data (balancete) | 65 | — | `01/08/2023` |
| Ag. origem | 192 | — | `0000` |
| Lote + Histórico | 227 | — | `13105 144 Pix - Enviado` |
| Documento | 388–445 | 466 | `80.101` / `872.131.200.057.912` |
| **Valor** | — | **520** | `2.001,00 D` |
| Saldo | — | 548 | `0,00 C` |

Assinaturas de detecção confirmadas: `Extrato de Conta Corrente` (y=768),
`Lançamentos` (y=659), e a linha de cabeçalho com `Dt. balancete … Valor R$ Saldo` (y=640).

Notas de parser que caem do texto real:
- **Sinal por sufixo C/D na coluna de valor** (`right≈520`): `D` = saída (`amountCents` > 0),
  `C` = entrada (`amountCents` < 0). Ler por borda direita (`cellAtRight`), como o Bradesco.
- **Linhas de detalhe** ficam em `x≈252`, na linha `y` logo abaixo do lançamento
  (contraparte do PIX/TED, "Tar. agrupadas…", "Cobrança referente…"). Anexar à descrição.
- **`Resgate Automático` (C) e `Aplicação` (D)** são varredura interna entre conta e
  aplicação automática — **não são entrada/saída reais**. Candidatos a `link`/excluir do
  gasto, como o `card_payment` do cartão. Decidir na implementação (provável: marcar e não
  contar). Nas linhas de resgate o valor e o saldo às vezes colam numa célula
  (`5.361,48 C 0,00 C`) — tratar.
- Classificação de `kind`: `Pix - Enviado`/`Transferência enviada`/`TED`/`Pagamento de
  Boleto` → saída; `Pix recebido`/`Transferência recebida` → entrada; `Tarifa …`/`IOF` →
  encargo; `Saldo Anterior`/`SALDO`/`Saldo Dia` → ignorar.

Ainda pendente de Task 0 (antes de codar cada um):
- **BB layout A (2020, `bb-belem.pdf`)** — ordem das colunas de data invertida; rodar o dump.
- **Sicoob (`sicredi-apiacas.pdf`)** e **Sicredi (`sicredi-carlinda.pdf`)** — rodar o dump.

### Duas decisões de correção descobertas ao construir (2026-07-23)

**Fork 1 — o BB não declara totais; o gabarito é o saldo.** Confirmado no dump completo do
`bb-cmbf.pdf`: não há linha "Total" (o Bradesco tem; o BB não). Só "Saldo Anterior" e
"S A L D O". O `checksum.ts` atual só confere contra `declaredIncome`/`declaredExpense`.
Opções:
- **(a) BB como `sem-gabarito`** — parser põe income/expense = null; o app mostra sem o selo
  "confere". Mínimo, honesto, mas perde a garantia forte. A correção fica só no teste (soma
  com sinal = saldoFinal − saldoInicial).
- **(b) Estender `checksum.ts` com validação por saldo** — caminho novo num módulo
  crítico de confiança; precisa de teste próprio. Mais trabalho, mas mantém o selo "confere"
  que é o coração do app. **Recomendado**, mas é mudança em código validado — não fazer no
  fim de sessão longa.

**Fork 2 — varredura interna infla o gasto.** O BB varre o saldo para aplicação automática
diariamente (`Resgate Automático` = C, `Aplicação`/`Aplic.BB` = D; o saldo diário volta a
0). Se `Aplicação` (débito) virar `compra`, o "gasto real" infla com dinheiro que só foi ao
investimento. É a mesma classe do "conta duas vezes" (fatura×extrato), mas sem mecanismo de
vínculo. Precisa de regra nova: marcar a varredura como **interna** e não contar no gasto.
`RawKind` hoje é `compra|encargo|pagamento|entrada` — não tem `interna`/`transferencia`.
Opções: acrescentar um kind, ou uma marca de `link` como a do `card_payment`. Decisão de
arquitetura, com teste.

**Consequência para o plano:** o parser do BB **não** é "só acrescentar uma entrada no
dispatcher" — ele encosta em dois pontos de correção do app (validação e dupla contagem).
Resolver os dois forks é a primeira coisa do build, com calma, não no cansaço. Sicredi,
Sicoob e Caixa podem ter varredura/gabarito diferentes — reavaliar por banco.
