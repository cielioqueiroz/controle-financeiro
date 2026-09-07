-- 0007 — o app passa a saber quando quebra na mão de alguém.
--
-- Até aqui não havia telemetria de espécie nenhuma. Em 2026-09-04 o app
-- quebrou no celular de outra pessoa e a ÚNICA razão de alguém ter descoberto
-- foi ela ter contado. Quem não conta, fecha a aba.
--
-- ---------------------------------------------------------------------
-- O que NÃO entra aqui, e por quê
-- ---------------------------------------------------------------------
--
-- A promessa do produto é "seus dados financeiros, só seus". Um registro de
-- falha que carregue descrição de compra, valor, nome de arquivo ou pilha com
-- dado dentro contradiz a promessa — e seria pior que não registrar nada,
-- porque cria um lugar novo onde o dado sensível mora.
--
-- Então a linha guarda o SUFICIENTE PARA IDENTIFICAR O DEFEITO e nada mais:
--
--   classe     o nome da classe do erro (`PdfIlegivelError`, `TypeError`).
--              Para os erros tipados do app isso já nomeia o defeito.
--   contexto   qual funil registrou (`importacao`, `historico`, `edicao`…).
--   rota       o `pathname`, SEM a query string — a query carrega os filtros,
--              e o filtro de busca é texto que a pessoa digitou.
--   versao     o módulo de entrada do bundle (`/assets/index-ABC123.js`).
--              É o mesmo truque do `lib/versao.ts`: não há número de versão
--              para manter, e ele diz exatamente qual build quebrou.
--   navegador  motor + versão maior + plataforma, reduzido. Nunca o UA cru.
--
-- Sem mensagem, sem pilha, sem nome de arquivo, sem valor, sem descrição.
--
-- ---------------------------------------------------------------------
-- Quem lê
-- ---------------------------------------------------------------------
--
-- O RLS escopa como todo o resto: cada um só enxerga as próprias linhas. Isso
-- é de propósito — o app não expõe as falhas de ninguém a ninguém. Quem
-- investiga é o dono do banco, pelo console do Neon, onde o RLS não se aplica.
--
-- ⚠️ LIMITE CONHECIDO: sem sessão não há JWT, e sem JWT não há insert. Falha
-- em tela DESLOGADA (entrar, criar conta, recuperar senha) não é registrada.
-- Cobrir isso exigiria um endpoint anônimo — ou seja, um backend, que o
-- ADR-0011 descartou — e superfície anônima de escrita é convite a lixo. O
-- incidente que originou esta tabela era logado.

create table public.client_errors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default (auth.user_id())::uuid,
  ocorrido_em timestamptz not null default now(),
  classe      text not null,
  contexto    text not null,
  rota        text not null,
  versao      text,
  navegador   text
);

-- Consulta de quem investiga: as mais recentes primeiro.
create index client_errors_recentes_idx on public.client_errors (ocorrido_em desc);

alter table public.client_errors enable row level security;

-- Sem UPDATE: linha de registro não se corrige, e o app não tem por que
-- reescrever uma. DELETE fica, para a pessoa poder limpar o que é dela.
--
-- ⚠️ O REVOKE NÃO É REDUNDANTE. Este banco tem DEFAULT PRIVILEGES que já
-- concedem em toda tabela nova do schema `public` ao role `authenticated` —
-- conferido em 2026-09-06, quando a tabela nasceu com UPDATE apesar de o
-- `grant` abaixo listar só três. Conceder o que se quer não tira o que veio
-- de graça: em tabela nova, revogue explicitamente o que não deve existir.
grant select, insert, delete on public.client_errors to authenticated;
revoke update on public.client_errors from authenticated;

create policy "dono le as proprias falhas" on public.client_errors
  for select to authenticated
  using ((select auth.user_id())::uuid = user_id);

create policy "dono registra as proprias falhas" on public.client_errors
  for insert to authenticated
  with check ((select auth.user_id())::uuid = user_id);

create policy "dono apaga as proprias falhas" on public.client_errors
  for delete to authenticated
  using ((select auth.user_id())::uuid = user_id);
