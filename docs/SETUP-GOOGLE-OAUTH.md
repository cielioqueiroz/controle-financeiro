# Google OAuth próprio

Preparação em 18/10/2026. Nenhuma credencial foi criada, nenhum provider foi
alterado e nenhum login real foi executado nesta rodada. A auditoria histórica
de 08/09 registrou Google com credenciais compartilhadas; isso não confirma a
configuração atual do console.

## O contrato do app

`frontend/src/ui/acesso/Auth.tsx` chama
`neon.auth.signIn.social({ provider: 'google', callbackURL: window.location.origin })`.
`frontend/src/lib/neon.ts` configura o cliente com `VITE_NEON_AUTH_URL`.

Existem dois retornos distintos:

| Campo | Valor a conferir |
|---|---|
| `callbackURL` do app | Origem da tela; em produção, `https://capital-financeiro.vercel.app` |
| Redirect URI autorizado no Google | Callback do Auth da branch, copiado do diálogo do provider no Neon |

O segredo fica no provider hospedado, nunca em `VITE_*`, código, captura de tela
ou documento versionado. O app não precisa de uma nova variável de ambiente
para Client Secret.

## Procedimento a executar com o titular

1. Selecionar projeto e branch corretos no Neon e registrar a identificação do
   ambiente. Abrir o Google em **Settings → Auth → OAuth providers**; copiar o
   callback exato do diálogo. O formato documentado é a URL base do Auth da
   branch seguida de `/callback/google`; preservar o caminho e evitar barra
   duplicada. A página inicial do app não é esse callback.
2. No Google Cloud, selecionar o projeto do titular e criar um cliente OAuth do
   tipo **Web application**. Registrar em **Authorized redirect URIs** o valor
   copiado. O Google exige correspondência exata, inclusive esquema e barra
   final. [Contrato do Google](https://developers.google.com/identity/protocols/oauth2/web-server).
3. Preparar nome Capital Financeiro, suporte e contato em **Google Auth Platform
   → Branding**. Conferir público em **Audience** e usuários de teste enquanto
   o app estiver em teste. [Identidade do consentimento](https://developers.google.com/identity/openid-connect/openid-connect).
4. Conferir a origem de produção na lista de domínios confiáveis do Auth.
   Guardar Client ID e Secret no provider selecionado. Ensaiar primeiro com
   branch e conta de teste; só aplicar a produção em uma mudança explicitamente
   autorizada. [Procedimento do Neon](https://neon.com/docs/auth/guides/setup-oauth),
   [domínios confiáveis](https://neon.com/docs/auth/guides/configure-domains).

As instruções do Neon consultadas em 18/10/2026 confirmam que Google oferece
credenciais compartilhadas para desenvolvimento e recomendam próprias em
produção. A interface do provider deve ser conferida novamente no momento da
execução.

## Evidência de aceite

- Abrir o site em navegador normal, em janela anônima, e escolher Google.
- Conferir identidade e permissões apresentadas; autorizar com a conta de teste.
- Voltar ao Painel, recarregar e conferir a mesma conta. Sair e recarregar:
  a sessão não deve voltar.
- Registrar ambiente, data, resultado e identidade visual observada em
  `docs/validacoes/`, sem códigos, tokens ou segredos. Não presumir que apenas
  cadastrar credenciais garante o nome exibido pelo Google.

`INVALID_CALLBACKURL` aponta para a origem de retorno permitida pelo Auth;
`redirect_uri_mismatch` pede conferir o callback registrado no Google. A troca
de provider é configuração externa e permanece pendente até este ensaio.
