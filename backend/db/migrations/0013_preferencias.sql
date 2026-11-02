-- 0013 — preferências da pessoa, iguais em todo aparelho.
--
-- Até aqui o apelido, o idioma, o tema, o modo discreto e o período moravam
-- só no `localStorage`: cada aparelho tinha os seus, e quem trocava o
-- apelido no celular continuava sendo chamado pelo nome antigo no desktop.
--
-- ---------------------------------------------------------------------
-- Por que uma tabela nossa, e não o usuário do Auth
-- ---------------------------------------------------------------------
--
-- O lugar natural seria o próprio usuário do Neon Auth. Não dá: a tabela
-- `neon_auth.user` tem `name` e `image` e nenhum campo livre (conferido em
-- 2026-11-02), e o servidor do Auth é gerenciado pelo Neon — não temos
-- como declarar `additionalFields` no better-auth de lá. Ver ADR-0023.
--
-- ---------------------------------------------------------------------
-- O que o app faz SEM esta migração
-- ---------------------------------------------------------------------
--
-- Funciona igual a antes: lê e grava no aparelho, e avisa "salvo só neste
-- aparelho" quando o servidor recusa. Nada quebra por ela faltar; o que
-- falta é a sincronização.
--
-- Uma linha por pessoa. Coluna nula = "não escolheu", e o app cai no padrão
-- dele (escuro, mês, idioma do navegador) — nunca num valor inventado.

create table public.preferencias (
  user_id        uuid primary key default (auth.user_id())::uuid,
  apelido        text check (char_length(apelido) <= 40),
  idioma         text check (idioma in ('pt', 'en', 'es')),
  tema           text check (tema in ('dark', 'light')),
  discreto       boolean,
  periodo_padrao text check (periodo_padrao in ('dia', 'semana', 'mes', 'ano')),
  cor_avatar     text check (cor_avatar in (
                   'grafite', 'oceano', 'floresta', 'ambar',
                   'terracota', 'vinho', 'ameixa', 'petroleo'
                 )),
  atualizado_em  timestamptz not null default now()
);

alter table public.preferencias enable row level security;

-- O `upsert` do PostgREST é INSERT ... ON CONFLICT DO UPDATE: precisa das
-- três, e o SELECT porque o conflito lê a linha existente.
--
-- ⚠️ O REVOKE NÃO É REDUNDANTE (ver 0007): os DEFAULT PRIVILEGES do schema
-- concedem a mais em toda tabela nova, e conceder o que se quer não tira o
-- que veio de graça.
grant select, insert, update, delete on public.preferencias to authenticated;
revoke truncate, references, trigger on public.preferencias from authenticated;

create policy "dono lê as próprias preferências" on public.preferencias
  for select to authenticated
  using ((select auth.user_id())::uuid = user_id);

create policy "dono escreve as próprias preferências" on public.preferencias
  for all to authenticated
  using ((select auth.user_id())::uuid = user_id)
  with check ((select auth.user_id())::uuid = user_id);
