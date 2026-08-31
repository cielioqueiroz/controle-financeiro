# Code-splitting por rota: medido e recusado

Fatiar as rotas em chunks separados é a otimização óbvia para um SPA com sete
páginas, e foi medida com build A/B em 2026-08-13: rende **2,6% de gzip**. O peso
não está nas páginas — está no SDK do Neon, que responde por **39% da primeira
pintura**, precisa carregar no boot para decidir se há sessão, e importa `zod`
estaticamente. Recusada.

## Consequences

- **Não reabrir sem número novo.** A conclusão é de medição, não de opinião; quem
  quiser reverter precisa trazer outra medição.
- O custo não é zero: rota fatiada cria uma **falha de navegação depois de cada
  deploy**, porque o chunk que a aba aberta tenta buscar já não existe no servidor.
  Pagar isso por 2,6% seria um mau negócio mesmo se o ganho fosse real.
- O caminho que teria efeito é reduzir ou adiar o SDK do Neon — trabalho de outra
  ordem de grandeza, e hoje bloqueado por [ADR-0008](./0008-o-login-nao-tem-rede-de-testes.md).
