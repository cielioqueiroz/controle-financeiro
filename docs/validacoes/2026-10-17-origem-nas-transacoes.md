# Origem nas transações — 2026-10-17

## Mudanças

- As três vistas de `Lançamentos` expõem uma ação acessível para abrir o
  documento associado à transação.
- Filtros da URL acompanham a navegação para Faturas, que seleciona e abre os
  dados do documento. O retorno do navegador preserva a tela anterior.
- A prévia acompanha as rotas do `MemoryRouter`, resolve o documento fictício
  pelo ID e tem uma jornada própria para cada origem.

## Verificações

- Teste integrado de origem em Relatórios e em Lançamentos: 2/2 aprovados.
- `npm run verificar`: typecheck, suíte, lint, caminhos, build e CSP aprovados.
- Medidor de overflow: 29 jornadas existentes passaram em 1280×800 e 390×844;
  as duas novas jornadas de origem também passaram nos dois tamanhos.
- axe-core: 29 jornadas existentes sem violações críticas/graves em ambos os
  tamanhos; as duas jornadas de origem passaram separadamente, também sem
  violações críticas/graves.
- `git diff --check`: limpo.

Não houve alteração de cores ou de banco de dados.
