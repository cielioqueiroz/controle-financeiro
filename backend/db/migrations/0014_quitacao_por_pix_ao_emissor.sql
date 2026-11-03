-- 0014 — o PIX que paga a fatura nomeando o emissor também é quitação.
--
-- Achado em 03/11/2026: a fatura do Mercado Pago de setembro (R$ 820,76) e a
-- de outubro (R$ 867,79) foram pagas do Bradesco por PIX QR Code, e o extrato
-- diz "PIX QR CODE ESTATICO DES: MERCADO PAGO INSTITUI". A 0009 só reconhece
-- a quitação pela palavra "fatura" ("PAGAMENTO DE FATURA", "PAGTO FATURA",
-- "GASTOS CARTAO DE CREDITO"), e o PIX ficou como gasto em "Transferências"
-- — o mesmo dinheiro contado duas vezes, pela fatura e pelo extrato.
--
-- Muda só a condição da descrição. Continuam exigidos: extrato de conta
-- corrente, saída do valor INTEIRO da fatura, vencimento a até sete dias e
-- unicidade nos dois sentidos. A descrição nova precisa de PIX ou boleto E
-- do nome do emissor DAQUELE cartão — só Mercado Pago e Nubank, os dois que
-- se pagam por PIX a uma instituição com outro nome. Os demais bancos seguem
-- só pela regra da 0009. Ver ADR-0021.
--
-- Aplicar como dono das tabelas, como a 0009. O laço do fim recalcula o
-- histórico de todo usuário.
begin;

create or replace function public.reconciliar_vinculos_usuario(p_usuario uuid) returns void
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
      and (
        pg_catalog.translate(pg_catalog.upper(t.description),
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')
          ~ '(PAGAMENTO DE FATURA|PAGAMENTO FATURA|PAGTO FATURA|GASTOS CARTAO DE CREDITO)'
        -- 0014: o PIX ou boleto que NOMEIA o emissor do cartão. "PIX QR CODE
        -- ESTATICO DES: MERCADO PAGO INSTITUI" pagou a fatura do Mercado Pago
        -- ao centavo e no vencimento, mas não diz "fatura".
        or (pg_catalog.translate(pg_catalog.upper(t.description),
              'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')
              ~ '(^|[^A-Z])(PIX|BOLETO)([^A-Z]|$)'
            and pg_catalog.translate(pg_catalog.upper(t.description),
              'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC')
              ~ case c.bank
                  when 'mercadopago' then '(MERCADO ?PAGO)'
                  when 'nubank' then '(NU PAGAMENTOS|NUBANK)'
                end)
      )
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

revoke all on function public.reconciliar_vinculos_usuario(uuid) from public, authenticated;

do $$
declare v_usuario uuid;
begin
  for v_usuario in select distinct user_id from public.transactions loop
    perform public.reconciliar_vinculos_usuario(v_usuario);
  end loop;
end;
$$;

commit;
