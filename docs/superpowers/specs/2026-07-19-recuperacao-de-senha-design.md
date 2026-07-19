# Recuperação de senha — design

> Spec da rodada de **2026-07-19**. Item 1 da fila em `docs/ESTADO-ATUAL.md`.
> Pedida em 2026-07-18, com os endpoints já sondados contra o servidor real.

## Problema

A tela de acesso não oferece saída para quem esqueceu a senha. Hoje o usuário
fica trancado do lado de fora, sem caminho dentro do app.

## O que já sabemos (sondagem de 2026-07-18)

Não é preciso servidor nosso: o Neon Auth (Better Auth) tem os endpoints e o
próprio Neon envia o e-mail (*Email provider: Shared*, `auth@mail.myneon.app`).
O cliente `neon-js` **não** expõe esses métodos, então são chamadas HTTP diretas
ao `VITE_NEON_AUTH_URL`.

| Endpoint | Resultado da sondagem |
|---|---|
| `POST /forget-password` | **404** — não existe, não usar |
| `POST /request-password-reset` | **200** `{"status":true,"message":"If this email exists…"}` |
| `POST /reset-password` | **400** `[body.newPassword] expected string` — existe, exige `newPassword` + `token` |

## Decisões tomadas

1. **Tudo dentro do card do `Auth`.** O card ganha estados além de
   `entrar`/`criar`. Sem router — o projeto não tem um, e o `App.tsx` já escolhe
   a tela por estado.
2. **Login automático após o reset, quando possível.** O usuário acabou de
   digitar a senha duas vezes; pedir uma terceira é atrito puro. Ver a ressalva
   do e-mail no passo 2 do fluxo — nem sempre dá.
3. **Confirmação de senha (dois campos)**, com o `IconeOlho` já existente. Erro
   de digitação nesta etapa tranca o usuário para fora.
4. **Token na URL vence sessão ativa.** Quem clica no link do e-mail quer
   redefinir, mesmo que já esteja logado.
5. **Arquitetura A**: componente próprio + módulo HTTP, seguindo o padrão que o
   projeto já adotou ao extrair `auth-validacao.ts`.

## Arquitetura

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `src/lib/recuperar-senha.ts` | `pedirLink(email, redirectTo)` e `redefinirSenha(token, novaSenha)`. Dois `fetch` contra `VITE_NEON_AUTH_URL`; traduz status HTTP em resultado tipado. Sem React. | `fetch`, env |
| `src/lib/url-token.ts` | `lerTokenDaUrl(search)` — pura, extrai o token da query string. | nada |
| `src/ui/auth-validacao.ts` (existente) | ganha `validarNovaSenha(senha, confirmacao)` — pura, devolve a mensagem de erro ou `null`. | nada |
| `src/ui/RecuperarSenha.tsx` | Os dois passos (pedir e-mail / definir nova senha), renderizados dentro do card. | as três acima, `sonner` |
| `src/ui/Auth.tsx` | Link "Esqueceu a senha?" e o `modo` estendido. | `RecuperarSenha` |
| `src/App.tsx` | Um `if`: token na URL → renderiza `Auth` em modo redefinir, mesmo logado. | `lerTokenDaUrl` |

`recuperar-senha.ts` não sabe que React existe. `RecuperarSenha.tsx` não sabe o
formato do payload HTTP. Trocar o backend de autenticação mexe em um arquivo só.

## Fluxo

### Passo 1 — pedir o link

1. Link "Esqueceu a senha?" no card → campo de e-mail.
2. `POST /request-password-reset` com `{ email, redirectTo: window.location.origin + '/' }`.
3. O `redirectTo` **precisa estar nos Domains do Neon Auth**. Produção já está;
   `Allow Localhost` cobre o desenvolvimento.
4. O servidor sempre responde 200 com *"If this email exists…"*, por design —
   não revela se a conta existe. **A UI não pode afirmar que o e-mail foi
   enviado.** Mensagem: *"Se houver conta com esse e-mail, o link já está a
   caminho. Confira também o spam."*

### Passo 2 — redefinir

1. O Neon envia o e-mail com o link contendo o token.
2. `App` detecta o token na URL e mostra o formulário de nova senha.
3. `POST /reset-password` com `{ token, newPassword }`.
4. Em caso de sucesso, **tentar** `neon.auth.signIn.email` → dashboard.
5. **Limpar o token da URL** com `history.replaceState`. Sem isso, um F5 tenta
   reusar um token já gasto e o usuário vê um erro que não é culpa dele.

**Ressalva do e-mail — o app nem sempre o conhece.** O link traz só o token; o
`POST /reset-password` não devolve o e-mail. Sem e-mail não há `signIn.email`.

Solução: ao pedir o link (passo 1), guardar o e-mail em `localStorage`
(`capital:email-reset`). Quem abre o link **no mesmo navegador** entra
automaticamente; quem abre em outro aparelho cai no login com a senha já
trocada e um toast explicando. O `localStorage` é limpo assim que o reset
conclui, com ou sem login automático.

Isso é preferência local, no mesmo espírito do apelido em `lib/perfil.ts` — e é
só um e-mail, num navegador onde o usuário já se autentica.

## Erros

| Situação | O que o usuário vê |
|---|---|
| E-mail em branco ou inválido | mesma validação e mesmo foco do login atual |
| Senhas divergentes | *"As senhas não coincidem."* |
| Senha com menos de 8 caracteres | reaproveita o aviso existente |
| Token expirado ou inválido (400) | *"Este link expirou ou já foi usado."* + botão **Pedir um novo link** |
| Falha de rede | *"Não consegui falar com o servidor. Tente de novo."* |
| Reset OK, e-mail conhecido, mas login automático falha | toast de sucesso + volta ao login com o e-mail preenchido |
| Reset OK, e-mail desconhecido (link aberto em outro aparelho) | *"Senha alterada. Entre com a senha nova."* + card no modo entrar |

## Testes

Puros e offline, sem navegador:

- `validarNovaSenha` — vazia, curta, divergente, válida.
- `lerTokenDaUrl` — com token, sem token, query vazia, valor vazio.
- `recuperar-senha.ts` com `fetch` mockado — 200, 400, e `fetch` que rejeita.
- guarda e limpeza do e-mail em `localStorage`, incluindo o caso em que ele não
  existe (link aberto em outro aparelho).

Um teste de componente no estilo do `Auth.test.tsx`: o link troca o modo do card,
e o botão de envio é `type="submit"`.

## Verificação que precede o código

O nome do parâmetro na URL (`?token=`) **nunca foi confirmado com um e-mail
real** — é apenas o padrão do Better Auth. O plano começa disparando um
`request-password-reset` de verdade para a conta de teste e lendo o link
recebido, **antes** de escrever a UI. Se vier como fragmento (`#token=`) ou com
outro nome, `lerTokenDaUrl` muda de forma.

## Fora de escopo

- Recuperação para contas criadas via Google (não têm senha).
- Personalizar o template do e-mail enviado pelo Neon.
- Rate limiting próprio — o Neon já limita do lado dele.
