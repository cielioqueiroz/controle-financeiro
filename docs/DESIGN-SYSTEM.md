# Design system — Capital Financeiro

## Direção

Livro-razão: leitura financeira com números alinhados, superfícies claras,
hierarquia discreta e procedência visível. A implementação usa Tailwind v4 e
componentes próprios, conforme a ADR-0009. Tokens de cor e tema continuam em
`frontend/src/index.css`; fontes locais em `frontend/src/fontes.css`.

## Tipografia

| Uso | Família | Regra |
| --- | --- | --- |
| Texto e controles | IBM Plex Sans | 14–16 px; entrelinha confortável |
| Títulos | IBM Plex Sans Condensed | `font-display`, peso 600 |
| Rótulos de cards | IBM Plex Sans Condensed | `rotulo`, 12 px, entrelinha 1.5 |
| Valores | IBM Plex Mono | `tabular`, números alinhados; `useDinheiro()` na UI |

As fontes já são locais, com `font-display: swap` e pesos 400/500/600
(Condensed: 500/600). Preservar essa configuração; novos pesos exigem o arquivo
correspondente. Legendas pequenas não substituem as informações principais.

## Superfícies e espaçamento

- `Cartao` (`ui/Cartao.tsx`): seção por padrão; aceita `article` ou `div`.
  Superfície `cartao`, borda `borda`, raio `xl`, sombra curta e `min-width: 0`.
  Preenchimento de 20 px em telas pequenas e 24 px a partir de `sm`.
- `.cartao`: mesma aparência para elementos animados com `motion`, que mantêm
  sua própria tag. Aplicar o preenchimento no elemento ou no conteúdo.
- `.pilha-paineis`: separação vertical de 16–24 px entre blocos. Usa `gap`,
  inclusive quando React Fragment agrupa os filhos.
- Grades de indicadores: `gap-4`, uma/duas/quatro colunas conforme largura.
- `.acao-painel`: ação secundária com altura mínima de 44 px; herda o foco
  visível global. Pode ser botão ou link, conforme sua função.

Cartões não são clicáveis por padrão. Navegação usa link; executar usa botão.
O preenchimento do cartão não deve cortar tooltip ou anel de foco.

## Gráficos

- Entradas usam esmeralda; saídas, coral; resultado/acumulado, azul com linha
  tracejada. Grade é neutra e não concorre com os dados.
- `ui/corCategoria.ts` resolve uma identidade fixa por slug, usada no donut,
  nos rankings e na lista de categorias. Categorias personalizadas preservam
  sua cor. Ícone, nome e valor complementam a cor; o catálogo compartilha matizes.
- Tokens de categoria ficam em `:root`, fora do `@theme` eliminável do Tailwind:
  são resolvidos dinamicamente, não por classes literais.
- Legendas do fluxo permitem destaque por hover/foco e seleção persistente por
  clique/toque. Apenas os traços perdem ênfase; o texto continua contrastado.
- Fluxo usa a mesma posição proporcional para pontos, meses e áreas de interação.
  SVG sem texto pode preencher a largura; os rótulos HTML não são deformados.
  No celular, janelas longas espaçam os rótulos sem remover os controles dos meses.
- Nomes de categoria e estabelecimento podem quebrar linha, sem depender de hover.
- Relatórios abrem a composição do gasto real no intervalo inteiro, por documento,
  com retorno de foco ao controle acionado. O detalhe não promete disponibilizar o
  PDF original, que não é guardado pelo aplicativo.

`npm run medir:graficos -- http://127.0.0.1:5173` mede alinhamento, tokens reais,
legendas de 3/6/12 meses e ida/volta do detalhe em dois temas e duas larguras.
O medidor de contraste lê os novos tokens do CSS, cobrando 3:1 para os traços.

## Hierarquia do Painel

Filtros e procedência vêm antes de Entradas, Gasto real e Resultado. Os três
valores ficam em uma coluna no celular. Diagnósticos e leituras em tom de alerta
permanecem visíveis; o acesso aos lançamentos preserva o período e o banco.

`Explorar o período` reúne contagem, exportação, comparativo, gráficos e rankings.
`Contas e compromissos` reúne saldos e parcelas futuras, inclusive quando o recorte
não tem transações. As duas seções começam recolhidas e usam `details`/`summary`
nativos, com alvo de pelo menos 48 px e foco visível. Abrir uma seção não altera
os filtros nem cria uma entrada no histórico de navegação.

## Conferência e documentos

A prévia compara **No documento**, **Lido pelo app** e **Diferença** para cada
gabarito. Entradas e saídas têm linhas separadas; diferenças opostas não viram
um carimbo com diferença zero. Sem gabarito suficiente, não se desenha uma
comparação fictícia. O texto de apoio delimita o alcance da conferência ao
documento lido.

Documentos salvos usam cartões com banco, tipo, data de importação e gasto real
identificado. `Ver dados do documento` é um `summary` nativo, com alvo mínimo
de 44 px; revela nome do PDF, período completo e gabaritos disponíveis. O
resultado original da conferência não é inferido desses valores — ver
[ADR-0017](./adr/0017-conferencia-original-nao-e-recalculada-pelo-gasto-salvo.md).

Na versão com a migração 0008, novos documentos mostram a conferência original
guardada antes dos vínculos e da deduplicação. As comparações usam o mesmo
componente da prévia; a contagem original pode diferir da contagem salva.
Registros antigos continuam com resultado desconhecido. A prévia divergente
explica por que o botão de salvar fica indisponível.

Consulta falha oferece nova tentativa. Contagem indisponível e documento sem
transações vinculadas não recebem um gasto zero. Um recorte sem transações
também não é prova de documento faltando.

## Estados compartilhados

| Estado | Componente | Comportamento |
| --- | --- | --- |
| Carregando | `CarregandoPainel` | Status traduzido, esqueletos decorativos ocultos dos leitores de tela, animação respeita movimento reduzido |
| Falha | `ErroCarregar` | Mensagem traduzida anunciada e ação de tentar novamente |
| Vazio | `EstadoVazio` | Título, explicação e ação contextual; não apresenta zero como dado inexistente |
| Pronto | Conteúdo da página | Procedência e valores calculados a partir dos documentos |

A precedência é carregando → erro → vazio → conteúdo. Erro de consulta nunca
vira convite para importar um histórico que já existe. A página mantém seu
cabeçalho enquanto carrega.

Falhas auxiliares de categorias ou saldos mantêm o histórico e exibem
`AvisoDadosParciais`, com as partes indisponíveis e uma ação de tentar de novo.

## Origem dos valores

No detalhe de Relatórios, cada grupo oferece “Ver documento importado”. A ação
abre os dados do documento em Faturas e foca seu resumo nativo. Voltar pelo
navegador restaura o detalhe, com período, banco e janela preservados na URL.
Fechar devolve o foco ao gatilho ou ao título do relatório após a navegação.

Seleção indisponível exibe mensagem genérica e “Ver todos os documentos”, que
limpa apenas a seleção. Ela só aparece após consulta bem-sucedida. Carregamento
e falha mantêm seus estados próprios; selecionar nunca aciona exclusão.

## Adoção e validação

Primeira adoção: Painel, Relatórios e estado de erro compartilhado. Outros
componentes mantêm sua aparência até serem migrados com revisão específica.
Não criar wrappers de modal, tabela ou botão sem um uso concreto: `Portal`,
foco, modo discreto e contratos existentes devem continuar válidos.

Prévias locais, com dados fictícios e fora do build de produção:

- `/demo.html?tela=painel`
- `/demo.html?tela=relatorios`
- `/demo.html?tela=estados`
- `/demo.html?tela=conferencia` (também `amostra=confere` e `amostra=sem-gabarito`)
- `/demo.html?tela=documentos` (também `amostra=sem-transacoes`)
- `/demo.html?tela=documentos&amostra=confere&documento=documento-ficticio`
- `/demo.html?tela=documentos&documento=ausente`

Essas prévias integram os medidores de overflow e acessibilidade.
Rodar `npm run verificar`, medir contraste, overflow e acessibilidade após
alterações visuais. Conferir os dois temas e movimento reduzido.
