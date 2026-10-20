# Regras de categorização com operadores

> Execução autorizada no chat; implementação por tarefas e revisão independente.

**Goal:** criar regras por texto, banco e valor usando o avaliador da busca.
**Architecture:** novo MatchType `consulta`, contexto bancário na categorização,
persistência e formulário em Categorias. **Tech Stack:** TS/React/Postgres.
**Spec:** `docs/superpowers/specs/2026-10-18-pendencias-design.md`.

## Restrições e revisão

Sem any; dinheiro inteiro; três idiomas; preservar regras atuais e prioridades;
sem recategorização histórica silenciosa. Revisar condições vazias, operadores
desconhecidos, categoria anterior, banco ausente e falha ao gravar.

### Task 1: domínio

Arquivos: `domain/categorize/regras.ts`, testes adjacentes e
`domain/categorize/aprendizado.ts` se necessário. Interface: novo tipo `consulta`
e contexto opcional de banco em `categoriaDe`, mantendo chamadas antigas válidas.

- [x] Cobrir texto+banco+valor, sinais e prioridade por testes.
- [x] Implementar avaliador compartilhado e categoria-base estável.
- [x] Provar compatibilidade com aprendizado por trecho e CNPJ.

### Task 2: persistência e formulário

Arquivos: `persist/regras.ts`, `persist/salvar.ts` (apenas contexto da categoria),
comando em `aplicacao/comandos/transacoes.ts`, `ui/Categorias.tsx`, novo formulário
se necessário, dicionários com prefixo `regrasOp`, e testes adjacentes.
Criar `backend/db/migrations/0010_regras_consulta.sql`.

- [x] Provar round trip do novo tipo, falhas de banco e exclusão específica.
- [x] Implementar criação com categoria, condição, ajuda e aviso sobre próximas
  importações. Impedir condição vazia e respeitar estados ocupado/falha.
- [x] Provar interação, texto traduzido e ausência de aplicação retroativa.
- [x] Rodar tipos, testes relacionados e lint; registrar resultados.

## Execução local

Implementado em 18/10/2026: `consulta` compartilha análise e avaliação com a busca;
`cat:` e `sem:categoria` leem a categoria global anterior às regras do usuário.
Condições vazias, números inválidos ou fora do inteiro seguro e operadores
conhecidos impossíveis são recusados. Operadores desconhecidos continuam texto.

Criação passa por `salvar_regra_atomica`, nova RPC da migração 0010. Ela substitui
o par padrão/tipo sob RLS e a mesma trava por usuário da importação. Não há
fallback para delete/insert separados. A migração precisa ser aplicada antes
do frontend, inclusive para preservar o aprendizado já existente.

Provas: 93 testes relacionados passaram; a suíte cobre aprendizagem anterior,
domínio novo, persistência, criação/exclusão/falha e bloqueio durante gravação.
`tsc -b frontend` e lint com `--deny-warnings` passaram. A primeira tentativa de
teste foi bloqueada por EPERM no cache temporário antes de executar casos;
as passadas válidas usam TEMP/TMP dentro de `.cache/regras-temp`.

As migrações 0001–0010 foram ensaiadas em PostgreSQL local descartável, incluindo
RLS, duas conexões concorrentes, rollback da substituição e ignorar `user_id`
forjado. Em 20/10, o ensaio na branch Neon de teste aprovou a RPC real, o
rollback após falha no INSERT, a leitura e exclusão de regras, os operadores
na gravação de documentos futuros e o isolamento entre JWTs. A verificação
completa, CSP, overflow e axe também passaram após disponibilizar Playwright.
[Evidência real e repetição](../../validacoes/2026-10-20-vinculos-regras-neon.md).
