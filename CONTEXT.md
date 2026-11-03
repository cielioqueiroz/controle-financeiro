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
ler: `nubank`, `bradesco`, `bb`, `sicredi`, `sicoob`, `mercadopago` e `caixa`.
**Estar no catálogo não é o mesmo que ser legível**: quem responde o que o app lê
é `domain/parsers/index.ts`, não esta lista — e é ele, não ela, que autoriza um
nome novo no carrossel da tela de acesso. Caixa aqui significa GovConta.
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

**Líquido de curto prazo**:
A soma dos **saldos** menos o **em aberto** declarado pelos cartões. **Próximas
faturas** não entram: parcela futura não vence agora. Cartão que só declara
próximas faturas fica fora da conta, e a tela diz qual.
_Em código_: `liquidoCurtoPrazo` (`domain/folego.ts`)
_Evitar_: patrimônio, saldo líquido, disponível

**Dias de fôlego**:
Quantos dias o dinheiro de hoje dura no ritmo do **gasto real** médio dos
últimos 90 dias, contados até a data do saldo mais recente. Parte do **líquido
de curto prazo** quando ele existe; senão, do saldo. Com menos de 30 dias de
histórico, cala.
_Em código_: `diasDeFolego` (`domain/folego.ts`)
_Evitar_: autonomia, reserva, runway (em código)

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

**Estorno**:
O crédito na fatura que devolve uma compra. É a compra voltando, não renda:
fica como `compra` com valor negativo (`expense` depois de salvo), abate o gasto
da categoria e entra no "Total a pagar" com o sinal dele. Como `entrada`, inflaria
o gasto real e as entradas ao mesmo tempo — foi o defeito do Bradesco e do
Mercado Pago até 2026-10-30, corrigido no histórico pela migração `0012`.
_Evitar_: reembolso, devolução, crédito (sozinho)

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

**Dívida**:
A categoria `dividas`: amortização de empréstimo, financiamento, consignado ou
renegociação. É gasto real, mas não é consumo nem **encargo** — IOF e juros,
mesmo os de um empréstimo, continuam em `taxas`.
_Em código_: `ehDivida`, `dividasCents`
_Evitar_: taxa, prestação, parcela (parcela é `installment`)

**Consumo**:
O gasto real sem as dívidas: o que o mês custou para ser vivido.
`consumoCents + dividasCents === gastoCents`, então separar não esconde
dinheiro. Diagnósticos e "maior categoria" medem o consumo; sem isso, a
parcela de um empréstimo seria a resposta de todo mês. ("Consumo da renda", no
comparativo, é outra conta — gasto real ÷ entradas — e é frase de tela.)
_Em código_: `consumoCents`
_Evitar_: gasto do dia a dia, despesa corrente

**Gasto atípico**:
A compra avulsa de consumo que destoa da rotina da própria categoria: vale
pelo menos 5× a mediana das outras compras avulsas da categoria no histórico
inteiro **e** pelo menos R$ 300. Com menos de cinco outras compras na
categoria, nada é atípico. Parcela, recorrência, dívida, estorno, entrada e
vínculo nunca são. Atípico é leitura, não exclusão: sai dos gráficos do
período quando a pessoa pede, e o gasto real continua com ele. Nos
Relatórios sai só do gráfico de categorias: o **Fluxo do período** fecha no
Resultado, e o Resultado conta a compra atípica.
_Em código_: `gastosAtipicos`, `LIMIAR_ATIPICO` (`domain/atipicos.ts`)
_Evitar_: outlier (em código), extraordinário, fora da curva, pontual

**installment**:
Uma das cobranças de uma compra dividida, com o número e o total (`03/10`).
_Em português_: parcela
_Evitar_: prestação, dividido

**Compromisso futuro**:
A projeção das parcelas que ainda vão cair, mês a mês. Nunca é salvo no banco: é
sempre cálculo, feito a partir da parcela mais recente conhecida de cada série.
_Evitar_: previsão, agendado, conta a pagar

**Fluxo do período**:
O caminho do dinheiro no período do relatório, em dois lados que fecham no
mesmo total. À esquerda, as **origens**: as entradas por banco, os
**estornos** das categorias que terminaram negativas e, se o gasto passou
das entradas, o que **faltou**. À direita, os **destinos**: as oito maiores
categorias de gasto, as outras juntas e, se as entradas passaram do gasto, o
que **sobrou**. Entradas + estornos + faltou = categorias positivas +
sobrou, e o sobrou é o resultado do relatório. Não diz qual banco pagou qual
categoria: o documento não sabe, e o desenho passa tudo por um total no
meio. **Não é o mesmo que o gráfico "Fluxo financeiro"**, que compara
entradas e saídas mês a mês.
_Em código_: `fluxoDoPeriodo` (`domain/fluxo-periodo.ts`)
_Evitar_: sankey (em código de domínio), DRE, fluxo de caixa, orçamento

**Calendário do próximo mês**:
O que deve cair, dia a dia, no mês seguinte à competência mais recente com
dado: as **recorrências** ativas no dia típico delas (de saída e de entrada)
e as parcelas do **compromisso futuro**, somadas por cartão no dia de
vencimento da última fatura dele. É projeção, nunca gravada. A régua é o
histórico, não o relógio: quem importou até agosto vê setembro. A
recorrência entra com o valor típico, ou com o último quando o alerta de
valor mudou o acusa — e então diz quanto era antes.
_Em código_: `calendarioDoProximoMes` (`domain/calendario.ts`)
_Evitar_: agenda (em código), previsão, contas a pagar

**Comprometimento de renda**:
Quanto das entradas do recorte foi para parcelas e dívidas: (parcelas +
dívidas) ÷ entradas. Mede o que já saiu, no mesmo recorte das entradas; a
dívida que vem com número de parcela conta uma vez só. As faixas (até 30%,
até 40%, acima) são referência de educação financeira, **não norma do Banco
Central**, e a tela diz isso. Sem entradas não há fração.
_Em código_: `comprometimentoDeRenda` (`domain/comprometimento.ts`)
_Evitar_: endividamento (é o estoque da dívida, não a parcela do mês), consumo da renda

**Fatura paga a menor**:
Fatura cujo pagamento encontrado nos documentos ficou abaixo do "Total a
pagar"; a diferença vai para o rotativo. O pagamento vem do registro na fatura
seguinte do mesmo cartão ou, sem ele, do extrato, com a mesma unicidade da
quitação. Sem pagamento nenhum, o app cala: não sabe se a conta que pagou foi
importada.
_Em código_: `faturasPagasAMenor` (`domain/link/quitacao-parcial.ts`)
_Evitar_: inadimplência, pagamento mínimo (o valor pode estar acima dele)

**Juros de atraso**:
O **encargo** que só existe porque uma conta não foi paga inteira até o
vencimento: juros e IOF do rotativo, juros do cheque especial, mora e multa.
Continua em `taxas`; o diagnóstico próprio só o separa do "taxas altas".
_Em código_: tipo `juros-atraso` em `diagnosticar`
_Evitar_: taxas (sozinho), tarifa

**Estabelecimento**:
Quem recebeu o dinheiro, reduzido a uma chave estável a partir da descrição do
banco — sem prefixo de adquirente, sem cidade, sem parcela.
_Em código_: `merchant`, `normalizeMerchant`
_Evitar_: loja, fornecedor, comerciante

**Descrição**:
O texto original do banco para a transação. Imutável — é o que permite auditar
contra o PDF, e é por ela que o ranking de estabelecimentos agrupa. Na tela,
quando vem toda em caixa alta, aparece em caixa de título; gravada, não muda.
_Em código_: `caixaDeTitulo`, `nomeExibido` (`domain/normalize/descricao.ts`)
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

**Falha registrada**:
O rastro que fica quando algo quebra na tela de alguém: a **classe** do erro, o
**contexto**, a rota, o build e o navegador — e nada do documento. Não é log, não
é erro: é o mínimo que identifica o defeito sem carregar o dado que o causou.
Ver [ADR-0015](./docs/adr/0015-registro-de-falhas-do-cliente.md).
_Em código_: `registrarFalha`, `ContextoFalha` (`persist/falhas.ts`)
_Evitar_: telemetria, log, evento, monitoramento, crash

**Preferências**:
As escolhas da pessoa sobre como o app se comporta e a chama: apelido, cor do
avatar, idioma, tema, modo discreto e o período com que as telas abrem. Valem
em todo aparelho: a conta guarda (tabela `preferencias`) e o aparelho tem uma
cópia, porque o tema precisa valer antes da primeira pintura. No login vence a
conta. Nulo é "não escolheu", e o app cai no padrão dele. Ver
[ADR-0023](./docs/adr/0023-preferencias-em-tabela-propria.md).
_Em código_: `Preferencias`, `sincronizarPreferencias`, `gravarPreferencias`
(`lib/preferencias.ts`, `aplicacao/comandos/preferencias.ts`)
_Evitar_: configurações, settings, ajustes, opções

**Integridade do recorte**:
A garantia de que o recorte contém **tudo** o que o histórico tem para aquele
filtro — nem uma transação a menos. É irmã da **Conferência** e responde a outra
metade da mesma promessa: a Conferência garante que todo número na tela veio de
um documento; a integridade do recorte garante que todo documento está no número.
Conferência olha o PDF contra o gabarito; esta olha a resposta do banco contra a
contagem que o próprio banco declara.
_Em código_: `RecorteIncompletoError` (`persist/puxar.ts`)
_Evitar_: completude, integridade (sozinho — o banco também usa a palavra para
as relações entre usuários), paginação

**Filtros**:
A descrição do recorte, que vive na query string da URL — período, referência,
banco, categoria e busca.
_Evitar_: recorte, estado da tela, parâmetros

**Procedência**:
Os documentos que sustentam os números do recorte — quantos, de que tipo e de
quais bancos. É a promessa de o app ser retrospectivo, dita na tela: todo número
veio de um documento. **Não é o mesmo que Filtros**: filtro é o que foi
*escolhido*, procedência é o que foi *encontrado*, e os dois divergem sempre que
o recorte cai num mês cuja fatura ninguém importou. Ela também diz o que o
recorte **sabe que falta**: a quitação de fatura, vinda de extrato, que não
achou a fatura que pagou. A quitação sai do gasto real contra a dupla
contagem, e sem a fatura as compras dela podem não estar no número.
_Em código_: `Procedencia`, `quitacoesSemFatura`
_Evitar_: origem, fonte, lastro, cobertura

**Composição**:
As transações que formam **um** número do resumo — entradas, gasto real ou
resultado — e quanto cada uma contribui para ele, no sinal do número: no
resultado, a entrada soma e a despesa subtrai. Segue a regra de `agregar`, e
por isso nenhum vínculo entra. **Não é o mesmo que Procedência**: a
procedência descreve o recorte inteiro; a composição abre um número só, e é
ela que a tela mostra em "De onde vem".
_Em código_: `composicaoDoNumero`, `contribuicao` (`domain/agrupar.ts`)
_Evitar_: origem, detalhamento, parcela (parcela é `installment`)

**Cobertura**:
A grade **fonte × competência** do histórico inteiro: para cada banco e tipo
de documento, mês a mês, se o documento foi importado, falta, é do mês em curso
(pode nem existir ainda) ou é anterior à primeira importação daquela fonte.
**Não é o mesmo que Procedência**: a procedência descreve o recorte na tela; a
cobertura descreve o histórico e responde "o que eu ainda não importei?".
_Em código_: `coberturaDocumentos` (`domain/cobertura.ts`), `CoberturaDocumentos`
_Evitar_: completude, matriz, checklist

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
O casamento entre um padrão — trecho da descrição normalizada, CNPJ ou consulta
com operadores — e uma categoria, com prioridade. Consulta usa o mesmo avaliador
de `Operador`; `cat:` e `sem:categoria` leem a categoria-base global, antes das
regras do usuário. Uma regra criada pelo usuário vale para importações futuras.
_Evitar_: mapeamento, filtro

**Categoria-base**:
A categoria calculada apenas pelas regras globais, antes de aplicar regras do
usuário. É estável para que uma regra com `cat:` não dependa da ordem de outras
regras aprendidas.
_Em código_: categoria global em `categoriaDe`
_Evitar_: categoria anterior, categoria atual

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
