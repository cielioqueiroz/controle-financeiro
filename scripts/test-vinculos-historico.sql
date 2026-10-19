-- Banco descartável, migrações 0001–0009 aplicadas. Dados inteiramente sintéticos.
-- psql -v ON_ERROR_STOP=1 -f scripts/test-vinculos-historico.sql
-- O teste nunca persiste os documentos. Concorrência requer duas conexões reais
-- e é descrita na ADR-0021; a suíte abaixo mede RLS usando authenticated.
begin;
create temporary table prova_vinculos (id integer);
create function pg_temp.documento_vinculo(
  p_chave text, p_tipo text, p_conta text, p_valor bigint, p_data date,
  p_descricao text default 'TESTE SINTETICO', p_kind text default null
) returns uuid language plpgsql security invoker set search_path = ''
as $$
declare v_resposta jsonb;
begin
  v_resposta := public.salvar_documento_atomico(
    jsonb_build_object('bank', 'nubank',
      'type', case when p_tipo = 'fatura' then 'credit_card' else 'checking' end,
      'number', p_conta),
    jsonb_build_object('file_hash', 'prova-vinculo-' || p_chave,
      'content_hash', 'prova-conteudo-' || p_chave, 'doc_type', p_tipo,
      'period_start', p_data, 'period_end', p_data,
      'declared_total', case when p_tipo = 'fatura' then p_valor else null end,
      'conferencia', jsonb_build_object('versao', 1, 'status', 'sem-gabarito',
        'contagem', 1, 'comparacoes', '[]'::jsonb)),
    jsonb_build_array(jsonb_build_object('date', p_data, 'description', p_descricao,
      'amount_cents', p_valor, 'direction', case when p_valor < 0 then 'in' else 'out' end,
      'kind', coalesce(p_kind, case when p_valor < 0 then 'income' else 'expense' end),
      'hash', 'prova-transacao-' || p_chave)));
  assert v_resposta ->> 'status' = 'salvo', 'a preparação sintética deve salvar';
  return (v_resposta ->> 'documentId')::uuid;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000091"}', true);

do $$
declare
  v_fatura uuid;
  v_extrato uuid;
  v_par uuid;
  v_outro uuid;
  v_transacao uuid;
  v_conferencia jsonb;
  v_recusou boolean;
begin
  -- Extrato antes da fatura: só uma evidência posterior autoriza a quitação.
  v_extrato := pg_temp.documento_vinculo('ordem-e', 'extrato', 'conta-a', 10101,
    '2026-10-10', 'Pagamento de fatura');
  assert (select kind = 'expense' and vinculo_criterio is null from public.transactions
    where document_id = v_extrato), 'quitação sem fatura';
  select conferencia into v_conferencia from public.documents where id = v_extrato;
  v_fatura := pg_temp.documento_vinculo('ordem-f', 'fatura', 'cartao-a', 10101, '2026-10-11');
  assert (select kind = 'card_payment' and vinculo_document_id = v_fatura
      and vinculo_criterio = 'quitacao-fatura' from public.transactions
    where document_id = v_extrato), 'extrato anterior não foi reconciliado';
  assert (select conferencia = v_conferencia from public.documents where id = v_extrato),
    'a reconciliação alterou a conferência original';

  -- Fatura antes do extrato e exatamente sete dias de janela.
  v_fatura := pg_temp.documento_vinculo('inversa-f', 'fatura', 'cartao-a', 10202, '2026-10-10');
  v_extrato := pg_temp.documento_vinculo('inversa-e', 'extrato', 'conta-a', 10202,
    '2026-10-17', 'GASTOS CARTAO DE CREDITO');
  assert (select vinculo_document_id = v_fatura from public.transactions
    where document_id = v_extrato), 'ordem inversa ou janela inclusiva falhou';
  v_fatura := pg_temp.documento_vinculo('distante-f', 'fatura', 'cartao-a', 10303, '2026-10-10');
  v_extrato := pg_temp.documento_vinculo('distante-e', 'extrato', 'conta-a', 10303,
    '2026-10-18', 'Pagamento de fatura');
  assert (select kind = 'expense' and vinculo_document_id is null from public.transactions
    where document_id = v_extrato), 'quitação fora da janela';
  v_extrato := pg_temp.documento_vinculo('sem-descricao', 'extrato', 'conta-a', 10303,
    '2026-10-10', 'COMPRA TESTE');
  assert (select kind = 'expense' from public.transactions where document_id = v_extrato),
    'o valor sozinho não autoriza quitação';

  -- Uma fatura concorrente revoga o vínculo anterior; não escolhe pela ordem.
  v_fatura := pg_temp.documento_vinculo('ambigua-f1', 'fatura', 'cartao-a', 10404, '2026-10-10');
  v_extrato := pg_temp.documento_vinculo('ambigua-e', 'extrato', 'conta-a', 10404,
    '2026-10-10', 'Pagamento de fatura');
  perform pg_temp.documento_vinculo('ambigua-f2', 'fatura', 'cartao-b', 10404, '2026-10-10');
  assert (select kind = 'expense' and vinculo_criterio is null from public.transactions
    where document_id = v_extrato), 'faturas ambíguas mantiveram uma escolha arbitrária';
  v_fatura := pg_temp.documento_vinculo('dois-pag-f', 'fatura', 'cartao-a', 10505, '2026-10-10');
  v_extrato := pg_temp.documento_vinculo('dois-pag-e1', 'extrato', 'conta-a', 10505,
    '2026-10-10', 'Pagamento de fatura');
  v_outro := pg_temp.documento_vinculo('dois-pag-e2', 'extrato', 'conta-b', 10505,
    '2026-10-10', 'Pagamento de fatura');
  assert (select count(*) = 2 from public.transactions where document_id in (v_extrato, v_outro)
    and kind = 'expense' and vinculo_criterio is null), 'pagamentos ambíguos foram pareados';

  -- Transferências precisam de unicidade RECÍPROCA, contas diferentes e texto.
  v_extrato := pg_temp.documento_vinculo('pix-saida', 'extrato', 'conta-a', 20101,
    '2026-10-10', 'PIX ENVIADO TESTE');
  v_par := pg_temp.documento_vinculo('pix-entrada', 'extrato', 'conta-b', -20101,
    '2026-10-12', 'Transferência recebida TESTE');
  assert (select count(*) = 2 from public.transactions where document_id in (v_extrato, v_par)
    and kind = 'internal_transfer' and vinculo_criterio = 'transferencia-pareada'),
    'par único ou janela de dois dias falhou';
  assert (select a.vinculo_transacao_id = b.id and b.vinculo_transacao_id = a.id
    from public.transactions a join public.transactions b on b.document_id = v_par
    where a.document_id = v_extrato), 'referência do par não é recíproca';
  v_outro := pg_temp.documento_vinculo('pix-ambigua', 'extrato', 'conta-c', -20101,
    '2026-10-11', 'PIX RECEBIDO TESTE');
  assert not exists (select 1 from public.transactions where document_id in (v_extrato, v_par, v_outro)
    and vinculo_criterio is not null), 'terceira ponta não desfez a ambiguidade';
  delete from public.documents where id = v_outro;
  assert (select kind = 'internal_transfer' from public.transactions where document_id = v_extrato),
    'excluir ambiguidade não recompôs o par';

  -- Desligar uma ponta manualmente desfaz a outra e sobrevive às importações.
  update public.transactions set kind = 'expense' where document_id = v_extrato;
  assert (select kind = 'income' and vinculo_criterio is null from public.transactions
    where document_id = v_par), 'a outra ponta ficou órfã após correção manual';
  perform pg_temp.documento_vinculo('nao-reverter-manual', 'extrato', 'conta-d', 999,
    '2026-10-10');
  assert (select kind = 'expense' and vinculo_manual and vinculo_criterio is null
    from public.transactions where document_id = v_extrato), 'importação sobrescreveu correção manual';
  update public.transactions set kind = 'internal_transfer' where document_id = v_extrato;
  assert (select vinculo_manual and vinculo_criterio is null from public.transactions
    where document_id = v_extrato), 'vínculo manual inventou contraparte';

  -- Exclusão da transação ou documento restaura a natureza anterior da outra ponta.
  v_extrato := pg_temp.documento_vinculo('excluir-saida', 'extrato', 'conta-a', 20202,
    '2026-10-10', 'TED ENVIADA TESTE');
  v_par := pg_temp.documento_vinculo('excluir-entrada', 'extrato', 'conta-b', -20202,
    '2026-10-10', 'TED RECEBIDA TESTE');
  delete from public.transactions where document_id = v_par;
  assert (select kind = 'expense' and vinculo_transacao_id is null from public.transactions
    where document_id = v_extrato), 'excluir transação deixou vínculo órfão';
  v_fatura := pg_temp.documento_vinculo('excluir-f', 'fatura', 'cartao-a', 10606, '2026-10-10');
  v_extrato := pg_temp.documento_vinculo('excluir-e', 'extrato', 'conta-a', 10606,
    '2026-10-10', 'Pagamento de fatura');
  delete from public.documents where id = v_fatura;
  assert (select kind = 'expense' and vinculo_document_id is null from public.transactions
    where document_id = v_extrato), 'excluir fatura deixou quitação órfã';

  v_extrato := pg_temp.documento_vinculo('mesma-conta-s', 'extrato', 'conta-a', 20303,
    '2026-10-10', 'PIX ENVIADO');
  perform pg_temp.documento_vinculo('mesma-conta-e', 'extrato', 'conta-a', -20303,
    '2026-10-10', 'PIX RECEBIDO');
  assert (select kind = 'expense' from public.transactions where document_id = v_extrato),
    'a mesma conta foi pareada';
  v_extrato := pg_temp.documento_vinculo('pix-distante-s', 'extrato', 'conta-a', 20404,
    '2026-10-10', 'PIX ENVIADO');
  perform pg_temp.documento_vinculo('pix-distante-e', 'extrato', 'conta-b', -20404,
    '2026-10-13', 'PIX RECEBIDO');
  assert (select kind = 'expense' from public.transactions where document_id = v_extrato),
    'transferência fora da janela';
  v_extrato := pg_temp.documento_vinculo('pix-sem-texto-s', 'extrato', 'conta-a', 20505,
    '2026-10-10', 'COMPRA TESTE');
  perform pg_temp.documento_vinculo('pix-sem-texto-e', 'extrato', 'conta-b', -20505,
    '2026-10-10', 'PIX RECEBIDO');
  assert (select kind = 'expense' from public.transactions where document_id = v_extrato),
    'compra foi pareada só por valor';

  -- Um DELETE multi-row só reconcilia depois de retirar todas as pontas.
  v_extrato := pg_temp.documento_vinculo('multi-saida-1', 'extrato', 'conta-a', 20606,
    '2026-10-10', 'PIX ENVIADO');
  v_par := pg_temp.documento_vinculo('multi-entrada-1', 'extrato', 'conta-b', -20606,
    '2026-10-10', 'PIX RECEBIDO');
  v_outro := pg_temp.documento_vinculo('multi-saida-2', 'extrato', 'conta-a', 20707,
    '2026-10-10', 'PIX ENVIADO');
  v_fatura := pg_temp.documento_vinculo('multi-entrada-2', 'extrato', 'conta-b', -20707,
    '2026-10-10', 'PIX RECEBIDO');
  delete from public.documents where id in (v_par, v_fatura);
  assert (select count(*) = 2 from public.transactions where document_id in (v_extrato, v_outro)
    and kind = 'expense' and vinculo_criterio is null), 'DELETE multi-row deixou vínculo órfão';

  v_extrato := pg_temp.documento_vinculo('conta-excluida-saida', 'extrato', 'conta-exclusao-a', 20808,
    '2026-10-10', 'PIX ENVIADO');
  v_par := pg_temp.documento_vinculo('conta-excluida-entrada', 'extrato', 'conta-exclusao-b', -20808,
    '2026-10-10', 'PIX RECEBIDO');
  delete from public.accounts where number in ('conta-exclusao-a', 'conta-exclusao-b');
  assert (select count(*) = 2 from public.transactions where document_id in (v_extrato, v_par)
    and account_id is null and vinculo_criterio is null
    and kind in ('expense', 'income')), 'DELETE multi-row de contas deixou evidência sem conta';

  -- UPDATE OF kind é intenção manual mesmo quando repete o valor atual.
  v_extrato := pg_temp.documento_vinculo('manual-mesmo-kind', 'extrato', 'conta-a', 20909,
    '2026-10-10', 'PIX ENVIADO');
  update public.transactions set kind = kind where document_id = v_extrato;
  perform pg_temp.documento_vinculo('manual-mesmo-kind-par', 'extrato', 'conta-b', -20909,
    '2026-10-10', 'PIX RECEBIDO');
  assert (select kind = 'expense' and vinculo_manual and vinculo_criterio is null
    from public.transactions where document_id = v_extrato), 'UPDATE do mesmo kind perdeu intenção manual';

  -- O GRANT da 0006 permanece: nem dono pode editar dado do PDF/evidência.
  select id into v_transacao from public.transactions where document_id = v_extrato;
  v_recusou := false;
  begin
    update public.transactions set amount_cents = 1 where id = v_transacao;
  exception when insufficient_privilege then v_recusou := true;
  end;
  assert v_recusou, 'UPDATE amount_cents indevidamente concedido';
  v_recusou := false;
  begin
    update public.transactions set vinculo_document_id = v_fatura where id = v_transacao;
  exception when insufficient_privilege then v_recusou := true;
  end;
  assert v_recusou, 'UPDATE evidência indevidamente concedido';
  v_recusou := false;
  begin
    update public.transactions set vinculo_manual = false where id = v_transacao;
  exception when insufficient_privilege then v_recusou := true;
  end;
  assert v_recusou, 'UPDATE marca manual indevidamente concedido';
  v_recusou := false;
  begin
    perform public.reconciliar_vinculos_usuario('00000000-0000-4000-8000-000000000092');
  exception when insufficient_privilege then v_recusou := true;
  end;
  assert v_recusou, 'helper DEFINER exposto como RPC';

  -- Outro usuário não enxerga, edita ou usa as pontas do primeiro.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000092"}', true);
  assert not exists (select 1 from public.transactions where id = v_transacao), 'RLS expôs transação';
  assert not exists (select 1 from public.documents where id = v_extrato), 'RLS expôs documento';
  update public.transactions set kind = 'internal_transfer' where id = v_transacao;
  v_par := pg_temp.documento_vinculo('rls-par', 'extrato', 'conta-b', -20505,
    '2026-10-10', 'PIX RECEBIDO');
  assert (select kind = 'income' and vinculo_criterio is null from public.transactions
    where document_id = v_par), 'reconciliação atravessou usuários';
  -- INSERT continua amplo desde 0001, mas valores derivados são descartados
  -- antes dos gatilhos de integridade, inclusive referências ao outro dono.
  insert into public.transactions (document_id, date, description, amount_cents,
    direction, kind, hash, vinculo_document_id, vinculo_transacao_id,
    vinculo_criterio, vinculo_kind_original, vinculo_manual)
    values (v_par, '2026-10-10', 'EVIDENCIA FORJADA', 31415, 'out', 'expense',
      'prova-evidencia-forjada', v_extrato, v_transacao, 'transferencia-pareada',
      'income', true);
  assert (select vinculo_document_id is null and vinculo_transacao_id is null
    and vinculo_criterio is null and vinculo_kind_original = 'expense' and not vinculo_manual
    from public.transactions where hash = 'prova-evidencia-forjada'),
    'INSERT permitiu forjar evidência ou natureza anterior';
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000091"}', true);
  assert (select kind = 'expense' from public.transactions where id = v_transacao),
    'outro usuário alterou a natureza';
  delete from public.documents where file_hash like 'prova-vinculo-%';
  assert not exists (select 1 from public.transactions),
    'DELETE de todos os documentos deixou transações do usuário';
end;
$$;
set constraints all immediate;
rollback;
