# Capital Financeiro

Sistema **retrospectivo** de finanças pessoais: o usuário importa PDFs de fatura e
extrato, e o app responde para onde o dinheiro foi. Nada é digitado à mão — todo
número na tela veio de um documento do banco.

> **Como ler este arquivo.** É um glossário, e só. Não há decisão de arquitetura
> aqui (essas ficam em [`docs/adr/`](./docs/adr/)) nem armadilha de ferramenta
> (essas ficam no [`CLAUDE.md`](./CLAUDE.md)).
>
> O **termo canônico é o que o código usa**, mesmo quando é inglês. Onde o código
> usa a palavra inglesa e existe uma tradução aceita para prosa e UI, ela aparece
> como `_Em português_`. `_Evitar_` lista o que **não** se deve escrever.
>
> A UI pode mostrar ao usuário uma palavra diferente da canônica — a página de
> transações se chama "Lançamentos", e isso é escolha de produto, não sinônimo
> autorizado em código ou em discussão técnica.

## Documento

**Documento**:
Um PDF de banco importado pelo usuário, com o período que cobre e os números que
declara. É a única fonte de dado do sistema.
_Evitar_: arquivo, upload, importação

**Fatura**:
Documento de cartão de crédito, que declara um "Total a pagar" e vence numa data.
_Evitar_: invoice, conta do cartão

**Extrato**:
Documento de conta corrente, que declara entradas, saídas e/ou a progressão de
saldo ao longo de um período.
_Evitar_: statement, movimentação

**Banco**:
A instituição emissora do documento, de um catálogo fechado do que o app sabe
ler: `nubank`, `bradesco`, `bb`, `sicredi`, `sicoob`, `mercadopago`. **Estar no
catálogo não é o mesmo que ser legível**: quem responde o que o app lê é
`domain/parsers/index.ts`, não esta lista — e é ele, não ela, que autoriza um
nome novo no carrossel da tela de acesso.
_Evitar_: instituição, emissor, financeira

**Gabarito**:
O total que o próprio documento declara e contra o qual a extração é conferida —
"Total a pagar" na fatura; totais de entrada e saída, ou a progressão de saldo, no
extrato.
_Evitar_: total declarado, checksum, controle

**Conferência**:
O confronto entre o que o parser extraiu e o gabarito, com três resultados
possíveis: `confere`, `diverge`, `sem-gabarito`. É o mecanismo de confiança do
sistema — divergir faz o app avisar em vez de mostrar número errado.
_Evitar_: validação, checagem, verificação

## Conta e saldo

**Conta**:
Onde o dinheiro está: uma conta corrente (`checking`) ou um cartão de crédito
(`credit_card`). Cartão é conta neste sistema.
_Evitar_: banco, cartão (quando se quer dizer a conta)

**Saldo**:
O que a conta corrente tinha ao fim do extrato mais recente dela. Só existe para
extrato — fatura não tem saldo.
_Evitar_: saldo disponível, balance

**Em aberto**:
O que já foi gasto no ciclo do cartão que ainda não fechou. Só existe quando a
fatura declara o número: o Nubank declara, o Bradesco não.
_Evitar_: saldo do cartão, fatura atual, parcial

**Próximas faturas**:
O que já está comprado e ainda vai ser cobrado em faturas futuras — tipicamente
parcelas. Responde uma pergunta **diferente** de *em aberto*, ainda que a tela use
um rótulo só para os dois e desça a distinção para a linha de detalhe.
_Evitar_: futuro, a vencer, pendente

## Transação

**Transação**:
Uma linha de documento depois de extraída: data, descrição, valor em centavos e
natureza.
_Evitar_: lançamento, compra, movimento, item

**RawKind**:
A natureza da linha **como ela aparece no documento**: `compra`, `encargo`,
`pagamento` ou `entrada`.
_Evitar_: kind (sem qualificar), tipo, natureza

**`transactions.kind`**:
A natureza da transação **já salva**: `expense`, `income`, `internal_transfer` ou
`card_payment`. Não é o mesmo conjunto do `RawKind`, e a conversão entre os dois
perde informação — a tabela está em [ADR-0002](./docs/adr/0002-quitacao-de-fatura-nao-e-despesa.md).
_Evitar_: kind (sem qualificar), tipo, natureza

**Encargo**:
Gasto cuja contraparte é o próprio banco — IOF, anuidade, tarifa, juros. **É gasto
seu**: compõe o "Total a pagar" da fatura e cai na categoria `taxas`.
_Evitar_: taxa (ambíguo com o nome da categoria), custo bancário, tarifa

**Vínculo**:
Marca que tira uma transação da contagem de gastos porque o dinheiro só mudou de
lugar, não foi consumido. Três causas: quitação de fatura, transferência entre
contas do próprio titular, e varredura/aplicação automática.
_Evitar_: link (em prosa), transferência (como guarda-chuva)

**Dupla contagem**:
Somar o mesmo dinheiro duas vezes ao importar a fatura e o extrato do mesmo mês —
as compras aparecem detalhadas na fatura e a quitação delas aparece inteira no
extrato. É o que o vínculo existe para impedir.
_Evitar_: duplicidade, duplicata, redundância

**Gasto real**:
A soma das saídas depois de descontar os vínculos. É o número honesto do sistema.
_Evitar_: total de saídas, despesa, gasto (sozinho, quando a distinção importa)

**Gasto ingênuo**:
A mesma soma **sem** descontar os vínculos. Existe só para mostrar ao usuário
quanto de dupla contagem desapareceu na importação.
_Evitar_: total bruto, gasto aparente

**installment**:
Uma das cobranças de uma compra dividida, com o número e o total (`03/10`).
_Em português_: parcela
_Evitar_: prestação, dividido

**Compromisso futuro**:
A projeção das parcelas que ainda vão cair, mês a mês. Nunca é salvo no banco: é
sempre cálculo, feito a partir da parcela mais recente conhecida de cada série.
_Evitar_: previsão, agendado, conta a pagar

**Estabelecimento**:
Quem recebeu o dinheiro, reduzido a uma chave estável a partir da descrição do
banco — sem prefixo de adquirente, sem cidade, sem parcela.
_Em código_: `merchant`, `normalizeMerchant`
_Evitar_: loja, fornecedor, comerciante

**Descrição**:
O texto original do banco para a transação. Imutável — é o que permite auditar
contra o PDF, e é por ela que o ranking de estabelecimentos agrupa.
_Evitar_: título, nome da compra, histórico

**Rótulo**:
O texto que o usuário escreveu por cima da descrição, exibido no lugar dela. Nunca
agrupa nada: renomear uma compra não pode partir um grupo em dois.
_Em código_: `label`
_Evitar_: apelido, nome, alias

## Tempo e recorte

**Competência**:
O mês em que um lançamento conta para o usuário. Numa fatura é o mês do
**vencimento**; num extrato, o mês em que o período do documento termina. Ver
[ADR-0001](./docs/adr/0001-competencia-e-o-mes-do-vencimento.md).
_Evitar_: mês de referência, mês da compra, período

**Recorte**:
O subconjunto do histórico que está na tela: as transações visíveis mais o resumo
delas.
_Evitar_: filtro, seleção, view, fatia

**Filtros**:
A descrição do recorte, que vive na query string da URL — período, referência,
banco, categoria e busca.
_Evitar_: recorte, estado da tela, parâmetros

**Procedência**:
Os documentos que sustentam os números do recorte — quantos, de que tipo e de
quais bancos. É a promessa de o app ser retrospectivo, dita na tela: todo número
veio de um documento. **Não é o mesmo que Filtros**: filtro é o que foi
*escolhido*, procedência é o que foi *encontrado*, e os dois divergem sempre que
o recorte cai num mês cuja fatura ninguém importou.
_Em código_: `Procedencia`
_Evitar_: origem, fonte, lastro, cobertura

**Operador**:
O pedaço da busca que restringe por algo que não é texto — `>100`, `<50`,
`banco:nubank`, `cat:farmacia`, `sem:categoria`. Mora dentro da caixa de busca, e
**não** é um filtro: filtro é a descrição do recorte inteiro, escrita na URL.
Operador que o app não conhece vira texto, nunca some.
_Em código_: `Operador`, `casaOperador` (`domain/consulta.ts`)
_Evitar_: filtro, modificador, comando

**Consulta**:
Uma busca já analisada: o texto livre que sobrou, mais os operadores extraídos
dele. (Em `aplicacao/consultas/` a palavra tem outro sentido, de arquitetura — o
lado de leitura do CQRS, oposto de `comandos/`. Ver
[ADR-0010](./docs/adr/0010-cqrs-e-integridade-de-dados.md).)
_Em código_: `Consulta`, `analisarConsulta`, `casaConsulta`
_Evitar_: query, pesquisa, termo

**Período**:
A granularidade do recorte: `dia`, `semana`, `mes` ou `ano`. Dia e Semana usam a
data real da transação; Mês e Ano usam a competência.
_Evitar_: intervalo, faixa, range

## Classificação

**Categoria**:
O rótulo de consumo de uma transação, vindo de um catálogo fechado com slug, nome,
ícone e cor.
_Evitar_: tag, grupo, rubrica, classe

**Regra**:
O casamento entre um padrão — trecho da descrição normalizada, ou CNPJ — e uma
categoria, com prioridade. A regra do usuário nasce acima de qualquer regra global.
_Evitar_: mapeamento, filtro, condição

**Aprendizado**:
A regra que nasce sozinha quando o usuário corrige a categoria de uma transação. É
o que faz a próxima ocorrência do mesmo estabelecimento já entrar certa.
_Evitar_: treino, memória, ML, IA

**Recorrência**:
Um estabelecimento que cobra em três ou mais competências distintas, tipicamente
uma vez por mês. Parceladas ficam de fora — aquilo é compromisso futuro.
_Evitar_: assinatura, gasto fixo, conta fixa, despesa mensal

**Assinatura**:
A categoria de serviços cobrados por mensalidade (Netflix, Spotify). **Não** é
sinônimo de recorrência: aluguel é recorrência e não é assinatura. (Em
`domain/pdf/detect` a palavra tem outro sentido, interno àquele módulo: os
marcadores textuais que identificam o banco de um PDF.)
_Evitar_: usar no sentido de "o que se repete todo mês"
