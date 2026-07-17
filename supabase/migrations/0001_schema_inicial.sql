-- Controle Financeiro — schema inicial
--
-- Princípio inegociável: RLS desde a primeira linha. São dados
-- financeiros; sem Row Level Security, qualquer um com a chave pública
-- lê a tabela inteira de todos os usuários. Cada tabela isola por
-- auth.uid() (ver spec da Fundação).
--
-- Valores monetários em BIGINT de CENTAVOS — nunca float. Evita o erro
-- de ponto flutuante que quebraria a conferência contra o total do banco.

-- ---------------------------------------------------------------------
-- accounts — contas bancárias do usuário (alimenta o tema por banco)
-- ---------------------------------------------------------------------
create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  bank        text not null check (bank in ('nubank','bradesco','desconhecido')),
  type        text not null check (type in ('checking','credit_card')),
  label       text,
  last4       text,
  agency      text,
  number      text,
  holder_name text,
  created_at  timestamptz not null default now(),
  unique (user_id, bank, type, coalesce(last4,''), coalesce(number,''))
);

-- ---------------------------------------------------------------------
-- documents — cada PDF importado (hash barra reimportação)
-- ---------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
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
  -- Campos prospectivos (projeção de compromisso futuro, fatia 3)
  next_close_date           date,
  next_invoice_balance      bigint,
  total_open_balance        bigint,
  future_installments_total bigint,
  imported_at   timestamptz not null default now(),
  unique (user_id, file_hash)   -- mesmo arquivo não entra 2x
);

-- ---------------------------------------------------------------------
-- categories — catálogo (globais têm user_id null; do usuário, o id dele)
-- ---------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  slug       text not null,
  nome       text not null,
  icone      text not null default '❓',
  cor        text not null default '#6b7280',
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- merchant_rules — regras de categorização (globais + do usuário)
-- ---------------------------------------------------------------------
create table public.merchant_rules (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  padrao     text not null,
  match_type text not null check (match_type in ('contains','cnpj')),
  categoria  text not null,
  prioridade int not null default 1000,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- transactions — o coração. Guarda a transação estruturada, nunca o PDF.
-- ---------------------------------------------------------------------
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  account_id   uuid references public.accounts(id) on delete set null,
  document_id  uuid references public.documents(id) on delete cascade,
  date         date not null,
  description  text not null,        -- original do banco, imutável
  label        text,                 -- texto do usuário, editável
  amount_cents bigint not null,      -- + saiu, − entrou
  direction    text not null check (direction in ('in','out')),
  kind         text not null check (kind in ('expense','income','internal_transfer','card_payment')),
  category_slug text,
  installment  jsonb,                -- {current, total}
  fx           jsonb,                -- {currency, amount, rate}
  counterparty_doc text,             -- CNPJ/CPF quando disponível
  linked_transaction_id uuid references public.transactions(id) on delete set null,
  hash         text not null,        -- chave de dedup
  raw          text,                 -- linha original, para auditoria
  created_at   timestamptz not null default now(),
  unique (user_id, hash)
);

create index transactions_user_date_idx on public.transactions (user_id, date);
create index transactions_document_idx  on public.transactions (document_id);
create index transactions_category_idx  on public.transactions (user_id, category_slug);

-- ---------------------------------------------------------------------
-- RLS — cada usuário só enxerga o que é seu
-- ---------------------------------------------------------------------
alter table public.accounts       enable row level security;
alter table public.documents      enable row level security;
alter table public.transactions   enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.categories     enable row level security;

-- accounts / documents / transactions / merchant_rules: dono = auth.uid()
create policy "dono lê accounts"      on public.accounts       for select using (auth.uid() = user_id);
create policy "dono escreve accounts" on public.accounts       for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "dono lê documents"      on public.documents      for select using (auth.uid() = user_id);
create policy "dono escreve documents" on public.documents      for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "dono lê transactions"      on public.transactions   for select using (auth.uid() = user_id);
create policy "dono escreve transactions" on public.transactions   for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "dono lê rules"      on public.merchant_rules for select using (auth.uid() = user_id);
create policy "dono escreve rules" on public.merchant_rules for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- categories: usuário lê as globais (user_id null) + as suas; escreve só as suas
create policy "lê categorias globais e próprias" on public.categories for select
  using (user_id is null or auth.uid() = user_id);
create policy "escreve próprias categorias" on public.categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
