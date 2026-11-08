-- 0015 — uma transação pode ser comprovada por mais de um documento.
--
-- Extratos sobrepostos são legítimos: um cobre 01–15 e outro 01–30. A chave
-- única de transactions impede dupla contagem, mas o modelo anterior guardava
-- somente o primeiro document_id. O segundo documento ficava com a conferência
-- completa e sem a relação das linhas repetidas; apagar o primeiro cascata-las
-- removia do histórico, embora o segundo ainda as comprovasse.
begin;

create table public.document_transactions (
  document_id uuid not null,
  transaction_id uuid not null,
  user_id uuid not null default (auth.user_id())::uuid,
  primary key (document_id, transaction_id),
  constraint document_transactions_document_id_fkey
    foreign key (document_id) references public.documents(id) on delete cascade,
  constraint document_transactions_transaction_id_fkey
    foreign key (transaction_id) references public.transactions(id) on delete cascade
);
create index document_transactions_transaction_idx
  on public.document_transactions (transaction_id);

alter table public.document_transactions enable row level security;
grant select, insert on public.document_transactions to authenticated;
create policy "dono lê relações documento-transação" on public.document_transactions
  for select to authenticated
  using ((select auth.user_id())::uuid = user_id);
create policy "dono cria relações documento-transação" on public.document_transactions
  for insert to authenticated
  with check ((select auth.user_id())::uuid = user_id);

create function public.verificar_proprietario_document_transaction() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.documents d
    where d.id = new.document_id and d.user_id = new.user_id
  ) then
    raise exception 'document_id não pertence ao usuário da relação'
      using errcode = '23503';
  end if;
  if not exists (
    select 1 from public.transactions t
    where t.id = new.transaction_id and t.user_id = new.user_id
  ) then
    raise exception 'transaction_id não pertence ao usuário da relação'
      using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.verificar_proprietario_document_transaction()
  from public, authenticated;
create trigger document_transactions_mesmo_usuario
  before insert or update of document_id, transaction_id, user_id
  on public.document_transactions for each row
  execute function public.verificar_proprietario_document_transaction();

-- Toda linha histórica já tem uma procedência primária; ela inaugura a
-- relação N:N sem inventar documentos que o banco antigo não registrou.
insert into public.document_transactions (document_id, transaction_id, user_id)
select document_id, id, user_id from public.transactions
where document_id is not null;

-- Clientes antigos ainda apagam documents diretamente. Antes da cascata,
-- transfere a procedência primária para outro documento que também comprova a
-- transação. Sem alternativa, a cascata continua sendo o comportamento certo.
create function public.preservar_transacoes_compartilhadas() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  with alternativas as (
    select distinct on (dt.transaction_id)
      dt.transaction_id, dt.document_id
    from public.document_transactions dt
    join public.documents d on d.id = dt.document_id and d.user_id = old.user_id
    join public.transactions t on t.id = dt.transaction_id
      and t.user_id = old.user_id and t.document_id = old.id
    where dt.user_id = old.user_id and dt.document_id <> old.id
    order by dt.transaction_id, d.imported_at, dt.document_id
  )
  update public.transactions t set document_id = a.document_id
    from alternativas a
    where t.id = a.transaction_id and t.user_id = old.user_id;
  return old;
end;
$$;
revoke all on function public.preservar_transacoes_compartilhadas()
  from public, authenticated;
create trigger documents_preservar_transacoes_compartilhadas
  before delete on public.documents for each row
  execute function public.preservar_transacoes_compartilhadas();

-- Substitui a RPC inteira: uma importação associa o documento novo tanto às
-- transações inseridas quanto às que já existiam pelo mesmo hash.
create or replace function public.salvar_documento_atomico(
  p_conta jsonb, p_documento jsonb, p_transacoes jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_usuario uuid := public.usuario_da_importacao();
  v_conta uuid;
  v_documento uuid;
  v_importado timestamptz;
  v_inseridas integer;
  v_associadas integer;
begin
  if v_usuario is null then
    raise exception 'Sem sessão' using errcode = '28000';
  end if;
  if jsonb_typeof(p_conta) is distinct from 'object'
    or jsonb_typeof(p_documento) is distinct from 'object'
    or jsonb_typeof(p_transacoes) is distinct from 'array' then
    raise exception 'Importação malformada' using errcode = '22023';
  end if;
  if (p_documento -> 'conferencia' ->> 'contagem')::integer
      is distinct from jsonb_array_length(p_transacoes)
    or (p_documento -> 'conferencia' ->> 'status') is null
    or p_documento -> 'conferencia' ->> 'status' not in ('confere', 'sem-gabarito') then
    raise exception 'Conferência ausente ou divergente' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_usuario::text, 0));

  select d.id, d.imported_at into v_documento, v_importado
    from public.documents d
    where d.user_id = v_usuario and (
      d.file_hash = p_documento ->> 'file_hash'
      or d.content_hash = p_documento ->> 'content_hash'
    ) limit 1;
  if found then
    return jsonb_build_object('status', 'documento-duplicado', 'importadoEm', v_importado);
  end if;

  insert into public.accounts (bank, type, last4, agency, number)
    values (p_conta ->> 'bank', p_conta ->> 'type', p_conta ->> 'last4',
      p_conta ->> 'agency', p_conta ->> 'number')
    on conflict do nothing returning id into v_conta;
  if v_conta is null then
    select a.id into strict v_conta from public.accounts a
      where a.user_id = v_usuario and a.bank = p_conta ->> 'bank'
        and a.type = p_conta ->> 'type'
        and coalesce(a.last4, '') = coalesce(p_conta ->> 'last4', '')
        and coalesce(a.number, '') = coalesce(p_conta ->> 'number', '');
  end if;

  insert into public.documents (
    account_id, file_hash, content_hash, bank, doc_type, period_start, period_end,
    declared_total, declared_income, declared_expense, filename, end_balance_cents,
    next_close_date, next_invoice_balance, total_open_balance,
    future_installments_total, conferencia
  ) values (
    v_conta, p_documento ->> 'file_hash', p_documento ->> 'content_hash',
    p_conta ->> 'bank', p_documento ->> 'doc_type',
    (p_documento ->> 'period_start')::date, (p_documento ->> 'period_end')::date,
    (p_documento ->> 'declared_total')::bigint, (p_documento ->> 'declared_income')::bigint,
    (p_documento ->> 'declared_expense')::bigint, p_documento ->> 'filename',
    (p_documento ->> 'end_balance_cents')::bigint, (p_documento ->> 'next_close_date')::date,
    (p_documento ->> 'next_invoice_balance')::bigint, (p_documento ->> 'total_open_balance')::bigint,
    (p_documento ->> 'future_installments_total')::bigint, p_documento -> 'conferencia'
  ) returning id into v_documento;

  insert into public.transactions (
    account_id, document_id, date, description, amount_cents, direction, kind,
    category_slug, installment, fx, hash
  ) select v_conta, v_documento, t.date, t.description, t.amount_cents,
      t.direction, t.kind, t.category_slug, t.installment, t.fx, t.hash
    from jsonb_to_recordset(p_transacoes) as t(
      date date, description text, amount_cents bigint, direction text,
      kind text, category_slug text, installment jsonb, fx jsonb, hash text
    ) on conflict (user_id, hash) do nothing;
  get diagnostics v_inseridas = row_count;

  insert into public.document_transactions (document_id, transaction_id, user_id)
  select v_documento, t.id, v_usuario
    from public.transactions t
    join jsonb_to_recordset(p_transacoes) as entrada(hash text)
      on entrada.hash = t.hash
    where t.user_id = v_usuario
    on conflict do nothing;
  get diagnostics v_associadas = row_count;
  if v_associadas is distinct from jsonb_array_length(p_transacoes) then
    raise exception 'Relação documento-transação incompleta' using errcode = '23514';
  end if;

  return jsonb_build_object('status', 'salvo', 'documentId', v_documento,
    'inseridas', v_inseridas,
    'jaExistiam', jsonb_array_length(p_transacoes) - v_inseridas);
end;
$$;

commit;
