# Origem dos valores — próximo incremento

Data: 17/10/2026. Continuação da fila aprovada pelo usuário: detalhar valores
até as transações e o documento de origem. Este incremento fecha o caminho que
Relatórios já inicia, usando as telas e o design system existentes.

## Experiência

- No detalhe de categoria, estabelecimento ou transação de Relatórios, cada
  grupo por documento oferece “Ver documento importado”. O identificador técnico
  deixa de ser o único dado oferecido como procedência.
- A ação leva a `/faturas` com `documento=<id>` e preserva período e banco.
  A tela consulta somente os documentos do usuário via adaptador atual/RLS.
  O documento correspondente abre seus detalhes e recebe foco no resumo nativo,
  mostrando nome, período, gabaritos e conferência original já existentes.
- Voltar pelo navegador retorna ao mesmo detalhe do relatório, mantendo janela,
  período e banco. Para isso, a seleção de detalhe usa a URL (`detalhe` e `item`),
  com replace ao abrir/fechar e sem nova entrada por interação de gráfico.
- Título e transações do detalhe são derivados dos dados atuais. Parâmetro
  inválido ou seleção sem transações não fabrica um título nem um valor.
- Fechar o detalhe restaura foco ao gatilho ainda montado; após uma navegação,
  quando ele não existe mais na ref, usa o título do relatório como destino.
- Documento ausente/excluído/indisponível ao usuário recebe mensagem genérica
  própria e ação para limpar a seleção. Falha de consulta continua sendo erro
  com nova tentativa; carregamento não pode ser confundido com ausência.

## Implementação e limites

Decisões do agente dentro da fila autorizada: `DocumentoImportado` recebe flag
opcional de seleção, abre o details/foca ao receber essa seleção; o componente de
lista recebe seleção e ação de limpar sem depender de Router. Faturas e
Relatórios ligam essas ações à URL. DetalheRelatorio recebe callback opcional
para a origem; a demo também oferece a ação pertinente à sua amostra.

Dinheiro continua em centavos e `useDinheiro`; textos em pt/en/es. Preservar
os tokens e IBM Plex. Sem dependência, nova migração, PDF original armazenado,
escrita no banco ou reformulação das demais telas nesta entrega.

## Provas

- Teste integrado Relatórios → Faturas → Voltar, com banco, janela e detalhe
  preservados; foco correto e conferência original visível.
- Documento ausente, consulta lenta e falha com retry; nenhuma exclusão disparada
  pela seleção. URL inválida do detalhe não quebra nem aprova dado desconhecido.
- Snapshot sem-gabarito/legado e modo discreto mantêm seus contratos existentes.
- Jornadas de overflow e axe para seleção automática no documento e ação de
  origem no relatório; desktop e celular. `npm run verificar` e review final.

O incremento será feito em nova branch sobre a rodada de integridade enviada.
A autorização integral posterior do usuário, em 17/10/2026, cobre também concluir
e publicar este incremento após revisão e verificações.
