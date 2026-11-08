# Auditoria de cálculos — 07/11/2026

Revisão na branch `codex/redesign-premium`. O percurso cobriu leitura dos documentos, conferência, deduplicação,
vínculos, agregações, saldos, relatórios, recorrências e projeções.

## Corrigido nesta branch

- Estorno negativo de compra abate gasto e categoria na prévia; não vira
  entrada. Pagamento anterior da fatura também não vira entrada.
- A fatura Nubank usa o vencimento como fim do período, competência e âncora da
  quitação, inclusive quando fechamento e vencimento ficam em meses distintos.
- O Sicoob escolhe o ano correto para cada transação quando o extrato atravessa
  dezembro e janeiro.
- Parcelas diferentes com a mesma data original, estabelecimento e valor têm
  identidades distintas. A gravação reconhece também hashes legados da mesma
  parcela e cancela se a leitura de compatibilidade vier incompleta.
- Dois cartões do mesmo banco mantêm séries e vencimentos separados nas
  projeções e no calendário.
- Estorno não cria recorrência futura. Alertas de mudança de valor deixam de
  reaparecer quando a série já ficou antiga.
- As leituras auxiliares de documentos e saldos conferem a contagem exata e
  recusam resposta truncada, evitando total parcial silencioso.
- Documento e transação passam a ter relação muitos para muitos: documentos
  sobrepostos compartilham a prova sem duplicar dinheiro, e excluir uma prova
  não remove a transação enquanto outra a sustenta.
- Uma mudança fixa repetida por dois meses consolida o novo patamar da
  recorrência. A regra exige três meses estáveis antes e dois depois; séries
  naturalmente variáveis continuam usando a mediana.

## Evidência

- Os 13 fixtures de referência passaram por `buildLines → parse → validar` com
  status `confere` e diferença zero.
- Casos de regressão foram acrescentados ao lado das regras corrigidas.
- `npm run verificar` passou em 08/11: typecheck, suíte completa, lint, regras
  de caminhos, build e CSP, todos contra o estado final da implementação.
- As seis jornadas visuais afetadas passaram em 1280 × 800 e 375 × 812, nos
  temas aplicáveis: sem overflow horizontal nem violações `critical`/`serious`
  do axe-core, com fontes e logos carregadas.
- `npm run medir:graficos` passou nos temas claro e escuro em desktop e mobile,
  cobrindo geometria, cores, rótulos, seleção e procedência.
- A migração 0015 passou numa branch normal do Neon derivada de produção: 644
  transações, 644 relações primárias, nenhuma relação ausente ou cruzada entre
  usuários. As provas de sobreposição e exclusão foram revertidas ao final.
- A mesma migração foi aplicada em produção em 08/11, em transação única. A
  conferência posterior repetiu 644 transações e 644 relações, com RLS ativo,
  duas policies, RPC presente e zero relações ausentes ou entre usuários.

## Limites dos dados históricos

- Dados Nubank já gravados com o fechamento no lugar do vencimento não são
  corrigidos pelo frontend novo. O reparo precisa recuperar o vencimento do PDF
  original e preservar IDs, rótulos e vínculos.
- Uma parcela descartada por colisão antes desta correção precisa ser recuperada
  da fonte. `file_hash` e `content_hash` impedem que uma simples reimportação
  repare silenciosamente o documento já salvo.
- O banco anterior não registrava relações adicionais de documentos
  sobrepostos. O backfill preserva somente a procedência comprovada; não cria
  associações históricas por coincidência de período.

Nenhum desses limites foi mascarado com zero, mock ou ajuste direto no banco.
