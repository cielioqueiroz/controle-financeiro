# O app é retrospectivo: nada é digitado

Todo número na tela veio de um PDF do banco. Não há cadastro de despesa, de conta a
pagar, de orçamento nem de meta — a única entrada de dado do sistema é a importação
de um documento. O usuário-alvo não vai categorizar 400 transações à mão, e um app
que exige alimentação manual é abandonado na terceira semana.

## Consequences

- **Metade das telas que um app de finanças costuma ter simplesmente não existe**,
  e isso é deliberado. Quem estranhar a ausência de "adicionar despesa" está vendo
  a decisão, não um buraco.
- **O que normalmente se cadastra, aqui se detecta.** A lista de contas fixas e o
  calendário de vencimentos saem de `domain/recorrencias.ts`, olhando o histórico
  já importado; os compromissos futuros saem da projeção das parcelas.
- **A detecção exige histórico.** Recorrência precisa de três competências
  distintas; o gráfico de evolução precisa de dois meses. Quem acabou de importar o
  primeiro documento vê telas legitimamente vazias — daí o gráfico de saídas por
  dia, que responde com um mês só.
- A única correção manual admitida é o **rótulo** e a **categoria** de uma
  transação já importada, e corrigir a categoria vira regra (aprendizado).
