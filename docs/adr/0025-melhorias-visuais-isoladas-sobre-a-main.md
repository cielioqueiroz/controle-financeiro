# Melhorias visuais isoladas sobre a main

Em 06/11/2026 o dono encerrou o experimento de redesign completo e pediu para
continuar com a aparência da `main` (`b952fe5`), aproveitando somente quatro
ideias: logos dos bancos, escolha direta de mês, a leitura de categorias em
barras e as fontes Instrument Sans / IBM Plex Mono.

## Decisão

- A paleta, a navegação, a marca Capital Financeiro, as superfícies e a
  organização das telas continuam sendo as da `main`.
- Instrument Sans substitui Sans/Condensed na interface e nos títulos. IBM Plex
  Mono continua nos valores, datas e percentuais. Os WOFF2 são locais, somente
  latin/latin-ext; as licenças OFL acompanham os arquivos.
- As logos dos sete bancos comprovadamente suportados identificam contas,
  documentos, filtros, procedência e compromissos ao lado dos nomes. Não
  anunciam o nome duas vezes para leitores de tela; banco desconhecido mantém
  o marcador do catálogo, sem marca inventada.
- Em Mês, o seletor oferece as competências presentes no histórico e mantém a
  competência atual mesmo quando está vazia. Como a escolha já é direta, não
  há setas redundantes nesse período; Dia, Semana e Ano mantêm sua navegação.
  A URL continua sendo o estado dos filtros, sem estado paralelo para a seleção.
- O Painel usa a apresentação em barras de `GraficoCategorias`, chamada "Onde
  você gastou". Relatórios mantém o donut. As duas apresentações compartilham
  valores, cores por categoria, navegação e tratamento de estornos. A faixa
  segmentada representa todas as categorias positivas; a lista destaca as oito
  maiores e mostra também os estornos. Uma dominante continua usando escala
  robusta, com o corte explicado e os percentuais reais escritos.

## Consequências

O experimento anterior foi descartado sem publicar. A direção aprovada entrou
na `main` pelo PR #76; a ampliação das marcas para os sete bancos continua
isolada na branch `codex/logos-bancos-recorrencias` até nova aprovação. A
decisão visual não depende de autenticação ou migração. A aprovação da direção
anterior não autoriza retomá-la.

## Revisão local

Em 06/11/2026, `npm run verificar:rapido` passou (tipos, suíte completa, lint e
caminhos). O medidor de contraste passou. As seis jornadas afetadas
(`mes-e-categorias`, sua versão clara, `painel-contas`, sua versão clara,
`estados-painel` e `painel-expandido`) passaram em 1280 × 800 e 375 × 812: sem
overflow horizontal nem violações critical/serious do axe-core, com fontes e
logos carregadas. A revisão visual usou a folha de provas identificada com
dados fictícios, conforme autorizado pelo dono.

O PR #76 foi verificado, aprovado e publicado em 08/11/2026. Mudanças posteriores
continuam exigindo nova revisão antes de commit, push, PR ou merge.
