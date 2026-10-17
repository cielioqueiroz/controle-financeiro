# ADR-0018 — Importação atômica e conferência original

Data: 2026-10-16. Status: implementada; migração 0008 aplicada e conferida em produção em 17/10/2026.

## Contexto

A escrita anterior criava a conta e o documento antes de inserir transações,
em chamadas HTTP independentes. Falha na última chamada deixava um documento
parcial; a tentativa seguinte o tratava como duplicado. Um `catch` que apagasse
o documento não resolveria queda de rede ou fechamento da aba.

A conferência era mostrada na prévia, mas se perdia ao salvar (ADR-0017).
Era possível salvar uma leitura divergente e depois vê-la no histórico sem o
alerta original. O usuário autorizou a rodada de correções nesta conversa.

## Decisão

- `salvar_documento_atomico` recebe conta, documento e transações já preparados
  pelo cliente. Uma chamada é uma transação do Postgres; erro desfaz tudo.
- A rotina usa `security invoker`, `search_path` vazio, colunas explícitas,
  defaults de `user_id`, RLS e os gatilhos existentes. Não recebe o PDF.
- Uma trava transacional por usuário é adquirida antes da consulta de duplicata.
  Ela serializa importações em abas diferentes, inclusive documentos sobrepostos;
  índices únicos continuam como defesa complementar.
- O getter `usuario_da_importacao()` é SQL com corpo `BEGIN ATOMIC`, resolvido
  na criação, e chama o mesmo `auth.user_id()` do RLS. O role `authenticated`
  não tem USAGE no schema `auth`; o corpo PL/pgSQL não conseguiria resolver
  diretamente esse nome. O helper evita abrir o schema inteiro ou criar outra
  interpretação do JWT. EXECUTE das duas funções é revogado de PUBLIC e
  concedido somente a `authenticated` (além do proprietário).
- A decisão desta rodada é bloquear gravação divergente na prévia e no
  adaptador. AGENTS.md §2.4 exige aviso, mas não especificava esse bloqueio.
  Sem gabarito continua permitido, explicitamente identificado.
- `documents.conferencia` guarda versão, estado, contagem e comparações usadas
  antes de vínculos/deduplicação. Documentos anteriores mantêm NULL; nenhuma
  conferência retroativa é inferida. JSON inválido ou versão desconhecida
  também não recebe aprovação na interface.
- Ausência da RPC falha sem recorrer à antiga escrita parcial. A migração
  deve ser aplicada e conferida antes de publicar o frontend desta rodada.
- Reconhecer uma duplicata também dispara a releitura do histórico. A primeira
  tentativa pode ter sido concluída no banco e perdido somente a resposta HTTP;
  a nova tentativa deve recuperar o estado salvo, sem exigir F5.

## Consequências e provas

`scripts/test-importacao-atomica.sql` testa falha depois do documento, rollback,
nova tentativa, repetição, sobreposição e RLS como `authenticated`, com dois
usuários sintéticos. Rodou na branch Neon `codex-integridade-20261016`.
Uma prova adicional disparou duas transações simultâneas: uma salvou duas
ocorrências idênticas (`hash` e `hash#2`), a outra respondeu duplicado; ficaram
uma conta, um documento e duas transações. Os privilégios e `security invoker`
foram conferidos no catálogo. Não foram encontrados documentos sem transações
na fotografia inicial da branch; esse estado não é reparado automaticamente,
porque deduplicação legítima também pode produzi-lo.

O fluxo erro de transporte → duplicata → histórico atualizado foi coberto no
teste integrado dos providers, com vermelho observado antes da correção. Em
17/10, a [prova HTTP real](../validacoes/2026-10-17-rpc-real.md) também passou:
SDK instalado, Auth/JWT reais, rollback, concorrência, RLS entre dois usuários,
PDF sintético pela interface e recuperação depois de perder a resposta do commit,
sem F5. Os dublês do adaptador não substituem essa prova. Produção segue pendente.

A migração é aditiva e mantém clientes antigos funcionando. A promessa atômica
só cobre a RPC usada pelo frontend novo; clientes antigos ainda fazem as chamadas
antigas até serem atualizados. Não há concessão nova a tabelas ou ao schema auth.
