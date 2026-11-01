-- Estorno de fatura é a compra voltando, não renda (CONTEXT.md, "Estorno").
-- Até aqui o Bradesco e o Mercado Pago gravavam o estorno como `income`, e
-- ele inflava o gasto real e as entradas ao mesmo tempo. O frontend novo
-- grava `expense` negativo, como o Nubank sempre fez; esta migração corrige
-- o histórico.
--
-- Aplicar como proprietário das tabelas, como a 0009: o gatilho de `kind` só
-- marca escolha manual quando quem escreve é o cliente. Sem sessão de usuário
-- os gatilhos de trava e reconciliação não fazem nada, então a trava de cada
-- dono é tomada aqui. A reconciliação não precisa rodar: ela só olha
-- pagamento em extrato e transferência entre extratos, nunca linha de fatura.
--
-- Fica de fora o que pode ser escolha do usuário: `vinculo_manual`, natureza
-- original diferente de `income` e o pagamento (`PAGTO`) que alguém desligou
-- do vínculo antes da 0009.
begin;

create temporary table estornos_de_fatura on commit drop as
select t.id, t.user_id
  from public.transactions t
  join public.documents d on d.id = t.document_id
  join public.accounts a on a.id = t.account_id
 where d.doc_type = 'fatura'
   and t.kind = 'income'
   and t.vinculo_kind_original = 'income'
   and not t.vinculo_manual
   and t.amount_cents < 0
   and (
     (a.bank = 'bradesco' and t.description !~* 'PAGTO')
     or (a.bank = 'mercadopago' and t.description ~* 'estorno')
   );

select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u.user_id::text, 0))
  from (select distinct user_id from estornos_de_fatura order by user_id) u;

update public.transactions t
   set kind = 'expense', vinculo_kind_original = 'expense'
  from estornos_de_fatura e
 where t.id = e.id;

commit;
