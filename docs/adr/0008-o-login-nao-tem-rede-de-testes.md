# O login não tem rede de testes, e é isso que decide upgrades do SDK

A suíte mocka o `@neondatabase/neon-js` inteiro. Nenhum teste deste repositório
exercita autenticação de verdade: uma regressão de login passa verde do começo
ao fim, e só o usuário, entrando com conta real, descobre. Essa é a restrição
durável — o resto deste documento é a consequência dela.

> **Atualização 2026-09-08 — parte da rede passou a existir.** O
> `scripts/medir-login.py` sobe um **Auth de mentira** em `127.0.0.1:4599`,
> serve o `dist` no mesmo endereço e dirige a tela num Chromium. O SDK de
> verdade roda — com o `better-auth` e o `zod` que ele arrasta —, e são cinco
> cenários: sem sessão, login aceito, login recusado, sessão já existente e
> sair. Cada um foi provado nos dois sentidos por mutação no app.
>
> **A frase de abertura desta ADR deixou de ser verdade inteira**: uma
> regressão de login não passa mais verde do começo ao fim. Mas o que ela
> decide **continua valendo**, porque o que o medidor cobre é o app fazendo a
> sua parte, e não o servidor fazendo a dele. Ficam de fora, e ainda pedem o
> roteiro manual: o Neon de verdade (formato de resposta que mude do lado
> deles), a entrega de e-mail, o OAuth do Google e o RLS. O desbloqueio
> completo continua sendo o que está escrito abaixo — conta de teste
> versionável ou integração real.
>
> ⚠️ **O medidor mede o `dist`, não o código.** Descoberto medindo: uma
> mutação que não compilava deixou o build falhar, e os cinco cenários
> passaram verdes contra o `dist` anterior. É a mesma armadilha do
> `medir-csp.py`. Rode `npm run build:login` **e confira que ele passou**
> antes de acreditar no verde.

> **Histórico.** Até 2026-08-28 esta ADR se chamava *"O SDK do Neon não é
> atualizado, apesar das falhas abertas"* e recusava o salto de
> `0.6.2-beta` → `0.7.0-beta`, porque trocar a biblioteca de autenticação de um
> app no ar sem poder verificar era pior que a falha que se consertava. O
> upgrade **foi feito** no commit `8a4130f` e o app continuou de pé; em
> 2026-08-31 `npm audit` acusa **zero** falhas. A recusa acabou — a razão dela,
> não.

## Consequences

- **Upgrade do SDK é ato manual, com o usuário presente.** Não existe verde que
  o autorize; existe alguém entrando na conta depois. O roteiro está em
  [`docs/VALIDACAO-MANUAL.md`](../VALIDACAO-MANUAL.md), que é o que substitui o
  teste que não há.
- **`npm audit` limpo é o estado normal de novo.** De 2026-08-13 a 2026-08-28 o
  vermelho era decisão registrada; hoje não é. Vermelho voltou a significar
  descuido, e o commit `8a4130f` mais o descarte do `@vercel/node`
  ([ADR-0011](./0011-backend-serverless-descartado.md)) zeraram os dois motivos
  que existiam.
- **O desbloqueio real continua sendo uma conta de teste versionável**, ou um
  teste de integração que fale com o Neon de verdade. Enquanto não houver,
  qualquer mexida em autenticação — SDK, provedor OAuth, fluxo de senha — cai no
  roteiro manual.
