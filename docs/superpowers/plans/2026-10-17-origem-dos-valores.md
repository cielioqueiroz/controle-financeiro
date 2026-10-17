# Origem dos valores — plano de execução

**Objetivo:** permitir conferir o documento que sustenta um valor em Relatórios
e voltar ao mesmo detalhe, com período e banco preservados.

**Design:** `docs/superpowers/specs/2026-10-17-origem-dos-valores-design.md`.
Escolhas específicas do agente, dentro da fila cuja continuação foi autorizada.
Builder check independente: nenhuma questão importante pendente.

## Critérios e tarefas

### Task 1: Detalhe de relatório na URL e ação de origem

- [x] Testar abertura por URL e restauração ao voltar, janela e banco preservados,
  fechamento com foco e parâmetro inválido sem inventar seleção.
- [x] Substituir estado local do detalhe por `detalhe`/`item` na URL. Derivar
  título e transações dos dados atuais; preservar seleção só quando válida.
- [x] Adicionar ação de origem ao grupo por documento, usando callback da página.
  Levar período e banco a `/faturas?documento=...`, sem usar ID como texto principal.

Arquivos: `paginas/Relatorios{,.test}.tsx`, `ui/DetalheRelatorio.tsx`,
`dados/detalhe-relatorio{,.test}.ts` se a lógica de seleção justificar helper puro
de apresentação, dicionários pt/en/es.

### Task 2: Documento selecionado em Faturas

- [x] Testar seleção após carregamento, expansão e foco, ausência, erro e retry;
  selecionar documento nunca chama exclusão.
- [x] Faturas lê `documento` da URL e fornece seleção/limpeza à lista. A lista
  permanece independente do Router. DocumentoImportado abre/foca o resumo quando
  selecionado; os demais conservam expansão nativa.
- [x] Ausência é informada somente após consulta bem-sucedida, com ação para
  limpar seleção preservando os parâmetros de período/banco.

Arquivos: `paginas/Faturas{,.test}.tsx`, `ui/Documentos{,.test}.tsx`,
`ui/DocumentoImportado{,.test}.tsx`, dicionários.

### Task 3: Integração, provas e fechamento

- [x] Teste com Routes reais Relatórios → Faturas → Voltar e conferência original.
- [x] Demo reproduz origem e seleção automática; journeys de overflow e axe
  verificam os gatilhos em desktop/celular, incluindo foco e documento ausente.
- [x] Rodar testes relacionados, `npm run verificar`, overflow e axe; contraste
  se houver mudança de cor. Review independente final e correção de achados.
- [x] Registrar resultados em ESTADO-ATUAL/DESIGN-SYSTEM e ADR se uma decisão
  fugir do que um leitor esperaria. A autorização integral posterior do usuário
  cobre publicação após revisão independente e verificações aprovadas.

Sem nova migração ou dependência. Preservar `useDinheiro`, centavos inteiros,
fronteira de aplicação e o visual atual. Testes de comportamento, sem medir
implementação nem duplicar a lógica do componente nas expectativas.
