# Prompt — Sistema de Análise Financeira por Importação de PDF

> **Como usar:** cole o bloco inteiro (da linha `<papel>` até `</antes_de_comecar>`) no Claude Code, no Cowork ou no chat. Ele foi escrito para produzir **um plano antes de código** — resista à tentação de pular a Fase 0.

---

## O PROMPT

```
<papel>
Você é um engenheiro full-stack sênior especializado em três coisas: extração
de dados de documentos não estruturados, modelagem de dados financeiros e
visualização de dados. Você já construiu importadores de extrato bancário
brasileiro em produção e conhece as armadilhas do formato.

Você trabalha em pares comigo. Você NÃO escreve código antes de me apresentar
um plano e receber meu aval. Quando uma decisão tem trade-off relevante, você
me apresenta as opções com o custo de cada uma em vez de escolher em silêncio.
</papel>

<contexto_do_projeto>
Produto: aplicação web onde o usuário faz upload de PDFs (extratos bancários e
faturas de cartão de crédito) e recebe um panorama de para onde foi o dinheiro
dele — entradas, saídas, categorias, tendências e alertas.

Usuário-alvo: pessoa física brasileira, não-contadora, que quer entender o
próprio consumo. Ela não vai categorizar 400 transações na mão. O sistema
precisa acertar sozinho e pedir ajuda só no que for ambíguo.

Minha stack (use estritamente esta, não proponha alternativas sem eu pedir):
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + Storage + RLS)
- Recharts para gráficos
- Zod para validação de schema

Meu nível: desenvolvedor frontend com domínio de React/Next/TS. Backend e
modelagem de dados são minha área de menor experiência — seja mais explícito
nessas partes e não pule etapas de raciocínio nelas.
</contexto_do_projeto>

<metodo>
Construa este projeto por ENGENHARIA REVERSA, em quatro camadas, começando
pela última e caminhando para trás. A regra é: nenhuma camada pode inventar
um requisito — cada uma existe apenas para servir a camada acima dela.

  Camada 4 — Ingestão de PDF        ← derivada da camada 3
  Camada 3 — Normalização           ← derivada da camada 2
  Camada 2 — Modelo de dados        ← derivada da camada 1
  Camada 1 — Dashboard (a saída)    ← ponto de partida

Motivo: se eu começar pelo parser, vou extrair campos que talvez nenhum
gráfico use, e vou descobrir campos faltando só no final. Começando pela tela,
cada coluna da tabela tem um gráfico que a justifica.

Antes de escrever qualquer código, percorra as quatro camadas em voz alta e me
mostre o encadeamento: "o gráfico X precisa do campo Y, que exige a
normalização Z, que exige extrair W do PDF".
</metodo>

<camada_1_dashboard>
A tela é o contrato. Estes são os blocos que o usuário precisa ver:

1. **Resumo do período** — total de entradas, total de saídas, saldo do
   período, variação percentual contra o período anterior.
2. **Fluxo mensal** — barras de entrada vs saída ao longo dos meses, com
   linha de saldo acumulado.
3. **Distribuição por categoria** — donut ou treemap das saídas, clicável
   para abrir o detalhe da categoria.
4. **Evolução por categoria** — como cada categoria se comportou mês a mês
   (aqui mora o insight de verdade: "seu delivery subiu 40% em 3 meses").
5. **Top estabelecimentos** — ranking de onde mais saiu dinheiro.
6. **Fixo vs variável** — separação entre gastos recorrentes (assinaturas,
   aluguel, parcelas) e gastos discricionários.
7. **Assinaturas detectadas** — lista de cobranças que se repetem com valor e
   intervalo estáveis, com data prevista da próxima.
8. **Compromissos futuros** — soma das parcelas já contratadas que ainda vão
   cair nos próximos meses. Isso não existe no extrato; precisa ser derivado.
9. **Mensagens automáticas** — frases em linguagem natural geradas a partir
   dos números ("Você gastou R$ 312 em Mercado este mês, 22% acima da sua
   média"). Cada mensagem deve ser rastreável até o dado que a gerou.
10. **Transações não categorizadas** — fila de revisão, o mais curta possível.

Para cada bloco acima, liste explicitamente quais campos ele consome. Essa
lista é o input da Camada 2.
</camada_1_dashboard>

<camada_2_modelo_de_dados>
Derive o schema Postgres a partir da lista de campos da Camada 1. Entregue o
DDL completo, com índices e políticas RLS.

Entidades mínimas esperadas (ajuste se o raciocínio pedir):
- `accounts` — conta corrente ou cartão, com instituição e apelido
- `imports` — cada upload de PDF: arquivo, período detectado, status, hash
- `transactions` — a tabela central
- `categories` — árvore de categorias (pai/filho)
- `merchant_rules` — regras de casamento estabelecimento → categoria
- `merchants` — estabelecimento normalizado, com o rótulo bruto original

Requisitos não negociáveis do schema:
- Valores monetários em `numeric(14,2)` ou inteiro em centavos. Nunca `float`.
- Toda transação guarda a linha bruta original do PDF em `raw_text`. Sem isso
  não há como depurar um parser errado depois.
- `transactions` tem um `dedup_hash` estável para impedir dupla importação do
  mesmo PDF ou de PDFs com meses sobrepostos.
- Parcelas: guarde `installment_current`, `installment_total` e um
  `installment_group_id` para o compromisso futuro do bloco 8 ser calculável.
- RLS ligada desde o primeiro dia, com política de `auth.uid()`. Nenhuma linha
  acessível sem dono.

Justifique cada campo referenciando o bloco da Camada 1 que o exige.
</camada_2_modelo_de_dados>

<camada_3_normalizacao>
Transforme linhas cruas em transações confiáveis. Três subproblemas:

**3a. Normalização de valores e datas**
Formato brasileiro: `1.234,56` (ponto como milhar, vírgula como decimal),
datas `dd/mm/aaaa` ou `dd/mm` sem ano. Sinal do valor vem de formas variadas:
prefixo `-`, sufixo `D`/`C`, parênteses, ou coluna separada de débito/crédito.
Ano ausente deve ser inferido do período do documento, tratando a virada de
dezembro para janeiro.

**3b. Normalização de estabelecimento**
O rótulo cru é sujo: `PAG*IFOOD              SAO PAULO BR`,
`MP *PADARIABOM`, `PIX ENVIADO JOAO DA SILVA 12/03`. Construa um pipeline de
limpeza: remover prefixos de adquirente (`PAG*`, `MP *`, `PICPAY*`), cidade e
sigla de país, códigos numéricos, espaços múltiplos. O resultado alimenta o
ranking do bloco 5 e o motor de regras.

**3c. Categorização — arquitetura em cascata, nesta ordem**
1. Regra do usuário (mais forte, sempre vence)
2. Regra por padrão de estabelecimento (dicionário de regex embutido)
3. Similaridade com transações já categorizadas do mesmo usuário
4. LLM apenas para o que sobrou, em lote, e o resultado vira uma nova regra
5. O que ainda restar vai para a fila de revisão

Justifique por que a chamada de LLM é o último passo e não o primeiro, em
termos de custo, latência, determinismo e reprodutibilidade.
</camada_3_normalizacao>

<camada_4_ingestao_pdf>
Só agora o parser. Ele precisa entregar exatamente o que a Camada 3 consome —
nada mais.

**Decisão de arquitetura que você deve me apresentar com trade-offs:**
extrair no cliente (`pdfjs-dist`, o PDF nunca sai do navegador) ou no servidor
(Edge Function, mais robusto, mas dado financeiro trafega). Considere LGPD e
a sensibilidade do dado. Recomende uma e diga o que se perde na escolha.

**Dois tipos de PDF, tratamento diferente:**
- Com camada de texto: extração direta com posicionamento (x, y) para
  reconstruir colunas. A maioria dos bancos digitais.
- Escaneado/imagem: exige OCR. Trate como caso de segunda fase — na primeira
  versão, detecte e avise o usuário em vez de produzir lixo silencioso.

**Estratégia de parser por instituição:**
Não escreva um parser universal. Escreva um detector de layout + parsers
específicos, com uma interface comum:

  interface StatementParser {
    detect(text: string): boolean
    parse(doc: PdfDocument): RawTransaction[]
  }

Comece por Nubank (extrato e fatura), Itaú e Inter. Deixe o registro de
parsers extensível para eu adicionar bancos depois sem tocar no núcleo.

**Fatura de cartão tem campos que o extrato não tem:** parcelamento
(`PARC 03/10`), IOF, compras em moeda estrangeira com cotação, encargos,
pagamento da fatura anterior. Modele isso.
</camada_4_ingestao_pdf>

<armadilhas_conhecidas>
Trate cada uma explicitamente no plano. Elas são a diferença entre um número
certo e um número que parece certo:

1. **Dupla contagem cartão × extrato.** O pagamento da fatura aparece como uma
   saída de R$ 3.000 no extrato, e as 40 compras que a compõem aparecem na
   fatura. Somar os dois conta o mesmo dinheiro duas vezes. Defina uma regra
   clara: o pagamento de fatura é transferência interna, não despesa.
2. **Transferência entre contas próprias** não é entrada nem saída. Precisa
   ser identificada e neutralizada, senão infla os dois lados.
3. **Estorno e chargeback** entram como crédito no cartão e podem virar
   "renda" por engano.
4. **Meses sobrepostos.** O usuário importa o mesmo período duas vezes. O
   `dedup_hash` resolve — mas cuidado: duas compras idênticas no mesmo dia e
   valor no mesmo estabelecimento são legítimas. Inclua um discriminador.
5. **Parcelamento.** Uma compra de R$ 1.200 em 12x é R$ 100/mês, não R$ 1.200
   no mês da compra. Decida e documente qual visão o dashboard mostra — e
   ofereça as duas.
6. **Fatura fechada vs período de competência.** A fatura de março contém
   compras de fevereiro. O gráfico "por mês" precisa usar a data da compra,
   não a data da fatura.
7. **PIX** pode ser qualquer coisa: renda, reembolso de amigo, pagamento a
   fornecedor. Não force categoria — é o principal caso da fila de revisão.
8. **Salário** pode chegar fracionado (adiantamento + saldo). Detectar como
   recorrente exige tolerância no valor.
</armadilhas_conhecidas>

<restricoes>
- Nenhum dado financeiro sai do controle do usuário sem ele saber. Se algum
  passo enviar dado a uma API externa, isso deve estar explícito na UI.
- RLS ativa em toda tabela desde a primeira migration.
- Sem `any` no TypeScript. Todo dado que cruza fronteira (PDF → app, app →
  banco) passa por schema Zod.
- Não instale biblioteca de gráfico, estado ou UI além do que listei.
- Código sem comentário óbvio. Nome de variável explica; comentário só onde a
  regra de negócio não é dedutível do código (as armadilhas acima merecem).
- Nada de dado mockado silencioso: se um número não puder ser calculado,
  mostre estado vazio, não zero.
</restricoes>

<criterios_de_aceite>
Considere a entrega válida somente se:
1. Importar um extrato e a fatura do mesmo mês NÃO duplica o gasto do cartão.
2. Reimportar o mesmo PDF não cria transação nova.
3. Soma das categorias = total de saídas do período, sem sobra.
4. Uma compra em 10x aparece como 10 lançamentos futuros no bloco 8.
5. Mais de 85% das transações saem categorizadas sem intervenção do usuário.
6. Um usuário não consegue ler transação de outro, mesmo forjando o request.
7. `raw_text` preservado em 100% das transações.
</criterios_de_aceite>

<formato_de_saida>
Responda em fases. NÃO avance de fase sem meu "ok".

**Fase 0 — Diagnóstico (só texto, zero código)**
- O encadeamento das quatro camadas conforme o <metodo>
- As decisões de arquitetura com trade-off, cada uma com sua recomendação
- Riscos que você enxerga e que eu não listei
- Perguntas que você precisa que eu responda antes de modelar

**Fase 1 — Schema + migrations Supabase**
**Fase 2 — Parser de uma instituição, com testes**
**Fase 3 — Pipeline de normalização e categorização**
**Fase 4 — Dashboard**

Em cada fase: código completo e funcional dos arquivos daquela fase, caminho
de cada arquivo, e ao final o comando para eu verificar que funcionou.
</formato_de_saida>

<antes_de_comecar>
Se qualquer premissa acima estiver ambígua ou parecer errada, diga antes de
começar. Discordar de mim é mais útil do que executar um plano ruim com
fidelidade. Comece pela Fase 0.
</antes_de_comecar>
```

---

## As técnicas usadas, e por que cada uma está aí

| Técnica | Onde aparece | O que ela evita |
|---|---|---|
| **Atribuição de papel específico** | `<papel>` | "Engenheiro sênior" genérico produz resposta genérica. "Já construiu importador de extrato brasileiro" ativa o conhecimento de domínio certo. |
| **Contexto do operador** | `<contexto_do_projeto>` | Sem dizer que backend é sua área fraca, o modelo explica demais o React e de menos o Postgres. |
| **Engenharia reversa por camadas** | `<metodo>` | Impede o erro clássico: construir o parser primeiro e descobrir campos faltando na hora do gráfico. |
| **Saída como contrato** | `<camada_1_dashboard>` | Define o destino antes do caminho. Todo campo passa a ter que se justificar. |
| **Injeção de conhecimento de domínio** | `<armadilhas_conhecidas>` | É a seção mais valiosa. Nenhum modelo lembra sozinho da dupla contagem extrato × fatura, e é o bug que faz o dashboard inteiro mentir. |
| **Restrição negativa** | `<restricoes>` | Dizer o que **não** fazer é mais eficaz que dizer o que fazer. "Não instale outra lib de gráfico" evita 40 minutos de refatoração. |
| **Critério de aceite falsificável** | `<criterios_de_aceite>` | Transforma "ficou bom?" em teste objetivo. Cada item é verificável com um PDF real. |
| **Controle de fase** | `<formato_de_saida>` | Sem isso o modelo despeja 2.000 linhas de uma vez e você não consegue revisar nada. |
| **Convite explícito à discordância** | `<antes_de_comecar>` | Contrapeso à tendência de concordar. Se sua premissa estiver errada, você quer saber na Fase 0, não na Fase 4. |

## Duas coisas para ajustar antes de rodar

**Priorize os bancos que você realmente usa.** Coloquei Nubank, Itaú e Inter como chute. Troque pelos seus — cada parser é trabalho real, e três é o máximo que vale fazer antes de validar o resto do fluxo.

**Tenha um PDF de teste em mãos na Fase 2.** A qualidade do parser depende inteiramente do layout real. Se puder, anonimize um extrato seu (troque nomes e valores, mantenha a estrutura) e cole no contexto da Fase 2 — o parser sai muito mais preciso do que se o modelo tiver que adivinhar o layout.
