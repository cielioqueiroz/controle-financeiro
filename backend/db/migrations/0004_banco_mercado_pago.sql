-- 0004 — o Mercado Pago entra no catálogo de bancos.
--
-- Precisa vir ANTES do primeiro documento do Mercado Pago ser importado: sem
-- ela o insert em `accounts` bate no CHECK e a importação falha inteira, com
-- uma mensagem de Postgres que não diz ao usuário o que aconteceu.
--
-- Aplicar na branch `production` do Neon (SQL Editor). É idempotente: pode
-- rodar duas vezes sem estrago.
--
-- ⚠️ Esta migração NÃO ensina o app a ler o PDF. Ela só permite guardar o
-- resultado. O parser e a assinatura do detector dependem de uma amostra com
-- camada de texto — ver `domain/pdf/detect.ts`.

alter table public.accounts drop constraint if exists accounts_bank_check;
alter table public.accounts add constraint accounts_bank_check
  check (bank in ('nubank','bradesco','bb','sicredi','sicoob','mercadopago','desconhecido'));
