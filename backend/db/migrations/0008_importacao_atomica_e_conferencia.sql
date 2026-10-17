-- Uma chamada RPC é uma transação: documento sem transações não pode ser
-- o resíduo de uma falha. O snapshot antecede vínculos e deduplicação.
begin;

alter table public.documents add column conferencia jsonb;
alter table public.documents add constraint documents_conferencia_forma check (
  conferencia is null or (
    jsonb_typeof(conferencia) = 'object'
    and conferencia ->> 'versao' = '1'
    and conferencia ->> 'status' in ('confere', 'sem-gabarito')
    and jsonb_typeof(conferencia -> 'comparacoes') = 'array'
    and jsonb_typeof(conferencia -> 'contagem') = 'number'
  ) is true
);

-- O corpo SQL é resolvido na criação: authenticated não precisa ganhar
-- USAGE no schema auth inteiro para chamar o mesmo getter usado pelo RLS.
create function public.usuario_da_importacao() returns uuid
language sql stable security invoker set search_path = ''
begin atomic
  select auth.user_id()::uuid;
end;
revoke all on function public.usuario_da_importacao() from public;
grant execute on function public.usuario_da_importacao() to authenticated;

create function public.salvar_documento_atomico(
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

  -- Mesmo usuário pode importar em duas abas; verificar e inserir precisam
  -- da mesma trava. Índices únicos continuam sendo a defesa final.
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

  return jsonb_build_object('status', 'salvo', 'documentId', v_documento,
    'inseridas', v_inseridas, 'jaExistiam', jsonb_array_length(p_transacoes) - v_inseridas);
end;
$$;

revoke all on function public.salvar_documento_atomico(jsonb, jsonb, jsonb) from public;
grant execute on function public.salvar_documento_atomico(jsonb, jsonb, jsonb) to authenticated;

commit;
