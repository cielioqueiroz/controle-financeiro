# Validação — categorias e gráficos — 2026-10-17

Branch: `codex/categorias-graficos`.

## Mudanças

- Seletor de emoji com opções para nova categoria, edição de categoria padrão e
  categorias do usuário.
- Categorias padrão podem ser personalizadas por usuário, sem alterar seu slug.
  Restaurar remove só a linha de personalização. Nenhuma migração foi necessária.
- Saldo atual em uma linha responsiva; linha do tempo usa barras mensais
  positivas/negativas e distingue meses sem dados de resultado zero.
- Comparativo de renda e despesas explica quando as despesas ultrapassam a renda.
- Chaves pt/en/es atualizadas. Decisão de persistência em
  [ADR-0019](../adr/0019-personalizacao-de-categorias-sem-mudar-o-slug.md).

## Provas

- Typecheck, testes (320,9s), lint, checagem de caminhos e build passaram.
- O gate CSP da execução completa não concluiu; executado isoladamente depois,
  passou login recusado, fontes, workers, chunks do relatório e todas as sondas
  positivas/negativas.
- `scripts/medir-overflow.py`: 30 jornadas em 1280×800 e 390×844, sem estouro.
  A primeira tentativa sinalizou dois gatilhos com seletores obsoletos/intermitência;
  ajustado o seletor da jornada de comparação e repetida a bateria completa, verde.
- `scripts/medir-a11y.py`: mesmas 30 jornadas nos dois tamanhos, zero violações
  `critical`/`serious`.
- Testes focados de categoria, emoji, gráfico e saldo passaram na suíte.

## Limites

- O medidor de navegador usa a demo autenticada simulada e não abre uma sessão
  Neon real. Personalização persistida depende da política RLS já existente da
  tabela `categories`.
- A métrica de contraste não foi repetida: não foram alterados os tokens de cor;
  o gráfico usa cores semânticas existentes e o seletor reaproveita cores
  existentes para categorias.
