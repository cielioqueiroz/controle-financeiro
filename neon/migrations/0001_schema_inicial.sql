-- Controle Financeiro — schema inicial (Neon Data API + Neon Auth/Better Auth)
--
-- Traduzido de supabase/migrations/0001_schema_inicial.sql. Diferenças:
--   • auth.uid()  →  (select auth.user_id())::uuid
--     auth.user_id() devolve TEXT (o sub do JWT); a coluna user_id é UUID
--     (tipo nativo de neon_auth.user.id). O cast é no valor do JWT, não na
--     coluna, para o índice de user_id continuar sendo usado.
--   • user_id UUID NOT NULL DEFAULT (auth.user_id())::uuid — preenchido do
--     JWT no insert; o client nem precisa mandar. SEM FK dura para
--     neon_auth.user (best practice do Neon: evitar acoplamento à tabela
--     de auth; o RLS já garante a integridade dono↔linha).
--   • Toda tabela: ENABLE RLS + policies TO authenticated + GRANT ao role
--     authenticated (a Data API expõe o schema public; o RLS é a fronteira).
--   • unique(...coalesce...) inválido do original → CREATE UNIQUE INDEX.
--
-- Valores monetários em BIGINT de CENTAVOS — nunca float.

-- ---------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------
create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default (auth.user_id())::uuid,
  bank        text not null check (bank in ('nubank','bradesco','desconhecido')),
  type        text not null check (type in ('checking','credit_card')),
  label       text,
  last4       text,
  agency      text,
  number      text,
  holder_name text,
  created_at  timestamptz not null default now()
);
create unique index accounts_unicas on public.accounts
  (user_id, bank, type, coalesce(last4,''), coalesce(number,''));

alter table public.accounts enable row level security;
grant select, insert, update, delete on public.accounts to authenticated;
create policy "dono lê accounts" on public.accounts
  for select to authenticated
  using ((select auth.user_id())::uuid = user_id);
create policy "dono escreve accounts" on public.accounts
  for all to authenticated
  using ((select auth.user_id())::uuid = user_id)
  with check ((select auth.user_id())::uuid = user_id);

-- ---------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default (auth.user_id())::uuid,
  account_id    uuid references public.accounts(id) on delete set null,
  file_hash     text not null,
  bank          text not null,
  doc_type      text not null check (doc_type in ('fatura','extrato','desconhecido')),
  period_start  date,
  period_end    date,
  declared_total    bigint,
  declared_income   bigint,
  declared_expense  bigint,
  parsed_total      bigint,
  filename      text,
  next_close_date           date,
  next_invoice_balance      bigint,
  total_open_balance        bigint,
  future_installments_total bigint,
  imported_at   timestamptz not null default now(),
  unique (user_id, file_hash)
);

alter table public.documents enable row level security;
grant select, insert, update, delete on public.documents to authenticated;
create policy "dono lê documents" on public.documents
  for select to authenticated
  using ((select auth.user_id())::uuid = user_id);
create policy "dono escreve documents" on public.documents
  for all to authenticated
  using ((select auth.user_id())::uuid = user_id)
  with check ((select auth.user_id())::uuid = user_id);

-- ---------------------------------------------------------------------
-- categories — globais (user_id null) + do usuário
-- ---------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default (auth.user_id())::uuid,
  slug       text not null,
  nome       text not null,
  icone      text not null default '❓',
  cor        text not null default '#6b7280',
  sort_order int not null default 0
);

alter table public.categories enable row level security;
grant select, insert, update, delete on public.categories to authenticated;
create policy "lê categorias globais e próprias" on public.categories
  for select to authenticated
  using (user_id is null or (select auth.user_id())::uuid = user_id);
create policy "escreve próprias categorias" on public.categories
  for all to authenticated
  using ((select auth.user_id())::uuid = user_id)
  with check ((select auth.user_id())::uuid = user_id);

-- ---------------------------------------------------------------------
-- merchant_rules
-- ---------------------------------------------------------------------
create table public.merchant_rules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default (auth.user_id())::uuid,
  padrao     text not null,
  match_type text not null check (match_type in ('contains','cnpj')),
  categoria  text not null,
  prioridade int not null default 1000,
  created_at timestamptz not null default now()
);

alter table public.merchant_rules enable row level security;
grant select, insert, update, delete on public.merchant_rules to authenticated;
create policy "dono lê rules" on public.merchant_rules
  for select to authenticated
  using ((select auth.user_id())::uuid = user_id);
create policy "dono escreve rules" on public.merchant_rules
  for all to authenticated
  using ((select auth.user_id())::uuid = user_id)
  with check ((select auth.user_id())::uuid = user_id);

-- ---------------------------------------------------------------------
-- transactions — o coração
-- ---------------------------------------------------------------------
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default (auth.user_id())::uuid,
  account_id   uuid references public.accounts(id) on delete set null,
  document_id  uuid references public.documents(id) on delete cascade,
  date         date not null,
  description  text not null,
  label        text,
  amount_cents bigint not null,
  direction    text not null check (direction in ('in','out')),
  kind         text not null check (kind in ('expense','income','internal_transfer','card_payment')),
  category_slug text,
  installment  jsonb,
  fx           jsonb,
  counterparty_doc text,
  linked_transaction_id uuid references public.transactions(id) on delete set null,
  hash         text not null,
  raw          text,
  created_at   timestamptz not null default now(),
  unique (user_id, hash)
);

create index transactions_user_date_idx on public.transactions (user_id, date);
create index transactions_document_idx  on public.transactions (document_id);
create index transactions_category_idx  on public.transactions (user_id, category_slug);

alter table public.transactions enable row level security;
grant select, insert, update, delete on public.transactions to authenticated;
create policy "dono lê transactions" on public.transactions
  for select to authenticated
  using ((select auth.user_id())::uuid = user_id);
create policy "dono escreve transactions" on public.transactions
  for all to authenticated
  using ((select auth.user_id())::uuid = user_id)
  with check ((select auth.user_id())::uuid = user_id);
