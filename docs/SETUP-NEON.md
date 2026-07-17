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
- Schema em [`neon/migrations/0001_schema_inicial.sql`](../neon/migrations/0001_schema_inicial.sql)
  aplicado na produção, com RLS + 2 policies por tabela.
- Código usando `@neondatabase/neon-js` (cliente único: auth + queries).

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
- **Google** (opcional): exige credenciais OAuth criadas no seu Google
  Cloud Console (Client ID + Secret) e coladas na config do provider
  Google. Sem isso, o botão "Continuar com o Google" aparece mas não
  completa. O e-mail/senha funciona sozinho.

## Cold start (free tier)

A branch de produção do Neon hiberna quando ociosa (*scale-to-zero*). A
primeira query/login depois de um tempo parado leva ~0,5–2s. É esperado
no plano grátis; as seguintes são rápidas.

## O Supabase

A migração não apagou nada do Supabase. A pasta
[`supabase/`](../supabase/) permanece como histórico. Quando quiser, pode
remover o projeto Supabase e a dependência — o app não usa mais.
