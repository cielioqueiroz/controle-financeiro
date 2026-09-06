# Minimizar em vez de criptografar, e o banco impõe a promessa do produto

Numa auditoria de segurança em 2026-09-06, dois itens da lista ("criptografia de
dados" e "bloquear mass assignment") não tinham resposta boa neste projeto. As
respostas óbvias — cifrar as colunas e validar melhor no cliente — estavam
ambas erradas, e por motivos diferentes.

## Criptografia: recusada, e o que foi feito no lugar

Cifrar `description` mataria a busca, o ranking por estabelecimento e a
categorização por regra — que não são recursos do app, são o app. E a chave
teria de viver no cliente, onde o PDF já é lido ([ADR-0003](./0003-o-pdf-e-lido-no-navegador.md)),
o que a torna decorativa.

O que a auditoria achou foi melhor que criptografia: **três colunas que o app
escrevia e nunca lia**. Conferido na branch `production`:

| Coluna | Preenchida em | Lida por |
|---|---|---|
| `transactions.raw` | 360 de 360 | ninguém |
| `accounts.holder_name` | 6 de 7 | ninguém |
| `transactions.counterparty_doc` | 0 de 360 | ninguém |

`raw` guardava a linha crua do extrato — o texto livre mais sensível do
documento — em toda transação. `holder_name`, o nome completo do titular. Nenhuma
das duas aparecia num único `select` do repositório: o vínculo usa
`result.account.holderName` em memória, vindo do parse, nunca a coluna. Auditar
contra o PDF sempre se fez pela `description`, que é imutável e continua.

Dado sensível sem consumidor é risco puro. **Parar de gravar é mais eficaz que
cifrar, e mais barato.** A migração `0006` apaga o que já estava lá.

## Mass assignment: o tipo não existe em runtime

`persist/editar.ts` limitava a edição a três campos via `EdicaoTransacao`. Mas
tipo do TypeScript some na compilação, e o `GRANT` era de tabela inteira: com o
próprio JWT, uma requisição fora do app escrevia `amount_cents`, `date`,
`description` ou `hash`. O RLS não impede — a linha é do próprio usuário.

Não é vazamento entre contas. É o usuário podendo mentir para si mesmo. Mas a
frase de abertura do README é *"todo número na tela veio de um documento do
banco"*, e ela é o produto, não marketing.

```sql
revoke update on public.transactions from authenticated;
grant update (label, category_slug, kind) on public.transactions to authenticated;
```

`label`, `category_slug` e `kind` são exatamente o que o usuário pode dizer sobre
uma transação: o apelido, a correção de categoria e ligar/desligar o vínculo. O
resto veio do PDF e não se discute. `INSERT` continua de tabela inteira — quem
insere é a importação, e o que ela escreve veio do parser.

## Consequências

- **A promessa do produto virou regra do banco.** Antes era convenção de
  TypeScript; agora quem recusa é o Postgres, e recusa igual para o app, para o
  `curl` e para a próxima versão do app.
- **Coluna nova exige decidir quem a lê.** Se a resposta for "ninguém ainda", ela
  não entra — foi assim que estas três nasceram.
- **`counterparty_doc` foi dropada**; `raw` e `holder_name` viraram `null` e as
  colunas ficaram. Dropar as duas exigiria conferir todo `select` do
  repositório, e o ganho sobre `= null` é nenhum: o dado sai do banco do mesmo
  jeito.
- **Se um dia algo precisar da linha crua**, o caminho é reprocessar o PDF, não
  ressuscitar a coluna — o documento é a fonte, o banco é derivado
  ([ADR-0005](./0005-o-app-e-retrospectivo.md)).
