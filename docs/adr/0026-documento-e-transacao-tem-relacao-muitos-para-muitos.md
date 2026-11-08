# ADR-0026 — Documento e transação têm relação muitos para muitos

## Contexto

Dois extratos da mesma conta podem cobrir períodos parcialmente sobrepostos.
A deduplicação por `transactions.hash` deve manter uma única transação para os
cálculos, mas o schema inicial guardava somente `transactions.document_id`.
Quando o segundo documento repetia uma linha do primeiro, a RPC informava
`jaExistiam`, porém não registrava que o segundo também comprovava a linha.

Isso produzia duas incoerências: a contagem do segundo documento não fechava com
sua conferência e apagar o primeiro documento podia remover por cascata uma
transação ainda comprovada pelo segundo.

## Decisão

A migração 0015 cria `document_transactions`, com uma linha por documento e
transação, RLS e verificação de que os dois lados pertencem à mesma pessoa.
`transactions.document_id` permanece como procedência primária: preserva as
relações existentes, a competência e a leitura sem duplicar transações.

`salvar_documento_atomico` passa a relacionar o documento novo com todas as
transações do payload, inclusive as que já existiam pelo hash. A importação
falha inteira se o número de relações não fechar com a contagem da conferência.

Antes de apagar um documento, um gatilho transfere a procedência primária das
transações compartilhadas para outro documento relacionado. A cascata continua
removendo a transação quando o documento apagado era sua última prova. O gatilho
protege também clientes antigos que ainda excluem `documents` diretamente.

A leitura traz as transações uma única vez e lê as relações com contagem exata.
Contagens específicas de documento usam todas as relações; agregações de
dinheiro continuam usando a linha única de `transactions`.

## Histórico

A migração associa cada transação histórica à sua procedência primária, que é a
única relação comprovada pelo banco anterior. Ela não inventa vínculos passados.
Uma auditoria agregada da produção encontrou apenas sobreposição de períodos de
faturas e nenhuma relação adicional reconstruível pelos gabaritos de extrato.

## Consequências

- Excluir um documento não perde dinheiro sustentado por outro.
- A conferência e a contagem de cada documento sobreposto voltam a falar do
  mesmo conjunto de transações.
- A cópia integral dos dados inclui `document_transactions`.
- Publicar o frontend que lê a nova tabela exige aplicar a 0015 primeiro.

O ensaio foi feito numa branch normal do Neon derivada de `production`: 644
transações geraram 644 relações primárias, sem relação ausente ou entre donos
diferentes. Importação sobreposta, exclusão da primeira prova, exclusão da
última e isolamento por usuário passaram dentro de uma transação revertida.
