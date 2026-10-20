-- Aplicar antes de publicar o formulário de regras com operadores.
-- Só amplia o vocabulário; as regras existentes e seus slugs são preservados.
begin;

alter table public.merchant_rules
  drop constraint merchant_rules_match_type_check;
alter table public.merchant_rules
  add constraint merchant_rules_match_type_check
  check (match_type in ('contains', 'cnpj', 'consulta'));

-- Substituir uma regra é uma só transação. Se o insert falhar, a regra
-- anterior continua existindo. A trava também serializa abas do mesmo dono.
create function public.salvar_regra_atomica(p_regra jsonb) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_usuario uuid := public.usuario_da_importacao();
begin
  if v_usuario is null then
    raise exception 'Sem sessão' using errcode = '28000';
  end if;
  if jsonb_typeof(p_regra) is distinct from 'object'
    or coalesce(btrim(p_regra ->> 'padrao'), '') = ''
    or coalesce(btrim(p_regra ->> 'categoria'), '') = ''
    or coalesce(p_regra ->> 'match_type', '') not in ('contains', 'cnpj', 'consulta')
    or jsonb_typeof(p_regra -> 'prioridade') is distinct from 'number' then
    raise exception 'Regra malformada' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_usuario::text, 0));
  delete from public.merchant_rules
    where user_id = v_usuario and padrao = p_regra ->> 'padrao'
      and match_type = p_regra ->> 'match_type';
  insert into public.merchant_rules (user_id, padrao, match_type, categoria, prioridade)
    values (v_usuario, p_regra ->> 'padrao', p_regra ->> 'match_type',
      p_regra ->> 'categoria', (p_regra ->> 'prioridade')::integer);
end;
$$;

revoke all on function public.salvar_regra_atomica(jsonb) from public;
grant execute on function public.salvar_regra_atomica(jsonb) to authenticated;

commit;
