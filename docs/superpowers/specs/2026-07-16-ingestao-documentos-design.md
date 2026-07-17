# Ingestão de Documentos Financeiros — Design

**Data:** 2026-07-16
**Status:** Aprovado
**Fatia:** 2 de 4 (Ingestão)

---

## Contexto

O app atual (`index.html` + `js/`, ~1.800 linhas de vanilla JS com `localStorage`) é de **digitação manual**: o usuário registra cada lançamento à mão. O objetivo é substituí-lo por um app de **ingestão e análise automática**: o usuário importa PDFs de faturas e extratos, e o sistema extrai, categoriza e apresenta os dados.

O projeto foi decomposto em quatro fatias independentes, cada uma com spec e plano próprios:

1. **Fundação** — Supabase, auth, schema, shell da UI
2. **Ingestão** — este documento
3. **Insights** — dashboard, gráficos, filtros por dia/semana/mês/ano
4. **Apresentação** — temas por banco, SVGs, export/compartilhar PDF

A Ingestão vem primeiro porque é a fatia de maior risco e porque define o formato de dados que as outras três consomem. Em particular, a fatia 4 (temas por banco) depende de a Ingestão identificar o emissor de cada documento.

**Escopo deste documento:** exclusivamente a fatia 2. Auth, dashboard, gráficos, temas e export estão fora.

---

## Documentos de referência

Quatro PDFs reais foram analisados. **Todos são PDF de texto nativo — nenhum escaneado, nenhum protegido por senha.** OCR está fora do escopo.

| Documento | Emissor | Tipo | Páginas |
|---|---|---|---|
| `BradescoCartoes14-07-2026-17-40-28.pdf` | Bradesco | Fatura de cartão | 3 |
| `extratoBradescoJunho.pdf` | Bradesco | Extrato de conta | 3 |
| `NuBank_extratoConta.pdf` | Nubank | Extrato de conta | 3 |
| `Nubank_faturaCartao.pdf` | Nubank | Fatura de cartão | 8 |

---

## Descobertas que fundamentam o design

### 1. Os documentos trazem os próprios gabaritos

Todos os quatro declaram totais que permitem **auto-verificação do parser**:

| Documento | Gabarito | Confere? |
|---|---|---|
| Extrato Nubank | `108,24 + 8.531,25 − 8.613,81 = 25,68` | ✓ |
| Extrato Bradesco | `55.575,13 + 33.265,53 − 41.841,65 = 46.999,01` | ✓ |
| Fatura Bradesco | `4.782,64 − 4.839,43 + 5.586,23 = 5.529,44` | ✓ |
| Fatura Nubank | `8.320,22 + 4,02 (IOF) = 8.324,24` | ✓ |

**Consequência:** o parser soma o que extraiu e compara com o total declarado pelo banco. Se bate, o parse está correto. Se não bate, o app reporta a discrepância em vez de exibir número errado silenciosamente. Este é o mecanismo central de confiança do sistema.

O extrato Bradesco tem ainda coluna de **saldo corrente** linha a linha, permitindo validação incremental (recalcular o saldo após cada transação e comparar).

### 2. Dupla contagem entre fatura e extrato

O mesmo dinheiro aparece nos dois documentos:

- Fatura Nubank: total **R$ 8.324,24** → Extrato Nubank, 29 JUN: `Pagamento de fatura — 8.324,24`
- Fatura Bradesco: total **R$ 5.529,44** → Extrato Bradesco, 29/06: `GASTOS CARTAO DE CREDITO — 5.529,44`

Somar os quatro documentos cegamente infla os gastos de junho para ~R$ 64 mil, contra um valor real muito menor.

**Regra derivada:** o extrato conta o dinheiro se movendo; a fatura conta onde ele foi gasto. A fatura é a fonte de verdade do detalhe (só ela sabe que R$ 114,95 foram para a Anthropic). No extrato, o pagamento da fatura é uma **quitação**, não uma despesa nova.

### 3. Transferências entre contas próprias

Em 29/06, R$ 5.300 e R$ 3.000 saíram do Bradesco para o Nubank do mesmo titular:

- Bradesco: `PIX ENVIADO / DES: JACIELIO DA SILVA QUE 29/06`
- Nubank: `Transferência recebida pelo Pix / JACIELIO DA SILVA QUEIROZ - BCO BRADESCO S.A. (0237)`

Também `TED D CC HBANK* / DEST. JACIELIO DA SILVA QU` (R$ 500 e R$ 700).

Não são gasto nem receita — são movimentação interna e devem ficar fora dos totais de despesa.

### 4. Armadilhas de layout por documento

**Extrato Bradesco:**
- Crédito e Débito são **colunas distintas** com texto idêntico. `300,00` (débito) e `298,56` (crédito) só se distinguem pela posição X. Extração de texto puro perde o sinal — **coordenadas do pdf.js são obrigatórias**.
- A data aparece só na **primeira linha do grupo**; as seguintes herdam. (08/06/2026 tem três lançamentos, um só com data.)
- Histórico ocupa duas linhas: `PIX ENVIADO` + `DES: Solange Silva Nunes d 31/05`.
- Nomes de contraparte vêm **truncados** em ~26 caracteres: `DES: DOUGLAS LEITE CAVALCA`.
- Linha `Total` deve ser ignorada como transação.
- Página 3 é `Últimos Lancamentos` — **período diferente** (julho) do corpo do extrato (junho). Não misturar.

**Fatura Bradesco:**
- Data **sem ano**: `08/04`, `28/05`. Inferir do vencimento (28/06/2026).
- Sinal de crédito é um `-` **no fim do valor**: `56,79 -` é estorno; `599,75` é compra. Confirmado pelo gabarito: créditos de 4.839,43 = pagamento 4.782,64 + estorno 56,79.
- Parcelamento **grudado na descrição, sem separador**: `ARAI KAMINISHI COS02/06` = parcela 02/06. Às vezes com espaço: `PAGUE MENOS @0756@ 02/03`.
- Parcelamento **quebra linha**: `MERCADOLIVRE*MERCADO03/0` numa linha e `4` na seguinte = parcela 03/04. Idem `MERCADOLIVRE*QCOMPRA02/0` + `2`.
- `ANUIDADE DIFERENCIADA 61,00` com `10/12` na linha seguinte = parcela 10/12.
- Cidade quebra linha: `SANTANA DO` + `AR`.

**Fatura Nubank:**
- Data sem ano: `20 MAI`. Inferir de `FATURA 29 JUN 2026` / `Período vigente: 20 MAI a 20 JUN`.
- Parcelamento **explícito e limpo**: `- Parcela 5/8`.
- Internacional ocupa 3 linhas: `Anthropic* Claude Sub` + `BRL 110.00 = USD 21.57` + `Conversão: BRL 5.32 = USD 1 = R$ 5,32` → R$ 114,95.
- IOF vem em **linha separada, sem cartão**: `IOF de "Anthropic* Claude Sub" R$ 4,02`.
- Pagamentos usam **MINUS SIGN U+2212** (`−`), não hífen ASCII: `−R$ 3.644,97`.

**Extrato Nubank:**
- Data por extenso: `01 JUN 2026`.
- Estrutura **hierárquica**: dia → `Total de entradas/saídas` → transações. O sinal vem do cabeçalho do grupo, não da linha.
- Um dia pode ter **ambos** os grupos (23 JUN tem `Total de entradas + 50,00` e `Total de saídas - 50,00`).
- Descrições multi-linha.
- **Traz CNPJ**: `IFOOD COM AGENCIA DE RESTAURANTES ONLINE S A - 14.380.200/0001-21`.

### 5. As categorias reais divergem das imaginadas

O pedido original citava "supermercado, Uber, iFood, conta de água, conta de luz". Nos dados reais:

- **Uber:** zero ocorrências
- **Água / Luz:** zero ocorrências
- **iFood:** uma ocorrência (via Pix)

O que de fato domina: Ofertao Supermercado, Farmacia Bom Preco, Panificadora Farturao, Mercado Josias, Auto Posto Novo Mundo, MercadoLivre, Supermercado Fama — com dezenas de repetições.

### 6. Prefixos de adquirente mascaram o estabelecimento

`Hna*Oboticario` não é a empresa "HNA" — é O Boticário via adquirente HNA. Idem `Mp *Cristilene` (Mercado Pago), `EBN*SPOTIFY`, `Paygo*Ga Glesia Artes`, `AMAZONMKTPLC*MENINECOM`, `Jim.Com* J C Acessori`. A normalização precisa descascar o prefixo antes de casar a regra.

### 7. PIX de alto valor para pessoas físicas

R$ 10.000 (Douglas), R$ 15.650 (JCJR Ortopedia), R$ 17.410 (Israel) — não têm cara de gasto pessoal. Nome de pessoa não determina categoria. Estas caem em Transferências e aguardam rótulo manual; nenhuma regra automática deve adivinhar.

---

## Decisões tomadas

| # | Decisão | Escolha | Razão |
|---|---|---|---|
| 1 | Escopo | 4 fatias, Ingestão primeiro | Maior risco; define o formato de dados |
| 2 | Categorização | Regras + aprendizado do histórico | Custo zero, offline, melhora com uso |
| 3 | Duplicatas | Hash do documento + transação exata | Protege sem gerar falso positivo |
| 4 | Parsing | Navegador, pdf.js | Dados não saem do dispositivo; grátis; sem backend |
| 5 | PDF desconhecido | Genérico → mapeamento manual que vira aprendizado | Nunca deixa o usuário sem saída |
| 6 | Login | E-mail/senha confirmado + Google | Recuperação de senha; sem porta dos fundos (fatia 1) |
| 7 | Stack | React 19 + TS + Vite | Dashboard privado; TS protege o parser |
| 8 | Dupla contagem | Detectar e marcar como interno | Totais honestos sem esconder dados |
| 9 | Categorias | Derivadas dos dados reais | Alta cobertura desde a 1ª importação |
| 10 | Fixtures | Anonimizados; originais no `.gitignore` | CPF/conta/nomes não entram no histórico do git |

---

## Arquitetura

### Pipeline

```
Arquivo PDF
  ↓ pdf.js → text items com coordenadas (x, y, página)
  ↓ reconstrução de linhas (agrupa por Y, ordena por X)   ← resolve colunas Crédito/Débito
  ↓ SHA-256 do arquivo                                    ← barra reimportação
  ↓ detecção de emissor + tipo                            ← assinatura textual
  ↓ parser específico → RawTransaction[]
  ↓ normalização (ano, sinal, parcela, câmbio, merchant)
  ↓ VALIDAÇÃO CONTRA O TOTAL DECLARADO                    ← o gabarito
  ↓ categorização (regras globais + regras do usuário)
  ↓ detecção de duplicatas + vínculos internos
  ↓ tela de revisão (usuário confirma)
  ↓ Supabase
```

### Módulos

Cada módulo tem propósito único, interface definida e é testável isoladamente.

| Módulo | Responsabilidade | Entrada → Saída |
|---|---|---|
| `pdf/extract.ts` | Extrair texto com coordenadas | `File` → `TextItem[]` |
| `pdf/lines.ts` | Reconstruir linhas por posição | `TextItem[]` → `Line[]` |
| `pdf/detect.ts` | Identificar emissor e tipo | `Line[]` → `DocKind` |
| `parsers/bradesco-fatura.ts` | Parser dedicado | `Line[]` → `ParseResult` |
| `parsers/bradesco-extrato.ts` | Parser dedicado | `Line[]` → `ParseResult` |
| `parsers/nubank-fatura.ts` | Parser dedicado | `Line[]` → `ParseResult` |
| `parsers/nubank-extrato.ts` | Parser dedicado | `Line[]` → `ParseResult` |
| `parsers/generico.ts` | Heurística de fallback | `Line[]` → `ParseResult` |
| `normalize/merchant.ts` | Descascar adquirente, limpar | `string` → `string` |
| `normalize/date.ts` | Inferir ano | `string, DocContext` → `Date` |
| `normalize/installment.ts` | Extrair parcela | `string` → `{atual, total} \| null` |
| `validate/checksum.ts` | Conferir com total declarado | `ParseResult` → `Validation` |
| `categorize/rules.ts` | Aplicar regras | `Transaction[]` → `Transaction[]` |
| `dedupe/document.ts` | Hash de arquivo | `File` → `string` |
| `dedupe/transaction.ts` | Detectar repetidas | `Transaction[]` → `DuplicateReport` |
| `link/card-payment.ts` | Ligar quitação ↔ fatura | `Transaction[]` → `Link[]` |
| `link/internal.ts` | Detectar transferência própria | `Transaction[]` → `Link[]` |

`ParseResult` é a interface comum de todos os parsers:

```ts
type ParseResult = {
  transactions: RawTransaction[]
  declaredTotal: number | null   // o gabarito, quando o documento traz
  period: { start: Date; end: Date } | null
  account: AccountHint           // banco, tipo, final do cartão, agência/conta
}
```

Isso permite trocar/adicionar parser sem tocar em nada a jusante.

---

## Modelo de dados

### `transactions`

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK, RLS |
| `account_id` | uuid | FK → `accounts` |
| `document_id` | uuid | FK → `documents` (origem) |
| `date` | date | ano já inferido |
| `description` | text | **original do banco, imutável** |
| `label` | text \| null | **texto do usuário, editável** |
| `amount` | numeric(14,2) | sempre positivo |
| `direction` | `'in'` \| `'out'` | |
| `kind` | `'expense'` \| `'income'` \| `'internal_transfer'` \| `'card_payment'` | mantém totais honestos |
| `category_id` | uuid \| null | FK → `categories` |
| `installment` | jsonb \| null | `{atual, total}` |
| `fx` | jsonb \| null | `{currency, amount, rate}` |
| `counterparty_doc` | text \| null | CNPJ/CPF quando disponível |
| `linked_transaction_id` | uuid \| null | par da transferência interna |
| `raw` | jsonb | linha original, para auditoria |
| `hash` | text | chave de dedup |

**Decisão-chave — `description` vs `label`:** o usuário pediu para editar a descrição ("posso escrever algo que faça mais sentido para eu entender depois"). Sobrescrever a original quebraria três coisas: a detecção de duplicata (compara com o texto do banco), a regra de categorização (casa com o padrão original) e a auditoria contra o PDF. Com dois campos, o usuário renomeia à vontade e o app continua reconhecendo o estabelecimento. A UI exibe `label ?? description`, com a original discreta abaixo.

### `accounts`

`id`, `user_id`, `bank` (`'nubank'` | `'bradesco'` | …), `type` (`'checking'` | `'credit_card'`), `label`, `last4`, `agency`, `number`, `holder_name`

`bank` alimenta o tema visual na fatia 4. `holder_name` alimenta a detecção de transferência interna.

### `documents`

`id`, `user_id`, `account_id`, `file_hash` (SHA-256), `bank`, `doc_type`, `period_start`, `period_end`, `declared_total`, `parsed_total`, `filename`, `imported_at`

**Campos prospectivos** (alimentam a projeção de comprometimento futuro na fatia 3 — ver seção "Compromisso futuro"):

`next_close_date`, `next_invoice_balance`, `total_open_balance`, `future_installments_total`

### `categories`

`id`, `user_id` (null = global), `name`, `slug`, `icon`, `color`, `sort_order`

### `merchant_rules`

`id`, `user_id` (null = global), `pattern`, `match_type` (`'contains'` | `'prefix'` | `'cnpj'`), `category_id`, `priority`

Regras do usuário têm prioridade sobre as globais.

---

## Categorização

### Catálogo inicial (derivado dos dados reais)

| Categoria | Estabelecimentos observados |
|---|---|
| Supermercado | Ofertao Supermercado, Supermercado Fama, Mercado Josias, Atacadao, Deposito Expansao, Lojao Brasil |
| Padaria | Panificadora Farturao, D'Tudo Massa'S |
| Farmácia & Saúde | Farmacia Bom Preco, Farma Lider, Pague Menos, Laboratorio Laluth, JCJR Ortopedia |
| Combustível & Carro | Auto Posto Novo Mundo, Auto Posto Santana 2, Auto Eletrica Rr |
| Marketplace | MercadoLivre, Amazon, Americanas, Havan, Jim.Com |
| Assinaturas | Spotify, AmazonPrimeBR, Apple.com/Bill, Anthropic Claude, LinkedIn, MeliMais |
| Beleza | O Boticário, Arai Kaminishi Cos, Rommanel, Oticas Carol |
| Telecom | Norte.Net Telecom, Recarga Pré Pago |
| Viagem | Airbnb |
| Delivery | iFood |
| Educação | Educandario Meninopol |
| Papelaria | Papelaria Giz de Cera |
| Serviços | Got Servicos Administr, Paygo |
| Taxas bancárias | IOF, Anuidade Diferenciada |
| Rendimentos | Rendimentos Poup Facil (entrada) |
| Transferências | PIX/TED sem categoria definida |
| Outros | fallback |

**Uber, Água e Luz** entram como categorias registradas mas sem regras — prontas se aparecerem, sem poluir a UI enquanto não aparecem.

### Normalização de merchant

Ordem de aplicação:

1. Remover sufixo de parcela (`03/04`, `- Parcela 5/8`, `COS02/06`)
2. Descascar prefixo de adquirente (`MP *`, `HNA*`, `PAYGO*`, `EBN*`, `AMAZONMKTPLC*`, `MERCADOLIVRE*`, `JIM.COM*`)
3. Uppercase, remover acentos, colapsar espaços
4. Remover sufixos numéricos de loja (`@0756@`, `671as`)

### Ordem de resolução da categoria

1. Regra do usuário por **CNPJ** (quando o documento traz)
2. Regra do usuário por **nome normalizado**
3. Regra global por **CNPJ**
4. Regra global por **nome normalizado**
5. `Outros`

### Aprendizado

Corrigir a categoria de uma transação grava/atualiza uma `merchant_rule` do usuário com o merchant normalizado (ou o CNPJ, se houver). Ocorrências futuras já entram categorizadas. Regras do usuário sempre vencem as globais.

---

## Inferência de ano

Faturas trazem data sem ano (`08/04`, `20 MAI`). Algoritmo:

1. Obter a data de referência do documento (vencimento ou fim do período vigente)
2. Atribuir o ano da referência à transação
3. Se a data resultante for **posterior** à referência, subtrair 1 ano

Cobre a virada de ano: transação `28/12` numa fatura com vencimento `10/01/2027` recebe 2026.

---

## Compromisso futuro (captura)

As faturas declaram quanto já está comprometido nos meses seguintes. A **tela** que expõe isso pertence à fatia 3; a **captura** é responsabilidade da Ingestão e está especificada aqui.

### Campos a extrair

| Documento | Campo no PDF | Valor observado | Coluna |
|---|---|---|---|
| Fatura Bradesco | `Total para as próximas faturas` | R$ 5.578,34 | `future_installments_total` |
| Fatura Nubank | `Fechamento da próxima fatura` | 20 JUL 2026 | `next_close_date` |
| Fatura Nubank | `Saldo em aberto da próxima fatura` | R$ 1.270,16 | `next_invoice_balance` |
| Fatura Nubank | `Saldo em aberto total` | R$ 2.688,23 | `total_open_balance` |

### Questão em aberto: a projeção por parcela não reconcilia

Projetar somando as parcelas restantes de cada transação (assumindo que cada parcela futura custa o mesmo da atual) **não bate com o valor declarado pelo banco**. Cálculo feito sobre a fatura Nubank de junho/2026:

| Métrica | Projeção por parcela | Declarado pelo banco | Diferença |
|---|---|---|---|
| Saldo em aberto total | R$ 2.419,82 | R$ 2.688,23 | R$ 268,41 |
| Saldo da próxima fatura | R$ 1.114,85 | R$ 1.270,16 | R$ 155,31 |

Parcelas consideradas (Nubank, 20 MAI–20 JUN): Dias Gomes 5/8 (249,50), Airbnb 2/6 (149,24), Bela Center 3/4 (41,96), Atacadao 2/3 (95,45), Got Servicos 2/4 (281,57), Laboratorio Laluth 1/2 (105,00), Hna\*Oboticario 1/2 (55,50), Hna\*Oboticario 1/2 (59,95), Farmacia Bom Preco 1/3 (76,68). Rommanel 2/2, Oticas Carol 6/6 e Bela Center 3/3 já encerraram.

**Causa não determinada.** Hipóteses a investigar na implementação: compras parceladas de períodos anteriores cujas parcelas correntes não aparecem na lista desta fatura; parcelas com valor variável (juros embutidos); lançamentos em aberto que não são parcelamento.

### Regra derivada

1. **O número declarado pelo banco é a fonte de verdade** para o total exibido. Nunca substituí-lo pela projeção calculada.
2. A projeção por parcela serve **exclusivamente para quebrar** esse total por mês e por estabelecimento — que é a informação acionável.
3. A diferença entre o declarado e a soma das parcelas é exibida explicitamente como **"outros lançamentos"**, nunca absorvida silenciosamente numa das categorias.
4. Se o documento não declarar o campo, a projeção é exibida como **estimativa**, rotulada como tal.

Motivo da regra: uma projeção plausível e errada é o pior resultado possível num app de finanças — passa despercebida. Ancorar no número do banco e mostrar o resíduo torna o erro visível em vez de invisível.

---

## Duplicatas e vínculos

### Documento

SHA-256 do conteúdo do arquivo, comparado contra `documents.file_hash` do usuário. Colisão → barra antes de processar, informando quando o documento foi importado.

### Transação

`hash = sha256(account_id + date + amount + description_normalizada)`.

Colisão → **avisa e mostra a original**, com link. O usuário decide se insere mesmo assim. Nunca bloqueia silenciosamente.

### Vínculo de pagamento de fatura

Transação de extrato com descrição casando `Pagamento de fatura` (Nubank) ou `GASTOS CARTAO DE CREDITO` (Bradesco), cujo `amount` seja **exatamente igual** ao `declared_total` de um `document` do tipo fatura do mesmo usuário, com vencimento a até 5 dias da data → marca `kind = 'card_payment'` e liga ao documento. Não conta como despesa.

### Vínculo de transferência interna

Duas heurísticas independentes; qualquer uma basta:

1. **Nome:** o nome do contraparte é prefixo de `accounts.holder_name` do usuário (tolera o truncamento em 26 chars do Bradesco: `DES: JACIELIO DA SILVA QUE`).
2. **Par casado:** mesmo `amount`, contas do usuário diferentes, `direction` opostas, até 2 dias de diferença.

Marca ambos os lados com `kind = 'internal_transfer'` e preenche `linked_transaction_id`. Fora dos totais de despesa/receita; visível no histórico.

---

## Validação

Após o parse, antes de qualquer exibição:

1. Somar as transações extraídas conforme a fórmula do documento
2. Comparar com `declaredTotal`
3. Tolerância: **R$ 0,00** (os quatro gabaritos batem exatamente)

Resultados:

| Situação | Comportamento | Toast |
|---|---|---|
| Bate | Prossegue para revisão | Verde |
| Não bate | Prossegue, mas exibe a discrepância em destaque ("li 47 de 52, faltam R$ 312,80") | Vermelho |
| Sem gabarito (parser genérico) | Prossegue, avisa que não há como conferir | Amarelo |

Para o extrato Bradesco, validação adicional incremental: recalcular o saldo após cada transação e comparar com a coluna `Saldo (R$)`. Localiza **qual linha** quebrou, não apenas que o total não fecha.

---

## Tratamento de erros

| Erro | Comportamento |
|---|---|
| Arquivo não é PDF | Toast vermelho, rejeita |
| PDF sem camada de texto (escaneado) | Toast vermelho: "PDF parece ser digitalizado; OCR não é suportado" |
| PDF protegido por senha | Solicita senha; se falhar, toast vermelho |
| Emissor não reconhecido | Tenta parser genérico → se falhar, tela de mapeamento manual |
| Parser genérico sem resultado | Tela de mapeamento manual (exibe texto extraído, usuário aponta data/valor/descrição) |
| Total não confere | Prossegue com aviso vermelho em destaque; usuário decide |
| Documento já importado | Barra, informa data da importação anterior |
| Falha ao salvar no Supabase | Toast vermelho, mantém a revisão aberta, permite retry |

Nenhum erro descarta o trabalho do usuário silenciosamente.

---

## UI da importação

Um fluxo, três passos:

1. **Soltar arquivo** — drag & drop ou seletor. Aceita múltiplos.
2. **Revisão** — nada é salvo antes desta tela:
   - Topo: veredito da conferência ("52 transações, R$ 8.324,24 — confere com a fatura ✓")
   - Duplicatas destacadas, com link para a original e escolha explícita de inserir ou não
   - Internas marcadas e visivelmente fora do total de gastos
   - Categorias sugeridas, editáveis inline
   - `label` editável inline
3. **Confirmar** — grava no Supabase; toast de resultado.

### Semântica dos toasts

| Cor | Significado | Exemplo |
|---|---|---|
| **Verde** | Sucesso limpo | "52 transações importadas, total confere" |
| **Amarelo** | Sucesso com ressalva | "Importado, mas 12 transações caíram em Outros" / "3 duplicatas detectadas" |
| **Vermelho** | Falha ou inconsistência | "Total não confere: faltam R$ 312,80" / "Parser falhou" |

---

## Testes

**Abordagem: TDD com gabarito real.** Os quatro PDFs viram fixtures; o total declarado por cada um é a resposta esperada.

### Fixtures — privacidade

Os PDFs originais contêm **CPF, agência, conta, nome do titular e nomes de terceiros**. Commitá-los é irreversível: permanecem no histórico do git mesmo após remoção.

**Regra:** fixtures são **anonimizados** (CPF, conta, agência e nomes substituídos por valores fictícios), **preservando o layout** — que é o que o parser testa. Os originais entram no `.gitignore`.

### Casos por parser

Cada parser deve ter teste para:

- Total extraído == total declarado
- Contagem de transações
- Sinal correto (o `56,79 -` do Bradesco é crédito)
- Data com ano inferido corretamente
- Parcela extraída, incluindo os casos grudado (`COS02/06`) e quebrado em duas linhas (`MERCADOLIVRE*MERCADO03/0` + `4`)
- Linhas de total/rodapé ignoradas
- Herança de data em grupo (extrato Bradesco)
- Câmbio (`Anthropic* Claude Sub`) e IOF em linha separada
- Minus sign U+2212 tratado como negativo
- Campos prospectivos extraídos: fatura Nubank → `2.688,23` / `1.270,16` / `20 JUL 2026`; fatura Bradesco → `5.578,34`

### Casos de integração

- Fatura Nubank + extrato Nubank → gastos **não** duplicam; `Pagamento de fatura` vira `card_payment`
- Extrato Bradesco + extrato Nubank → os R$ 5.300 e R$ 3.000 de 29/06 viram `internal_transfer` nos dois lados
- Reimportar o mesmo arquivo → barrado pelo hash
- Corrigir categoria → nova ocorrência do mesmo merchant já entra categorizada

---

## Fora de escopo

- OCR (nenhum documento de referência precisa)
- Auth e schema base (fatia 1)
- Dashboard, gráficos, filtros por período (fatia 3)
- **Tela** de projeção de compromisso futuro (fatia 3) — a **captura** dos campos está nesta fatia
- Temas por banco, SVGs, export PDF (fatia 4)
- Bancos além de Bradesco e Nubank (cobertos pelo parser genérico + mapeamento manual)
- Import de CSV/OFX

---

## Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Banco muda o layout do PDF | Validação por gabarito detecta na hora; parser genérico + mapeamento manual como rede |
| Parser genérico com baixa precisão | Nunca salva sem revisão; sem gabarito, toast amarelo explícito |
| Nome truncado gera falso positivo de transferência interna | Exige prefixo do nome do titular **e** valor casado entre contas do usuário |
| Fatura importada sem o extrato correspondente | `card_payment` só vincula se a fatura existir; caso contrário fica despesa comum até a fatura entrar |
| Dois cafés iguais no mesmo dia sinalizados como duplicata | Aceito: aviso, nunca bloqueio; usuário decide em um clique |
| Projeção de compromisso futuro plausível porém errada | Total ancorado no valor declarado pelo banco; resíduo exibido como "outros lançamentos"; estimativa sem gabarito é rotulada como tal |
