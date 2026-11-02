# ADR-0023 — Preferências em tabela própria, com o aparelho de cache

Data: 2026-11-02. Status: em produção desde o #57; migração 0013
aplicada em 2026-11-02 (o cache de schema da Data API precisa ser recarregado
pelo console para a tabela ficar visível — ver AGENTS.md §4.3).

## Contexto

O dono pediu um perfil "mais completo". O apelido, o idioma, o tema, o modo
discreto e o período morariam todos no `localStorage`, então cada aparelho
tinha os seus: quem trocava o apelido no celular continuava sendo chamado pelo
nome antigo no desktop.

O lugar natural seria o próprio usuário do Neon Auth (better-auth), com campos
extras. **Não dá**: `neon_auth.user` tem `name` e `image` e nenhum campo livre
(conferido em 2026-11-02), e o Auth é gerenciado pelo Neon (`owned_by: neon`)
— não temos como declarar `additionalFields` no servidor. Guardar JSON no
`image` funcionaria e seria mentir sobre o que a coluna é.

## Decisão

- **Tabela `preferencias`** (migração 0013), uma linha por pessoa, chave
  `user_id` vinda do JWT, RLS como toda tabela daqui e `revoke` explícito do
  que os DEFAULT PRIVILEGES dão a mais. Coluna nula = "não escolheu".
- **O servidor é a verdade; o aparelho é cache.** O tema e o modo discreto
  precisam valer antes da primeira pintura, e o servidor só responde depois
  dela — por isso as chaves antigas do `localStorage` continuam sendo lidas
  primeiro, inclusive pelo script inline do `index.html`.
- **No login, o servidor vence.** A única exceção é a primeira conversa de um
  aparelho com ele: aí o aparelho preenche o que o servidor não sabe e sobe —
  é como as escolhas de antes da 0013 migram sozinhas. Depois disso, nulo no
  servidor é escolha: o apelido apagado no celular não volta do cache do
  desktop.
- **Quem leva para a conta é um observador no `App`** (`SincronizarPreferencias`),
  que vigia idioma, tema e discreto venham de onde vierem. Os botões do
  cabeçalho não sabem que a sincronização existe. Nada sobe antes de a
  sincronização do login terminar.
- **Sem a migração, o app funciona como antes**: lê e grava no aparelho, e o
  perfil diz "salvo só neste aparelho".
- **Sem "Sistema" no tema.** A regra de 2026-09-04 ("escolha salva > escuro,
  o sistema não opina") continua; o perfil só passa a reunir a escolha.

## Excluir conta

Os dados saem pela Data API, tabela por tabela, documentos primeiro. Só
depois se tenta `deleteUser`. O better-auth só abre essa rota com
`user.deleteUser.enabled`, e não sabemos se o Neon gerenciado a liga. Quando
ela recusa, a tela diz que os dados foram apagados e o login continua. A
ordem é deliberada: apagar o login antes deixaria linhas no banco que mais
ninguém poderia apagar.

**O Neon liga o `deleteUser`.** No §7 do roteiro manual, em 2026-11-02, o
dono viu "Conta e dados excluídos". O banco confirma: nenhuma conta, sessão
ou linha órfã daquele teste sobrou — a conta de teste saiu inteira. O ramo
"o login continua" fica no código para o dia em que o servidor mudar.

## Limites

- A suíte mocka o SDK do Neon (ADR-0008): trocar senha, `listAccounts` e
  `deleteUser` contra o servidor real ficam no roteiro manual.
- Duas abas trocando preferências ao mesmo tempo: vence a última a gravar,
  sem aviso. Para preferência de exibição, aceitável.
