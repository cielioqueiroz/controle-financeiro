# Funcionalidades derivadas — spec

> Rodada de 2026-08-05. Origem: `docs/img/exemplo.jpeg`, print de um app de
> finanças pessoais de terceiro, usado como referência de funcionalidades.
> **Somente funcionalidades — nenhuma decisão de aparência nesta rodada.**

## Por que esta rodada existe

O print mostra um app com as abas `Dashboard · Lançamentos · Faturas ·
Importação · Categorias · Recorrências · Poupança · Datas` e sete tiles no
painel: Entradas, Saídas, **Pago no mês**, **Falta pagar**, **Saldo do mês**,
**Poupado acumulado**, **Contas pagas 71%**. Mais três cartões: *Datas do mês*,
*Maiores saídas do mês* e o donut de categorias, além de barras de Entradas ×
Saídas em 12 meses.

Cruzando com o que o Capital Financeiro já faz, o donut, as barras de 12 meses
(`GraficoEvolucao`) e a importação já existem e são equivalentes. O resto se
divide em duas naturezas muito diferentes, e essa distinção é a decisão
estruturante da rodada.

### A decisão estruturante: o app continua retrospectivo

Metade do que o print mostra — *falta pagar*, *contas pagas*, *datas*,
*recorrências*, *poupança* — é **prospectivo** e, naquele app, nasce de dado
que a pessoa **digita**. O Capital Financeiro é **100% retrospectivo**: toda
transação nasce de um PDF importado e `transactions.document_id` sempre aponta
para um documento.

**Decisão (usuário, 2026-08-05): não se introduz digitação nesta rodada.**
Entra apenas o que o app consegue **derivar sozinho** do que já importa. Isso
preserva a identidade do produto (leitor de extratos, não planilha manual),
dispensa migração de banco e elimina a classe inteira de bug "o que a pessoa
digitou não bate com o que o banco diz".

O bloco de **Poupança/investimentos foi descartado** de propósito (decisão do
usuário). "Quanto sobrou" fica coberto pelo tile de Saldo do mês (B1).

## Os três achados que orientam o desenho

Levantados lendo o código antes de desenhar. Cada um muda o custo de uma
funcionalidade da lista.

1. **O dado de "falta pagar" já está gravado e ninguém lê.**
   `salvar.ts:74-77` grava `next_close_date`, `next_invoice_balance`,
   `total_open_balance` e `future_installments_total` em toda importação. O
   parser do Nubank extrai os três primeiros (`nubank-fatura.ts:188-190`) e o
   do Bradesco extrai `futureInstallmentsTotal`. **Nenhum ponto do código lê
   essas colunas.** Ligar o fio é leitura pura, sem migração.

2. **O app já sabe quais faturas foram quitadas.** `vincular()` marca
   `card_payment` quando acha no extrato um pagamento cujo valor bate com o
   total declarado de uma fatura (`vinculos.ts:104-112`). O selo "quitada" é
   derivação desse fato, não trabalho novo.

3. **`merchant_rules` não tem nenhuma UI.** O usuário corrige uma categoria,
   o app aprende (ligado em 2026-07-29) e **não existe jeito de ver nem
   desfazer** o que foi aprendido. Uma correção errada é permanente e
   invisível. Esse é o buraco mais real da lista, e é o que justifica D2.

E uma peça pronta que evita reinventar: `normalizeMerchant()`
(`normalize/merchant.ts:19`) já descasca marcador de parcela e prefixo de
adquirente (`MP*`, `HNA*`). É exatamente a chave de agrupamento que a detecção
de recorrência precisa.

## Escopo, em três fatias

Cada fatia é um plano e uma implementação próprios, verificáveis isoladamente.
A ordem é de menor custo e maior retorno para maior.

| Fatia | Conteúdo | Cria tela nova? | Migração? | Estado |
|---|---|---|---|---|
| **1** | A1, A2, B1, B2 | não | não | ✅ entregue 2026-08-05 |
| **2** | C1, C2 | card no aside | não | ✅ entregue 2026-08-05 |
| **3** | D1, D2 | vista + painel | não | ✅ entregue 2026-08-05 |

> **Entregue, não commitado.** As três fatias estão na árvore de trabalho a
> pedido do usuário, que quer conferir rodando local antes de publicar.
>
> **Dois desvios do desenho original, ambos deliberados:**
>
> 1. **C1/C2 não ganharam painel modal.** O card no aside expande e recolhe
>    inline (5 itens, botão "ver mais"). Menos superfície e uma dependência a
>    menos de `Portal`, com o mesmo alcance. `AnimatePresence` ficou de fora da
>    lista de propósito: animação de saída segura a linha no DOM depois de
>    recolher, e recolher precisa ser imediato.
> 2. **A regra de "sumiu" virou janela de recência** (teto de 3 meses) em vez
>    de "presente nas 2 competências anteriores". A redação original errava o
>    caso de faltar 2 meses seguidos — que é *mais* alarmante e não alertava.
>    A janela expressa o objetivo declarado (não gritar para sempre) e cobre
>    esse caso.

Nenhuma fatia exige migração de banco. Nenhuma introduz navegação nova: tudo
mora nos padrões que já existem (decisão do usuário, 2026-08-05).

---

## Fatia 1 — dado morto e derivações triviais

### A1 · Saldo em aberto e próximo fechamento

**O que é.** O "Falta pagar" do print, derivado do próprio PDF em vez de
digitado: quanto ainda está em aberto no cartão e quando a próxima fatura
fecha.

**Como.** `puxarSaldos()` (`documentos.ts:32-44`) passa a trazer também
`total_open_balance`, `next_invoice_balance`, `next_close_date` e
`future_installments_total`, **no mesmo select defensivo que já existe** — o
`try/catch` que devolve `[]` quando a coluna não existe continua protegendo,
então uma coluna faltando degrada para "não aparece" e nunca quebra o painel.

Novo módulo puro `persist/aberto.ts`: dada a lista de documentos, escolhe por
conta a **fatura de maior `period_end`** e devolve o que ela declara. Espelha
`persist/saldos.ts`, que já resolve exatamente esse problema para o saldo do
extrato — mesmo formato, mesmo teste.

**Onde aparece.** Na fileira de cartõezinhos que a `SaldoConta` já ocupa. Sem
layout novo.

**Limite honesto.** Hoje só o Nubank declara saldo em aberto e próximo
fechamento; o Bradesco declara só o total das próximas faturas. Quem não
declara simplesmente não mostra o cartão — nada de inventar número.

### A2 · Fatura quitada vs em aberto

**O que é.** O "Contas pagas 71%" do print, derivado.

**Como.** Módulo puro `domain/quitacao.ts`. Uma fatura está quitada se existe
transação salva com `kind = 'card_payment'` cujo valor bate com o
`declared_total` dela. É a mesma regra do `vinculos.ts`, com uma diferença que
importa:

> `vincular()` roda **sobre o lote da importação**. Se a fatura entra em
> janeiro e o extrato que a quita entra em fevereiro, o vínculo nunca
> acontece. Aplicar a regra sobre **tudo que está salvo** conserta esse buraco
> de verdade, não só mostra um selo.

**Onde aparece.** Selo "quitada" / "em aberto" na lista do painel `Documentos`,
que já lista os documentos e já tem `declared_total` em mãos.

**Cuidado de desenho.** Casar por valor exato pode dar falso positivo se duas
faturas de meses diferentes tiverem o mesmo total. Desempate: a transação de
pagamento tem que ser **posterior** ao `period_end` da fatura, e cada
transação de pagamento só pode quitar **uma** fatura (consumo, não reuso).

### B1 · Tile "Saldo do mês"

`agregar()` (`agrupar.ts:72`) passa a devolver `saldoCents = entradasCents −
gastoCents`. Quarto tile na fileira que hoje tem três.

**Consequência de layout, declarada:** a grade dos tiles é `sm:grid-cols-3`.
Um quarto tile obriga a mexer nessa classe. É a **única** consequência visual
inevitável desta fatia, e fica registrada aqui para o usuário decidir — as
alternativas são grade de 4 ou grade de 2×2.

### B2 · Card "Maiores saídas do mês"

`maioresSaidas(txs, n)` em `agrupar.ts`: filtra `kind === 'expense'`, ordena
por valor desc, corta em `n` (padrão 5). Função pura, teste trivial.

Componente novo no aside, junto do donut e de `CompromissosFuturos`. Cada
linha reusa o selo de categoria que `ListaPorCategoria` já desenha.

---

## Fatia 2 — recorrências e alertas

### C1 · Recorrências detectadas

**O que é.** Cobre as abas *Recorrências* **e** *Datas do mês* do print de uma
vez só, sem cadastro nenhum.

**Módulo puro `domain/recorrencias.ts`.** Sem rede, sem React.

Regras de detecção:

- **Agrupa por `normalizeMerchant(description)`** — a peça que já existe.
- **Ignora transações parceladas** (`installment != null`). Essa fronteira é
  deliberada: parcela já é assunto de `CompromissosFuturos`. Sem ela, a mesma
  compra apareceria em dois lugares dizendo coisas diferentes.
- **Recorrente = presente em ≥3 competências distintas.** Competência (mês da
  fatura), não data real — é o agrupamento que o app já usa para mês/ano.
- **Classifica em valor fixo ou variável.** Luz e água variam todo mês e *são*
  recorrências legítimas; tratá-las como ruído perderia o que mais importa.
  A classificação não decide se é recorrência — decide só se C2 pode alertar.
  **Limiar explícito:** é `fixo` quando **todas** as ocorrências, exceto no
  máximo a última, caem dentro de **±5% da mediana**; senão é `variavel`. A
  última fica de fora do cálculo de propósito — ela é justamente a candidata a
  ser a mudança que C2 vai anunciar, e incluí-la faria o aumento se esconder
  reclassificando a recorrência como variável.
- Devolve `valorTipicoCents` e `diaTipico`, ambos **medianas** (mediana, não
  média: um mês atípico não desloca o valor típico).

`diaTipico` **é** o card "Datas do mês" do print — "05 Aluguel, 15 Salário"
sai de graça da mesma estrutura, sem feature separada.

Forma da saída:

```
Recorrencia = {
  chave            // normalizeMerchant
  descricao        // a ocorrência mais legível do grupo
  categoriaSlug
  tipo             // 'saida' | 'entrada'  (salário entra aqui)
  valorTipicoCents // mediana
  diaTipico        // mediana do dia do mês
  variacao         // 'fixo' | 'variavel'
  competencias[]   // ordenadas
  ultimoValorCents
  ultimaCompetencia
}
```

### C2 · Alertas de mudança

Derivados da mesma lista, sem estrutura nova. **É a única funcionalidade desta
rodada que o app do print não tem** — e é justamente o que um app que lê
documentos faz melhor que um app que recebe digitação.

- **`valor-mudou`** — "Netflix subiu de R$ 39,90 para R$ 55,90".
  **Só dispara para recorrências de valor fixo.** Sem essa trava, a conta de
  luz alertaria todo santo mês e o usuário aprenderia a ignorar o alerta.
  **Limiar explícito:** `ultimoValorCents` difere da mediana das anteriores em
  **mais de 10%** *e* em **mais de R$ 5,00**. As duas condições juntas: só o
  percentual faria uma assinatura de R$ 9,90 alertar por R$ 1,00 de diferença;
  só o valor absoluto faria uma conta de R$ 800 ignorar R$ 6,00 de aumento.
- **`sumiu`** — "a academia não veio esse mês".
  **Só compara contra a competência mais recente que tem dado.** Sem essa
  trava, o mês em que a fatura ainda não foi importada acusaria *tudo* como
  sumido — o alerta seria pior que não ter alerta.
  **Regra explícita:** dispara quando `ultimaCompetencia` é **anterior** à
  competência mais recente presente no conjunto de dados **e** a recorrência
  estava presente nas 2 competências imediatamente anteriores a essa. Sem a
  segunda parte, algo que aconteceu 3 vezes em 2024 alertaria para sempre.

Ambas as travas existem pelo mesmo motivo: alerta que grita à toa é alerta
que ninguém lê.

**Onde aparece.** Card no aside, junto de `CompromissosFuturos`, com "ver
todas" abrindo painel no padrão do `Documentos`.

---

## Fatia 3 — Lançamentos e Categorias

### D1 · Vista "Todos" com busca e filtro

Hoje só dá para navegar por categoria ou por dia, dentro do período ativo.
Falta procurar uma compra específica.

Terceira opção no seletor de vista que já existe
(`por categoria | por dia | todos`), com campo de busca por texto e filtro por
categoria. Reusa `LinhaTransacao`. A busca casa contra `label ?? description`
— o rótulo do usuário é o que ele lembra ter escrito.

### D2 · Painel de Categorias e regras aprendidas

Painel no padrão do `Documentos`, em duas seções:

**Suas categorias** — lista, renomeia, troca ícone/cor, apaga.
`criarCategoria` e `apagarCategoria` já existem em
`persist/categoriasUsuario.ts`; falta `editarCategoria`.

> **Apagar categoria em uso.** As transações guardam `category_slug`, não FK.
> Apagar a categoria deixa o slug órfão e `categoria(slug)` cai no fallback.
> Decisão: a confirmação **diz quantas transações serão afetadas** e elas
> passam a exibir "Outros". Não se apaga em silêncio.

**Regras aprendidas** — o item 3 dos achados. Lista o que o app aprendeu
("MERCADO X → Supermercado") com botão de esquecer. Precisa de `apagarRegra`
novo em `persist/regras.ts`, simétrico ao `salvarRegra` que já existe.

---

## O que fica de fora, e por quê

- **Digitação de qualquer natureza** — conta a pagar, meta, recorrência
  cadastrada à mão. Decisão do usuário; muda a identidade do produto.
- **Poupança e investimentos** (bloco E do levantamento). Descartado pelo
  usuário. A categoria `investimentos` continua existindo e funcionando.
- **Abas de topo** como no print. É reestruturação de navegação, ou seja,
  mudança de aparência — fora do escopo declarado desta rodada.
- **Aparência em geral.** Nenhuma decisão visual aqui. A única consequência
  de layout inevitável está declarada em B1, para o usuário decidir depois.

## Como verificar

Cada fatia entrega funções puras testáveis sem rede — é o padrão do projeto
(`saldos.ts`, `agrupar.ts`, `aprendizado.ts` são todos assim). Além dos testes:

```bash
npm test && npm run build && npm run lint
npx tsx scripts/diagnostico.ts "D:/extratos/junho2026"
python scripts/medir-overflow.py            # com npm run dev rodando
```

Os números de referência do `docs/ESTADO-ATUAL.md` (gasto real de junho
R$ 41.012,25, entradas R$ 41.853,57, 34 parcelas futuras) **não podem mudar**:
esta rodada só lê e deriva, nunca altera o que já é calculado. Se algum deles
se mexer, alguma derivação vazou para o cálculo existente.
