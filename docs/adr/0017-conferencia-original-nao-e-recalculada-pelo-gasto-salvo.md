# ADR-0017 — A conferência original não é recalculada pelo gasto salvo

Data: 2026-10-16. Status: aceita.

## Contexto

A prévia confere as transações extraídas contra os gabaritos do documento,
antes de categorizar, vincular e deduplicar. O histórico guarda alguns
gabaritos, mas não guarda o resultado da conferência nem todos os dados da
extração original. As naturezas das transações salvas também são diferentes
das naturezas lidas pelo parser.

Comparar o gasto real salvo com o total da fatura ou com as saídas do extrato
poderia acusar uma divergência causada apenas por vínculos e deduplicação.
Do mesmo modo, diferenças opostas de entradas e saídas podem somar zero sem
que nenhum dos dois gabaritos confira.

## Decisão

- A prévia apresenta cada comparação utilizada pelo domínio: entradas e
  saídas separadas, variação do saldo ou total da fatura. O resultado só é
  `confere` quando todas as diferenças são zero.
- A lista de documentos mostra os gabaritos disponíveis e identifica o
  gasto real salvo separadamente. Não atribui um carimbo retroativo.
- O detalhe explica que o resultado original não foi guardado. Quem precisa
  conferir novamente pode selecionar o PDF e revisar a prévia, antes de salvar.
  O aplicativo não armazena nem oferece o PDF original para download.
- Sem transações, sem gabarito e falha de consulta são estados distintos.
  Nenhum deles autoriza concluir gasto zero ou documento faltando.

## Consequências

Esta rodada usa as colunas já existentes; não exige migração. Um resultado
persistente no histórico exigirá guardar a conferência no momento da leitura,
com os gabaritos e valores extraídos usados nela. Documentos antigos precisam
continuar com resultado desconhecido, mesmo depois dessa futura mudança.
