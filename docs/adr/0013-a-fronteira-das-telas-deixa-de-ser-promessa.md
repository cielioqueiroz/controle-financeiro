# A fronteira das telas deixa de ser promessa e vira regra de lint

O [ADR-0010](./0010-cqrs-e-integridade-de-dados.md) criou `aplicacao/consultas` e
`aplicacao/comandos` como a fronteira entre as telas e o adaptador do Neon, e o
[ADR-0011](./0011-backend-serverless-descartado.md) prometeu que *"é lá que um
backend entraria se um dia entrasse"*. Em 2026-09-06 essa fronteira não existia:
`aplicacao/` eram **17 linhas** de reexportação em cinco arquivos, sete arquivos
a usavam e cerca de trinta importavam `persist/` direto. `ui/Documentos.tsx`
chegava a fazer os dois no mesmo arquivo — lia por `persist/documentos` na linha
4 e apagava por `aplicacao/comandos/documentos` na linha 5.

Uma fronteira que metade do código atravessa não é fronteira; é uma indireção
que se paga sem receber o isolamento. As duas saídas honestas eram apagar
`aplicacao/` ou fazê-la valer. Escolhemos fazer valer, e o que decidiu foi o
ADR-0011: se um backend um dia entrar, ele entra ali — e com trinta arquivos
falando com o adaptador, "ali" seria trinta lugares.

## O que mudou

1. **`no-restricted-imports` no `.oxlintrc.json`** proíbe `**/persist/*` fora de
   `aplicacao/**`, `persist/**` e dos testes. O lint é `--deny-warnings`, então
   atravessar a fronteira derruba a verificação. A regra foi conferida com uma
   violação proposital antes de entrar — regra que não dispara é pior que regra
   nenhuma, porque ensina a confiar no que não protege.
2. **O tipo `TransacaoSalva` também passou a vir de `aplicacao/consultas`.** É
   type-only e some na compilação, mas é o vocabulário da tela: deixá-lo
   apontando para o adaptador manteria o acoplamento que a regra existe para
   remover, com a agravante de ser invisível.
3. **Duas portas novas** onde faltavam: `aplicacao/consultas/documentos.ts` e
   `aplicacao/comandos/categorias.ts`.

## A consequência que não é sobre camadas

`persist/` passou a ser **só** o adaptador — e isso obrigou a mover 501 linhas
que não conversavam com o Neon: `agrupar.ts` (390), `aberto.ts` (73) e
`saldos.ts` (38) foram para `domain/`. Nenhuma delas importava rede; as três
importavam `domain/`.

O argumento não é de arrumação, é do glossário. **Recorte** tem entrada própria
no `CONTEXT.md`, e `agrupar.ts` é a função que o calcula. Competência, gasto
real, projeção de compromisso futuro e saldo por conta são todos termos de lá.
Estavam na pasta que existe para falar com o banco.

O custo assumido, e é real: `agrupar.ts` opera sobre `TransacaoSalva`, que é a
forma da LINHA DO BANCO (`amount_cents`, `category_slug` — snake_case, direto do
`select`). Mover a função sem mover a forma faz `domain/` depender do formato da
tabela, que é o acoplamento que `domain/` existe para não ter. Aceitamos porque
`TransacaoSalva` já **é** o modelo de leitura do domínio na prática — `puxar.ts`
faz o mapeamento campo a campo e já calcula `competencia` ali, que é regra de
domínio rodando dentro do adaptador. A alternativa era uma quarta camada para
três arquivos, e o `AGENTS.md` tem regra contra isso.

## Consequências

- **Um backend, se entrar, entra em `aplicacao/`** — agora de verdade, e o lint
  garante que continue assim.
- **`persist/` só cresce com adaptador.** Lógica pura que aparecer ali está no
  lugar errado, e a pergunta que decide é a do glossário: isto tem nome no
  `CONTEXT.md`?
- **Os testes estão fora da regra**, de propósito: dublar o adaptador é
  exatamente o que `persist/salvar.test.ts` faz, e ele precisa alcançá-lo.
