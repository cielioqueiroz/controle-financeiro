-- 0006 — o banco passa a impor a promessa do produto, e para de guardar o
-- que ninguém lê.
--
-- Duas mudanças independentes, na mesma migração porque são a mesma ideia:
-- reduzir o que o banco aceita e o que o banco retém.
--
-- ---------------------------------------------------------------------
-- 1. GRANT por coluna: "todo número veio de um documento" vira regra
-- ---------------------------------------------------------------------
--
-- O `EdicaoTransacao` de `persist/editar.ts` já limitava a edição a três
-- campos — mas é tipo do TypeScript, e tipo não existe em runtime. O GRANT
-- era de tabela inteira, então o próprio dono, com o próprio JWT e uma
-- requisição fora do app, escrevia `amount_cents`, `date`, `description` ou
-- `hash`. O RLS não impede: a linha é dele.
--
-- Não é vazamento entre contas — é o usuário podendo mentir para si mesmo.
-- Mas fura a frase de abertura do README, e a frase é o produto.
--
-- `label`     — o apelido que o usuário escreve por cima da descrição.
-- `category_slug` — a correção de categoria, que alimenta o aprendizado.
-- `kind`      — ligar/desligar o vínculo à mão (ver `kindComVinculo`).
--
-- INSERT continua de tabela inteira: quem insere é a importação, e ela
-- precisa escrever todas as colunas. O que a importação escreve vem do
-- parser, que veio do PDF — que é justamente a promessa.
revoke update on public.transactions from authenticated;
grant update (label, category_slug, kind) on public.transactions to authenticated;

-- ---------------------------------------------------------------------
-- 2. Minimização: três colunas escritas e jamais lidas
-- ---------------------------------------------------------------------
--
-- Conferido em 2026-09-06, na branch production:
--
--   transactions.raw              preenchida em 360 de 360 · lida por ninguém
--   accounts.holder_name          preenchida em   6 de   7 · lida por ninguém
--   transactions.counterparty_doc preenchida em   0 de 360 · lida por ninguém
--
-- `raw` guardava a linha crua do extrato — o texto livre mais sensível do
-- documento — em toda transação. `holder_name`, o nome completo do titular.
-- Nenhuma das duas aparece em um único `select` do app: o vínculo usa
-- `result.account.holderName` em memória, vindo do parse, nunca a coluna.
-- Auditar contra o PDF se faz pela `description`, que é imutável e continua.
--
-- Guardar dado sensível sem consumidor é risco sem contrapartida — e é por
-- isso que a resposta certa aqui foi minimizar, não criptografar: cifrar a
-- descrição mataria a busca, o ranking por estabelecimento e a
-- categorização, que são o produto.
--
-- `persist/salvar.ts` parou de ESCREVER as três na mesma rodada. Esta
-- migração apaga o que já estava gravado.

-- Coluna morta: nunca foi escrita por nenhuma versão do app.
alter table public.transactions drop column if exists counterparty_doc;

-- Estas duas existem e têm dado. Apagamos o conteúdo e mantemos a coluna:
-- dropar exigiria conferir todo `select('...')` do repositório, e o ganho
-- sobre `= null` é nenhum — o dado sai do banco de qualquer forma.
update public.transactions set raw = null where raw is not null;
update public.accounts set holder_name = null where holder_name is not null;
