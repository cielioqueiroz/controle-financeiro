# ADR-0019: personalizar categorias sem mudar o slug

- **Estado:** aceito
- **Data:** 2026-10-17

## Contexto

Transações guardam `category_slug`, e os slugs embutidos são parte do catálogo
usado por classificação, relatórios e gráficos. Trocar o slug ao editar o nome
órfãoaria as transações e regras existentes. O seletor de categorias também
precisa permitir que cada pessoa escolha os próprios nomes e ícones, inclusive
para as categorias padrão.

## Decisão

Uma personalização de categoria padrão grava uma linha em `categories` com o
mesmo slug embutido e o `user_id` da sessão. Não se altera o slug das
transações. No catálogo em memória, a linha própria substitui a padrão somente
para aquele usuário; os outros usuários continuam vendo o catálogo base.

Excluir a linha de personalização restaura a categoria padrão. Categorias
criadas pelo usuário continuam com slugs `u-…` e podem ser removidas pelo fluxo
de confirmação existente.

## Consequências

- Não requer migração: `categories` já separa linhas globais e próprias por
  `user_id`, e as políticas RLS limitam a escrita às próprias linhas.
- `categoria()`, `todasCategorias()` e `nomeCategoria()` precisam preferir a
  personalização própria e deduplicar o mesmo slug no seletor.
- O slug não muda; transações, regras aprendidas e relatórios continuam ligados
  à mesma categoria.
- O botão de restaurar remove apenas a personalização do usuário, nunca a linha
  global nem a categoria de outro usuário.
