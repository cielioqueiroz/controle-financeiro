# Refino do saldo e das jornadas — 17/10/2026

Execução autorizada no chat: concluir as seis melhorias propostas e centralizar
o cartão do saldo. Preservar React/TS, o livro-razão e o histórico documental.

1. Saldo: título, valor e explicação juntos e centralizados; detalhe expansível
   com banco, data e documento de cada conta. Não chamar saldo de extrato de
   saldo em tempo real. Sem documento identificável, não inventar link.
2. Gráficos: seleção mensal com acesso à composição em Lançamentos, preservando
   banco, e retorno pelo histórico até a seleção original.
3. Categorias: busca por nome nos dois fluxos; busca de emojis localizada,
   fechamento por Escape/clique fora e navegação de opções por teclado.
4. Design system: classes compartilhadas para campos e ações, cartões e estados
   consistentes nas telas autenticadas. Preservar tokens existentes.
5. Domínio: análise mensal e taxas compartilhadas; variação de taxa em pontos
   percentuais, não percentual relativo sobre uma taxa negativa.
6. Desempenho: medição reproduzível em 1k/10k/50k transações sintéticas;
   eliminar trabalho repetido demonstrado e limitar linhas montadas por página.
   Totais e busca continuam considerando o conjunto completo. A consulta mantém
   a contagem exata e a recusa de resposta incompleta.

Verificar: testes de domínio/navegação/interação; gate completo; contraste,
overflow e axe nas jornadas novas e existentes; inspeção visual nos dois temas.
Registrar resultados, limitações e medidas antes de commit/push e publicação.
