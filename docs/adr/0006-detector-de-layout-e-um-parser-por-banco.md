# Detector de layout mais um parser por banco, sem parser universal

Cada banco imprime o PDF do seu jeito, e as diferenças não são cosméticas: o
Bradesco marca crédito com sufixo hífen e o Sicoob com sufixo `C`/`D`; o Nubank
declara o próximo fechamento como "16 JUL 2026" e o Bradesco como "16/07/2026"; o
BB não declara totais de entrada e saída, só a progressão de saldo. Um parser
universal viraria uma escada de condicionais onde qualquer conserto quebra outro
banco. Em vez disso, `detectDocument` identifica emissor e tipo pelas duas
primeiras páginas, e despacha para um parser dedicado atrás de uma interface comum.

## Consequences

- **Adicionar um banco não toca em nada a jusante**: normalização, categorização,
  vínculo e telas consomem `ParseResult`, não o PDF.
- **Adicionar um banco exige uma amostra real.** É por isso que Caixa e o layout A
  do BB seguem parados: sem o PDF, o detector não tem marcador e o parser não tem
  colunas. Não é trabalho que dê para escrever adiantado.
- **A ordem das assinaturas importa.** O extrato do Bradesco também contém a
  palavra "Fatura" no rodapé, então a assinatura mais específica é testada
  primeiro. Reordenar a lista quebra a detecção sem quebrar teste algum se a
  fixture do caso não existir.
- Cada parser é responsável pelo próprio gabarito, porque cada documento declara um
  total diferente — e é a conferência contra esse gabarito que autoriza mostrar o
  número.
