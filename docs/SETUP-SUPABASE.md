# Ligar a persistência (Supabase)

O app **funciona sem isto** — você importa o PDF e vê tudo na hora. Este
passo liga o que fica *salvo*: login, e a possibilidade de puxar seus
dados depois por dia, semana, mês e ano.

Você só precisa fazer isto **uma vez**.

---

## Por que preciso fazer parte disto

Duas coisas exigem a sua conta e não dá para eu fazer sozinho:

1. **Criar o projeto Supabase** — sua conta atingiu o limite de 2 projetos
   ativos no plano grátis (`praca-araguaia` e `gabarito-app`). Você
   decide: pausar um que não usa, ou criar este mesmo assim.
2. **Login com Google** — exige credenciais criadas na sua conta do
   Google. O passo 4 abaixo.

O e-mail/senha funciona sem o Google.

---

## 1. Liberar um slot e criar o projeto

1. Entre em <https://supabase.com/dashboard>.
2. Se aparecer erro de limite: abra um projeto que você não usa mais
   (ex.: `task-manager`) → Settings → General → **Pause project**. Pausar
   não apaga nada; dá para reativar depois.
3. **New project** → nome `controle-financeiro`, região `South America
   (São Paulo)`, defina uma senha de banco e crie. Leva ~2 minutos.

## 2. Aplicar o schema (as tabelas)

1. No projeto, abra **SQL Editor** → **New query**.
2. Cole todo o conteúdo de [`supabase/migrations/0001_schema_inicial.sql`](../supabase/migrations/0001_schema_inicial.sql).
3. **Run**. Cria as tabelas (contas, documentos, transações, categorias,
   regras) já com Row Level Security ligado — cada usuário só enxerga o
   que é dele.

## 3. Colar as chaves no app

1. No projeto: **Project Settings → API**.
2. Copie **Project URL** e a chave **anon public**.
3. Na pasta do projeto, copie `.env.example` para `.env` e preencha:

   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
   ```

4. Reinicie o `npm run dev`. Pronto — a tela de login aparece.

> A chave `anon` é pública por natureza; é o RLS que protege os dados.
> Nunca coloque a chave `service_role` no front.

## 4. (Opcional) Login com Google

1. No **Google Cloud Console** (<https://console.cloud.google.com>) crie
   um projeto, vá em **APIs & Services → Credentials → Create OAuth client
   ID** (tipo *Web application*).
2. Em **Authorized redirect URIs**, cole a URL que o Supabase mostra em
   **Authentication → Providers → Google** (algo como
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`).
3. Copie o **Client ID** e o **Client Secret** gerados.
4. No Supabase, **Authentication → Providers → Google** → cole os dois e
   ative.

Sem este passo, o botão "Continuar com o Google" aparece mas não funciona.
O e-mail/senha funciona normalmente.

## 5. (Opcional) Confirmação de e-mail

Por padrão o Supabase já exige confirmação por e-mail no cadastro — é o
que a spec pede. Para conferir: **Authentication → Providers → Email** →
*Confirm email* ligado.
