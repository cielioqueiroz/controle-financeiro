# Relatórios comparam janelas de calendário

Data: 2026-10-13.

Contar N meses existentes não equivale a observar N meses consecutivos.
Relatórios agora enumera competências de calendário e exige presença de
transações em todos os meses dos dois intervalos antes de comparar percentuais.

Uma lacuna não representa zero. Por isso o gráfico interrompe as linhas e
desabilita o saldo acumulado nessa janela. Somar somente pontos conhecidos
produziria um número calculável, mas o rótulo de acumulado do intervalo seria
enganoso. Totais parciais seguem disponíveis, explicitamente acompanhados da
quantidade de meses com transações.

Essa regra é conservadora e não prova que todos os documentos de cada conta
estão presentes. Esse limite é informado na tela. A regra não consulta a data
atual: ancora na competência mais recente do histórico selecionado, mantendo
a leitura retrospectiva e determinística.
