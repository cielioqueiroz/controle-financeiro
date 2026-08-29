-- Garante que relações entre dados também respeitem o dono da linha.
-- RLS protege cada tabela isoladamente, mas não transforma uma FK em uma
-- relação entre linhas do mesmo usuário. Esta função fecha essa lacuna.

create or replace function public.verificar_proprietario_referencias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
begin
  if tg_table_name = 'documents' and new.account_id is not null then
    select user_id into dono from public.accounts where id = new.account_id;
    if dono is distinct from new.user_id then
      raise exception 'account_id não pertence ao usuário do documento';
    end if;
  end if;

  if tg_table_name = 'transactions' then
    if new.account_id is not null then
      select user_id into dono from public.accounts where id = new.account_id;
      if dono is distinct from new.user_id then
        raise exception 'account_id não pertence ao usuário da transação';
      end if;
    end if;

    if new.document_id is not null then
      select user_id into dono from public.documents where id = new.document_id;
      if dono is distinct from new.user_id then
        raise exception 'document_id não pertence ao usuário da transação';
      end if;
    end if;

    if new.linked_transaction_id is not null then
      select user_id into dono
      from public.transactions
      where id = new.linked_transaction_id;
      if dono is distinct from new.user_id then
        raise exception 'linked_transaction_id não pertence ao usuário da transação';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists documents_referencias_mesmo_usuario on public.documents;
create trigger documents_referencias_mesmo_usuario
before insert or update of user_id, account_id on public.documents
for each row execute function public.verificar_proprietario_referencias();

drop trigger if exists transactions_referencias_mesmo_usuario on public.transactions;
create trigger transactions_referencias_mesmo_usuario
before insert or update of user_id, account_id, document_id, linked_transaction_id
on public.transactions
for each row execute function public.verificar_proprietario_referencias();
