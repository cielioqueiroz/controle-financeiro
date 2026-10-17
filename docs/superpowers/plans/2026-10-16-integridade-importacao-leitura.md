# Integridade da importação e da leitura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** impedir gravações parciais e leituras incompletas com aparência de sucesso.

**Architecture:** RPC transacional no Postgres, `security invoker`, mantendo RLS e o Neon existente. A preparação financeira permanece no cliente; o provider distingue falhas parciais e descarta respostas antigas.

**Tech Stack:** React 19, TypeScript, Vitest, Neon Data API e PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-16-integridade-importacao-leitura-design.md`

## Global Constraints

- Centavos inteiros seguros, `useDinheiro()` na UI, pt/en/es em igualdade.
- Manter fronteira `aplicacao/`, RLS e gatilhos existentes.
- Branch `codex/integridade-importacao-leitura`; commit e push desta rodada
  autorizados pelo usuário em 17/10/2026, depois da validação.
- Testar migração em branch Neon; produção depende de aprovação específica.

## Review Focus

- Falha após criar documento: nenhuma linha parcial permanece; nova tentativa funciona.
- Importações simultâneas e sobrepostas: deduplicação sem perda de ocorrências reais.
- Conferência desconhecida de documentos antigos: nenhuma aprovação inventada.
- Contagem ausente/inválida e valores fora do inteiro seguro: leitura recusada.
- Resposta antiga, falha parcial e recuperação: tela representa a consulta mais recente.

### Task 1: Gravação atômica e conferência original

**Files:** `backend/db/migrations/0008_importacao_atomica_e_conferencia.sql`, `scripts/test-importacao-atomica.sql`, `frontend/src/persist/salvar{,.test}.ts`, `frontend/src/persist/neon-falso.ts`, `frontend/src/domain/validate/conferencia-salva{,.test}.ts`, `frontend/src/ui/ResultadoImport{.chamando.test,}.tsx`, dicionários e `lib/erro-usuario.ts`.

**Interfaces:** `salvarDocumento(...)` preserva `ResultadoSalvar`; RPC `salvar_documento_atomico(p_conta jsonb, p_documento jsonb, p_transacoes jsonb)` devolve esse resultado. `ConferenciaSalva` versão 1 contém estado, contagem e comparações.

- [x] Escrever e executar testes que exigem uma chamada RPC, recusa de divergência sem escrita e fotografia exata da conferência.
- [x] Implementar adaptador sem fallback de escrita não atômica, dublê de RPC e migração com privilégios mínimos e serialização por usuário.
- [x] Testar SQL real em branch Neon: falha/rollback, nova tentativa, duplicata, sobreposição e isolamento por usuário.
- [x] Executar testes do adaptador e da prévia; registrar evidência.

### Task 2: Leitura íntegra e atualização ordenada

**Files:** `persist/puxar{,.test}.ts`, `persist/documentos{,.test}.ts`, `dados/DadosProvider{,.test}.tsx`, componente de aviso no casco autenticado, dicionários.

**Interfaces:** `useDados()` acrescenta erros parciais opcionais; `recarregar(): Promise<void>` preservado. A consulta de saldos passa a propagar erros ao provider.

- [x] Escrever e executar testes de contagem ausente/inválida, inteiro inseguro, recargas concluídas fora de ordem e falhas parciais recuperáveis.
- [x] Implementar guardas e estados, com aviso traduzido e nova tentativa.
- [x] Executar testes relacionados e typecheck.

### Task 3: Conferência no histórico e documentação

**Files:** `persist/documentos{,.test}.ts`, `ui/DocumentoImportado{,.test}.tsx`, `ui/ConferenciaDocumento.tsx`, demo/jornadas pertinentes, `docs/adr/`, `docs/ESTADO-ATUAL.md`, `AGENTS.md`.

**Interfaces:** `DocumentoSalvo.conferencia` opcional para compatibilidade com documentos antigos; somente snapshots válidos são apresentados.

- [x] Escrever e executar testes para snapshots confere/sem-gabarito e legado desconhecido, incluindo modo discreto.
- [x] Implementar detalhe da conferência guardada reutilizando a apresentação de comparações.
- [x] Atualizar ADR, estado atual e mapa desatualizado do repositório.
- [x] Rodar `npm run verificar`, contraste, overflow e acessibilidade pertinentes; executar review independente de toda a alteração.

## Registro de execução

- Base: `eda094f`. Execução autorizada no chat; escolhas técnicas acima são decisões do agente a revisar no diff.
- Sem commit/push: regra explícita do repositório prevalece sobre passos genéricos das skills.
- Atualização em 17/10: o usuário autorizou commit e push da rodada validada.
  O envio vai para a branch de trabalho; integrar em `main` exige antes conferir
  a migração `0008` em produção.
- SQL real: branch `br-billowing-mud-ac8q493y`, expiração 23/10. Migração
  aplicada e `scripts/test-importacao-atomica.sql` aprovado como `authenticated`.
  Concorrência real também aprovada: uma gravação e uma duplicata, sem perda das
  duas ocorrências idênticas. Produção não foi alterada.
- Testes exigiram os comportamentos novos e falharam antes das correções.
  Execuções focadas aprovadas: adaptador/aviso (28), leitura/provider/documentos
  (42), snapshots/UI (38), recuperação/providers/listas/aviso/documento (27).
- Primeira suíte completa do diagnóstico: 138 arquivos, 1.176 testes aprovados
  com dois workers. A execução final inclui o novo caso de recuperação. Fixado
  o teste de fechar categoria, que pressupunha animação ainda em andamento após
  o clique; corrigido o mock de contagem exata do App. Limite de workers mantém
  a verificação em ambientes com CPU disputada, sem ampliar timeout.
- Contraste aprovado nos dois temas; overflow e axe aprovados nas 26 jornadas,
  em 1280×800 e 390×844. Prévia da conferência inspecionada no celular.
- Verificador final concluído em 16/10, resultado reconferido em 17/10:
  tipos (33,8s), testes (240,6s), lint (2,0s), caminhos (0,7s), build (27,0s) e
  CSP contra esse build (12,1s), todos aprovados. Não houve mudança de código
  do app após essa execução; o fechamento acrescenta documentação e o validador HTTP.
- Review independente: nenhum crítico, um importante (duplicata não sinalizava
  releitura após resposta perdida), corrigido. Teste integrado observado falhar
  com histórico antigo e passar após invalidar a leitura também na duplicata.
- Validação HTTP concluída em 17/10: 21 verificações com Auth/JWT/SDK reais,
  duas contas sintéticas na execução final, rollback, concorrência, RLS, leitura,
  conferência e PDF sintético pela interface. Resposta perdida após commit foi
  recuperada sem F5. Evidências: `docs/validacoes/2026-10-17-rpc-real.md`;
  validador: `scripts/validar-rpc-real.py`. Nenhuma credencial pessoal foi usada.
- Limite restante: migração e conferência em produção dependem de autorização
  específica antes de publicar o frontend. Não houve mudança em produção.
