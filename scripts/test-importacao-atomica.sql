-- Somente em branch Neon de teste, depois da migração 0008.
-- Identidades e conteúdo sintéticos. ROLLBACK preserva a branch.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001"}', true);

do $$
declare
  conta jsonb := '{"bank":"nubank","type":"credit_card","last4":"t001"}';
  documento jsonb := '{"file_hash":"teste-atomico-1","content_hash":"teste-conteudo-1","doc_type":"fatura","declared_total":100,"conferencia":{"versao":1,"status":"confere","contagem":1,"comparacoes":[{"criterio":"total-fatura","gabaritoCents":100,"extraidoCents":100,"diferencaCents":0}]}}';
  transacoes jsonb := '[{"date":"2026-10-01","description":"TESTE SINTETICO","amount_cents":100,"direction":"out","kind":"expense","hash":"teste-tx-1"}]';
  resposta jsonb;
  falhou boolean := false;
begin
  -- A falha ocorre depois dos inserts de conta/documento, na última tabela.
  begin
    perform public.salvar_documento_atomico(conta, documento,
      jsonb_set(transacoes, '{0,kind}', '"invalido"'));
  exception when check_violation then
    falhou := true;
  end;
  assert falhou, 'a transação inválida deveria falhar';
  assert not exists (select 1 from public.documents where file_hash='teste-atomico-1'), 'documento parcial';
  assert not exists (select 1 from public.accounts where last4='t001'), 'conta parcial';

  resposta := public.salvar_documento_atomico(conta, documento, transacoes);
  assert resposta ->> 'status' = 'salvo', 'nova tentativa não salvou';
  assert (resposta ->> 'inseridas')::integer = 1, 'contagem inserida incorreta';
  assert exists (select 1 from public.documents where id=(resposta ->> 'documentId')::uuid
    and conferencia = documento -> 'conferencia'), 'snapshot não foi preservado';

  resposta := public.salvar_documento_atomico(conta, documento, transacoes);
  assert resposta ->> 'status' = 'documento-duplicado', 'retry duplicou';
  assert (select count(*) from public.accounts where last4='t001') = 1, 'conta duplicada';

  documento := jsonb_set(jsonb_set(documento, '{file_hash}', '"teste-atomico-2"'),
    '{content_hash}', '"teste-conteudo-2"');
  resposta := public.salvar_documento_atomico(conta, documento, transacoes);
  assert (resposta ->> 'inseridas')::integer = 0, 'sobreposição duplicou transação';
  assert (resposta ->> 'jaExistiam')::integer = 1, 'sobreposição não reconhecida';
  assert (select count(*) from public.transactions where hash='teste-tx-1') = 1, 'hash duplicado';

  -- IDs fornecidos pelo cliente não podem escolher o dono ou a relação.
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002"}', true);
  assert not exists (select 1 from public.documents where file_hash='teste-atomico-1'), 'RLS expôs documento';
  resposta := public.salvar_documento_atomico(conta || '{"user_id":"00000000-0000-4000-8000-000000000001"}',
    documento || '{"user_id":"00000000-0000-4000-8000-000000000001"}',
    jsonb_set(transacoes, '{0,document_id}', '"00000000-0000-4000-8000-000000000001"'));
  assert resposta ->> 'status' = 'salvo', 'deduplicação atravessou usuários';
  assert (select user_id from public.documents where id=(resposta ->> 'documentId')::uuid)
    = '00000000-0000-4000-8000-000000000002'::uuid, 'usuário do payload foi usado';
  assert exists (select 1 from public.transactions
    where document_id=(resposta ->> 'documentId')::uuid), 'document_id do payload foi usado';
end;
$$;
rollback;
