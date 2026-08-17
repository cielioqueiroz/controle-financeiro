# Competência é o mês do vencimento da fatura, não o da compra

Uma fatura atravessa dois meses do calendário: a compra de 20/mai chega na fatura
que vence em 10/jun. Agrupar pela data real da compra **partia a fatura ao meio** —
o supermercado de junho aparecia com R$ 287 em vez dos R$ 918 que o usuário de fato
pagou naquele mês. Decidimos que o mês de um lançamento é a **competência**: o mês
do `period_end` do documento, que numa fatura é o vencimento e num extrato é o fim
do período extraído.

## Considered Options

- **Data real da compra**, como pede o spec original em
  `docs/prompt-dashboard-financeiro.md` ("o gráfico por mês precisa usar a data da
  compra, não a data da fatura"). Recusada: é correta para um contador e errada
  para o usuário, que pensa em "o que veio na fatura desse mês" e confere o número
  contra o boleto que pagou.
- **As duas visões, alternáveis por um botão.** Recusada por escopo: dobra a
  superfície de teste de todo agregado e nenhum usuário pediu.

## Consequences

- **Dia e Semana usam outra régua.** `pertence()` compara `tx.date` em Dia e
  Semana, e `tx.competencia` em Mês e Ano. Uma compra de 20/mai na fatura de junho
  está simultaneamente na semana de maio e no mês de junho — trocar o período sem
  trocar a referência pode fazer a transação sumir da tela. É consequência aceita,
  não defeito.
- **Extrato que atravessa o mês herda a data errada.** Um extrato de 15/jun a
  14/jul joga *todo* o mês de junho na competência `2026-07`, sem que exista um
  ciclo de fatura para justificar. Nenhum banco suportado emite extrato assim hoje,
  mas a regra permite.
- Quem "consertar" isso para a data da compra vai ver os totais mensais mudarem e
  deixarem de bater com as faturas. Foi confirmado pelo usuário em 2026-07-18.
