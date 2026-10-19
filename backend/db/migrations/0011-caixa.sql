-- Aplicar antes de publicar o frontend que importa GovConta Caixa.
begin;
alter table public.accounts drop constraint if exists accounts_bank_check;
alter table public.accounts add constraint accounts_bank_check
  check (bank in ('nubank','bradesco','bb','sicredi','sicoob','mercadopago','caixa','desconhecido'));
commit;
