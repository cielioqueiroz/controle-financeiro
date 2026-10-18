# 0020 — Saldo documental e paginação da exibição

Data: 2026-10-18

## Contexto

O saldo da situação financeira soma os últimos extratos de cada conta, que podem
ter datas diferentes. Chamá-lo de atual sugere uma sincronização que não existe.
O histórico é carregado inteiro e sua contagem é conferida antes de exibir totais.
Montar milhares de linhas de uma vez, porém, aumenta o custo da interface.

## Decisão

- Usar “Último saldo importado”, com conteúdo centralizado e detalhamento
  expansível de contas, datas e documentos. Acrescentar `id` à consulta de
  saldos, sem migração. Registros sem identificador não recebem link inventado.
- Mostrar transações em páginas de 50 linhas, inclusive dentro de grupos.
  Busca, contagem e totais continuam considerando todos os resultados.
- Preservar a consulta completa com contagem exata: paginação de rede exigiria
  tratar alterações concorrentes entre páginas para não fabricar um recorte
  completo pela mera soma das contagens. A medição atual não justifica esse risco.
- O mês dos gráficos oferece uma navegação explícita até suas transações.
  Categorias da situação financeira abrem o detalhe de Relatórios na janela
  inteira: não podem navegar para um único mês mostrando uma soma de vários.
- Taxas financeiras e destaques mensais ficam no domínio. Diferença entre taxas
  de economia usa pontos percentuais, inclusive com base negativa ou igual a zero.

## Consequências

A lista monta até 50 linhas por página/grupo, sem ocultar os totais do conjunto.
A consulta de rede ainda cresce com o histórico; o medidor sintético não mede
latência do Neon. Se esse custo se tornar dominante, a próxima decisão deve
avaliar leitura com fotografia consistente e agregação no servidor.
