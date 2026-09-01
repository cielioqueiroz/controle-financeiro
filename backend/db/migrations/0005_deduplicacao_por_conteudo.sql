-- 0005 — a identidade do Documento não depende do PDF bruto.
-- O PDF pode ser exportado novamente com metadados/IDs internos diferentes.
alter table public.documents add column if not exists content_hash text;
create unique index if not exists documents_conteudo_unico
  on public.documents (user_id, content_hash)
  where content_hash is not null;
