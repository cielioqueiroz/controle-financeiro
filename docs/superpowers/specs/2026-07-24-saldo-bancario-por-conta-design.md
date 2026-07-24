# Saldo bancário por conta — design

> Spec da rodada. Data: **2026-07-24**. Aprovado em brainstorming antes de escrever.
> Contexto do projeto em `docs/ESTADO-ATUAL.md` (fila item 4).

## Objetivo

Mostrar, no dashboard, o **saldo atual de cada conta** — quanto há em cada banco —
a partir dos extratos que o usuário já importa. Um número por conta, com a data a
que ele se refere.

## Decisões tomadas (brainstorming 2026-07-24)

1. **Modelo — saldo final do extrato mais recente.** Cada extrato declara o saldo
   final do período. O saldo atual de uma conta é o `balance.final` do extrato de
   maior `period_end` daquela conta. É autoritativo e **se autocorrige** a cada novo
   extrato; nunca "deriva" como faria uma soma de lançamentos. Contrapartida aceita:
   entre um extrato e outro o número fica parado na data do último extrato — por isso
   **a data é sempre mostrada junto**.
2. **Persistência — o saldo é um fato do documento.** Guardado em `documents`
   (coluna nova), não denormalizado em `accounts`. O "saldo atual" é derivado na
   leitura. Combina com o resto do app (guarda fatos, deriva o resto) e não exige
   lógica de "só atualiza se for mais novo" na importação.
3. **UI — fileira de cards acima do filtro de bancos.** Um card por conta com saldo
   conhecido. Some quando não houver nenhum.

## Aproveitamento do que já existe

`ParseResult.balance` **já existe** (`{ initial, final } | null`) — o Banco do Brasil
o adicionou para conferir pela progressão de saldo (`balance.final` credor > 0,
devedor < 0). Reaproveitamos esse campo como fonte do saldo, **sem criar campo novo**.

Estado atual por parser de extrato:
- **BB** — já preenche `balance`.
- **Bradesco** — lê a coluna de saldo (`COL.saldoRight`, marcador `SALDO_INICIAL`)
  só para ancorar datas; **não expõe** o valor. Passar a preencher `balance`.
- **Nubank** — não captura o "Saldo final do período". Passar a preencher.
- **Sicredi, Sicoob** — verificar na amostra real; preencher `balance`.

`balance.final` é o único campo obrigatório para esta feature. `balance.initial` é
opcional (só reforça a conferência onde já houver total declarado) — YAGNI se a
amostra do banco não trouxer o saldo inicial de forma limpa.

## Componentes (unidades isoladas)

### 1. Parsers de extrato — preencher `ParseResult.balance`
- Puro, offline, testável contra as amostras reais em `.amostras-bancos/` (gitignored).
- Cada parser de **extrato** passa a devolver `balance.final` (centavos, com sinal).
- Faturas continuam com `balance` ausente/null.
- **Teste por banco:** `balance.final` bate com o saldo final impresso na amostra.
- Onde um banco publica saldo inicial e final, preencher os dois habilita um ramo de
  conferência no `checksum.ts` (opcional, só se sair de graça).

### 2. Migração `neon/migrations/0002_saldo_e_bancos.sql`
Duas mudanças, ambas idempotentes onde possível:

```sql
-- a) o saldo final do extrato, como fato do documento (nulável; fatura não tem)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS end_balance_cents bigint;

-- b) CONSERTO de bug latente: o CHECK de accounts.bank foi criado em 0001 só com
--    ('nubank','bradesco','desconhecido'). O app já lê e tenta SALVAR BB, Sicredi
--    e Sicoob; um insert de conta desses bancos VIOLA o constraint hoje. Relaxar
--    para os 5 bancos suportados.
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_bank_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_bank_check
  CHECK (bank IN ('nubank','bradesco','bb','sicredi','sicoob','desconhecido'));
```

> Nota: o nome real do constraint (`accounts_bank_check`) deve ser confirmado no
> banco antes de aplicar — o Postgres nomeia `<tabela>_<coluna>_check` por padrão,
> mas convém checar com `\d public.accounts` (ou consulta a `pg_constraint`).

**Aplicação — portão.** Aplicar **primeiro numa branch do Neon**, verificar
(`\d public.accounts` mostra os 5 bancos; `documents` tem a coluna), depois
produção. Passo do usuário / com aval explícito. **Nada no código depende de a
migração já estar em produção** exceto salvar/ler o saldo — a UI degrada para
"sem saldo" quando a coluna não existe ou está nula.

### 3. Persistência
- `salvar.ts`: no insert do documento, `end_balance_cents: result.balance?.final ?? null`.
- Leitura: expor, por documento, `account_id, bank, doc_type, period_end,
  end_balance_cents`. Reusar a busca de `documents` já existente (a de `Documentos.tsx`)
  ou uma leitura enxuta dedicada — decidir no plano, seguindo o padrão de `puxar.ts`.

### 4. Derivação — `saldosPorConta(documentos)` (função pura)
- Entrada: lista de documentos com `{ bank, account_id, doc_type, period_end,
  end_balance_cents }`.
- Saída: um `{ bank, accountId, balanceCents, date }` por conta que tenha ao menos
  um extrato com `end_balance_cents` não nulo, escolhendo o de maior `period_end`.
- Ignora faturas e documentos sem saldo. Vive em `persist/` ou `domain/`, ao lado de
  `agrupar.ts`. Puro e testável sem banco.

### 5. UI — `src/ui/SaldoConta.tsx` + fileira no `Dashboard`
- Fileira acima do seletor de banco (que só aparece com ≥2 bancos; o saldo aparece
  com ≥1 conta com saldo).
- Card: rótulo "Saldo", nome do banco (de `BANCOS`, cor `accent`), valor em `formatBRL`,
  e "em DD/mmm" (a `date`). Reusa `ValorAnimado`/`formatBRL` conforme o padrão.
- Some inteiro quando `saldosPorConta` volta vazio (ninguém importou extrato ainda,
  ou a migração não rodou).

## Fluxo de dados

```
extrato PDF → parser (balance.final) → salvar (end_balance_cents no documento)
                                              ↓
dashboard: ler documentos → saldosPorConta() → fileira de cards SaldoConta
```

## Tratamento de erro / bordas
- **Migração não aplicada / coluna ausente:** a leitura devolve `end_balance_cents`
  indefinido → `saldosPorConta` ignora → fileira some. Sem quebra.
- **Conta só com faturas (cartão):** sem saldo, não entra na fileira.
- **Saldo negativo (conta devedora):** `balance.final < 0` é válido e é mostrado como
  tal (vermelho/negativo, segundo o padrão de cor do app).
- **Vários extratos, mesma conta:** vence o de maior `period_end`. Empate de data é
  inalcançável na prática (dedupe por hash de documento); se ocorrer, qualquer um
  serve — o saldo final do mesmo período é o mesmo número.

## Testes
- **Parser (por banco):** `balance.final` == saldo final da amostra real.
- **`saldosPorConta`:** pega o mais recente; ignora fatura; ignora saldo nulo; conta
  sem extrato não aparece; saldo negativo passa.
- **UI:** card renderiza valor + data; fileira some quando não há saldo.
- Meta: manter a suíte verde (hoje 329) e somar os novos.

## Fora de escopo (YAGNI)
- Histórico de saldo / gráfico de evolução do saldo (a feature é "quanto tenho agora").
- Projeção "saldo até hoje" somando lançamentos após o extrato (rejeitado no
  brainstorming: reintroduz deriva).
- Saldo de fatura de cartão (não é saldo de conta).
- `balance.initial` obrigatório — opcional, só onde a amostra entrega limpo.

## Ordem de implementação (para o plano)
1. Parsers de extrato preenchem `balance.final` (um banco por vez, com teste).
2. `saldosPorConta` puro + testes.
3. Migração `0002` (arquivo no repo; aplicação em branch/produção é passo manual gated).
4. `salvar.ts` grava `end_balance_cents`; leitura expõe.
5. UI `SaldoConta` + fileira no Dashboard.
6. Verificação: `npm test && npm run build && npm run lint`, e — quando a migração
   estiver numa branch do Neon — um salvar/ler real de extrato conferindo o número.
