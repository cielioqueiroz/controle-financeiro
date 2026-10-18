# Refino do saldo e das jornadas — 18/10/2026

Branch: `codex/refino-saldos-navegacao`. Base: `c787cf4`.

## Entrega

- Saldo centralizado, com explicação junto do valor e expansão por conta/data.
  Cada saldo identificado abre seu documento. A consulta passa a incluir `id`.
- Fluxo e linha mensal oferecem acesso às transações e ao documento, com
  banco preservado e retorno à seleção. Categorias de múltiplos meses abrem
  o detalhe do intervalo em Relatórios.
- Busca de categorias nos dois fluxos. Emojis pesquisáveis em pt/en/es,
  navegação com setas, foco contido no seletor e fechamento por Escape ou fora.
- Cartões, campos e ações compartilham tokens nas telas de categorias,
  transações, documentos, recorrências e situação financeira. Falha de leitura
  das categorias oferece nova tentativa; recorrências distingue espera e erro.
- Análise mensal e taxas extraídas para domínio, reutilizadas em três telas e
  no comparativo. Comparação da taxa de economia usa pontos percentuais.
- Exibição paginada em 50 linhas nas três vistas de transações. Totais e busca
  continuam globais ao recorte. Agrupamentos só são calculados na vista ativa.

## Desempenho reproduzível

Comando: `npx tsx scripts/medir-historico.ts`. Sete amostras após aquecimento,
mediana em Node 24 nesta máquina. Dados sintéticos, nenhum documento real.

| Transações | JSON sintético | Filtro antes | Filtro depois | Busca depois | Relatório depois |
| --- | --- | --- | --- | --- | --- |
| 1.000 | 0,23 MiB | 0,23 ms | 0,05 ms | 0,69 ms | 0,48 ms |
| 10.000 | 2,34 MiB | 2,14 ms | 0,31 ms | 6,50 ms | 1,94 ms |
| 50.000 | 11,76 MiB | 9,62 ms | 1,67 ms | 27,89 ms | 12,87 ms |

O filtro calcula os limites de data uma vez por consulta. A competência inicial
é obtida em uma passagem, sem ordenar todo o histórico. Os tempos são de CPU,
não de rede; os tamanhos são JSON sintético sem compressão, não tráfego medido.
Não são um limite universal de capacidade. A leitura completa mantém o guarda
de contagem exata. Ver ADR-0020.

## Verificações

- Typecheck `npx tsc -b --force`: aprovado.
- Suíte completa: 142 arquivos e 1.202 testes aprovados. Testes focados de
  domínio, saldo, seletor, categorias, paginação e navegação também passaram.
- A primeira tentativa da suíte completa falhou antes da coleta dos testes:
  142 arquivos receberam `EPERM` ao renomear módulos no diretório temporário
  isolado do Windows. Com `TEMP`, `TMP` e `TMPDIR` apontando para o cache do
  workspace, os 1.202 testes passaram.
- Lint sem avisos; verificação de caminhos em strings: aprovada; build de
  produção aprovado. O Vite avisou sobre um chunk acima de 500 kB; a decisão
  vigente contra code-splitting continua registrada no estado atual do projeto.
- Contraste: todos os pares aprovados nos temas claro e escuro.
- Axe no teste do componente do seletor, com busca ativa: sem violações
  critical/serious. O axe e o overflow nas jornadas completas precisam do
  Chromium conectando a uma origem local.
- Capturas locais em `node_modules/.cache/saldo-centralizado-*`, dados fictícios,
  sem injeção de valor no DOM: o saldo vem das sementes do provider da demo.
- CSP, axe e overflow no navegador: não concluídos. A política do sandbox
  recusou conexões loopback (`127.0.0.1`) mesmo com o servidor iniciado; os
  medidores dependem de Chromium acessando servidor local. Isso é uma limitação
  do ambiente de validação, não uma aprovação desses medidores.
