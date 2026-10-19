-- A evidência pertence ao histórico, e a importação continua sendo uma RPC só.
-- Aplicar depois de 0008 e antes de publicar o frontend que lê estas colunas.
begin;

alter table public.transactions
  add column vinculo_document_id uuid references public.documents(id)
    deferrable initially deferred,
  add column vinculo_transacao_id uuid references public.transactions(id)
    deferrable initially deferred,
  add column vinculo_criterio text,
  add column vinculo_kind_original text,
  add column vinculo_manual boolean not null default false;

-- O histórico anterior não distingue uma correção manual de uma heurística.
-- Preservar sua natureza é mais seguro que inventar a procedência dela.
update public.transactions set vinculo_kind_original = kind;
alter table public.transactions alter column vinculo_kind_original set not null;
alter table public.transactions add constraint transactions_vinculo_forma check (
  vinculo_kind_original in ('expense', 'income', 'internal_transfer', 'card_payment')
  and (
    (vinculo_criterio is null and vinculo_document_id is null and vinculo_transacao_id is null)
    or (vinculo_criterio = 'quitacao-fatura' and vinculo_document_id is not null
      and vinculo_transacao_id is null and kind = 'card_payment' and not vinculo_manual)
    or (vinculo_criterio = 'transferencia-pareada' and vinculo_document_id is null
      and vinculo_transacao_id is not null and vinculo_transacao_id <> id
      and kind = 'internal_transfer' and not vinculo_manual)
  ) is true
);
create index transactions_vinculo_document_idx on public.transactions (vinculo_document_id)
  where vinculo_document_id is not null;
create index transactions_vinculo_transacao_idx on public.transactions (vinculo_transacao_id)
  where vinculo_transacao_id is not null;

-- Esta função é INVOKER: current_user identifica quem está escrevendo.
-- A reconciliação, DEFINER e sem EXECUTE público, é o único escritor automático.
create function public.preparar_vinculo_transacao() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_dono name;
begin
  if tg_op = 'INSERT' then
    new.vinculo_kind_original := new.kind;
    new.vinculo_manual := false;
    new.vinculo_document_id := null;
    new.vinculo_transacao_id := null;
    new.vinculo_criterio := null;
  else
    select pg_catalog.pg_get_userbyid(c.relowner) into v_dono
      from pg_catalog.pg_class c where c.oid = tg_relid;
    if current_user <> v_dono then
      new.vinculo_kind_original := new.kind;
      new.vinculo_manual := true;
      new.vinculo_document_id := null;
      new.vinculo_transacao_id := null;
      new.vinculo_criterio := null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.preparar_vinculo_transacao() from public;
grant execute on function public.preparar_vinculo_transacao() to authenticated;
create trigger transactions_preparar_vinculo_insert before insert on public.transactions
  for each row execute function public.preparar_vinculo_transacao();
create trigger transactions_preparar_vinculo_update before update of kind on public.transactions
  for each row execute function public.preparar_vinculo_transacao();

create function public.verificar_proprietario_vinculo() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.vinculo_document_id is not null and not exists (
    select 1 from public.documents d
      where d.id = new.vinculo_document_id and d.user_id = new.user_id
  ) then
    raise exception 'vinculo_document_id não pertence ao usuário da transação'
      using errcode = '23503';
  end if;
  if new.vinculo_transacao_id is not null and not exists (
    select 1 from public.transactions t
      where t.id = new.vinculo_transacao_id and t.user_id = new.user_id
  ) then
    raise exception 'vinculo_transacao_id não pertence ao usuário da transação'
      using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.verificar_proprietario_vinculo() from public;
create trigger transactions_vinculos_mesmo_usuario
  before insert or update of user_id, vinculo_document_id, vinculo_transacao_id
  on public.transactions for each row
  execute function public.verificar_proprietario_vinculo();

-- Não ganha EXECUTE para authenticated. O parâmetro só é usado por gatilhos
-- e pelo backfill desta migração; todas as leituras/escritas incluem o dono.
create function public.reconciliar_vinculos_usuario(p_usuario uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_usuario is null then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_usuario::text, 0));

  -- Recalcular também desfaz vínculos que ficaram ambíguos, órfãos ou que
  -- tiveram uma das pontas corrigida à mão. O gabarito original não é tocado.
  update public.transactions set kind = vinculo_kind_original,
    vinculo_document_id = null, vinculo_transacao_id = null, vinculo_criterio = null
    where user_id = p_usuario and vinculo_criterio is not null;

  with candidatos as (
    select t.id as transacao, f.id as fatura,
      count(*) over (partition by t.id) as por_transacao,
      count(*) over (partition by f.id) as por_fatura
    from public.transactions t
    join public.accounts a on a.id = t.account_id and a.user_id = p_usuario
      and a.type = 'checking'
    join public.documents e on e.id = t.document_id and e.user_id = p_usuario
      and e.doc_type = 'extrato'
    join public.documents f on f.user_id = p_usuario and f.doc_type = 'fatura'
      and f.declared_total = t.amount_cents and f.declared_total > 0
      and f.period_end between t.date - 7 and t.date + 7
    join public.accounts c on c.id = f.account_id and c.user_id = p_usuario
      and c.type = 'credit_card'
    where t.user_id = p_usuario and not t.vinculo_manual
      and t.kind in ('expense', 'card_payment')
      and pg_catalog.translate(pg_catalog.upper(t.description),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')
        ~ '(PAGAMENTO DE FATURA|PAGAMENTO FATURA|PAGTO FATURA|GASTOS CARTAO DE CREDITO)'
  )
  update public.transactions t set kind = 'card_payment',
    vinculo_document_id = c.fatura, vinculo_criterio = 'quitacao-fatura'
    from candidatos c where t.id = c.transacao and t.user_id = p_usuario
      and c.por_transacao = 1 and c.por_fatura = 1;

  with elegiveis as (
    select t.id, t.account_id, t.date, t.amount_cents
    from public.transactions t
    join public.accounts a on a.id = t.account_id and a.user_id = p_usuario
      and a.type = 'checking'
    join public.documents d on d.id = t.document_id and d.user_id = p_usuario
      and d.doc_type = 'extrato'
    where t.user_id = p_usuario and not t.vinculo_manual
      and t.kind in ('expense', 'income') and t.amount_cents <> 0
      and pg_catalog.translate(pg_catalog.upper(t.description),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')
        ~ '(^|[^A-Z])(PIX|TED|DOC|TRANSFERENCIA)([^A-Z]|$)'
  ), candidatos as (
    select a.id as transacao, b.id as contraparte,
      count(*) over (partition by a.id) as quantidade
    from elegiveis a join elegiveis b on a.account_id <> b.account_id
      and a.amount_cents::numeric = -(b.amount_cents::numeric)
      and b.date between a.date - 2 and a.date + 2
  ), unicos as (
    select a.transacao, a.contraparte from candidatos a
    join candidatos b on b.transacao = a.contraparte and b.contraparte = a.transacao
    where a.quantidade = 1 and b.quantidade = 1
  )
  update public.transactions t set kind = 'internal_transfer',
    vinculo_transacao_id = u.contraparte, vinculo_criterio = 'transferencia-pareada'
    from unicos u where t.id = u.transacao and t.user_id = p_usuario;
end;
$$;
revoke all on function public.reconciliar_vinculos_usuario(uuid) from public;

-- A trava antecede os locks de linha: edição/exclusão não pode travar uma
-- transação e depois esperar a importação que já detém a trava do usuário.
create function public.travar_historico_usuario() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare v_usuario uuid := public.usuario_da_importacao();
begin
  if v_usuario is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_usuario::text, 0));
  end if;
  return null;
end;
$$;
revoke all on function public.travar_historico_usuario() from public;
grant execute on function public.travar_historico_usuario() to authenticated;

create function public.reconciliar_vinculos_apos_escrita() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if pg_catalog.pg_trigger_depth() = 1 then
    perform public.reconciliar_vinculos_usuario(public.usuario_da_importacao());
  end if;
  return null;
end;
$$;
revoke all on function public.reconciliar_vinculos_apos_escrita() from public;

create trigger transactions_travar_historico
  before insert or update or delete on public.transactions
  for each statement execute function public.travar_historico_usuario();
create trigger transactions_reconciliar_historico
  after insert or update or delete on public.transactions
  for each statement execute function public.reconciliar_vinculos_apos_escrita();
create trigger documents_travar_historico
  before insert or update or delete on public.documents
  for each statement execute function public.travar_historico_usuario();
create trigger documents_reconciliar_historico
  after insert or update or delete on public.documents
  for each statement execute function public.reconciliar_vinculos_apos_escrita();
create trigger accounts_travar_historico
  before insert or update or delete on public.accounts
  for each statement execute function public.travar_historico_usuario();
create trigger accounts_reconciliar_historico
  after update or delete on public.accounts
  for each statement execute function public.reconciliar_vinculos_apos_escrita();

-- authenticated continua com UPDATE somente em label/category_slug/kind.
-- INSERT amplo não permite forjar evidência: o gatilho a elimina na entrada.
do $$
declare v_usuario uuid;
begin
  for v_usuario in select distinct user_id from public.transactions loop
    perform public.reconciliar_vinculos_usuario(v_usuario);
  end loop;
end;
$$;

commit;

\n