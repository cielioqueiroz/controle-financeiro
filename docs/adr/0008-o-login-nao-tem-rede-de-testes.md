# O login não tem rede de testes, e é isso que decide upgrades do SDK

A suíte mocka o `@neondatabase/neon-js` inteiro. Nenhum teste deste repositório
exercita autenticação de verdade: uma regressão de login passa verde do começo
ao fim, e só o usuário, entrando com conta real, descobre. Essa é a restrição
durável — o resto deste documento é a consequência dela.

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
