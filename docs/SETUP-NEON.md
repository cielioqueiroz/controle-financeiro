# Banco e login (Neon)

O app **funciona sem isto** — importa o PDF e vê tudo na hora. Este passo
liga o que fica *salvo*: login e a possibilidade de puxar seus dados
depois por dia/semana/mês/ano.

Migrado de Supabase para **Neon** (Data API + Neon Auth/Better Auth) em
2026-07. Sem backend próprio: o navegador fala com a Data API, e o **RLS
no banco** é a fronteira de segurança (cada usuário só vê o que é dele).

---

## O que já está feito

- Projeto Neon `controle-financeiro` (região São Paulo), Data API e Neon
  Auth ativos.
- Schema e migrações até `0011` em [`backend/db/migrations/`](../backend/db/migrations/)
  aplicados na produção, com RLS + policies por tabela.
- Código usando `@neondatabase/neon-js` (cliente único: auth + queries).

As migrações 0009–0011 desta branch foram aplicadas e ensaiadas pela Data API
real na branch descartável codex-integridade-20261016 em 20/10/2026.
Evidências e validador em [vínculos, regras e parsers no Neon](./validacoes/2026-10-20-vinculos-regras-neon.md).
Após autorização no chat, foram aplicadas e conferidas em produção em 20/10,
antes do frontend do PR #38. [Aplicação e recuperação](./validacoes/2026-10-20-producao-vinculos-regras.md).
O [roteiro manual](./VALIDACAO-MANUAL.md) permite repetir a prova enquanto a
branch de teste existir.

## Configurar o app (uma vez)

1. Copie `.env.example` para `.env.local` e preencha com os valores do
   Console do Neon:
   - `VITE_NEON_DATA_API_URL` — Console → **Data API** → API URL.
   - `VITE_NEON_AUTH_URL` — Console → **Auth** → Configuration (ou o
     quickstart). Termina em `/auth`.
   Ambos são **públicos** por design; a proteção é o RLS + o JWT. Nunca
   coloque a *connection string* do Postgres (com senha) aqui.
2. `.env.local` já está no `.gitignore`.
3. Reinicie o `npm run dev`. A tela de login aparece.

## Habilitar os métodos de login

No Console do Neon → **Auth → Configuration**, confirme que estão
ligados:

- **E-mail/senha** (o app usa `signIn.email` / `signUp.email`).
- **Google** (opcional): o Neon oferece credenciais compartilhadas para
  desenvolvimento; a auditoria de 08/09/2026 registrou esse modo no projeto.
  Para produção, preparar credenciais próprias no Google Cloud e configurá-las
  no provider da branch. O procedimento e a distinção entre os dois retornos
  estão em [SETUP-GOOGLE-OAUTH.md](./SETUP-GOOGLE-OAUTH.md), com fontes oficiais.
  A configuração atual do console precisa ser conferida antes de alterá-la.

A confirmação de e-mail implementada usa **código de seis dígitos**, solicitado
pelo cliente após o cadastro. O ensaio de entrega e confirmação está em
[VALIDACAO-MANUAL.md, §2](./VALIDACAO-MANUAL.md#2--criar-conta-e-receber-o-e-mail).

## Cold start (free tier)

A branch de produção do Neon hiberna quando ociosa (*scale-to-zero*). A
primeira query/login depois de um tempo parado leva ~0,5–2s. É esperado
no plano grátis; as seguintes são rápidas.

## O Supabase

A pasta `supabase/` e a dependência **já não existem** no repositório: a pasta
saiu em `ea34040` (2026-07-18), no mesmo dia em que este documento dizia que ela
ficaria como histórico. O que resta é o projeto Supabase na conta, se ainda
estiver de pé — pode ser removido, o app não usa mais. **A troca foi por cota**: o
plano grátis do Supabase dá dois projetos ativos, e a conta já tinha mais de cinco.
O registro completo está em
[`docs/adr/0004-neon-no-lugar-de-supabase.md`](./adr/0004-neon-no-lugar-de-supabase.md).
