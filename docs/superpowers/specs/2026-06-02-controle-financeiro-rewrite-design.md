# Controle Financeiro — Reescrita completa (design)

Data: 2026-06-02

## Objetivo

Reescrever o app de controle financeiro (hoje HTML/CSS/JS puro em um único `main.js`)
mantendo a stack sem build, mas com arquitetura modular, visual profissional de fintech,
correção dos bugs atuais e novas funcionalidades.

## Direção visual

- Paleta com intenção via CSS custom properties: base neutra (slate/grafite), esmeralda
  para entradas, rosa/vermelho para saídas, índigo para ações. Tema claro/escuro = troca
  do conjunto de variáveis.
- Layout: header (logo + marca + toggle de tema) → cards de resumo (Entradas / Saídas /
  Saldo, Saldo colorido conforme sinal) → painel de gráfico donut → barra de filtros/busca →
  formulário de novo lançamento → tabela com estado vazio ilustrado.
- Tipografia: Inter (Google Fonts), `tabular-nums` nos valores.
- Microinterações: hover ricos (elevação de cards, brilho em botões, scale em ícones),
  transições suaves, contadores animados nos totais, fade/slide ao inserir linha, donut animado.
- Favicon: SVG próprio (marca de carteira/gráfico) na paleta do app, substituindo o PNG do icons8.

## Arquitetura (ES modules, sem build)

```
index.html
css/
  tokens.css   → variáveis de tema (claro/escuro), tipografia, espaçamentos
  style.css    → layout e componentes
js/
  main.js      → ponto de entrada, conecta tudo
  store.js     → estado + localStorage (load/save/add/update/remove/import/export) + migração
  format.js    → moeda (BRL) e data
  categories.js→ catálogo de categorias (label, ícone, cor)
  render.js    → tabela, cards de resumo, estado vazio
  filters.js   → busca + filtros (tipo/categoria/período)
  chart.js     → donut SVG animado (zero dependência)
  modals.js    → editar/excluir com foco automático, Esc e trap de foco
  theme.js     → toggle claro/escuro persistido
  toast.js     → wrapper do Toastify
public/
  favicon.svg  → novo favicon
```

`store.js` é a única fonte de verdade; a UI reage ao estado.

## Modelo de dados

```js
{
  id: string,          // crypto.randomUUID()
  desc: string,
  amount: number,      // sempre positivo
  type: "Entrada" | "Saída",
  category: string,    // id da categoria
  date: string,        // "YYYY-MM-DD"
  createdAt: number    // timestamp
}
```

Migração leve no carregamento: itens antigos (sem id/data/categoria) recebem padrões
(id gerado, data = hoje, categoria = "outros"). Não se perde nada do que já está salvo.

## Categorias (padrão)

salario, alimentacao, transporte, moradia, lazer, saude, educacao, outros —
cada uma com label, ícone (boxicons) e cor.

## Funcionalidades

- Data em cada lançamento (default = hoje), coluna ordenável.
- Categorias com chip (ícone + cor) na tabela.
- Filtros + busca: texto, tipo, categoria, período (mês atual / tudo).
- Gráfico donut entrada×saída, recalculado conforme filtros.
- Saldo do mês além do total geral.
- Exportar/Importar JSON e CSV (backup).
- Modo claro/escuro persistido.

## Validação / erros

- Valor > 0 (`min`/`step` + checagem); descrição obrigatória; data válida.
- Escape de HTML na descrição (corrige XSS via `innerHTML`).
- Corrige o bug do Enter global: Enter só envia o formulário quando o foco está nele;
  modais tratam Enter/Esc localmente.
- Import valida formato antes de sobrescrever e pede confirmação.

## Acessibilidade

Modais com `role="dialog"`, foco automático, trap de foco, Esc para fechar; ações com
`aria-label`; contraste AA nos dois temas.

## Verificação (sem framework de teste)

Checklist manual: criar/editar/excluir; filtros e busca; troca de tema; export → limpar →
import; responsivo no mobile; bugs antigos confirmados como corrigidos.

## Restrição de processo

O assistente NUNCA commita nem dá push. Todos os comandos git são entregues prontos
para o usuário rodar no terminal.
