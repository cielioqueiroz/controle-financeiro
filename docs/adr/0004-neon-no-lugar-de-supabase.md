# Neon (Data API + Neon Auth) no lugar de Supabase

O banco é **Neon**, com a Data API (PostgREST) e o Neon Auth (Better Auth),
migrado do Supabase em 2026-07-17. Não há backend próprio: o navegador fala direto
com a Data API, e o **RLS no banco é a fronteira de segurança** — cada usuário só
enxerga as próprias linhas porque a política diz isso, não porque uma camada de
aplicação filtra.

**O motivo da troca foi cota, não mérito técnico.** O plano grátis do Supabase
permite **dois projetos ativos**, e a conta do autor já tinha mais de cinco: dois
funcionando e o resto pausado. Criar o banco deste app exigiria pausar um dos dois
que estavam de pé. O Neon entrou porque tinha vaga.

## Considered Options

- **Pausar um dos projetos ativos do Supabase** para abrir a vaga. Recusada: os
  dois em uso continuam em uso, e derrubar um deles para acomodar este seria
  trocar um problema por outro.
- **Plano pago do Supabase.** Recusada por custo, para um app de uso pessoal com
  ~6 usuários.

## Consequences

- **A escolha nunca foi comparação técnica entre os dois.** Quem for reavaliar não
  deve presumir que Neon venceu num confronto de recursos — ele venceu uma
  restrição de conta grátis. Se a cota deixar de importar, a comparação ainda está
  por fazer.
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
