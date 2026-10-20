# Vínculos com o histórico e conferência lado a lado

> Execução autorizada no chat; implementação por tarefas e revisão independente.

**Goal:** reconhecer e explicar vínculos entre documentos importados separadamente.
**Architecture:** reconciliação atômica no Postgres, leitura pelo adaptador e UI
em Faturas. **Tech Stack:** Postgres/Neon, React 19, TypeScript, Vitest.
**Spec:** `docs/superpowers/specs/2026-10-18-pendencias-design.md`.

## Restrições e revisão

Centavos inteiros; RLS; ensaios restritos à branch de teste; correção manual prevalece.
Revisar ambiguidades, ordem inversa, datas distantes, exclusão e atualização manual.

### Task 1: reconciliação transacional

Arquivos: criar `backend/db/migrations/0009_vinculos_historico.sql`,
`scripts/test-vinculos-historico.sql` e ADR-0021.
Interface produzida: colunas opcionais `vinculo_document_id`,
`vinculo_transacao_id`, `vinculo_criterio` em transactions; manter assinatura de
`salvar_documento_atomico(jsonb,jsonb,jsonb)` e updates manuais existentes.

- [x] Escrever provas SQL para ordem inversa, par único, ambiguidades, RLS,
  concorrência, edição manual e exclusão da contraparte.
- [x] Implementar migração com integridade de referências por usuário,
  reconciliação sob trava e preservação da escolha manual.
- [x] Ensaiar em Postgres descartável e registrar resultados.
- [x] Repetir pela Data API/JWT reais numa branch Neon isolada, incluindo os
  default privileges das funções e a recusa de chamada direta ao helper.

Evidência da Task 1: [ADR-0021](../../adr/0021-vinculos-reconciliados-no-historico.md).
PostgreSQL local 18.4, migrações 0001–0010 em ordem; provas SQL da 0008 e da
0009 passaram como `authenticated`, com RLS e ROLLBACK. Duas conexões provaram
espera na trava advisory, ordem concorrente, edição manual e exclusão. DELETE
multi-row de documentos/contas e falsificação de evidência também passaram.
O ensaio da 0010 comprovou rollback após falha do INSERT e isolamento de regras.
Servidor local desligado ao terminar; nada aplicado no Neon. A natureza manual
legada não era registrada antes da 0009 e não pode ser inferida; a ADR explicita
essa limitação e a necessidade de ensaio pela Data API antes da implantação.

### Task 2: leitura e interface

Arquivos: `persist/puxar.ts`, `paginas/Faturas.tsx`, novo
`domain/link/conferencia-vinculos.ts` e `ui/ConferenciaVinculos.tsx`, testes
adjacentes e dicionários. Consumir as colunas da Task 1; usar o histórico completo
do provider e os documentos da consulta existente, sem acesso direto ao adaptador.

- [x] Provar leitura das referências e formação dos pares sem duplicar linhas.
- [x] Mostrar duas pontas, critério e acesso ao documento; estado sem evidência.
- [x] Provar comportamento no modo discreto, teclado e traduções.
- [x] Rodar contraste pertinente e revisar o diff integrado; corrigir achados.
- [x] Rodar typecheck forçado, lint e testes focados após correções da revisão.
- [x] Rodar `npm run verificar`, CSP, overflow e axe com Playwright e acesso
  local disponíveis.

Provas de componente e navegação: 11 testes em três arquivos passaram. A suíte
completa passou (147 arquivos, 1.270 testes), assim como typecheck, lint,
caminhos, build e contraste. Em 20/10, `npm run verificar` passou nos seis
gates, incluindo build e CSP. Overflow aprovou 40 jornadas em desktop e celular
sem rolagem lateral; axe aprovou as mesmas 40 jornadas nos dois tamanhos sem
violações `critical`/`serious`. A revisão posterior corrigiu cinco casos de
borda nos parsers; os testes focados, typecheck forçado, lint e build passaram.
A 0011 foi ensaiada numa branch Neon temporária, depois descartada sem aplicar
na branch pai; 0009 e 0010 têm ensaio completo em PostgreSQL descartável
registrado na ADR-0021.

Em 20/10, o ensaio real encontrou e corrigiu o \n literal ao fim da 0009 e
o EXECUTE concedido por default privilege do Neon ao helper interno.
As três migrações foram aplicadas na branch de teste existente; o validador
aprovou 50 asserções e as provas de interface, isolamento por JWT e rede.
O PostgreSQL local também reaplicou os arquivos completos com o default
privilege do Neon e aprovou as provas SQL da 0008/0009.
[Evidência e reprodução](../../validacoes/2026-10-20-vinculos-regras-neon.md).

### Task 3: fechamento

- [x] Registrar evidências, exigência de migração antes do frontend e pendências
  externas no diário. Não aplicar em produção nesta rodada.
