# Quitação de fatura não é despesa: o vínculo tira dinheiro da contagem

Importar a fatura e o extrato do mesmo mês conta o mesmo dinheiro duas vezes: as 40
compras aparecem detalhadas na fatura, e a quitação delas aparece como uma saída
única de R$ 3.000 no extrato. Somar cru infla os gastos em cerca de 2×. Decidimos
marcar essas transações com um **vínculo**, que as remove do gasto sem apagá-las —
elas continuam visíveis, auditáveis e somando no saldo da conta.

## Consequences

- **O nome do valor é mais estreito que o valor.** `internal_transfer` cobre duas
  coisas que não são a mesma: transferência entre contas do próprio titular, e a
  varredura automática do BB (conta ↔ aplicação). Quem distingue as duas na tela é
  o `linkNote`, não o `kind`. Separar exigiria `ALTER TABLE` num CHECK em produção
  para ganhar pouco.
- **A conversão de `RawKind` para `transactions.kind` perde informação.** É a única
  ponte entre os dois vocabulários (`kindParaBanco`, em `persist/salvar.ts`), e o
  vínculo tem precedência sobre a natureza da linha:

  | `RawKind` (documento) | vínculo | `transactions.kind` (banco) |
  |---|---|---|
  | qualquer | `internal_transfer` | `internal_transfer` |
  | qualquer | `card_payment` | `card_payment` |
  | `entrada` | — | `income` |
  | `pagamento` | — | `card_payment` |
  | `compra` | — | `expense` |
  | `encargo` | — | `expense` |

  `encargo` é o que some: depois de salvo, IOF e anuidade são indistinguíveis de
  uma compra pelo `kind`. Quem precisa dessa distinção tem que ir pela categoria
  `taxas`, não pelo `kind`.
- `direction` (`in`/`out`) é gravado em toda transação e **nunca lido** por nada. É
  redundante com o sinal de `amount_cents`.
