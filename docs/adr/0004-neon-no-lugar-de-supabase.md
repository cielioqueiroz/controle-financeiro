# Neon (Data API + Neon Auth) no lugar de Supabase

O banco é **Neon**, com a Data API (PostgREST) e o Neon Auth (Better Auth),
migrado do Supabase em 2026-07-17. Não há backend próprio: o navegador fala direto
com a Data API, e o **RLS no banco é a fronteira de segurança** — cada usuário só
enxerga as próprias linhas porque a política diz isso, não porque uma camada de
aplicação filtra.

## Consequences

- **O motivo de sair do Supabase não está registrado em lugar nenhum do
  repositório.** Quem for reavaliar a escolha começa sem o argumento original —
  registre-o aqui se reaparecer.
- **RLS é o único guarda.** As duas URLs em `VITE_*` são públicas por projeto; a
  proteção inteira é a policy `(select auth.user_id())::uuid = user_id` mais o JWT.
  Toda tabela nova nasce com RLS ligado ou vaza.
- **O SDK é beta e molda o código.** `@neondatabase/neon-js` não expõe `upsert`
  confiável, então `persist/salvar.ts` faz busca-ou-cria de conta e insere só os
  hashes inéditos, à mão.
- Documentos do repositório ainda descrevem a stack antiga:
  `docs/prompt-dashboard-financeiro.md` foi escrito para Next.js + Supabase +
  Recharts e é **spec de produto**, não descrição da implementação.
- A branch de produção hiberna (scale-to-zero): a primeira query depois de ociosa
  leva ~0,5–2s. É o plano grátis, não regressão.
