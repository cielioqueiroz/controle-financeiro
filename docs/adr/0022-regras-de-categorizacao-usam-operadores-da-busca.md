# ADR-0022 — Regras de categoria usam os operadores da busca

Data: 2026-10-18. Status: implementada localmente; migração 0010 ainda não
aplicada em produção.

## Contexto

As regras globais e o aprendizado por estabelecimento/CNPJ não expressavam
condições por valor, banco ou categoria. Criar outra gramática de regras faria
busca e classificação discordarem e manteria dois avaliadores.

## Decisão

- Um padrão do tipo `consulta` usa `analisarConsulta` e `casaConsulta`, o mesmo
  avaliador que a busca. Operadores desconhecidos continuam texto; operadores
  conhecidos incompletos, inválidos ou contraditórios são recusados ao salvar.
- `banco:`, `>`, `<`, `cat:` e `sem:categoria` podem combinar com texto livre.
  A categoria usada por `cat:` é a categoria-base calculada somente pelas regras
  globais, portanto uma regra do usuário não depende da ordem de outras regras.
- Regras aprendidas e de consulta têm prioridade acima das globais; empates
  seguem a regra existente de padrão mais específico. A tela esclarece que a
  regra nova afeta próximas importações; não há recategorização histórica
  automática.
- A criação substitui o mesmo padrão/tipo pela RPC `salvar_regra_atomica`, sob
  RLS e trava por usuário, numa transação. A 0010 também amplia o CHECK de
  `merchant_rules.match_type`; aplicá-la antes do frontend.

## Provas e limites

Domínio, persistência e interface passaram 93 testes relacionados; typecheck e
lint passaram nas execuções registradas no plano. A 0010 foi ensaiada junto das
migrações 0001–0010 em PostgreSQL local sintético, incluindo RLS, concorrência,
rollback da substituição e `user_id` forjado. Isso não substitui a Data API/JWT
do Neon real. Não houve alteração em produção.
