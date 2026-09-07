# O app passa a saber quando quebra, sem saber o que a pessoa comprou

Até 2026-09-06 não havia telemetria de espécie nenhuma. Em 2026-09-04 o app
quebrou no celular de uma parente do dono e a **única** razão de alguém ter
descoberto foi ela ter contado. Quem não conta, fecha a aba — e o defeito
continua no ar.

## O que foi recusado, e por quê

**Sentry (ou qualquer SaaS).** É o caminho barato de montar e caro de
justificar: a promessa de abertura do produto é *"seus dados financeiros, só
seus"*, e exceção de app financeiro carrega mensagem, pilha e, com frequência,
o dado que a estourou. Mandar isso para terceiro contradiz a frase que é o
argumento do produto.

**Um endpoint próprio (Vercel Function).** Era a forma que o dono aprovou, e o
desenho mudou por dois motivos concretos, não por preferência:

1. Reabriria o [ADR-0011](./0011-backend-serverless-descartado.md), que
   descartou o backend serverless.
2. Precisaria da `DATABASE_URL` — a mesma credencial que bloqueou a Fatia 1b
   por três semanas em agosto e nunca chegou. Um desenho que depende dela
   nasce parado.

## A decisão

**Uma tabela no Neon do próprio dono (`client_errors`), escrita pelo cliente
pela Data API, com RLS.** Entrega as três propriedades que a escolha exigia —
infraestrutura própria, campos mínimos, um único destinatário — sem backend,
sem credencial nova, sem dependência nova e sem endpoint anônimo.

É também o arranjo que o resto do app já usa: cliente → Data API → RLS. Não
inventa uma segunda arquitetura para um recurso acessório.

### O que a linha guarda

| campo | por quê |
|---|---|
| `classe` | `PdfIlegivelError`, `RecorteIncompletoError`, `TypeError`. Para os erros tipados do app, **a classe já é o nome do defeito**. |
| `contexto` | qual funil registrou (`importacao`, `historico`, `edicao`…), de um conjunto fechado. |
| `rota` | o `pathname`, **sem a query** — a query carrega os filtros, e a busca é texto que a pessoa digitou. |
| `versao` | o módulo de entrada do bundle. Mesmo truque do `lib/versao.ts`: não há número de versão para manter e ele diz qual build quebrou. |
| `navegador` | motor + versão maior + plataforma. Nunca o UA cru. |

**Sem mensagem, sem pilha, sem nome de arquivo, sem valor, sem descrição.**

O preço disso é real e assumido: um `TypeError` solto rende "algo quebrou em
`/importar`, no Chrome 118 do Android, neste build" — menos do que uma pilha
daria. Para os erros que o app define, que são a maioria dos que importam, a
classe basta.

## Consequências

- **Dois funis, não trinta.** `chaveDeErro` (lib/erro-usuario) e
  `classificarFalha` (lib/falha-importacao) já eram os pontos por onde toda
  falha visível passa. Registrar neles evita `try/catch` novo espalhado.
- **Nunca lança e nunca espera.** É chamado de dentro de tratadores de erro:
  falhar ali empilharia um segundo defeito sobre o primeiro, e um `await`
  travaria a tela entre o erro e o aviso.
- **Teto de 20 por aba e dedupe por (contexto, classe, rota).** Erro dentro de
  um `render` vira laço; sem teto, o registro de falha viraria a falha.
- ⚠️ **Falha em tela DESLOGADA não é registrada.** Sem sessão não há JWT, e sem
  JWT não há insert. Cobrir isso exigiria superfície anônima de escrita — que é
  convite a lixo — ou o backend que o ADR-0011 descartou. O incidente que
  originou esta tabela era logado.
- **Quem investiga é o dono do banco, pelo console do Neon**, onde o RLS não se
  aplica. O app não expõe falha de ninguém a ninguém: cada conta só enxerga as
  próprias linhas.
- **Se um dia isto virar produto** (uma tela de "o que quebrou"), o caminho já
  está pronto: a consulta é a mesma da tabela, com RLS.
