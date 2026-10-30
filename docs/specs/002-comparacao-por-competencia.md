# Relatórios: comparação por competência

Status: implementado e validado localmente em 2026-10-13; incluído no push para `main` de 2026-10-14.

## Problema

Selecionar as últimas N competências existentes comprimia o calendário quando
havia lacunas. Com quatro meses importados e janela de três, a tela comparava
três meses recentes com apenas um anterior, exibindo uma variação enganosa.

## Comportamento

- As janelas de 3/6/12 meses terminam na competência mais recente do histórico
  do banco selecionado. O intervalo anterior é adjacente e tem a mesma duração.
- Meses sem transações importadas têm resumo `null`. Não recebem valor zero e
  não são preenchidos com meses mais antigos.
- Os totais continuam disponíveis sobre as transações existentes, acompanhados
  da contagem de meses com dados e da procedência.
- A comparação exige transações em todos os meses dos dois intervalos. Variação
  de gasto exige gasto anterior positivo; taxa de economia exige entradas.
- A tela informa os limites de ambos os intervalos e permite expandir os meses
  para conferir quantidade de documentos e gasto real.
- O gráfico mantém a posição dos meses ausentes, interrompe linhas/áreas e
  mostra pontos para observações isoladas. Hover e teclado anunciam a ausência.
  Acumulado fica indisponível em janelas com lacunas; o resultado mensal continua.
- Vínculos continuam fora do gasto real, mesmo quando são as únicas transações
  conhecidas de um mês.

## Limite do dado

Ter transações em cada competência **não prova** que todos os documentos e todas
as contas foram importados. A comparação descreve o histórico disponível. Não
é uma conferência de completude bancária. Documentos sem transações não são
inferidos por este cálculo, que recebe o mesmo histórico usado nos totais.

## Mês final incompleto — 2026-10-30

A fatura conta no mês do vencimento (ADR-0001), e a última importada costuma
vencer no mês seguinte ao último extrato. Esse mês fechava a janela só com o
gasto do cartão e sem as entradas. Com seis meses iguais (R$ 6.000 de entrada e
R$ 4.000 de gasto) e uma fatura vencendo em novembro, a taxa de economia caía de
33,3% para 4,2%, e a comparação ainda era dada como disponível.

O histórico prova uma coisa só: **a fonte que sumiu**. Fonte é banco + tipo de
documento. Se no último mês falta uma fonte que o mês imediatamente anterior
tem, o último mês sai da janela, e o teste se repete um mês antes. O retorno
`foraDaJanela` diz qual mês saiu e o que falta nele, e a tela pede para importar
o documento.

- Uma conta encerrada atrasa a janela só até o mês seguinte chegar: aí o mês
  anterior também já não tem aquela fonte.
- Através de uma lacuna de calendário não há com que comparar, e nada sai.
- Com filtro de banco, só as fontes daquele banco contam.
- Duas contas do mesmo banco e tipo são uma fonte só. A régua erra para o lado
  de deixar o mês entrar, não de tirá-lo.

## Arquitetura

`domain/relatorios.ts` contém a regra pura, sem React, persistência ou rede.
`MesesRelatorio` apresenta o resultado e respeita modo discreto e traduções.
`GraficoFluxo` aceita competências esperadas opcionais; seus demais consumidores
continuam compatíveis. Nenhuma migração ou dependência é necessária.

## Aceite

- Testes de duração, virada de ano, lacunas, janela curta, vínculos e base zero.
- Testes de UI para comparação disponível/indisponível e banco selecionado.
- Gráfico não conecta pontos através de uma lacuna nem permite escolher
  acumulado incompleto. Períodos completos mantêm a opção de acumulado.
- Detalhe dos meses medido em desktop/celular, claro/escuro e com axe-core.

Prévias fictícias (somente desenvolvimento):

- `/demo.html?tela=relatorios&amostra=lacunas&janela=3`
- `/demo.html?tela=relatorios&amostra=comparavel&janela=3&tema=claro`

## Validação executada

- 22 testes focados de domínio, Relatórios e GraficoFluxo passaram.
- `npm run verificar`: typecheck, suíte completa, lint, caminhos, build e CSP passaram.
- Overflow: 13 jornadas em 1280×800 e 390×844 sem rolagem lateral.
- Acessibilidade: as mesmas 13 jornadas, sem violações critical/serious.
- Inspeção visual: lacunas no desktop escuro e comparação expandida no celular claro.
