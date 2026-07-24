-- 0002 — saldo do extrato + bancos novos no CHECK de accounts
--
-- ⚠️ Aplicação é passo MANUAL e gated: rodar primeiro numa BRANCH do Neon,
--    conferir com `\d public.accounts` e `\d public.documents`, e só então
--    promover/aplicar em produção. Nada no código quebra antes disso — a
--    leitura degrada para "sem saldo" enquanto a coluna não existir.

-- (a) Saldo final do extrato, como fato do documento. Nulável: fatura não tem.
alter table public.documents
  add column if not exists end_balance_cents bigint;

-- (b) Conserto de bug latente: o CHECK de accounts.bank foi criado em 0001 só
--     com ('nubank','bradesco','desconhecido'). O app já lê e tenta SALVAR BB,
--     Sicredi e Sicoob — um insert de conta desses bancos VIOLA o constraint
--     hoje. Relaxar para os 5 bancos suportados.
--
--     Confirme o nome real do constraint antes de aplicar (o padrão do Postgres
--     para check de coluna inline é `<tabela>_<coluna>_check`):
--       select conname from pg_constraint
--       where conrelid = 'public.accounts'::regclass and contype = 'c';
alter table public.accounts drop constraint if exists accounts_bank_check;
alter table public.accounts add constraint accounts_bank_check
  check (bank in ('nubank','bradesco','bb','sicredi','sicoob','desconhecido'));
