# Auditoria das somas e roteiro de melhorias — 2026-10-30

Escopo: conferir se o **gasto real**, as entradas, a projeção de parcelas e os
relatórios seguem as regras do `CONTEXT.md` e das ADRs, e levantar melhorias de
produto, regra e interface **sem mudar a natureza do app** — continua
retrospectivo: só importa fatura e extrato, e todo número vem de um documento.

Nada do código foi alterado. Os quatro defeitos de soma abaixo foram
**reproduzidos com script** contra o domínio real (`agrupar.ts`,
`relatorios.ts`), com dados fictícios; os números citados são a saída dele.

---

## 1. Defeitos nas somas

### 1.1 Estorno na fatura vira "entrada" no Bradesco e no Mercado Pago — e abate o gasto no Nubank

> **Corrigido em `fix/estorno-e-parcelas`**, com a migração `0012` para o
> histórico (ensaiada localmente, ainda não aplicada no Neon).

| Banco | Onde | Estorno vira |
|---|---|---|
| Nubank | `domain/parsers/nubank-fatura.ts:90` | `compra` com valor negativo → `expense` negativo → **abate o gasto** |
| Bradesco | `domain/parsers/bradesco-fatura.ts:147` | `entrada` → `income` |
| Mercado Pago | `domain/parsers/mercadopago-fatura.ts:94` | `entrada` → `income` |

Prova (compra de R$ 300 estornada no mesmo mês):

```
Nubank        gasto 0      entradas 0
Bradesco/MP   gasto 300,00 entradas 300,00
```

O mesmo fato vira dois números diferentes conforme o banco. No Bradesco e no
Mercado Pago, o estorno **infla o gasto real e as entradas ao mesmo tempo**. A
taxa de economia e o "quanto sobrou" ficam errados, e a categoria da compra
segue com o valor cheio. Estorno não é renda: é dinheiro do mesmo consumo
voltando.

**Correção sugerida:** estorno de fatura é `compra` com valor negativo nos três
parsers, como o Nubank já faz, e a regra vira linha no `CONTEXT.md` (termo
**Estorno**). Antes de mexer, confira contra o fixture do Bradesco **se o "Total
a pagar" declarado já desconta o estorno**. A conferência `total-fatura`
(`validate/checksum.ts:42`) soma só `compra` + `encargo`, então mudar o
`RawKind` muda o que é conferido.

### 1.2 A projeção de parcelas duplica com rótulo e funde compras diferentes

> **Corrigido em `fix/estorno-e-parcelas`.** A correção também resolveu a série
> quitada: a 6/6 era descartada antes do agrupamento, e a 5/6 reprojetava a 6/6.

`domain/agrupar.ts:229-230` — a chave da série é `label ?? description` + total
de parcelas.

- **Rótulo parte a série em duas.** Parcela 03/10 renomeada para "Geladeira" e
  04/10 sem rótulo viram duas séries, e cada uma projeta suas parcelas.
  Prova: out/2026 projeta **R$ 200,00 em vez de R$ 100,00**. Isso também
  contraria o `CONTEXT.md`: "Rótulo… Nunca agrupa nada".
- **Duas compras na mesma loja, com o mesmo número de parcelas, viram uma
  só.** AMAZON 10× de R$ 50 e AMAZON 10× de R$ 80: a de número maior vence e a
  outra some. Prova: out/2026 projeta **R$ 80,00 em vez de R$ 130,00**.
- A chave também não tem banco: a mesma descrição em dois cartões se funde.

**Correção sugerida:** a chave da série é
`banco + normalizeMerchant(description) + total + valor + competência de
origem`, com a competência de origem igual a `competência − (parcela atual − 1)`.
O rótulo entra só na exibição.

**Bônus de confiança:** a fatura declara `future_installments_total`, que já é
gravado (`domain/aberto.ts`). Comparar a projeção com esse número é uma
**conferência da própria projeção**, no espírito da ADR de conferência.

### 1.3 O relatório trata como completo um mês que só tem a fatura

`domain/relatorios.ts:57` — o fim da janela é a **maior competência do
histórico**. Pela ADR-0001, a fatura conta no mês do vencimento, e a última
fatura importada costuma vencer **no mês seguinte** ao último extrato. Esse mês
entra na janela só com gasto e sem entradas, e ainda conta como "com dados".

Prova (seis meses idênticos: R$ 6.000 de entrada e R$ 4.000 de gasto; mais uma
fatura de R$ 3.500 vencendo em novembro):

```
janela 2026-09 → 2026-11, comparavel: true
taxa de economia atual 4,2%   anterior 33,3%   variação do gasto −4,2%
```

O usuário vê a economia "despencar" de 33% para 4% sem ter mudado nada. A
spec 002 já admite que ter transação no mês não prova completude. Este é o
caso concreto, e ele acontece **todo mês**.

**Correção sugerida:** só considerar completa a competência em que toda conta
conhecida tem documento que a cubra (ver a "matriz de cobertura" em 2.1). No
mínimo, o fim da janela é a última competência com extrato **e** fatura.

### 1.4 Pagamento de empréstimo cai em "Taxas bancárias" e domina o mês

Na folha de provas, `PAGAMENTO EMPRESTIMO` (R$ 41.653,85) está em **Taxas
bancárias** e é **91% do donut**. O catálogo (`categorize/categorias.ts`) não tem
categoria para dívida. Amortização de empréstimo ou financiamento não é encargo,
porque encargo é IOF, anuidade, tarifa e juros, nem é consumo. Misturá-la ao
gasto real esconde todo o resto: ranking, donut, diagnóstico de "taxas
altas" e concentração passam a falar só dela.

**Correção sugerida:** criar uma categoria `dividas` (empréstimo, financiamento,
consignado, acordo) com regra global, e mostrar o gasto real em duas linhas:
**consumo** e **dívidas**. A soma total continua a mesma, então nada esconde
dinheiro. Só "Taxas" continua sendo encargo.

### 1.5 Pagamento de fatura sem a fatura importada some do gasto sem aviso

`persist/salvar.ts:134` — `pagamento` sem vínculo grava `card_payment` de
qualquer jeito. Com só o extrato importado, a quitação sai da soma (certo, para
não haver dupla contagem), mas **as compras daquela fatura também não estão na
soma**. O gasto real do mês fica menor do que foi, em silêncio.

**Correção sugerida:** a **Procedência** passa a dizer "Quitação de fatura
Bradesco de R$ X sem a fatura importada — esse gasto ainda não está no
número". É a mesma família de 1.3: o app sabe o que falta e não conta.

### 1.6 Riscos menores (não reproduzidos)

- **Categoria com total negativo.** Um estorno no Nubank que cai num mês
  diferente do da compra deixa a categoria negativa naquele mês. Falta
  conferir como o donut e as barras desenham um valor negativo.
- **Pagamento parcial da fatura.** A quitação só ganha evidência com o valor
  inteiro (ADR-0021). Pagar o mínimo ou parte não gera nenhum aviso, e o resto
  vai para o rotativo, cujo juros chega na fatura seguinte. Ver 2.3.

---

## 2. Regras e ideias de produto (todas só a partir do que foi importado)

### 2.1 Matriz de cobertura: "o que falta importar"

Uma grade **conta × competência** em que cada célula diz: extrato importado,
fatura importada, faltando ou fora do período. Ela resolve 1.3 e 1.5 de uma vez
e vira a tela de entrada do mês: o usuário vê o buraco antes de confiar no
número. É a **Integridade do recorte** levada do banco de dados para o
histórico de documentos.

### 2.2 Gasto pontual × gasto de rotina

Separar o atípico (compra isolada acima de N× a mediana da categoria, ou acima
de um valor) do recorrente. O donut e a média diária ganham a opção "sem
atípicos". É o que faz um mês com um empréstimo de R$ 41 mil voltar a dizer
alguma coisa sobre o supermercado.

> **Feito em `feat/atipicos`** (`domain/atipicos.ts`, termo **Gasto atípico**
> no `CONTEXT.md`): a alternância "Sem atípicos" no donut e no ritmo diário
> do Painel.

### 2.3 Alertas que o documento já permite

- **Fatura paga a menor:** o valor da quitação é menor que o "Total a pagar" →
  "o resto vai para o rotativo".
- **Juros/IOF de atraso apareceram:** já existe o diagnóstico de "taxas altas".
  Este alerta é específico de juros de rotativo e de multa.
- **Comprometimento de renda:** (parcelas futuras + dívidas) ÷ entradas do mês.
  Faixas de referência de educação financeira: até 30% saudável, de 30% a 40%
  atenção, acima de 40% elevado ([Serasa](https://www.serasa.com.br/credito/blog/comprometimento-renda/),
  [Valor Final](https://valorfinal.com.br/guia/comprometimento-de-renda)). Não é
  norma do Banco Central, e a tela não deve dizer que é. A FGV propõe 20% para
  dívida cara sem garantia e 35% no total
  ([FGV EAESP](https://eaesp.fgv.br/node/13846)).

### 2.4 Dias de fôlego

Saldo das contas correntes ÷ gasto real médio por dia dos últimos 90 dias =
"quantos dias o dinheiro de hoje dura". Usa só o **Saldo** do extrato mais
recente e o histórico. É a métrica *Days of Buffering* da comunidade YNAB, que
o próprio YNAB complementa com o *Age of Money*
([YNAB](https://www.ynab.com/blog/how-old-is-your-money),
[comparação](https://medium.com/@penzgil/which-ynab-metric-is-best-a23e4b8aeda9)).
Também vale mostrar o **líquido de curto prazo**: saldos − faturas em aberto.

### 2.5 Fluxo entradas → categorias

Um diagrama de fluxo (Sankey) do mês: entradas à esquerda, categorias e
"sobrou" à direita. O Monarch fez disso o centro dos relatórios
([Monarch](https://help.monarch.com/hc/en-us/articles/20504904768020-Cash-Flow)),
e depois ajustou para mostrar estornos e reembolsos do lado da entrada —
exatamente a ambiguidade de 1.1. Aqui eles devem abater a categoria.

### 2.6 Calendário do próximo mês

Recorrências e parcelas projetadas, dispostas por dia: "o que deve cair em
novembro". O Monarch oferece um calendário de recorrências parecido
([Monarch](https://www.monarchmoney.com/whats-new/track-recurring-bills-and-subscriptions)).
É projeção, nunca gravada, como o **Compromisso futuro**.

### 2.7 Mais formatos de importação (opcional)

OFX e CSV que o próprio banco exporta continuam sendo "documento do banco" e
trazem saldo para conferência. Isso amplia a cobertura sem um parser de PDF por
layout. Só vale se o dono quiser manter o PDF como fonte única.

---

## 3. Interface

Avaliada na folha de provas (`/demo.html`, dados fictícios) e nos prints do
`docs/img`. As telas autenticadas, com dados reais, **não** foram vistas.

| # | O que | Sugestão |
|---|---|---|
| U1 | O donut fica inútil quando um item tem 91% | Barras horizontais ordenadas como vista principal, com a opção "sem atípicos" (2.2). |
| U2 | Rótulos de seção (`PROCEDÊNCIA`, `SALDOS`, `COMPROMISSOS`) em mono caixa-alta com espaçamento largo, pequenos e claros | Subir para ≥ 12px e medir com `scripts/medir-contraste.py`. |
| U3 | Descrição crua do banco em CAIXA ALTA domina as listas | Exibir em caixa de título só na tela, sem tocar a **Descrição** gravada nem a chave do estabelecimento. **Feito em `feat/descricao-caixa-titulo`.** |
| U4 | Saldo de conta e "Próximas faturas" com o mesmo peso, na mesma fileira | Separar o que é seu (saldo) do que você deve (fatura) e mostrar o líquido de curto prazo (2.4). |
| U5 | Compromissos repetem seis linhas iguais ("1× R$ 450,00") | Recolher meses consecutivos iguais: "nov/26 – abr/27 · 6× R$ 450,00". |
| U6 | Os dois rankings lado a lado repetem o mesmo primeiro lugar | Um ranking só, com a alternância "por compra / por estabelecimento". |
| U7 | O detalhe "transações e documentos deste valor" é o ponto forte do app | Levar o mesmo botão de origem para cada número do cabeçalho (gasto real, entradas, sobra). **Feito em `feat/origem-cabecalho`** ("De onde vem"; no código, **Composição**). |

Os comparativos citam [Copilot e Monarch](https://getfinny.app/blog/copilot-money-vs-monarch-money-2026)
como referência de interface e de detecção de recorrência. Sobre conciliação,
[Firefly III](https://docs.firefly-iii.org/how-to/firefly-iii/finances/reconcile/) e
[Actual](https://actualbudget.org/docs/transactions/transfers) seguem o mesmo
princípio daqui: transferência entre contas próprias não tem categoria, e as
duas pontas andam juntas.

---

## 4. Ordem sugerida

| Prioridade | Item | Por quê |
|---|---|---|
| 1 | 1.1 Estorno | Número errado hoje, em dois bancos. É correção pequena nos parsers, mas exige conferir o fixture. |
| 2 | 1.2 Chave da projeção | Número errado hoje. Correção pura em `domain/`, com teste. |
| 3 | 1.3 + 2.1 Cobertura | Corrige o relatório e o 1.5, e vira funcionalidade. |
| 4 | 1.4 Categoria `dividas` + consumo × dívidas | Muda o que o Painel diz em todo mês com empréstimo. |
| 5 | 2.3 Alertas de fatura paga a menor e de comprometimento | Valor alto, só dado já existente. |
| 6 | U1, U5, U6 | Interface com o maior ganho por esforço. |
| 7 | 2.2, 2.4, 2.5, 2.6 | Funcionalidades novas. |

Cada item de 1.x merece teste de domínio que **reproduza o caso acima antes da
correção** (os quatro roteiros do script cabem como testes em `agrupar.test.ts`
e `relatorios.test.ts`).

## 5. Fora desta auditoria

- Dados reais do Neon e PDFs originais: os números de produção não foram
  recalculados.
- Telas autenticadas, celular e tema escuro com dado real.
- A semântica do "Total a pagar" do Bradesco e do Mercado Pago quando há
  estorno: depende do PDF real.
