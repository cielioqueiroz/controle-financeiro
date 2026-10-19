# ADR-0021 — Vínculos reconciliados no histórico

Data: 2026-10-18. Status: implementada e ensaiada em Postgres local descartável;
migração 0009 ainda não aplicada em produção.

## Contexto

A importação conhecia apenas as transações do documento que estava entrando.
Uma fatura e seu pagamento, ou duas pontas de uma transferência, normalmente
chegam separadamente. Ler no navegador e gravar as marcas em chamadas distintas
permitiria corrida entre abas e deixaria metade do par gravada após falha.

O GRANT da 0006 só permite editar `label`, `category_slug` e `kind` nas
transações. Ampliá-lo para o cliente preencher evidências transformaria uma
conclusão entre documentos em campo livre. A edição manual de `kind`, por outro
lado, precisa continuar funcionando sem trocar o contrato do adaptador.

## Decisão

- A 0009 mantém a assinatura e o corpo da RPC da 0008. Gatilhos reconciliam
  depois da escrita de documentos, transações ou contas, dentro da mesma
  transação. A ordem de importação deixa de importar.
- Quitação exige extrato de conta corrente, descrição de pagamento de fatura,
  saída do mesmo valor inteiro e uma fatura de cartão com vencimento a até sete
  dias. `period_end` é o vencimento nos parsers de fatura. A relação precisa ser
  única nos dois sentidos: duas faturas ou dois pagamentos candidatos impedem
  a marca. Não se exige que o pagamento saia do banco que emitiu o cartão.
- Transferência exige dois extratos de contas correntes distintas, descrições
  de PIX/TED/DOC/transferência nas duas pontas, valores exatamente opostos e até
  dois dias entre datas. Somente unicidade recíproca autoriza o vínculo. A
  normalização inclui acentos maiúsculos e minúsculos, inclusive sob locale C.
- `vinculo_document_id`, `vinculo_transacao_id` e `vinculo_criterio` guardam a
  evidência. FKs adiáveis e um gatilho verificam existência e mesmo usuário.
  O CHECK exige forma coerente com a natureza e impede auto-referência.
- `vinculo_kind_original` guarda a natureza anterior à reconciliação e
  `vinculo_manual` preserva a intenção do usuário. Todo `UPDATE OF kind` do
  cliente, mesmo repetindo o valor, marca a escolha como manual e apaga a
  evidência automática. A outra ponta volta à sua natureza anterior. A escolha
  manual permanece nas importações seguintes; ligar manualmente um vínculo não
  inventa uma contraparte.
- A rotina primeiro desfaz apenas suas próprias conclusões e depois recalcula
  candidatos. Isso também revoga um par que se tornou ambíguo ou perdeu uma
  ponta. Excluir documento, transação ou conta não deixa exclusão do gasto real
  sustentada por uma evidência órfã. `documents.conferencia` não é atualizada.
- Os gatilhos `BEFORE STATEMENT` adquirem a mesma trava transacional por usuário
  da RPC antes de locks de linha. Isso serializa importação, edição e exclusão
  e evita inverter a ordem das travas. `AFTER STATEMENT` enxerga todas as linhas
  excluídas num DELETE; gatilhos aninhados não iniciam nova reconciliação.
- O helper que escreve evidências é `SECURITY DEFINER`, tem `search_path`
  vazio, referências qualificadas e predicado de usuário em todas as consultas.
  Seu EXECUTE é revogado de PUBLIC e não é concedido a `authenticated`. O
  helper só é chamado por gatilhos e pelo backfill da migração. A preparação
  de `kind` é INVOKER: distingue o proprietário da tabela, usado pela rotina
  automática, do cliente autenticado. Aplicar a migração como proprietário das
  tabelas, como nas migrações anteriores.
- Nenhum UPDATE novo é concedido a `authenticated`. O INSERT amplo anterior
  continua existindo, mas o gatilho descarta evidência, marca manual e natureza
  anterior fornecidas no payload, calculando-as a partir da linha importada.

## Limite do histórico anterior

Antes da 0009, o banco não registrava se `kind` era importado ou corrigido à
mão. A migração guarda o valor existente como natureza anterior e preserva
vínculos legados sem evidência. Uma correção antiga que desligou o vínculo e
deixou `expense`/`income` é indistinguível de uma transação nunca corrigida:
ela pode ser alcançada pelo novo reconhecimento. Congelar todas as linhas
anteriores impediria reconhecer o histórico, objetivo desta mudança. A proteção
inequívoca da escolha manual começa com a 0009; nada na interface deve afirmar
procedência manual ou automática para a natureza legada sem evidência.

## Provas de 18/10/2026

PostgreSQL portátil 18.4, base inteiramente sintética em
`node_modules/.cache/vinculos-pgdata`, somente `127.0.0.1:55491`. Foram aplicadas
em ordem as migrações 0001–0010. Não houve acesso nem alteração no Neon.
O getter local `auth.user_id()` lê as identidades sintéticas da sessão; isso
prova políticas e privilégios PostgreSQL, sem substituir Auth/JWT/Data API reais.

Passaram `scripts/test-importacao-atomica.sql` e
`scripts/test-vinculos-historico.sql`, sob `SET LOCAL ROLE authenticated`, com
ROLLBACK. Cobrem as duas ordens, limites de datas, descrição obrigatória,
ambiguidade das duas relações, revogação de conclusão anterior, escolha manual
inclusive UPDATE do mesmo valor, exclusão de contraparte, DELETE multi-row de
documentos e contas, conferência original, RLS e privilégios. `SET CONSTRAINTS
ALL IMMEDIATE` ao final confirmou que nenhuma FK ficou pendente.

Tentativas de UPDATE de valor, evidência e marca manual foram recusadas.
Chamar diretamente o helper DEFINER foi recusado. Um INSERT autenticado com
evidência apontando para documento/transação de outro usuário e natureza
anterior forjada foi sanitizado: ficaram referências nulas, sem marca manual e
com natureza anterior igual à linha importada.

Um segundo ensaio usou duas conexões reais, ambas como `authenticated`:

1. A importou a saída sem commit; B iniciou a entrada. `pg_stat_activity`
   mostrou B em `Lock/advisory`. Após commit de A, B terminou e as duas linhas
   ficaram com referências recíprocas.
2. A corrigiu `kind` sem commit; B iniciou outra importação e esperou a mesma
   trava. Após os commits, a escolha manual permaneceu sem evidência automática.
3. A excluiu o documento de uma contraparte sem commit; B iniciou importação
   e esperou. A saída sobrevivente terminou como `expense`, sem referência órfã.
4. Usuários diferentes importaram valores opostos enquanto A mantinha sua
   transação aberta: B progrediu sem esperar a trava de A e não houve vínculo.

Os executores temporários ficaram em
`node_modules/.cache/ensaio-vinculos.mjs` e
`node_modules/.cache/ensaio-concorrencia.mjs`; iniciam e desligam o servidor no
mesmo processo. O segundo também ensaiou a 0010: substituição única de regra,
rollback da substituição após falha no INSERT, RLS e `user_id` forjado ignorado.

## Implantação e manutenção

Aplicar a 0009 antes do frontend e repetir a prova em branch Neon descartável,
incluindo a leitura pela Data API. A leitura de `transactions` precisa
desambiguar as relações antigas com `accounts` e `documents` pelos nomes das
FKs, porque agora há outra relação com `documents`. Nenhuma migração desta
rodada foi aplicada em produção.

Manutenção administrativa que altera dados sem sessão de usuário deve executar
explicitamente a reconciliação dos usuários afetados sob a mesma trava; gatilhos
da aplicação identificam o dono pelo getter da sessão. O backfill da migração
faz isso para todo usuário já existente. A exclusão depende das FKs inicialmente
adiadas: não antecipar sua conferência antes do fim do statement que reconcilia.
