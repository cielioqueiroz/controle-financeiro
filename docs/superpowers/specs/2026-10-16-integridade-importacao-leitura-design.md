# Integridade da importação e da leitura

Primeira rodada do diagnóstico aprovado em 16/10/2026. O usuário autorizou a execução nesta conversa. Objetivo: impedir que uma falha deixe números parciais com aparência de sucesso.

## Comportamento

- Salvar usa uma operação transacional do Postgres, via RPC do cliente Neon existente. Conta, documento e transações entram juntos; falha desfaz tudo. Chamadas concorrentes do mesmo usuário são serializadas no banco. Repetir uma chamada concluída devolve documento duplicado.
- Categorização, vínculos, hashes e discriminador de ocorrências continuam no código atual. A rotina SQL recebe apenas colunas explícitas, usa `security invoker` e mantém RLS, defaults de usuário e gatilhos de integridade.
- Conferência divergente bloqueia salvar na tela e no adaptador. Decisão de produto desta rodada para preservar o alerta também depois da prévia; AGENTS.md §2.4 exige aviso, mas não determina literalmente esse bloqueio. Sem gabarito continua permitido, identificado como tal.
- Novos documentos guardam uma fotografia versionada da conferência: estado, contagem e comparações utilizadas. Documentos antigos continuam sem resultado conhecido. Nenhum carimbo é reconstruído do gasto real salvo.
- A leitura principal só aceita contagem exata válida e igual ao número recebido. Dinheiro deve ser inteiro seguro em JavaScript.
- Falhas nas consultas de saldos e categorias não bloqueiam o histórico, mas são comunicadas, com nova tentativa. Saldos indisponíveis não usam uma fotografia anterior. Uma resposta de recarga antiga não altera dados, erros ou carregamento da recarga mais recente.

## Limites e entrega

Preservar centavos inteiros, modo discreto, pt/en/es, fontes e tokens atuais, URLs como estado e arquitetura domínio/aplicação/persistência. Sem dependências novas, commit, push ou aplicação em produção nesta rodada. Migração aditiva testada em branch Neon; aplicação em produção exige aprovação explícita antes da publicação do frontend. Não remover documentos históricos com zero transações: deduplicação também pode causar esse estado legitimamente.

Outras frentes do diagnóstico (detalhamento nas demais telas, adoção visual por tela, desempenho e proteção de publicação) permanecem na sequência após esta rodada verificável.
