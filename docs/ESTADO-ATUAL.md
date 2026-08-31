# Estado atual do projeto — retomada

> Documento de continuidade. Última atualização: **2026-08-31** (parte 3).
> Leia isto antes de continuar. O README explica o projeto; aqui está **onde paramos**,
> **o que já foi decidido** e **o que vem a seguir**.

> **Atualização 2026-08-29:** a migração `0003_integridade_referencias_por_usuario.sql` foi aplicada e conferida na branch `production` do Neon (`neondb`). A função e os dois gatilhos de integridade entre usuários estão ativos.

> **Três coisas saíram deste arquivo em 2026-08-17** e agora moram em lugar próprio.
> Este documento continua sendo a porta de entrada, mas não é mais dono delas:
>
> | Onde | O quê |
> |---|---|
> | [`CONTEXT.md`](../CONTEXT.md) | **O vocabulário.** O que é competência, vínculo, recorte, encargo — e o que não se deve escrever no lugar de cada um. |
> | [`docs/adr/`](./adr/) | **As decisões duras**, com o porquê e as alternativas recusadas. A primeira é a competência. |
> | [`CLAUDE.md`](../CLAUDE.md) | **As armadilhas de ferramenta e ambiente**, que antes viviam aqui na seção "Notas de armadilha". Lá elas entram em contexto sozinhas. |

## Rodada 2026-08-31 (parte 3) — o Mercado Pago passou a ser lido

As amostras chegaram (fatura do cartão e extrato da conta) e os dois parsers
foram escritos contra elas. **Os dois conferem ao centavo** na primeira
execução: a fatura fecha R$ 621,34 contra o "Resumo da fatura", o extrato fecha
R$ 135,18 de entradas e R$ 135,18 de saídas contra os totais declarados.

9 lançamentos na fatura, 21 no extrato, 27 testes novos.

### O que este banco faz e nenhum outro fazia

**No extrato, a descrição fica ACIMA e ABAIXO da linha do valor ao mesmo
tempo:**

```
Pix recebido MARIAXXX DA                      ← prefixo   (y 417)
08-08-2026 171802730931 R$ 100,00 R$ 100,00   ← o valor   (y 410)
APARECIDA SANTOSS                             ← sufixo    (y 405)
```

⚠️ **O que junta os três é a DISTÂNCIA, não a vizinhança.** "A linha de cima e a
de baixo" quebra em lançamentos seguidos: entre dois valores há ~30pt, e a
linha logo abaixo de um deles pode ser o prefixo do *próximo*. Fragmentos da
mesma descrição ficam a 5–7pt. O teste que guarda isso conta as 11 linhas de
"Rendimentos" — se o critério estivesse errado, uma delas viria colada em
"Débito por dívida".

**Na fatura, a palavra "Total" aparece três vezes**, em páginas diferentes e
com sentidos diferentes: R$ 621,34 é a fatura (p. 1 e 2) e R$ 711,89 são os
lançamentos futuros (p. 4). Cada leitura é ancorada num título. Ler o segundo
faria o gabarito **conferir contra o número errado**, que é pior que não
conferir — a conferência é o mecanismo de confiança do sistema.

### Um erro meu, achado antes de commitar

Classifiquei "Débito por dívida Empréstimos Mercado Pago" como `pagamento`.
Estava errado: `pagamento` vira `card_payment`, que é **vínculo**, e sairia do
gasto real — R$ 79,32 desapareceriam da conta sem ninguém pedir. O vínculo
existe contra **dupla contagem** entre fatura e extrato do mesmo mês
(`CONTEXT.md`: quitação de fatura, transferência entre contas próprias,
varredura automática), e a parcela do empréstimo não está contada em documento
nenhum além deste. É `compra`, e tem categoria própria.

### ⚠️ Dois dados que atravessaram todas as gerações de fixture sem anonimizar

Achados ao gerar os fixtures novos, **não** procurados:

| O quê | Onde |
|---|---|
| `3117878715-6` — número de conta solto | `nubank-extrato.items.json` |
| `L C COMERCIO` — razão social de terceiro | `nubank-extrato.items.json` |

Nenhum é nome de pessoa nem CPF, e a varredura de 13/08 (que declarou os
fixtures anonimizados) olhava a lista `PROIBIDOS`, que não os continha — a
auditoria só sabe procurar o que já lhe ensinaram. Os dois ganharam regra e
entraram na lista. **O repositório é público desde 25/08**, então eles
estiveram expostos por seis dias.

Junto: o embaralhador de IDs de operação (9+ dígitos, determinístico) ficou
**restrito ao Mercado Pago**. Ligado para todos, ele reescrevia dado que já era
falso — o código de barras e a conta trocada do Bradesco — e fixture que muda
sem motivo é diff que ninguém lê.

### O que mais entrou

- `extractInstallment` ganhou o **terceiro** formato de parcela do projeto:
  "Parcela 1 de 4" (o Nubank escreve "- Parcela 5/8", o Bradesco cola "02/06").
- `gerar-fixtures.ts` aceita **várias pastas**: as amostras vivem por safra
  (`junho2026`, `agosto2026`), e exigir tudo numa pasta só obrigaria a copiar
  PDF com CPF de um lugar para outro a cada banco novo.
- **Mercado Pago entrou no carrossel** da tela de acesso — agora ele lê, então
  agora pode dizer que lê.
- As assinaturas do detector não dependem de ordem: `DETALHE DOS MOVIMENTOS` +
  `ID da operação` são exclusivas. "EXTRATO DE CONTA" sozinho casaria por
  prefixo com o "Extrato de Conta Corrente" do BB.

✅ **A migração `0004` foi APLICADA e conferida em produção (2026-08-31).** Feita
pelo console do Neon (branch `production`, base `neondb`), no navegador do
usuário — o MCP do Neon segue sem autorização, mas o console logado serve.

Antes: `CHECK (bank = ANY (ARRAY['nubank','bradesco','bb','sicredi','sicoob','desconhecido']))`.
Depois: a mesma lista **com `mercadopago`**, lida de volta com
`pg_get_constraintdef` — não pelo "Statement executed successfully", que só diz
que o comando não deu erro.

Conferido junto, porque é o outro jeito de a importação falhar inteira: as cinco
colunas que `salvar.ts` grava a partir do `Forward` e do `balance` existem em
`documents` (`end_balance_cents`, `future_installments_total`, `next_close_date`,
`next_invoice_balance`, `total_open_balance`).

`npm run verificar` verde nos seis passos; 10 medições de overflow verdes com o
sexto banco no carrossel; prints regerados.

## Rodada 2026-08-31 (parte 2) — o desenho volta seis dias, e a navegação vira calha

O usuário mandou duas imagens e pediu a barra lateral de uma e a tela de acesso
da outra. **As duas imagens eram do desenho de ANTES de 25/08** — conferido
extraindo o print do commit `c90851b`, que bate item a item com a referência:
moeda R$, card arredondado com sombra, "OU", rodapé com a assinatura.

Isso punha os dois pedidos em conflito: as seis propostas aprovadas de manhã
eram todas continuações do "impresso e terminal" (carimbo, régua grossa, banda,
impressão), e as imagens pedem raio, cartão e gradiente — o oposto das regras
1, 2 e 3. Perguntado se era só a estrutura ou a direção inteira, o usuário
respondeu **a direção inteira**.

### 1. O revert, e por que ele foi barato

`git revert f4bd601` — a direção inteira cabia num commit: `index.css`,
`fontes.css`, `index.html` e retoques em 18 componentes. **Dois conflitos**, e
os dois resolvidos a favor do HEAD porque não eram de desenho: o alvo de toque
de 44px veio da correção de acessibilidade de 28/08. *Desenho é gosto;
contraste e alvo de toque são requisito.*

Isso virou a consequência principal da [ADR-0012](./adr/0012-o-livro-razao-volta-e-a-calha-lateral-nasce.md):
**toda direção visual futura tem que caber num commit reversível.** Se um
redesenho se espalhar por cinquenta arquivos de componente, ele deixa de ser
reversível e vira reescrita.

Voltou junto a `Celebracao.tsx`, o confete que o redesign havia aposentado por
"não caber num sistema que raciona cor". Não raciona mais.

### 2. A calha lateral

Duas navegações sobre a mesma `ROTAS`: `NavLateral` a partir de `lg`,
`NavPrincipal` horizontal abaixo. 16rem num viewport de 390px levaria metade da
tela — e 390 é uma das duas larguras que o medidor roda.

⚠️ **Os modais de tutorial e de perfil subiram para o `App`.** Eles moravam no
`Cabecalho` com a razão escrita no próprio arquivo: *"só o menu de conta os
abre"*. O menu desceu para a calha e agora **dois** lugares o abrem — a razão
expirou, e o comentário que a guardava foi reescrito em vez de apagado.

Ícones casados pelo **caminho**, não pela posição: array paralelo deslocaria
todos os outros, em silêncio, no dia em que uma rota nova entrasse sem ícone.

### 3. A tela de acesso, e a medição que pagou na hora

O card de vidro e a moeda voltaram com o revert. Faltavam três coisas: o
gradiente ciano, o clima e os pontos dos bancos.

⚠️ **O ciano da imagem, aplicado ao tema claro, dá 3.94:1 — reprovado.** Texto
sobre gradiente precisa passar nas **duas pontas**, não na média, e o laço
antigo do `medir-contraste.py` não alcançava esse caso (lá o texto fica sobre
uma das três superfícies, nunca sobre algo que muda de cor ao longo da própria
largura). O script ganhou o par. No claro o gradiente ficou azul escuro com
tinta branca (**6.90:1**); o ciano ficou no escuro (**8.22:1**).

O `FundoAcesso` é `fixed` + `pointer-events-none` + `overflow-hidden`, como a
regra manda: o brilho **desta mesma tela** já criou barra de rolagem lateral
uma vez. 10 medições de overflow verdes.

### 4. Mercado Pago: metade, e a metade que falta é a que importa

Entrou o valor no tipo `Bank`, o tema e a **migração `0004`**. Não entrou a
assinatura em `detect.ts` nem o despacho em `parsers/index.ts` — assinatura de
layout é um conjunto de marcadores lidos de um PDF real, e inventar um é
escrever um detector que nunca casa ou, pior, que casa com o documento errado.

⚠️ **A migração `0004` é pré-requisito, não acabamento.** Sem ela o primeiro
insert de uma conta do Mercado Pago bate no CHECK e a importação inteira falha.
Aplicar na branch `production` do Neon **antes** do primeiro documento.

E ele fica **fora do carrossel**: aquilo diz "já lê os extratos de", e ainda não
lê.

### 5. O que aconteceu com as seis propostas de manhã

A reversão as atinge de forma desigual, e nenhuma foi feita:

| Proposta | Depois do revert |
|---|---|
| 01 carimbo de conferência | **Sobrevive.** Não depende de raio nem de fonte — depende de a conferência ser a tese, e ela continua sendo. |
| 02 folha de fechamento | **Sobrevive em parte.** O bloco de identificação vale; a "régua grossa que fecha total" era vocabulário do impresso. |
| 03 conciliação em duas colunas | **Sobrevive inteira.** É informação, não material. Continua a mais cara. |
| 04 banda de competência | **Sobrevive.** Bandar por bloco em vez de por linha independe da direção. |
| 05 régua do banco no lugar do ponto | **Morreu.** O argumento era gastar a única exceção de raio zero. Não há mais raio zero — e o ponto agora aparece também no carrossel. |
| 06 imprimir de verdade | **Enfraqueceu.** Era "a piada funcionando" num app que parecia impresso. Continua barata, mas perdeu o motivo. |

`npm run verificar` verde nos seis passos; contraste OK nos dois temas; 10
medições de overflow verdes; prints regerados.

## Rodada 2026-08-31 — a fila que sobrou era menor do que parecia, e mais suja

Quatro decisões do usuário, todas executadas. Duas mudaram de forma no meio,
pelo mesmo motivo de sempre: a medição discordou da previsão.

### 1. O backend serverless nunca entrou — e era ele a dívida de segurança

Havia código **não commitado** na árvore desde 28/08: `api/data.ts`,
`backend/api/{data,_auth,_db}.ts` e três dependências no `backend/package.json`.
A Fatia 1b, escrita contra um bloqueio que ninguém removeu em três semanas.

Descartada, com [ADR-0011](./adr/0011-backend-serverless-descartado.md). O que
o handler fazia era receber o Bearer, perguntar a sessão ao Neon Auth e injetar
o `sub` por `set_config` para então **deixar o RLS decidir** — que é o que ele
decide hoje, quando o navegador fala direto com a Data API. Uma indireção de
ganho, três de custo.

⚠️ **E aqui a previsão errou por completo.** O diário registrava, desde 13/08,
"pendência de segurança viva: 6 falhas na cadeia do SDK do Neon". Duas coisas
estavam erradas nessa frase:

1. **O SDK JÁ tinha sido atualizado** para `0.7.0-beta`, no commit `8a4130f`
   (28/08), e ninguém registrou. A [ADR-0008](./adr/0008-o-login-nao-tem-rede-de-testes.md)
   passou três dias afirmando o contrário do `package.json`.
2. **As 5 falhas que restavam eram do `@vercel/node`** — a dependência que a
   Fatia 1b trouxe. `path-to-regexp` e `undici`, 3 delas `high`.

Removida a pasta, `npm audit` foi a **zero**. A dívida de segurança do projeto
era a pasta que nunca deveria ter existido, não a biblioteca que se recusou a
atualizar por dois meses.

### 2. A ADR-0008 foi renomeada para o que ela sempre foi

`0008-sdk-do-neon-nao-atualizado.md` → `0008-o-login-nao-tem-rede-de-testes.md`.
A recusa do upgrade acabou; a **razão** dela não: a suíte mocka o SDK inteiro, e
regressão de autenticação passa verde do começo ao fim.

E como o que substitui o teste que não há é uma pessoa entrando com conta real,
o roteiro virou arquivo: [`docs/VALIDACAO-MANUAL.md`](./VALIDACAO-MANUAL.md),
com uma tabela de *quando* rodar cada seção. Fica de fora dele tudo o que virou
medidor — **lista manual que cresce é lista que ninguém roda**, e era isso que
estava acontecendo com as quatro peças do item 4.

### 3. Operador não é filtro, e o glossário não sabia

`domain/consulta.ts` exportava `type Filtro` para o pedaço de busca que
restringe (`>100`, `banco:nubank`). O `CONTEXT.md` já definia **Filtros** como
outra coisa: a descrição do recorte, que vive na URL. Dois conceitos separados
por **uma letra**, os dois vivos no mesmo código — `useRecorte.ts` usa `filtros`
num sentido, `consulta.ts` usava no outro.

O próprio módulo já chamava aquilo de operador na prosa. `Filtro` → `Operador`,
contido em dois arquivos. As duas palavras entraram no glossário, junto com a
**segunda colisão, que fica**: `consulta` é a busca analisada em `domain/` e o
lado de leitura do CQRS em `aplicacao/consultas/`. Essa não se resolve por
rename — a ADR-0010 nomeia a pasta — então ficou registrada, como a `assinatura`
já estava.

### 4. O medidor aprendeu a clicar, e achou um defeito de verdade

`medir-overflow.py` fazia `pagina.goto(URL)` e nada mais: media a tela de acesso
e **achava que tinha medido o app**. As quatro peças que atravessaram três
rodadas na lista do "falta abrir no navegador" — diagnósticos, modo discreto,
dica de sintaxe da busca, editor de compra — só existem depois de um clique ou
de um foco.

Agora são **jornadas**: rota + passos + **prova** + amostras. A prova não é
enfeite: medir depois de um clique que não aconteceu devolve OK, o mesmo OK de
uma tela sã — seria a versão em Playwright do "teste que passa dos dois jeitos"
já registrado aqui. Conferido quebrando de propósito: gatilho inexistente dá
`TimeoutError`, prova falsa dá `AssertionError`, e o medidor sai 1.

O alvo é a folha de provas (`demo.html`), que já era onde se olha antes de
publicar. Só o editor precisou de porta nova — chama `useDados`, que lança fora
do provider, e num navegador não existe `vi.mock`. Daí `DadosProvider sementes`.

⚠️ **E na primeira execução ele achou um defeito real: 438px num viewport de
390.** Não era da folha — o mesmo markup está em `Recorrencias.tsx:55`. Filho de
`grid` tem `min-width: auto` e recusa encolher abaixo do min-content: os dois
cards de compromissos ficavam com 414px numa coluna de 342, e **a página rolava
de lado no celular**. `overflow-hidden` no filho não resolvia, porque quem
estoura é o próprio filho. `min-w-0` nos dois, e o `scrollWidth` voltou a 390.

10 medições verdes (5 jornadas × 2 viewports). `npm run verificar` verde nos
seis passos.

### 5. O que a Vercel e a Data API disseram, sem credencial nenhuma

- **Deployment Protection: desligada** nos três modos (senha, SSO, IPs). É o que
  o `CLAUDE.md` prescreve — quem protege dado é login + RLS + JWT.
- **Zero erros de runtime** em 7 dias.
- **A Data API responde 404 sem JWT**, para `transactions` e `documents`: não
  vaza nem a existência da tabela. `/api/data` também dá 404, coerente com o
  backend descartado.
- ⚠️ **O REPOSITÓRIO NÃO É MAIS PRIVADO.** Os deploys a partir de 25/08 marcam
  `githubRepoVisibility: "public"`, e o `gh` confirma. A linha da auditoria de
  13/08 aqui neste arquivo dizia "privado" e foi corrigida. **Nada vazou** — a
  varredura daquela rodada já provava que nunca houve `.env`, PDF ou credencial
  versionados, e as `VITE_*` são públicas por design. Mas a decisão de manter
  público é sua, e ela muda o peso da regra "nunca commitar PDF real": antes um
  descuido ficaria entre você e o GitHub; agora não.

### O que continua aberto, e é curto

| O que | Por que está parado |
|---|---|
| **Rodar o `VALIDACAO-MANUAL.md`** | Precisa de conta real e caixa de entrada real |
| **Mais bancos** (Caixa, layout A do BB) | Falta amostra: o extrato da Caixa veio como imagem |
| **Regra de categorização com operadores** | Exige migração de `merchant_rules`; o avaliador já está pronto |
| **Revisão de en/es por nativo** | Traduções são minhas |

**O MCP do Neon não está autorizado nesta sessão** — o banco não foi inspecionado
de dentro. A migração `0003` foi conferida em 29/08 e nada nesta rodada tocou em
schema.

## Rodada 2026-08-18 (parte 2) — a fila dos quatro repositórios, fechada

Os quatro itens que a análise de 18/08 deixou na fila foram feitos. Dois deles
mudaram de forma durante a execução, e é isso que vale registrar.

### O que eu previ errado, e o que a medição disse

| Item | Previsão | O que a medição mostrou |
|---|---|---|
| **Vínculo editável** | "mexe em `kind`, tem CHECK em produção, é assunto de ADR" | **Nenhuma migração.** O CHECK aceita os quatro valores desde o schema inicial; marcar vínculo é gravar `internal_transfer`, sempre legal. O item que parecia mais caro era o mais barato. |
| **Modo discreto** | "custo baixo, é só uma classe CSS" | **Errado.** Dinheiro sai por 60 lugares, vários DENTRO de string de tradução interpolada, onde CSS não alcança. A máscara teve que ir para o funil (`formatBRL`). |

### 1. Vínculo editável (`kindComVinculo`, `ehVinculo`)

O vínculo era 100% automático e sem recurso: quando `vincular()` erra, o "gasto
real" fica errado e não havia conserto de dentro do app. Agora há um interruptor
no editor.

Desligar devolve `expense`/`income` **pelo sinal do valor**, porque o kind
original não é recuperável — a coluna guarda um valor só. Ligar grava sempre
`internal_transfer`, nunca `card_payment`: quitação é conclusão de uma
conferência entre documentos, não algo que se afirme no olho.

⚠️ **`kind` só entra no update se mudou.** Sem isso, editar o rótulo de uma
quitação reescreveria `card_payment` como `internal_transfer` sem ninguém pedir.

### 2. Diagnósticos (`domain/diagnosticos.ts`)

Padrão "X-ray" do Ghostfolio: regras puras independentes, união discriminada
como o `Alerta` de `recorrencias.ts`. Três achados — gasto parado em Outros,
concentração num estabelecimento, e taxas como fatia do gasto (o análogo do
`fees` de lá).

**Todo limiar tem duas condições, percentual E absoluta.** É a lição do
`alertasDe`: só o percentual faz um mês de R$ 200 gritar por R$ 60. Vínculo e
entrada ficam fora da conta — a quitação da fatura é o maior valor de todo mês e
dispararia a concentração para sempre.

Clicar em "X% está sem categoria" abre a lista filtrada por `sem:categoria`.
Fecha o ciclo com o item 1: o painel aponta, a lista mostra, e corrigir uma
compra conserta as iguais.

### 3. Modo discreto (`formatBRL` + `DiscretoProvider`)

Máscara de tamanho **fixo**: `R$ •.•••,••` preservaria a forma do número e
entregaria a ordem de grandeza. `formatBRLCru` é o desvio do relatório em PDF —
exportar é ato deliberado, e um PDF de máscaras não serve para nada.

O flag é ajustado no **inicializador do estado**, não num efeito: num efeito o
primeiro render sairia com valores reais, um piscar de dinheiro a cada recarga.

⚠️ **A caçada ao vazamento do `ValorAnimado` é a lição desta rodada.** Ele
desenha por `useTransform`, que só recalcula quando o componente repinta;
alternar o modo não muda `valor`. **Três versões do teste passaram com o defeito
em pé:**

1. A primeira montava com o modo já ligado — o funil mascara sozinho na primeira
   passada.
2. A segunda alternava, mas durante a animação de 0,9s: o motion value
   recalculava por conta própria. **O teste vencia por corrida.**
3. Só esperando o valor final assentar (`findByText('R$ 1.234,56')`) o teste
   ficou válido.

Com ele, as duas metades do meu conserto foram medidas **uma de cada vez**: sem
assinar o contexto, vermelho; sem o curto-circuito que eu havia escrito junto,
verde. O curto-circuito não defendia defeito nenhum e saiu. Previsão de defeito
não é defeito — e guarda que nenhum teste válido derruba é código morto.

### 4. Operadores de busca (`domain/consulta.ts`)

Do Firefly III, onde a mesma tabela de operadores alimenta a busca e os gatilhos
das regras. A busca aceita `>100`, `<50`, `banco:nubank`, `cat:farmacia` e
`sem:categoria`, em pt/en/es.

⚠️ **Operador desconhecido vira texto, nunca some.** O Firefly dá erro; aqui
descartar em silêncio esconderia resultados sem o usuário saber por quê, e
`PIX: Joao` é busca legítima.

`busca.ts` perdeu normalizador e casador próprios — virariam a segunda opinião
sobre "o que casa" no dia em que a busca ganhasse operadores, que é hoje.

**Metade da unificação ficou de fora, de propósito.** O avaliador é puro e não
sabe de onde vem a transação, então é o mesmo que uma regra usaria — mas
`merchant_rules` guarda um padrão de texto e nada mais, e regra com operadores
exige migração de schema para capacidade que ninguém pediu.

### 5. O medidor de CSP reprovava um build correto, às vezes

`medir-csp.py` passava o predicado de fonte como **expressão em string**, e o
Playwright embrulha expressão em `new Function` — que a nossa própria CSP
bloqueia de dentro da página medida.

**Por isso falhava só às vezes:** quando uma fonte já estava carregada na
primeira checagem, a chamada volta sem entrar no laço de polling; quando não
estava, o laço roda e a medição morre com `EvalError`, reprovando um build
correto. Passando uma arrow function, o Playwright usa `callFunctionOn`, que não
passa por eval. Três execuções seguidas verdes.

⚠️ **Armadilha de método, minha:** eu vinha checando `npx tsc … | head; echo
$?`. Depois de um pipe, `$?` é o status do `head`, não do `tsc` — aqueles
"exit=0" não mediam nada. Capturar em arquivo e testar o código de saída direto.

**707 testes (86 arquivos)**, contra 663 no início desta parte. `npm run verificar`
verde nos seis passos.

⚠️ **O layout continua NÃO medido, e o motivo é o mesmo de sempre:**
`medir-overflow.py` só faz `pagina.goto(URL)`. As peças novas desta rodada — as
duas caixas do editor de compra e a dica de sintaxe da busca — só aparecem depois
de um clique ou de um foco, então o medidor não as alcança. Falta abrir no
navegador. Contraste não se aplica: nenhum token de cor novo foi criado.

### O que sobrou da análise dos quatro repositórios

Uma coisa só, e ela é uma decisão de produto, não de código: **fazer as regras de
categorização usarem os operadores da busca**. Exige migração de `merchant_rules`,
que hoje guarda `padrao` + `match_type` e nada mais. O avaliador (`consulta.ts`)
já está pronto e é puro — falta querer a capacidade.

## Rodada 2026-08-18 (parte 1) — quatro repositórios open source, e a promessa que a UI cumpria pela metade

O usuário mandou quatro links (Firefly III, Ghostfolio, web-budget, full-finan-as)
pedindo o que dava para reaproveitar. A primeira conclusão foi jurídica e inverte
a intuição: **os três projetos maduros são copyleft forte** — Firefly e Ghostfolio
AGPL-3.0, web-budget GPL-3.0. Copiar código deles contamina o repositório inteiro.
O único legalmente copiável é o `full-finan-as` (MIT), que é justamente o que não
tem nada a copiar. Então "reaproveitar" aqui só pode significar **desenho**.

O que ficou de cada um:

| Projeto | Veredito |
|---|---|
| **Firefly III** | Os gatilhos de regra **são** a linguagem de busca (`config/search.php`): uma tabela só de operadores alimenta a caixa de busca e o motor de regras. Aqui `busca.ts` e `regras.ts` são dialetos separados e pobres. |
| **Ghostfolio** | O padrão do X-ray: `Rule` abstrata com `evaluate() → { value, evaluation }` e `isActive` por regra. É o que `alertasDe()` quer virar quando crescer. Mais o "Zen Mode" (esconder valores absolutos). |
| **web-budget** | Nada. v3 em manutenção, JSF/WildFly, e o domínio é prospectivo (período que abre e fecha) — conflita com o ADR-0005. |
| **full-finan-as** | Nada. Projeto pessoal em vanilla JS; estado global em `window.*`, e uma pasta `js/ui.js/` que contém outros arquivos. |

**O que foi recusado, e por quê:** orçamentos, piggy banks, metas e contas fixas
cadastradas à mão contradizem o ADR-0005 — este app não deixa digitar número. A
partida dobrada com conta origem/destino resolveria o que `linked_transaction_id`
+ vínculo já resolvem sem exigir cadastro. E a reconciliação do Firefly é mais
fraca que o gabarito + `checksum.ts` daqui.

⚠️ **Num ponto o projeto daqui é MELHOR que o Firefly, e isso quase passou batido.**
As `bills` do Firefly pedem cadastro; `recorrencias.ts` **deduz** — mediana,
classificação fixo/variável, `diaTipico`. Trazer o modelo do Firefly seria regressão.

### O defeito: corrigir uma categoria consertava uma linha só

Conferido no código, não presumido. `EditarCompra.salvar()` chamava
`editarTransacao(tx.id, …)` — **uma** linha — e gravava a regra aprendida. Mas a
categoria mora numa coluna, decidida na importação, e `agrupar.ts` lê a coluna:
corrigir "ATACADAO" hoje acertava as compras **futuras** e deixava as 26 já salvas
erradas. O toast dizia *"vou lembrar desta categoria"* — verdade pela metade.

O Firefly tem exatamente isto resolvido: aplicar a regra ao histórico, com prévia
de quantas transações seriam atingidas antes de confirmar.

**O que entrou:**

- **`casaRegra` extraída em `regras.ts`.** O casamento estava embutido dentro do
  laço de `categoriaDe`. Duas cópias da regra de casamento seriam duas opiniões —
  e a que o usuário vê na prévia é justamente a que não roda na importação. O
  núcleo privado `casa()` recebe merchant e CNPJ já calculados: `categoriaDe` roda
  ~150 regras contra a mesma descrição, e normalizar por regra multiplicaria por
  150 o custo de cada linha importada.
- **`alcancadasPelaRegra`** (`aprendizado.ts`): quem a regra corrigiria, excluindo
  a transação em edição e quem já está na categoria de destino (update sem efeito
  que só inflaria o número da prévia). Casa pela `description`, nunca pelo `label`.
- **`recategorizarEmLote`** (`persist/editar.ts`), em lotes de 200.
- **`aplicarRecategorizacao`** no `DadosProvider`: a tela reflete na hora, sem
  reler o banco.
- **A prévia** no editor, com caixa marcada por padrão e a contagem real.

⚠️ **A regra aprendida é ESTREITA, e isso é de propósito.** `normalizeMerchant`
não descarta a cidade: a chave de "Atacadao Palmas" não casa com "Atacadao
Araguaina". Reclassificar em massa a loja de outra cidade suporia mais do que o
usuário disse. Está fixado em teste para ninguém "consertar" isso sem querer.

⚠️ **O diálogo de confirmação mentia por omissão** — achado na revisão, não no
teste. Ele diz *"A compra passa a valer com o nome e a categoria que você
escolheu"*, no singular, no exato momento em que 26 outras mudariam junto. A
confirmação passou a declarar o alcance real (com variante de singular: "as
outras 1 compras" é o tipo de desleixo que não passa aqui).

⚠️ **`recategorizarEmLote` conta o que ENVIOU sem erro, não o que o banco
confirmou.** A Data API não informa linhas afetadas sem um `select` extra. O que
importa está garantido: com falha, `corrigidas` fica 0 e o toast cai no genérico
em vez de anunciar correções que não houve.

⚠️ **O teste de fiação foi PROVADO contra o defeito.** Trocar `ids` por `[]`
deixa `EditarCompra.test.tsx` vermelho. Sem essa prova ele seria mais um teste
verde que não testa nada — armadilha que já mordeu este repositório em 17/08.

**A fila que sobrou** (do maior valor para o menor): vínculo editável pelo usuário
(hoje `EdicaoTransacao` é só `{ label, category_slug }`, e o "gasto real" fica
errado sem recurso quando a heurística erra); registro de diagnósticos no padrão
X-ray; operadores únicos para busca e regra; modo discreto.

**663 testes (83 arquivos)** — 11 novos: 6 puros do alcance da regra e 5 da
fiação do editor. `npm run verificar` verde nos seis passos (typecheck, testes,
lint, caminhos, build, CSP).

⚠️ **O layout NÃO foi medido, e o motivo importa:** `medir-overflow.py` só faz
`pagina.goto(URL)` — não clica para abrir modal nenhum. A caixa nova vive dentro
do editor de compra, então o medidor não a alcança e rodá-lo não provaria nada.
Falta abrir o editor no navegador. Contraste não se aplica: `accent-marca` é
token que já existia, nenhum token novo foi criado.

## Rodada 2026-08-17 (parte 3) — `ui/` tinha 40% do código numa pasta plana

Auditoria de arquitetura de pastas, em 4 lotes. **O diagnóstico foi que a
estrutura não estava quebrada** — 0 imports circulares, 0 caminhos quebrados,
0 divergência de caixa, 0 imports com 3+ níveis de `../`. Havia **um** problema
real: `ui/` com 48 dos 119 arquivos de código, misturando telas inteiras,
gráficos, listas, primitivos e 4 arquivos `.ts` que não são componente nenhum.

`ui/` foi de **48 para 25** arquivos na raiz: saíram `acesso/` (10), `graficos/`
(5) e `listas/` (7).

⚠️ **A armadilha desta rodada, e ela é grande: `vi.mock('../x')` recebe STRING,
não import.** Nem o `tsc` nem o build reclamam quando o caminho deixa de
resolver — o módulo **real** entra no lugar do dublê. Mover os testes para
`ui/acesso/` matou 7 caminhos de mock com **typecheck 0 e build verde**, e 18
testes caíram.

**E dois deles continuaram VERDES com o mock morto.** `Auth.test` e
`Auth.i18n.test` mockavam `lib/neon` para `neonConfigurado: false`, e sem as
`VITE_*` o módulo real se comporta igual — então passaram testando outra coisa.
Teste verde com mock que não casa não está testando o que diz testar.

Disso nasceu **`scripts/checar-caminhos.py`**: resolve todo caminho relativo que
vive em string (`vi.mock`, `importActual`, `readFileSync` relativo ao CWD) e sai
com código 1 se algum não existir. **Provado contra o defeito real** — quebrei um
caminho de volta e ele acusou. Entrou no `CLAUDE.md`.

### O lint foi a ZERO, e aviso virou erro

O projeto convivia com **4 avisos "pré-existentes"** havia meses — e quatro
avisos fixos treinam qualquer um a não ler a saída do lint. O quinto entraria
sem ninguém notar. Agora são **zero**, e o script roda `oxlint --deny-warnings`:
aviso novo derruba a verificação inteira.

- **O do `vite.config.ts` era redundante de verdade.** `/// <reference
  types="vitest/config" />` na linha 1, com `import … from 'vitest/config'` na
  linha 2 — o import já traz os tipos. Apagado.
- **Os outros três não foram "consertados", foram autorizados com nome.**
  `useT`, `useDados` e `useTravarRolagem` moram no mesmo arquivo dos seus
  providers, que é o padrão idiomático do React. Separá-los custaria **40
  arquivos reescritos** (só `useT` é importado por 40) para ganhar Fast Refresh
  em três arquivos que ninguém edita. Entraram em `allowExportNames` no
  `.oxlintrc.json` — a supressão carrega o *porquê* no lugar de o aviso carregar
  o ruído.

⚠️ **Provado, não presumido:** com o lint limpo `exit=0`; criando um arquivo que
exporta um hook fora da lista ao lado de um componente, `exit=1`. A primeira
tentativa de prova **falhou em silêncio** — usei `export const`, que
`allowConstantExport` permite, e o teste passou sem nunca ter gerado aviso.

### A verificação virou um comando: `npm run verificar`

A rotina eram **cinco comandos soltos numa tabela de documento**, com uma ordem
que não é opcional e que já mordeu — e o medidor novo (`checar-caminhos.py`) nem
tinha entrado na lista. Virou `scripts/verificar.py`: typecheck, testes, lint,
caminhos, build e CSP, em ordem, com tempo de cada passo e as últimas 25 linhas
do erro quando algo cai.

Ficaram **de fora de propósito**: `medir-contraste.py` (só importa se mexeu em
cor) e `medir-overflow.py` / `gerar-prints.py` (precisam do `npm run dev` de pé).
O script imprime esse lembrete no fim.

⚠️ **Ele achou dois defeitos na primeira execução — um deles dele mesmo.** O meu
comentário JSX quebrou o `Painel.variacao.test.tsx`, e o próprio `verificar.py`
**morria ao imprimir a falha**: a saída do vitest tem caixa de desenho (U+2502) e
o console do Windows é cp1252, então o script sumia com exatamente a informação
que se foi buscar. Corrigido com `reconfigure(encoding='utf-8')`.

⚠️ **`Painel.variacao.test.tsx` abria a URL com `periodo=mes`, e `lerFiltros` lê
`p`.** A chave era ignorada em silêncio; o teste passava porque o **padrão** já é
mês, não porque tivesse pedido mês. Mudar o padrão trocaria o significado do
teste sem nenhuma linha vermelha. Conferido que o **app não tem esse defeito**:
ele nunca monta querystring à mão, e as cinco chaves lidas (`p`, `ref`, `banco`,
`cat`, `q`) batem exatamente com as escritas por `escreverFiltros`.

### As decisões de agrupamento, e por que não são gosto

- **A regra que decide um caso novo:** peça usada por **um** grupo mora nele;
  usada por **dois**, sobe para `ui/`. Foi ela que manteve `MarcaCategoria` na
  raiz (gráfico + lista).
- **`escala-barras`, `auth-validacao` e `mensagem-campos` NÃO foram para
  `domain/`**, embora sejam puras e testadas. `domain/` é o vocabulário do
  dinheiro; validação de formulário e escala de gráfico são apresentação, e
  diluir a pasta tira o sentido de ela existir.
- **`MoedaLogo` ficou na raiz** mesmo sendo usado só pelo `Auth`: é marca, irmã
  de `Marca.tsx`, e separar as duas por uso circunstancial de hoje seria pior.

### O que foi recusado do prompt da auditoria

O `docs/prompt-arquitetura-de-pastas.md` pressupõe Next.js e Supabase (é Vite +
React Router + Neon), manda criar branch (este projeto trabalha direto na `main`
desde 18/07) e cita duas skills que não existem no ambiente. E mandava trocar
`../../` por alias `@/` — **não há um único import com 3+ níveis** neste projeto,
então seria churn sem alvo.

**Órfãos removidos:** `ui/MenuAcoes.tsx` e `public/img/icons8-financial-96.png`
(cuja única menção no repositório é um spec de 02/06 dizendo que ele *foi
substituído* pelo favicon SVG).

**Varredura final:** tsc 0, build ok, lint 4 avisos pré-existentes, **652/652
testes**, 0 circulares, 0 órfãos, 0 caixa divergente, **6 rotas idênticas antes ×
depois**, CSP aprovada, overflow e contraste OK.

## Rodada 2026-08-17 (parte 2) — a barra escura do painel era o grid vazando

O usuário mandou três prints e cinco pedidos. Quatro eram acabamento; um era
defeito estrutural, e é o que explica a "barra escura atravessando o painel".

### 1. O bloco escuro sob os tiles — o grid aparecendo por baixo

**A régua entre os tiles é o fundo do grid visto por um `gap-px`.** O
`bg-carvao-900` estava no `Tile`, não no item do grid. Os dois primeiros tiles
ganham a linha de variação ("122% acima do período anterior") e ficam mais altos;
"Saldo do período" e "Lançamentos" não têm essa linha. Sobrava espaço dentro das
células 3 e 4 — e a sobra mostrava `carvao-800`. Era literalmente o gap vazando
onde devia haver painel, o que explica por que parecia um bloco quebrado.

⚠️ **A regra que isso deixa:** num grid que desenha as réguas por `gap-px` +
`bg`, o fundo vai no **item do grid**. Pôr no filho funciona enquanto todos os
filhos tiverem a mesma altura, e quebra no dia em que um deles ganhar uma linha
a mais — que foi exatamente o que aconteceu quando a variação percentual entrou,
em 13/08. O teste novo `Painel.ritmo.test.tsx` fixa isso.

### 2. "Quando passa a ser dias, o gráfico some"

`GraficoDiario` recebia só o recorte e desistia com menos de dois dias. No
período **Dia** o recorte é um dia: ele se apagava sempre, e a metade direita do
painel voltava a ser o buraco que ele foi criado para tapar em 12/08.

O conserto não foi baixar o limite — uma barra sozinha é o número do tile,
redesenhado. **A janela passou a ser o mês em volta**, com o dia aberto pintado
de `--color-marca`. "Onde estão os picos" é pergunta que só existe contra um pano
de fundo.

⚠️ **Pelo mês de CALENDÁRIO (`doMesCalendario`), não por competência.** O eixo x
desse gráfico é a data real; recortar por competência poria uma barra de 20/mai
dentro do desenho de junho (ver ADR-0001). E o cabeçalho passou a declarar o que
o desenho cobre — sem isso, "média R$ 1.764" seria lido como média do dia aberto.

### 3. As duas listas falavam línguas diferentes

"Maiores saídas" desenhava a linha de baixo como **pílula de fundo tingido**;
"Onde mais saiu dinheiro", como **texto solto**. Alturas diferentes, linha 2 de
uma coluna desencontrada da linha 2 da outra, e a dupla lendo como dois
componentes sem parentesco — em vez de duas leituras do mesmo recorte.

Agora as duas passam por `ui/LinhaRanking.tsx`: **estrutura idêntica, conteúdo
livre.** A cor da categoria não sumiu, virou o mesmo quadradinho da legenda do
donut (`ui/MarcaCategoria.tsx`, usado nos dois lugares — eram dois desenhos para
a mesma ideia). E entrou a régua vertical entre as colunas, que nunca existiu.

### 4. As cores do gráfico de colunas

Eram **todas** `--color-debito` com o pico em tinta: um muro vermelho no qual o
vermelho não distinguia nada, e o destaque gastando a cor mais forte da interface
no lugar mais repetido dela. Agora o campo em repouso é `--color-barra` (token
novo, neutro), o pico é `--color-debito` — a única barra vermelha do desenho — e
o dia aberto é `--color-marca`. Cada cor voltou a carregar uma informação.

⚠️ **`scripts/medir-contraste.py` tem lista fixa de tokens e não media o novo.**
Ele passava sem olhar para a cor que eu tinha acabado de criar. `barra` entrou na
lista como forma cheia (piso 3:1, não 4.5 — não carrega texto dentro): **3.02:1
no claro, 3.44:1 no escuro**, contra a pior superfície.

### 5. A folha de provas estava provando outra coisa

`demo.tsx` desenhava os dois rankings soltos num `gap-6` enquanto o painel os
desenhava com borda entre as colunas. Print que não mostra o que vai ao ar não é
prova. Alinhados.

**652 testes (82 arquivos)**, build limpo, lint com os 4 avisos pré-existentes,
CSP aprovada, overflow e contraste OK, prints regerados.

---

## Rodada 2026-08-17 — o vocabulário virou arquivo, e três palavras estavam mentindo

Sessão de modelagem de domínio: entrevista, sem código novo de comportamento. O
projeto não tinha `CONTEXT.md` nem `docs/adr/` — todo o vocabulário e todas as
decisões viviam neste diário, em ordem cronológica. Saíram daqui **32 verbetes**,
**9 ADRs** e um `CLAUDE.md`.

### Os três conflitos que a leitura do domínio achou

1. **`encargo` dizia ser uma coisa e era outra.** `parsers/types.ts` afirmava
   *"IOF, anuidade, juros — encargo do banco, **não gasto seu**"*. Mas
   `kindParaBanco` manda encargo para `expense`, `agregar` soma em `gastoCents`,
   `regras.ts` categoriza IOF/ANUIDADE/TARIFA/JUROS em `taxas` e `checksum.ts`
   exige `compra + encargo = total declarado` para a fatura fechar. O comentário
   estava errado, não o código: o dinheiro saiu do bolso. Ele queria dizer "não é
   **consumo** seu", que é outra afirmação. Corrigido.
2. **`internal_transfer` cobre duas coisas que não são a mesma** — transferência
   entre contas do próprio titular e a varredura automática do BB (conta ↔
   aplicação). Quem separa as duas na tela é o `linkNote`, não o `kind`. **Não foi
   mexido**: separar exigiria `ALTER TABLE` num CHECK em produção. Ficou
   registrado que o nome é mais estreito que o valor.
3. **"Recorte" era usado com dois sentidos opostos.** `useRecorte.ts` diz que
   recorte é o *resultado* e `Filtros` é a descrição dele; este diário, na linha
   sobre a barra de navegação, usa "recorte" querendo dizer os filtros da URL.
   Valeu o código.

⚠️ **`direction` (`in`/`out`) é gravado em toda transação e nunca lido por nada.**
Redundante com o sinal de `amount_cents`. Achado da varredura, não corrigido —
mexer numa coluna `not null` em produção não é trabalho de sessão de documentação.

### O que "assinatura" significava neste repositório

**Quatro coisas.** A categoria de mensalidades (Netflix, Spotify); os marcadores
textuais de `pdf/detect` que identificam o banco de um PDF; a prosa de um teste que
definia "assinatura" pelos critérios de **recorrência**; e o crédito no rodapé da
tela de acesso. O canônico é a **categoria** — é o que o usuário vê. O terceiro uso
foi corrigido, porque aluguel é recorrência e não é assinatura.

### O que mudou de lugar

- **`CONTEXT.md`** (raiz) — 32 verbetes, com `_Evitar_` em cada um. Termo canônico é
  o que o código usa, mesmo em inglês (`installment`, `RawKind`).
- **`docs/adr/0001` a `0009`** — competência, vínculo, PDF no cliente, Neon,
  escopo retrospectivo, parser por banco, code-splitting recusado, SDK do Neon,
  shadcn. O 0002 carrega a tabela de conversão `RawKind → transactions.kind`, que é
  onde a informação se perde.
- **`CLAUDE.md`** (raiz) — as ~35 armadilhas que viviam na seção "Notas de
  armadilha" deste arquivo. O motivo da mudança: elas mordem toda sessão de
  trabalho, e num arquivo que o agente carrega sozinho elas chegam **antes** do
  erro em vez de depois.
- `docs/SETUP-NEON.md` tinha **dois links quebrados** desde a reforma (`neon/migrations/`
  e a pasta `supabase/`, apagada em `ea34040`, 2026-07-18 — no mesmo dia em que o
  documento dizia que ela ficaria como histórico). Corrigidos.

**A lacuna do Supabase fechou no mesmo dia.** A varredura não achou o motivo da
troca em lugar nenhum do repositório — nem no diário, nem no README, nem no
SETUP-NEON, nem no memory: havia o quê, o quando e o como, nunca o porquê. O
usuário respondeu, e a resposta é a parte que importa: **foi cota, não mérito
técnico.** O plano grátis do Supabase dá dois projetos ativos e a conta já tinha
mais de cinco (dois de pé, o resto pausado); criar o banco deste app exigiria
derrubar um dos que funcionavam. O Neon entrou porque tinha vaga. Está no ADR-0004,
com a consequência explícita: se um dia a cota deixar de importar, a comparação
técnica entre os dois **ainda está por fazer**.

**638 testes (81 arquivos)**, build limpo, lint com os 4 avisos pré-existentes. As
duas únicas edições de código foram comentários; nenhuma linha de comportamento.

## Rodada 2026-08-13 — o e-mail manda código, e os gráficos mentiam de tão achatados

Seis pedidos do usuário com o app na tela. Dois viraram achado de verdade: o fluxo de
confirmação de e-mail estava **inalcançável** e a escala dos gráficos **inutilizava** o
desenho num mês com um valor discrepante.

### 1. A confirmação de e-mail nunca teve onde ser digitada

**O relato:** *"o e-mail me manda um código, mas onde eu digito esse código?"*

E não havia lugar nenhum. O fluxo montado em 12/08 era o de **link**
(`/send-verification-email` + `callbackURL` + `/verify-email?token=`), com 8 testes
verdes — e o e-mail que chega traz **6 dígitos**. Sondagem contra o servidor real
explicou por quê:

| Sonda (2026-08-13) | Resposta |
|---|---|
| `GET /open-api/generate-schema` | o plugin **`email-otp` está ligado** no servidor da Neon |
| `POST /email-otp/verify-email {email, otp}` | `400 {"message":"Invalid OTP","code":"INVALID_OTP"}` |
| `POST /email-otp/send-verification-otp {email, type}` | `200 {"success":true}` |

O código do plugin (`node_modules/better-auth/dist/plugins/email-otp/index.mjs:22`) é
explícito: com `overrideDefaultEmailVerification`, o `init()` **reescreve**
`sendVerificationEmail` para mandar OTP. Ou seja, o `callbackURL` que o app passava era
ignorado e o `/verify-email?token=` nunca receberia link nenhum — **código testado que
não podia rodar**.

A documentação da Neon fecha a questão: *"Verification links require a custom email
provider"*. Com o remetente compartilhado (`auth@mail.myneon.app`, o que está no ar) só
existe código. O app passou a se ajustar ao que **de fato chega na caixa de entrada**:
`AvisoConfirmarEmail` abre um campo de 6 dígitos, com "enviar outro código".

⚠️ **Limite do servidor: 3 chamadas por minuto** em `send-verification-otp` e em
`verify-email` (`rateLimit` do plugin). O `429` tem mensagem própria — dizer "não
consegui" ali mandaria a pessoa procurar defeito onde o conserto é **esperar**.

**Sobre o nome exibido no e-mail:** não é um descuido do
template, é a **assinatura do callback**. O `sendVerificationOTP` recebe
`{ email, otp, type }` — o objeto `user` não está lá, então o remetente da Neon não tem
o nome para escrever. Só sai do lugar com **provedor de e-mail próprio + webhook**
(o payload do webhook tem `user.name`). Nada disso é alcançável do cliente.

**Código removido junto:** `urlDeRetorno`, `lerConfirmacaoDaUrl`,
`limparConfirmacaoDaUrl`, o efeito de `?confirmado=1` no `App.tsx` e 4 chaves de i18n.
Era o fluxo de link inteiro — inalcançável, e manter código que não pode rodar é
manter uma mentira compilável.

### 2. Os gráficos de barra: um empréstimo de R$ 41.653 achatava o mês inteiro

**O relato:** *"os gráficos de barra estão desproporcional"*. Estavam. Com a escala no
máximo — o jeito óbvio — os outros 25 dias do mês viravam traços de 2px rente ao chão.
O gráfico continuava **correto** e tinha parado de responder à única pergunta que
justifica sua existência: *quando* o dinheiro saiu.

`ui/escala-barras.ts` (12 testes) resolve sem mentir na altura: escala linear até um
**teto robusto** (cerca de Tukey, `q3 + 1,5·IQR`), com quem passa desenhado **cortado**
— serrilha no topo, valor cheio no `aria-label` e "escala até R$ 816 · 1 dia acima" no
rodapé. Log ou raiz resolveriam o aperto e cobrariam caro: as alturas deixariam de ser
comparáveis **em silêncio**, e ninguém desconfia de um gráfico bonito.

⚠️ **O ajuste fino não veio de teste nenhum — veio de olhar a tela.** A primeira versão
cortava 2 dias: com um espeto muito grande, a cerca desce tanto que o segundo maior dia
(R$ 816, nada de extraordinário) também caía fora. Serrilha numa barra que caberia
inteira ensina a ignorar a marca. Daí a regra de **absorção** (o teto sobe para abraçar
quem passou da cerca sem ser espeto, e para no primeiro que não couber).

Aplicado em `GraficoDiario` e `GraficoEvolucao`, que também subiram de `h-32` para
`h-40` e ganharam linha de base. `GraficoEvolucao` **passou a usar `t()`** — quita
metade da dívida de i18n anotada em 12/08 (falta `GraficoCategorias`).

### 3. `frontend/demo.html` — a folha de provas, e por que ela existe

O achado acima **não era detectável em jsdom**: altura aplicada pelo `motion` não chega
ao DOM, e o próprio teste de `GraficoEvolucao` já registrava isso ("qualquer asserção
aqui passaria com a escala certa E com a errada"). Gráfico é a peça que passa no teste e
sai torta na tela.

`frontend/demo.html` + `src/demo.tsx` montam os componentes com dados **fictícios**
(incluindo o mês com o empréstimo). Fora do build de produção — o `vite build` só usa
`index.html` como entrada, conferido no `dist/`. `scripts/gerar-prints.py` dirige o
Chromium contra ela e gera os prints do README, sem expor extrato de ninguém.

### 4. Os outros três pedidos

- **Rótulo único na fileira de saldos.** "Em aberto Nubank" ao lado de "Próximas
  faturas Bradesco" eram dois cards irmãos com cara de coisas diferentes. Agora o
  rótulo é **"Próximas faturas"** nos dois — verdadeiro para ambos, porque os dois
  números respondem *o que ainda vem* — e a distinção desceu para a linha de detalhe:
  `ciclo em aberto · fecha em 20/ago` (Nubank) e `parcelas a vencer` (Bradesco). A data
  de fechamento **não** acompanha as parcelas futuras: elas se espalham por vários
  meses, e carimbar uma data ali diria que tudo cai de uma vez.
- **Gráfico nas Recorrências** (`ui/GraficoCompromissos.tsx`): a metade direita da
  página vivia vazia (sem recorrências detectadas, `ListaRecorrencias` devolve `null`).
  Agora há barras por mês futuro, **empilhadas pelas cores institucionais** dos bancos
  (roxo Nubank, vermelho Bradesco, do catálogo `BANCOS` — as mesmas do filtro e dos
  cards). `MesFuturo` ganhou `porBanco` e `ItemFuturo` ganhou `bank`, ambos testados no
  `agrupar`. Clicar numa barra **abre aquele mês na lista ao lado**: por isso
  `CompromissosFuturos` virou controlado — com o estado dentro dele, as duas peças
  discordariam sobre qual mês está aberto.
- **Favicon novo**: cofrinho com a moeda entrando, a pedido (o carimbo de "conferido"
  durou um dia). Conferido a 16/24/32/48/64/128px nos dois fundos, com o mesmo cuidado
  de antes: só silhueta, nada abaixo de 3px em 64, e os recortes (olho, fenda) na cor
  do fundo em vez de linhas — recorte sobrevive ao downscale, linha não.
  **⚠️ Substituído no mesmo dia** pela moeda R$ — ver o item 6.

### 5. README refeito

Prints reais, quatro diagramas Mermaid (pipeline de importação, arquitetura em camadas,
ER das 5 tabelas com RLS, e o modelo de isolamento), a seção de qualidade com o que cada
medidor reprova, e a decisão da escala dos gráficos contada por extenso.

⚠️ **Diagrama Mermaid com erro de sintaxe não quebra nada — só vira um bloco de código
cru no meio da página.** Por isso os quatro foram **parseados** (`mermaid.parse`) e
**renderizados em PNG** antes de publicar; os dois primeiros nasceram altos e ilegíveis
e foram refeitos com menos nós.

⚠️ **Armadilha de plataforma:** editar arquivo com `io.open(..., 'w')` no Python, no
Windows, converte todo `\n` em `\r\n` em silêncio. O README inteiro virou CRLF numa
edição e o validador passou a achar **zero** blocos mermaid (o regex `\`\`\`mermaid\n`
não casa com `\r\n`). Normalizado de volta para LF. Use `newline=''` ao reescrever
arquivo versionado.

**606 testes (78 arquivos)**, build e lint limpos (4 avisos pré-existentes), CSP,
contraste e overflow reaprovados.

### 6. (mesmo dia, com a conta real) O aviso não sumia depois de confirmar

**O relato:** *"recebi o código, usei, confirmei — e a mensagem continua visível"*. E,
logo depois, o dado que fechou o diagnóstico: **"saiu depois que atualizei a página"**.

Esse "só depois do F5" é a assinatura de **estado velho no cliente**, não de gravação que
falhou — o servidor já tinha registrado a confirmação; quem repetia a resposta antiga era
o SDK. E repetia por desenho: `@neondatabase/auth` guarda a sessão **em memória** e o hook
`beforeFetch` do `getSession` responde do cache **sem tocar na rede**
(`node_modules/@neondatabase/auth/dist/adapter-core-*.mjs`), com TTL igual à validade do
JWT — cerca de uma hora. O `onConfirmado` chamava `checarSessao()` justamente esperando o
contrário; ele relia o mesmo `emailVerified: false` e a faixa ficava.

O conserto é o aviso sumir **na hora**, sem reler sessão: o `200` do
`/email-otp/verify-email` já é a confirmação. Rechecar hoje seria pior que inútil —
sobrescreveria o `true` de volta para `false`.

⚠️ **O teste que provaria nada.** Um teste em que a sessão simulada "passa a devolver
`true`" depois de confirmar **passa com o bug em pé** — ele testa um servidor que o SDK
não deixa o app enxergar. Por isso o mock de `App.test.tsx` mantém `emailVerified: false`
fixo: é o que o SDK real faz. Com o mock certo, o teste falhou antes do conserto.

**Só este caminho tinha o defeito.** Editar o perfil passa por `updateUser`, e o adapter
atualiza o cache no sucesso dele. O `fetch` cru do OTP é o único que muda o usuário no
servidor **por fora do SDK** — e por isso era o único que o cache não acompanhava.

**Favicon, de novo: a moeda R$** (`frontend/public/img/favicon.svg`), a mesma do
cabeçalho, a pedido. ⚠️ **Uma moeda R$ já esteve aqui e foi retirada em 19/07 por ser
ilegível a 16px** ("três círculos concêntricos e um texto — detalhe demais"). Esta lê
porque muda as três causas: a face é **sangrada** (r=31 em vez de r=23 no quadro de 64,
então o `R$` cresce junto), sobrou **um** anel discreto no lugar de três, e o contraste
**inverteu** — face clara (`#6bb3e8`) com o glifo quase preto, onde antes era traço
escuro sobre face escura. Conferido a 16/24/32/64px nos dois fundos, com o SVG
rasterizado no tamanho real (`device_scale_factor`), não ampliado.

⚠️ **Duas armadilhas confirmadas na prática nesta hora:**

1. **O comentário do próprio arquivo estava certo e eu caí nele assim mesmo:** escrever
   um token CSS (com os dois traços da frente) dentro de comentário XML **quebra o SVG
   inteiro** — `--` é proibido ali. O ícone some sem erro de build e sem erro de teste;
   quem denunciou foi a prova renderizada, com a imagem quebrada.
2. **Favicon é dos recursos mais cacheados que existe.** Trocar o conteúdo do arquivo não
   basta: a URL é a mesma e o navegador serve o desenho velho por dias. Por isso o
   `<link>` agora leva `?v=moeda`, em `index.html` e em `demo.html`. **Mudou o desenho,
   muda o token.**

**608 testes (78 arquivos)**, build e lint limpos (os mesmos 4 avisos), CSP reaprovada
contra o build.

### 7. A limpeza da lista de pendências — e o item que foi RECUSADO com número

Levantamento item a item, e a primeira surpresa foi o próprio documento: **três
pendências listadas aqui já estavam resolvidas** havia rodadas (`limparTokenDaUrl` tem
`describe` próprio em `lib/url-token.test.ts`; `GraficoEvolucao` foi traduzido;
`mensagemCamposFaltando` nem existe mais). Já corrigidas acima. **Lista de pendência não
conferida vira ficção** — o hábito daqui passa a ser verificar cada item antes de
repeti-lo.

#### O erro do servidor ia cru para a tela, em inglês (o mais grave dos seis)

Treze telas escreviam a mesma linha, e a tradução estava no lado ERRADO do ternário:

```ts
toast.error(e instanceof Error ? e.message : t('cats.toastFalha'))
```

`t()` só aparecia quando o erro **não** era um `Error` — o caso raro. No caminho normal a
pessoa lia `e.message`, que vem da Data API do Neon em inglês e em vocabulário de banco
(`new row violates row-level security policy for table "documents"`). Um app com i18n
completo mostrando inglês técnico justamente na hora da falha.

`lib/erro-usuario.ts` (`chaveDeErro`, 8 testes) decide a frase. **Não** é "traduzir tudo
para um genérico": parte das falhas é acionável e o genérico esconde o que fazer — sessão
vencida se resolve entrando de novo, rede fora se resolve esperando, e nenhuma das duas é
"problema ao salvar a categoria". Então quatro casos ganham frase própria
(`erro.semSessao`, `erro.semConexao`, `erro.semPermissao`, `erro.duplicado`) e o resto cai
no genérico de cada tela, que já existia.

⚠️ **Ordem dos padrões é semântica, não estética.** Sessão vem antes de permissão: token
vencido chega do Postgres como negativa de permissão, e dizer "peça acesso" a quem só
precisa entrar de novo manda a pessoa para o lugar errado. Idem em `Auth.tsx`, onde os
três padrões de autenticação vêm antes do classificador geral — "invalid password"
casaria com o padrão de sessão e viraria "sua sessão expirou".

Casar por trecho de texto é frágil, e mesmo assim é o certo aqui: é a técnica que
`lib/chunk.ts` e o `Auth.tsx` já usavam, porque a Data API não expõe código de erro
estável para o cliente. **A fragilidade é contida por construção** — padrão que deixa de
casar cai no genérico, que é o comportamento de antes. O erro cru continua indo para o
`console.error`: sumiu da tela, não do navegador.

Junto vieram as duas mensagens que estavam em **português fixo, fora do dicionário**
(`'Não consegui encerrar a sessão.'` e `'Falha ao carregar'`) — em en/es apareciam em
português. E o `DadosProvider` passou a guardar a **chave**, não a frase pronta: com o
texto congelado lá dentro, trocar de idioma com a tela de erro aberta deixaria a mensagem
para trás.

⚠️ **Um teste estava pinando o defeito.** `DadosProvider.test.tsx` afirmava
`/ERRO: rede caiu/` — ou seja, exigia que a mensagem crua chegasse à tela. Teste que
descreve o comportamento errado não protege nada: atrasa o conserto.

#### Os outros três pedidos pequenos

- **Última dívida de i18n fechada**: os dois `aria-label` do donut
  (`donut.rotulo`, `donut.rotuloFatia`, nos três dicionários). O projeto pode voltar a
  dizer "i18n 100%".
- **Senha curta era amarela no login e vermelha na recuperação** — mesma frase, mesma
  validação (`validarNovaSenha`), duas cores. Vermelho nos dois: nos dois o envio foi
  barrado.
- **`INEFFECTIVE_DYNAMIC_IMPORT`**: `Painel.tsx` fazia `await import('../lib/compartilhar')`
  enquanto a linha 24 importava o mesmo módulo de forma estática — o `await` não dividia
  nada e o build reclamava. Import estático nos três. O arquivo tem 1,5 kB e nenhuma
  dependência; o peso do PDF está em `jspdf`/`relatorio-pdf`, que **continuam** sob demanda.

#### Code-splitting: MEDIDO E RECUSADO

O aviso de "chunk > 500 kB" estava na fila como se fosse conserto pendente. Não é —
e o número diz por quê. Fatiando as quatro rotas secundárias com `lazy()`:

| | 1 chunk (antes) | 4 rotas fatiadas |
|---|---|---|
| Primeira pintura, cru | 948,3 kB | 920 kB (388 + 480 + 51 + 1) |
| Primeira pintura, gzip | 271,6 kB | ~264,6 kB |

**2,6% de ganho.** As quatro páginas somam 31 kB crus — ~3% do pacote. Em troca, cada
navegação viraria um download que pode falhar: falha de chunk depois de deploy já é
problema conhecido aqui (`lib/chunk.ts` existe por causa disso, no PDF), e ali ela custa
um PDF, não a tela inteira. **Revertido**, com o comentário e o número no `App.tsx` para
ninguém refazer o experimento às cegas.

⚠️ **Onde o peso está de verdade** (build A/B, com e sem o cliente Neon): o SDK custa
**366 kB crus / 93 kB gzip — 39% da primeira pintura**. Ele importa `zod` de forma
estática e é necessário no boot (o app confere a sessão na montagem), então não há como
adiá-lo do lado de cá. Sem ele o pacote ainda dá 582 kB — react-dom, router, motion e
sonner. **Nada disso está ao alcance do nosso código**: só cairia trocando ou remendando
dependência, o que não se justifica por 8% de gzip.

Já estão fora da primeira pintura, conferido na lista de `modulepreload` do
`index.html` gerado: `jspdf` (399 kB), `pdf.js` (410 kB), `html2canvas` (200 kB),
`purify` (27 kB).

**617 testes (79 arquivos)** — 9 novos: 8 do classificador de erro e 1 do
`DadosProvider`. Build e lint limpos (os mesmos 4 avisos pré-existentes), CSP reaprovada
contra o build.

### 8. O spec que já existia — e a falha alta que estava aberta no pdf.js

`docs/prompt-dashboard-financeiro.md` é a especificação **deste mesmo produto**, escrita
para outra stack (Next.js/Supabase/Recharts). Conferido item a item contra o código: o
projeto já cumpre quase tudo, e em dois pontos ultrapassa o pedido (`fx jsonb` para
compra em moeda estrangeira e `linked_transaction_id` materializando o vínculo
fatura×extrato — nenhum dos dois está no spec).

⚠️ **A armadilha 4 do spec quase virou falso achado.** Ela exige um discriminador para
duas compras idênticas no mesmo dia e lugar, que são legítimas. `dedupe/hash.ts` não tem
— mas `persist/salvar.ts:103` conta ocorrências e sufixa `#2`, `#3`. Estava resolvido,
só não onde se procura primeiro. **Ler o arquivo que nomeia a função não basta; é
preciso ler quem a chama.**

#### Os dois blocos construídos

- **Onde mais saiu dinheiro** (`porEstabelecimento` + `ui/TopEstabelecimentos.tsx`):
  ranking por estabelecimento, ao lado de "maiores saídas" e **não no lugar dela** — são
  perguntas distintas. A prova está no print: ATACADAO aparece em 3º e 5º na lista de
  maiores compras (R$ 456 e R$ 321) e sobe para **2º com R$ 777** quando somado. Agrupa
  pela descrição do banco, nunca pelo rótulo do usuário: renomear UMA compra partiria o
  grupo em dois. O rótulo entra só na exibição.
- **Variação contra o período anterior** nos tiles. O ponto do bloco é o `null`:
  sem período anterior, qualquer gasto seria "+∞%", e "+100%" no primeiro mês importado
  não significa "gastou o dobro" — significa "não havia nada antes". A UI esconde. A cor
  também não segue só o sinal: gastar 10% a mais é vermelho, **receber** 10% a mais é
  verde.

#### 🔴 Falha ALTA no pdf.js — a que mais importava desta rodada

Varredura de segurança pedida pelo usuário. O `npm audit` apontou `pdfjs-dist@5.7.284`
dentro da faixa vulnerável de **GHSA-hq66-cqwq-w95j — "execução de JavaScript arbitrário
ao abrir um PDF malicioso"**. É a superfície mais exposta do app: abrir PDF é o que ele
faz. Corrigida: **5.7.284 → 6.2.108** (primeira versão fora da faixa).

⚠️ **Nenhum teste do projeto exercitava o pdf.js.** Os fixtures são JSON já extraído e
`domain/pdf/load.ts` é mockado em jsdom (que não tem `DOMMatrix`): a suíte inteira
passaria verde com o parser quebrado — a mesma armadilha já registrada para gráficos.
Por isso o salto de major foi provado à parte: PDF gerado com texto conhecido, extraído
de volta pela mesma chamada do app (`getDocument` → `getTextContent` → `str` +
`transform`). **Texto e coordenadas idênticos nas duas versões.**

#### O resto da varredura, e o que ficou de fora

| Frente | Resultado |
|---|---|
| Histórico do git (todos os commits) | **limpo** — nenhum `.env` ou PDF jamais versionado, nenhuma credencial |
| Árvore versionada | **limpa** — sem chave, token, CPF, agência ou conta |
| Prints do README | **fictícios**, e conferido: os valores batem com `demo.tsx:171-182` |
| Fixtures | **anonimizados** (`MARIA APARECIDA SANTOSS`, agência `111`, conta `1234-5`) |
| RLS | as **5** tabelas criadas são as 5 com RLS ligado |
| Repositório | **privado** — deixou de ser em 2026-08-25; ver a rodada de 31/08 |

**Upgrade do SDK do Neon: NÃO feito, de propósito.** As 6 falhas restantes do `npm
audit` são todas da cadeia `@neondatabase/neon-js` → `better-auth`. Existe uma
`0.7.0-beta`, mas **a suíte mocka o SDK inteiro** — uma regressão de login não seria
pega por teste nenhum, e validar exige entrar com conta real. Trocar a biblioteca de
autenticação de um app no ar sem poder verificar é pior que a falha que se conserta:
os caminhos vulneráveis do `better-auth` (callback OAuth, sessão após exclusão) são do
**servidor de auth hospedado pela Neon**, não do cliente que vai no bundle.

**638 testes (81 arquivos)**, build e lint limpos, CSP, overflow e contraste reaprovados.

## 🚀 Retomada em 30 segundos

**O app está no ar e saudável** em https://capital-financeiro.vercel.app —
**743 testes (90 arquivos)**, `npm run verificar` verde nos seis passos.
Trabalha-se direto na `main`; todo push publica sozinho em ~1 min.

**O desenho é o "livro-razão"** (IBM Plex, raio, cartão com sombra) desde a
reversão de 31/08 — ver [ADR-0012](./adr/0012-o-livro-razao-volta-e-a-calha-lateral-nasce.md).
A navegação é a **calha lateral** a partir de `lg`; abaixo disso, a barra
horizontal. **Não sugerir voltar ao "impresso e terminal".**

**Seis bancos, nove parsers.** O Mercado Pago entrou em 31/08 (fatura e
extrato), com a migração `0004` aplicada e conferida em produção.

✅ **As quatro peças que "nenhum medidor alcançava" agora são medidas** — o
editor de compra, a dica de sintaxe da busca, os diagnósticos e o modo discreto
viraram jornadas de `medir-overflow.py` (31/08). Peça interativa nova **entra na
lista `JORNADAS`**, senão volta a não ser medida por ninguém.

✅ **`npm audit`: zero falhas** (31/08). O SDK do Neon está em `0.7.0-beta` desde
28/08, e as 5 falhas que restavam eram do `@vercel/node`, que saiu junto com a
Fatia 1b. Vermelho no `audit` voltou a significar descuido, não decisão.

⚠️ **O repositório é PÚBLICO** desde 25/08. Nada vazou (a varredura de 13/08 vale:
nunca houve `.env`, PDF ou credencial versionados), mas a regra "nunca commitar
PDF real" mudou de peso. Ver a rodada de 31/08, item 5.

**O QUE DEPENDE DE VOCÊ — ninguém mais pode fazer:**

| O que | Por que está parado |
|---|---|
| **Importar os PDFs do Mercado Pago pelo app** | Os parsers conferem contra fixture; ninguém ainda gravou no banco de verdade. É a prova que falta |
| **Rodar o [`VALIDACAO-MANUAL.md`](./VALIDACAO-MANUAL.md)** | Precisa de conta real e caixa de entrada real — substitui o teste de login que não existe |
| **Amostra da Caixa / layout A do BB** | O extrato da Caixa veio como imagem, e o app lê texto |
| **Revisão de en/es** | As traduções são minhas; falta olho de nativo |

**O QUE DÁ PARA ESCREVER EM CÓDIGO** (a fila voltou a existir em 31/08, depois
de ter acabado em 13/08):

| O que | Tamanho |
|---|---|
| **Carimbo de conferência** — a tese do produto virando desenho | pequeno |
| **Folha de fechamento** — bloco de identificação no topo do painel | médio |
| **Conciliação em duas colunas** — a dupla contagem, que hoje é um número que pede fé | rodada inteira: exige o vínculo registrar COM QUEM casou |
| **Regra de categorização com operadores** | exige migração de `merchant_rules`; o avaliador (`consulta.ts`) já está pronto |

> As três primeiras vêm da prancheta de 31/08. Duas propostas daquela lista
> morreram na reversão do desenho: a régua do banco (o argumento era gastar a
> única exceção de raio zero, e não há mais raio zero) e a impressão de verdade
> (era "a piada funcionando" num app que parecia impresso).

> A **Fatia 1b** saiu daqui: foi descartada em 31/08, com
> [ADR-0011](./adr/0011-backend-serverless-descartado.md). Não está parada — não
> existe mais.

**O que o usuário precisa conferir na próxima vez que abrir** (nesta ordem):

1. **Criar uma conta de verdade e ver o e-mail de confirmação chegar.** O fluxo
   está pinado por teste e os endpoints foram sondados, mas a **entrega**
   depende do remetente da Neon e não dá para verificar sem uma caixa real.
2. **O card "Próximas faturas" do Bradesco** — a fileira de saldos agora mostra
   um card por banco com o número que cada um declara (ver a rodada de 12/08).
3. **O gráfico de saídas por dia**, que ocupou a metade vazia do painel.

**Antes de dizer que algo está pronto**, rode **`npm run verificar`** (17/08).
Um comando só: typecheck, testes, lint, caminhos em string, build e CSP, na
ordem certa e falhando alto. Cor e layout continuam à mão (`medir-contraste.py`,
`medir-overflow.py`) porque um precisa de escolha e o outro do `dev` de pé.
**`npm test` NÃO checa tipos** — essa armadilha já mordeu quatro vezes.

**A dívida de i18n acabou** (13/08): os dois `aria-label` do donut em
`GraficoCategorias` eram o último resto e viraram `donut.rotulo` /
`donut.rotuloFatia`. `GraficoEvolucao` já havia sido traduzido antes. O
documento pode voltar a dizer **i18n 100%** — e desta vez a afirmação foi
conferida arquivo a arquivo, não presumida.

## ⚠️ A REFORMA (leia antes de tudo)

**A estrutura de pastas mudou.** O que era `src/` agora é `frontend/src/`.
Monorepo com npm workspaces: `frontend/` (app React) e `backend/`
(migrations SQL hoje; a API é a Fatia 1b). `scripts/` continua na raiz.
`neon/migrations/` virou `backend/db/migrations/`.

Spec: `docs/superpowers/specs/2026-08-07-reforma-arquitetura-e-design-design.md`
Plano da fatia 1a: `docs/superpowers/plans/2026-08-07-reforma-fatia-1a-arquitetura.md`

**Duas armadilhas novas desta mudança:**

1. **`vite.config.ts` tem `envDir: '..'`.** O `.env.local` fica na RAIZ, não em
   `frontend/`. Sem isso o Vite não acharia as `VITE_*` e elas virariam
   `undefined` **em silêncio** — `neonConfigurado` daria false e o app cairia
   no modo "importa e vê", sem login e sem erro de build para denunciar.
2. **`tests/fixtures/` foi para `frontend/tests/fixtures/`** de propósito: 13
   testes fazem `readFileSync('tests/fixtures/…')` relativo ao CWD, e com o
   Vitest rodando de `frontend/` eles continuam resolvendo sem edição. Os
   scripts da raiz, esses sim, apontam para `frontend/tests/fixtures/`.

### Estado das fatias

| Fatia | O que é | Estado |
|---|---|---|
| 1a | `frontend/` + `backend/` com workspaces | ✅ **no ar** (07/08) |
| 4a | seletor de idioma fora da UI (código i18n intacto) | ✅ **no ar** (07/08) |
| 2 | router + páginas de navegação (a 7ª, "Datas", saiu em 12/08) | ✅ **no ar** (07/08) |
| 3 | design "livro-razão" + gráficos interativos | ✅ **no ar** (07/08) |
| 4b | CSP completa, medida contra o build | ✅ **no ar** (09/08) |
| 1b | backend real (Vercel Functions) | ❌ **descartada** (31/08) — [ADR-0011](./adr/0011-backend-serverless-descartado.md) |

~~**A fatia 1b é o único item aberto da reforma**~~ — **descartada em
2026-08-31**. O código chegou a ser escrito em 28/08 e nunca foi commitado; o
cliente segue falando direto com a Data API, que funciona, com RLS, como sempre
funcionou. O porquê está na [ADR-0011](./adr/0011-backend-serverless-descartado.md).
**A reforma acabou: as seis fatias estão resolvidas.**

**Decisões da reforma:** nginx/apache foi **descartado** (o app está na
Vercel, não há servidor próprio nem painel de banco exposto); o backend será
**real**, em Vercel Functions, com o RLS preservado via
`set_config('request.jwt.claims')` numa role sem BYPASSRLS.

**567 testes (75 arquivos)**, build e lint limpos, medidor de overflow OK,
contraste OK nos dois temas, CSP aprovada nas duas jornadas e contra o site no ar.

## Rodada 2026-08-12 (parte 2) — ajustes pedidos com o app na tela

O usuário abriu o sistema logado, com dados reais de julho, e apontou seis
coisas. Todas resolvidas; duas viraram achado de verdade.

### O card "em aberto" do Bradesco não existia — e o motivo importa

**A pergunta era "por que só o Nubank tem?".** A resposta: `faturasAbertas`
exigia `total_open_balance`, e a fatura do Bradesco **não declara esse
número** — ela não diz quanto já foi gasto no ciclo que ainda vai fechar. O
Nubank diz ("Saldo em aberto total"). Derivar seria **inventar**: essas compras
estão na próxima fatura, que ninguém importou.

O que a fatura do Bradesco declara, e o app gravava sem nunca ler:
`Previsão de fechamento da próxima fatura: 16/07/2026` (agora lida pelo parser,
formato dd/mm/aaaa — o do Nubank é "16 JUL 2026", por isso cada parser tem o
seu leitor) e `Total para as próximas faturas R$ 5.578,34`.

Então o card aparece com o **rótulo certo**: "Em aberto" (Nubank) ou "Próximas
faturas" (Bradesco). São perguntas diferentes — *o que já devo agora* e *o que
já está comprado e ainda vem* — e pôr as duas sob o mesmo rótulo, lado a lado,
seria pior que não mostrar.

### O vazio à direita do donut era o gráfico se apagando

Com **uma só competência importada**, `serie.length < 2` e o gráfico de
evolução (12 meses) retorna `null` — metade do painel ficava literalmente
branca, que é o estado normal de quem acabou de importar as primeiras faturas.

Entrou `GraficoDiario` (`ui/GraficoDiario.tsx`): **saídas por dia do período**,
que responde com um mês só. O donut diz *em que* o dinheiro foi, a evolução diz
*como o mês se compara*, e este diz **quando** — onde estão os picos. Clicar
numa barra leva a tela para aquele dia, o mesmo gesto de clicar num mês na
evolução. Só saídas: uma entrada de salário na mesma escala esmagaria todas as
barras e o gráfico deixaria de responder a única pergunta que ele existe para
responder. Com histórico, os dois gráficos se empilham na coluna.

### Os outros quatro

- **Selo "quitada/em aberto" fora**, a pedido. Com ele saíram
  `domain/quitacao.ts`, seus testes e o cálculo de pagamentos da página —
  código que ninguém mais alcançava. Está no histórico do git.
- **"Datas" fora da navegação**: com dois meses de dados nada é reconhecido
  como recorrente e a página vivia vazia. Rota e componente saíram juntos
  (rota sem link é código que só o autor alcança). O `diaTipico` de cada série
  continua visível em Recorrências.
- **Favicon novo** — carimbo azul da marca (`#1b5e8f`) com "R$" e a régua de
  livro-razão. ⚠️ **A primeira versão nasceu quebrada**: escrever o nome de um
  token CSS num comentário de SVG (com os dois traços da frente) é ilegal em
  XML e derruba o arquivo INTEIRO — sem erro de build, sem erro de teste, o
  navegador só não mostra ícone nenhum. Conferido a 16/24/32/64px, nos dois
  fundos.
- **Card de compartilhamento refeito** no visual "livro-razão": papel frio,
  filete azul, e um documento com débito/crédito e o selo "confere ao centavo"
  — o que o app faz, no formato em que ele faz. `scripts/gerar-og.py` **estava
  escrevendo na pasta errada** desde a reforma de 07/08 (`public/` em vez de
  `frontend/public/`): gerava um arquivo que ninguém servia, e o og.png
  publicado continuava sendo o antigo.
- **Tutorial reescrito**: descrevia um app que não existe mais — mandava clicar
  num botão "Documentos" (virou a página Faturas em 07/08) e dizia que o
  relatório "abre o diálogo de impressão" (o `window.print()` saiu em 24/07).
  Os seis passos agora cobrem importação com conferência, os dois gráficos
  clicáveis, competência, busca/aprendizado, Faturas/Categorias e recorrências.

### Confirmação de e-mail no cadastro (novo)

Pedido: quem cria conta deve **receber um e-mail com link de confirmação**.

O contrato foi **sondado contra o servidor real** antes de qualquer linha, como
em 2026-07-18 (é assim que se descobre a API do Better Auth aqui):

| Chamada | Resposta |
|---|---|
| `POST /send-verification-email {email, callbackURL}` | `200 {"status":true}` **sempre**, inclusive para e-mail sem conta |
| `GET /verify-email?token=…&callbackURL=…` | `302` para o callbackURL; token ruim volta com `error=INVALID_TOKEN` **anexado** (com `&` se já houver query) |
| `GET /verify-email?token=…` (sem callbackURL) | `401` com JSON — por isso o callbackURL não é opcional |

`lib/confirmar-email.ts` (8 testes) faz o envio e lê o retorno. O `callbackURL`
é `<origem>/?confirmado=1`: **a marca própria é o que distingue** "acabou de
confirmar" de "abriu o site", já que o sucesso volta sem parâmetro nenhum — e
um `?error=` de outra origem (um login social cancelado) **não** é lido como
link expirado.

- **O envio é pedido pelo cliente**, no cadastro, porque o envio automático é
  uma chave do servidor da Neon que este app não controla. Assim o link chega
  seja qual for o estado dela.
- **Falhar ao enviar não desfaz o cadastro nem barra a entrada** (a conta já
  existe) — o toast conta o que de fato aconteceu, em vez de prometer um
  e-mail que pode não ter saído.
- **`ui/AvisoConfirmarEmail.tsx`**: faixa com "reenviar link" para quem tem
  `emailVerified === false`. Só com o `false` explícito: campo ausente não
  vira alarme falso. **Não bloqueia nada** — é aviso, não portão. Existe porque
  a recuperação de senha manda o link para esse endereço, e um e-mail digitado
  errado só apareceria no dia em que a pessoa esquecesse a senha, quando já não
  há conserto de dentro do app.

**A recuperação de senha foi reconferida contra o servidor** nesta rodada e
segue igual ao documentado: `request-password-reset` responde 200 mesmo para
e-mail inexistente (não revela cadastro) e `reset-password` com token gasto dá
400. Nada a mudar.

⚠️ **O que falta o usuário fazer**: criar uma conta de verdade e confirmar que
o e-mail chega. Aqui o fluxo está pinado por teste e o endpoint sondado, mas
**a entrega do e-mail depende do remetente da Neon** e não dá para verificar
sem uma caixa real.

**567 testes (75 arquivos)**, build e lint limpos, CSP reaprovada.

⚠️ **Armadilha nova, do próprio medidor:** `document.fonts.status === 'loaded'`
significa *"nada pendente agora"* — e isso também é verdade **antes** de a
primeira fonte ser pedida. Contra o site publicado, numa borda fria, o
`medir-csp.py` passava por ali cedo demais e **reprovava um build correto**
("nenhuma fonte carregou"). Agora ele espera por *uma fonte com status
`loaded`*, então só o esgotamento do tempo reprova — e aí a fonte foi barrada
de verdade. Três rodadas seguidas contra a produção, verdes.

### Dívida anotada, não corrigida

- Os dois gráficos novos e as páginas Datas/Recorrências não usavam `t()`.
  Datas saiu; `GraficoDiario` **nasceu traduzido** (5 chaves nos três
  dicionários), mas `GraficoEvolucao` e `GraficoCategorias` seguem com rótulo
  e `aria-label` fixos em português.

## Rodada 2026-08-12 (parte 1) — code review das fatias 2 e 3

As duas maiores fatias da reforma foram para a `main` **sem review de fim de
ramo**, e a lição registrada neste projeto é que é justamente ele que pega o
defeito *emergente* — o que nenhuma tarefa isolada podia ver. Achou **quatro**,
todos da mesma família: **peças certas, ligação faltando**.

### 1. Dia e Semana não navegavam (o mais grave)

`escreverFiltros` gravava a referência como `AAAA-MM`, mas `pertence()` compara
o **dia exato** (`tx.date === isoLocal(ref)`). Clicar em "próximo dia" gravava
`2026-06` e a leitura devolvia **1º de junho** — a seta não saía do lugar, e
"dia anterior" a partir do dia 1 pulava para o 1º do mês anterior. Semana,
idêntico. E o teste de ida-e-volta convivia com o bug porque conferia **só ano
e mês**: o caso clássico já anotado aqui de *teste que passa dos dois jeitos*.

Correção: a URL passa a gravar `AAAA-MM-DD` **quando o dia significa alguma
coisa** (Dia e Semana), e continua curta em Mês e Ano. `lerRef` aceita as duas
formas — todo link antigo continua de pé — e **valida a data pelo resultado**,
não pelo formato: `2026-02-31` casa o regex e o `Date` rolaria para março
calado. Junto, `mover` passou a ancorar Mês/Ano no dia 1, senão **31 de janeiro
+ 1 mês daria 3 de março** e fevereiro sumiria da navegação.

Seis testes novos em `dados/filtros.test.ts` descrevem o clique como o usuário
o dá (`mover` → URL → ler), e cinco deles falhavam antes da correção.

### 2. `cat` e `q` da URL eram letra morta

`lerFiltros`/`escreverFiltros` liam, escreviam e **testavam** os dois — e
**nenhuma tela os consumia**: `ListaTodos` guardava busca e categoria em
`useState` próprio. Consequências: o recorte não sobrevivia ao F5, o link não
carregava a busca, e o **clique numa fatia do donut** (que navega para
`/lancamentos?cat=…`, a funcionalidade que a fatia 3 anunciou) chegava sem
efeito nenhum — a pessoa via a lista inteira, sem entender por quê.

Correção: `ListaTodos` virou **controlada** (busca e categoria vêm de fora) e a
página as liga à URL; quem chega com `cat` ou `q` abre direto na vista que
filtra, em vez da vista por categoria, que os ignoraria.

### 3. O clique no donut jogava fora o resto do recorte

Montava `?cat=…` na mão. Quem clicava numa fatia **de maio, filtrando o
Nubank**, caía em lançamentos de **outro mês** (a página sem `ref` se ancora na
competência mais recente) e com **todos os bancos**. Agora a navegação leva o
recorte inteiro.

### 4. A barra de navegação perdia o recorte a cada troca de página

Mesma família, porta mais larga: `NavLink` ia para o caminho pelado. As sete
páginas são **vistas diferentes do mesmo recorte** — é o motivo de `useRecorte`
existir —, e trocar de página zerava período, mês, banco e busca em silêncio.
Agora a query viaja junto (e o "Lançamentos →" do Painel também).

**Isso criou uma exposição nova, corrigida na mesma rodada:** `Recorrências`
**obedece** ao filtro de banco (usa `visiveis`) e não o mostrava. Com a
navegação preservando o recorte, chegar lá filtrado virou rotina — e filtro que
age sem aparecer é exatamente o defeito do seletor de categoria de 2026-08-05.
A página passou a exibir `<BarraFiltros mostrarPeriodo={false} />`: mostra o
filtro que ela obedece e **não** mostra o de período, que ela ignora. As duas
metades da mesma regra — o que se vê e o que filtra não podem divergir.

**564 testes (75 arquivos)**, build e lint limpos, CSP reaprovada.

### Dívida anotada, não corrigida (decisão de escopo)

- **`Datas.tsx` e `Recorrencias.tsx` não usam `t()` em lugar nenhum**, e os dois
  gráficos novos têm rótulo e `aria-label` fixos em português
  (`GraficoEvolucao`: "Entradas × saídas · 12 meses", "Escolha um mês…";
  `GraficoCategorias`: "Gasto por categoria…", "Ver lançamentos"). Como o
  seletor de idioma saiu da UI na fatia 4a, **não quebra nada hoje** — mas o
  documento afirmava i18n 100%, e não está mais. Quando o seletor voltar, são
  ~25 chaves em três dicionários.
- **`Datas` com período Dia/Semana**: a grade é sempre do mês da referência,
  então as setas andam um dia por clique e o calendário só muda de mês quando
  cruza a virada. Pré-existente à correção nº 1, e sem defeito de dado.

## Rodada 2026-08-09 — CSP completa (fatia 4b, a última que não dependia do usuário)

A política que ficou de fora em 2026-07-29 está no ar. O que a destravou foi a
fatia 3 ter trazido as fontes para o próprio domínio (`font-src 'self'`) — a
quebra do Google Fonts era metade do motivo original.

**A outra metade do motivo continuava de pé, e virou ferramenta.** O
`vercel.json` **não vale no `npm run dev` nem no `vite preview`**: só a Vercel
aplica aqueles headers. Publicar para descobrir se a política quebra o app é
descobrir com o app quebrado no ar. `scripts/medir-csp.py` fecha esse buraco —
sobe um servidor estático que devolve os headers **lidos do próprio
`vercel.json`** (copiar a política para dentro do script seria medir uma
política que não vai ao ar) e dirige o Chromium contra o build de produção.

O script tem duas metades, e **a segunda é a que dá valor à primeira**:

1. **Jornada** — usa o app e coleta `securitypolicyviolation`.
2. **Sondas** — 16 tentativas com o resultado *declarado*. Metade espera
   **bloqueio**: script inline injetado, `eval`, origem estranha, `<base>`
   externa, imagem para fora, `form-action` para fora. Sem esses controles
   negativos, um header que nem chegou ao navegador daria zero violações e
   nota máxima — sonda que passa dos dois jeitos é pior que nenhuma.

**As jornadas assevera resultado, não silêncio.** A da tela de acesso exige o
toast de volta (`"E-mail ou senha incorretos."` — resposta real do servidor); a
de importação exige o toast de leitura (`"94 lançamentos — bate com o banco ao
centavo."`, de um extrato BB real). Sem isso, worker barrado e importação
morta passariam como "nenhuma violação".

**O achado da rodada: o app chama `eval` no uso normal.** É o `allowsEval` do
**zod** (`node_modules/zod/v4/core/util.js:142`), que chega via
`@neondatabase/neon-js` → better-auth: uma **sonda de capacidade** memoizada,
`try { new Function('') } catch { return false }`. Sob CSP ela responde "não
posso" e o zod passa a validar pelo caminho interpretado — o mesmo que ele já
usa em Cloudflare Workers, ambiente que o próprio zod testa na linha de cima.
**Não virou `'unsafe-eval'`**: seria devolver ao atacante a primitiva mais
valiosa da lista para comprar de volta uma otimização que ninguém mede. Está
registrada como violação esperada em `ESPERADAS`, e a trava que impede esse
perdão de virar cheque em branco é a jornada exigir que o login **responda**
depois do bloqueio.

**A política, e o porquê de cada exceção:**

| Diretiva | Valor | Por quê |
|---|---|---|
| `script-src` | `'self'` + hash sha256 | o `<script>` do tema, inline no `<head>`, precisa rodar antes da primeira pintura |
| `style-src` | `'self' 'unsafe-inline'` | React/motion escrevem `style=""` em **atributo**, e o sonner injeta a folha dele; hash não cobre atributo (só `'unsafe-hashes'`, que é pior). Estilo não executa código |
| `connect-src` | `'self'` + as **duas origens exatas** do Neon | `https://*.neon.tech` seria canal de exfiltração pronto: qualquer pessoa cria um projeto Neon e ganha um endpoint sob o curinga |
| `worker-src` | `'self' blob:` | o parsing do pdf.js roda em worker |
| `img-src` | `'self' data: blob:` | o jsPDF desenha em canvas |
| `base-uri`, `object-src`, `frame-src`, `media-src` | `'none'` | nada disso existe no app; `<base>` externa sequestraria todo caminho relativo |

Sem `upgrade-insecure-requests` de propósito: o HSTS já força o esquema, e a
diretiva atrapalharia a medição local em `http://127.0.0.1`.

**Verificado por mutação** (o script precisa reprovar, não só aprovar): hash
errado → a violação do script de tema aparece e reprova; `connect-src` sem as
origens do Neon → o login morre com `"Failed to fetch"` e duas violações.

✅ **Conferida no ar** (`--url https://capital-financeiro.vercel.app`): o header
chega da Vercel idêntico ao do repositório, o script de tema roda, as 5 fontes
carregam, o login real responde, as 16 sondas se comportam como declarado e
`/.env`, `/.env.local`, `/.git/config` e `/scripts/*` não respondem 200.

**Também nesta rodada:** o `rewrite` de SPA passou a excluir `/.git`, `/.env*`,
`/backend/`, `/scripts/` e `/node_modules/`. A Vercel não serve nada disso de
qualquer forma — o que se corrige é o catch-all responder **200 com o HTML do
app** para `/.env`, que faz um scanner registrar o caminho como existente.

**Três testes novos em `frontend/index.test.ts`** (13 no arquivo), porque o
acoplamento entre `index.html` e `vercel.json` é invisível para o compilador:
o hash de **cada** script inline tem que estar na `script-src`; `script-src`
não pode ganhar `'unsafe-inline'`/`'unsafe-eval'` (sem isso o teste do hash
passaria à toa); toda origem `VITE_*` do `.env.local` tem que estar na
`connect-src` (pula se o arquivo não existir — ele é gitignored). Os dois
primeiros foram verificados por mutação.

## Rodada 2026-08-07 — fatias 2 e 3 (páginas e design)

### Fatia 2 — sete páginas, e o fim da barra de rolagem do painel

`Dashboard.tsx`, de 846 linhas, **deixou de existir**: virou Painel,
Lançamentos, Faturas, Importação, Categorias, Recorrências e Datas, cada uma
com endereço próprio.

A queixa da barra de rolagem foi resolvida **pela raiz**. O
`xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto` da coluna lateral não foi
apagado: ele existia porque a coluna passava da altura da janela, e `sticky`
mais alto que a viewport gruda deixando o resto **inalcançável**. Com o
conteúdo distribuído em sete páginas a coluna não alcança mais esse tamanho,
então a regra saiu **sem trazer o bug de volta**. Outras três barras internas
do mesmo tipo caíram junto (Documentos `55vh`, Categorias `60vh`, prévia da
importação `46vh`): existiam para caber num card de modal e, como página,
viravam barra dupla.

Peças novas: `dados/filtros.ts` + `useFiltros` (o recorte da tela vive **na
URL**, com `replace: true` para a busca não encher o histórico),
`dados/useRecorte` (filtrar+agregar num lugar só), `dados/periodo.ts`,
`dados/calendario.ts` (a página Datas deriva do `diaTipico` das recorrências —
nada digitado, o sistema segue 100% retrospectivo) e `ui/BarraFiltros`.
Os dois modais de Faturas e Categorias tiveram o **miolo extraído e o
invólucro descartado** (Portal, trava de rolagem, Esc, véu): numa página, cada
um deles seria defeito.

### Fatia 3 — a direção "livro-razão"

O visual anterior (creme, display serifada de alto contraste, âmbar/terracota,
cantos de 16px, brilho, grão) **era o cluster #1 do que hoje se reconhece como
página gerada por IA** — o usuário identificou isso de olho. A direção nova sai
do que o app **faz**: ele confere, ao centavo, contra o gabarito do banco. Isso
é conciliação contábil, e o desenho vem desse mundo — papel frio de formulário
fiscal (`#f6f7f9`), tinta azul-ferro, marca azul de carimbo (`#1b5e8f`),
semântica **crédito/débito** (nunca cor sozinha: sempre com sinal ou rótulo),
cantos de 2–3px, réguas de 1px, zero gradiente.

Tipografia: **uma família (IBM Plex), três vozes** — Mono nos números (que são
o herói da tela), Condensed nos rótulos de coluna, Sans no corpo. Servida do
**próprio domínio** (16 woff2, 412 kB, só latin/latin-ext) — o Google Fonts saiu
justamente para destravar a CSP desta semana.

`scripts/medir-contraste.py` **novo**: reprova o build do olho humano. Achou um
par abaixo de AA (borda de campo clara, 2,62:1) e a correção veio por **busca**
preservando matiz e saturação (`#8b97a6` → `#7f8c9d`, 3,19:1).

Gráficos **interativos em SVG próprio** (gráfico com cara de biblioteca é a cara
que se pediu para evitar): o donut destaca a fatia no hover/foco e abre os
lançamentos no clique — a cor segue a **categoria, não o ranking**, então
trocar de mês não repinta o que sobrou, e o preço disso é o rótulo ao lado ser
obrigatório. A evolução virou **entradas × saídas** de 12 meses (`entradasCents`
já existia na série e nunca era desenhado), numa escala só para as duas séries.

**three.js removido** (−515 kB de chunk): era decoração de fundo, e decoração
não paga meio megabyte.

## Rodada 2026-08-05 — funcionalidades derivadas (3 fatias)

### Code review da própria rodada — 3 bugs achados e corrigidos

Revisão feita depois das três fatias, sobre o código recém-escrito.

1. **Chave de React duplicada nos alertas.** `Alerta` tinha `chave` (o
   estabelecimento) mas não a série de origem. A mesma loja pode ter série de
   **saída** (a cobrança) e de **entrada** (o estorno), e as duas podem sumir
   no mesmo mês — dois alertas indistinguíveis, com a mesma chave na lista.
   Campo `origem` novo, pinado por teste.
2. **O filtro de categoria mentia ao trocar de período.** Se a categoria
   escolhida não existisse no mês novo, o `<select>` caía visualmente em
   "todas" (nenhuma `option` casava com o `value`) enquanto o estado seguia
   filtrando: a tela mostrava "0 lançamentos" com um filtro que ninguém via.
   Resolvido derivando `catEfetiva` em vez de guardar estado que pode
   apodrecer — o que se vê e o que se filtra não têm como divergir.
3. **Coluna lateral `sticky` podia ficar inalcançável.** A coluna ganhou dois
   cards nesta rodada e passou a poder ficar mais alta que a janela. Elemento
   `sticky` mais alto que a viewport gruda e o que sobra embaixo não é
   alcançável — a rolagem da página move o irmão, não ele. Resolvido com
   `max-h` + `overflow-y-auto` no contêiner grudado.

Mais dois acabamentos: os botões "Apagar" do painel de Categorias ganharam
`aria-label` com o nome da categoria (havia **dois botões "Apagar" idênticos**
na tela com a confirmação aberta — o teste tinha de adivinhar "o último"), e
`faturasQuitadas` saiu do corpo do render para um `useMemo`.

> **Nota de método:** o bug do casamento de faturas (a mais antiga roubando o
> pagamento da mais nova) foi achado porque o teste original só asseverava
> `size === 1` — passava com a implementação certa e com a errada. Vale a
> lição já registrada neste documento: *teste que passa dos dois jeitos é pior
> que nenhum*. A correção foi verificada por mutação.

### Tipografia e cores — medidas, não opinadas

**Tipografia.** Archivo passou a ser carregada como **fonte variável**
(`wdth 62–125`, `wght 400–800`) no lugar dos 5 pesos estáticos: um arquivo em
vez de cinco, e de quebra um eixo de LARGURA. `.font-display` agora usa
`font-stretch: 108%` — display e corpo são a mesma família em larguras
diferentes, então há hierarquia real **sem carregar uma segunda fonte**.
Também: `text-wrap: balance` nos títulos, `text-wrap: pretty` nos parágrafos.

`.tabular` (as cifras) foi **movida para `@layer components`** e ganhou peso
500 e tracking −0.015em. O layer importa: regra sem layer vence utilitário do
Tailwind — o inverso da armadilha do `@layer base` já anotada aqui — então uma
`letter-spacing` solta atropelaria o `tracking-widest` dos rótulos de 10px que
também usam `.tabular`.

**Cores.** Medi o contraste WCAG de todos os pares que o app usa. Seis
falhavam AA e foram corrigidos com o **menor ajuste possível preservando
matiz e saturação** (resolvidos por busca, não escolhidos a olho):

| Token | Antes | Depois | Motivo |
|---|---|---|---|
| `tinta-tenue` (escuro) | `#6f6a62` | `#8c867d` | 3,0–3,5:1 → 4,50–5,19:1 |
| `falha` (escuro) | `#d64545` | `#d95252` | 4,27:1 → 4,70:1 |
| `tinta-tenue` (claro) | `#776f63` | `#6f685d` | 4,06:1 na página → 4,50+ |
| `marca` (claro) | `#9a6a15` | `#8e6213` | 3,97:1 → 4,52:1 |
| `ressalva` (claro) | `#9c6415` | `#945f14` | 4,35:1 → 5,33:1 |

O caso do `tinta-tenue` escuro é o mais amplo: é a cor de **todos** os rótulos
de 10–11px do painel. O tema claro já tinha sido corrigido por esse motivo
numa rodada anterior; o escuro tinha ficado para trás.

**`--color-campo-borda`, token novo.** As bordas de campo estavam em ~1,8:1,
abaixo dos 3:1 que a WCAG pede para identificar um controle. Subir o token dos
cartões junto engrossaria o desenho inteiro, então campos ganharam token
próprio (`#6a635a` escuro / `#9c8f77` claro, ambos ≥3:1). Aplicado em
`estilos-campo.ts`, `ListaTodos`, `Categorias`, `EditarCompra` e
`EditarPerfil`. **As bordas de cartão não mudaram** — aquilo é decoração.

Origem: `docs/img/exemplo.jpeg`, print de um app de finanças de terceiro, usado
como referência **de funcionalidades** (nenhuma decisão de aparência foi tomada).
Spec em `docs/superpowers/specs/2026-08-05-funcionalidades-derivadas-design.md`;
plano da fatia 1 em `docs/superpowers/plans/2026-08-05-funcionalidades-derivadas-fatia-1.md`.

**Decisão estruturante:** metade do que o print mostra (falta pagar, contas
pagas, datas, recorrências, poupança) nasce, naquele app, de dado **digitado**.
O Capital Financeiro continua **100% retrospectivo** — só entrou o que dá para
**derivar** do que já é importado. Poupança/investimentos foi **descartado**.

### Fatia 1 — dado morto e derivações

1. **Saldo em aberto do cartão** (`persist/aberto.ts`, `ui/SaldoAberto.tsx`).
   O achado da rodada: `salvar.ts:74-77` gravava `total_open_balance`,
   `next_invoice_balance`, `next_close_date` e `future_installments_total`
   desde sempre e **nenhuma linha do app lia**. São colunas do schema **0001**,
   então não houve migração. `puxarSaldos()` alargou o select (mesmo
   `try/catch` defensivo) e passou a devolver `DocDoPainel`.
   O nome `puxarSaldos` **não** mudou de propósito: `Dashboard.pdf.test.tsx`
   mocka o módulo por nome.
2. **Fatura quitada vs em aberto** (`domain/quitacao.ts`, selo em `Documentos`).
   Conserta um buraco real: `vincular()` só cruza documentos do **lote da
   importação**, então fatura e extrato importados em dias diferentes nunca se
   encontravam. Aqui a regra roda sobre todo o histórico salvo.
   **Casa por par mais próximo primeiro, não fatura a fatura** — a primeira
   versão deixava a fatura mais antiga roubar o pagamento que casava exatamente
   com uma mais nova de igual valor. Pinado por teste e **verificado por
   mutação** (inverter a ordenação derruba 2 testes).
3. **Tile "Saldo do período"** (`agregar().saldoCents`).
4. **Card "Maiores saídas do período"** (`maioresSaidas()`, `ui/MaioresSaidas.tsx`).

### Fatia 2 — recorrências e alertas (`domain/recorrencias.ts`)

Detecção pura, sem cadastro. Cobre as abas *Recorrências* **e** *Datas do mês*
do print de uma vez: o `diaTipico` (mediana do dia) **é** o calendário.

Três filtros, cada um por um motivo registrado no código: parceladas ficam de
fora (já são `CompromissosFuturos`), vínculos ficam de fora (a quitação
lideraria a lista sem significar nada) e exige **mediana de 1 cobrança por
competência** — é o que separa assinatura de supermercado, que também aparece
todo mês mas com 27 compras.

**Alertas** (`valor-mudou`, `sumiu`) — a única funcionalidade da rodada que o
app do print **não tem**. Duas travas contra alerta que grita à toa:
`valor-mudou` só dispara para série de **valor fixo** (senão a conta de luz
alertaria todo mês) e exige **>10% E >R$ 5,00**; `sumiu` compara contra a
**competência mais recente com dado** (senão o mês sem fatura importada
acusaria tudo) e tem teto de 3 meses (senão série de 2024 gritaria para sempre).

### Fatia 3 — busca e gestão do aprendizado

- **Vista "Todos"** (`domain/busca.ts`, `ui/ListaTodos.tsx`): terceira opção do
  seletor que já existia, com busca por texto e filtro por categoria. A busca
  casa contra `label ?? description` e ignora acento e caixa.
- **Painel de Categorias** (`ui/Categorias.tsx`): renomear/ícone/cor/apagar as
  suas, **e ver/desfazer as regras aprendidas**. Fecha o terceiro achado da
  rodada: `merchant_rules` **não tinha nenhuma UI** — o usuário corrigia uma
  categoria, o app decorava e não havia como ver nem desfazer. Novos
  `apagarRegra` e `editarCategoria`. Apagar categoria em uso avisa **quantos
  lançamentos** vão passar a exibir "Outros".

### Verificação

**504 testes (66 arquivos)**, build e lint limpos (só os 3 avisos
pré-existentes), `medir-overflow.py` OK em 1280×800 e 390×844 depois da
mudança de largura de fonte.

⚠️ **`npm test` não checa tipos.** O erro de tipo introduzido pelo campo
`origem` nas fixtures passou pela suíte inteira e só caiu no `tsc -b` do
`npm run build`. **Rodar os dois sempre** — verde no Vitest não é verde.

⚠️ **Não verificado logado**: a senha da conta de teste não é versionada, então
as telas novas foram exercidas por teste de componente, não contra dados reais
no navegador. É o que falta o usuário conferir.

✅ **A dúvida das "Entradas" foi resolvida em 2026-08-09 — e a resposta é que a
pergunta estava mal posta.** A suspeita registrada aqui (o
`BradescoCartoes14-07-2026` na pasta de junho) estava certa, e agora está
medida: rodar o diagnóstico com os **3 PDFs de junho** e com os **4 da pasta**
dá números diferentes em *todas* as linhas, porque o script **soma o que você
entrega a ele** — ele não filtra por competência, e a fatura de julho traz
compras de meados de junho a meados de julho.

| Medida | Só os 3 de junho | A pasta inteira (4, com a fatura de 14/07) |
|---|---|---|
| Gasto real | R$ 40.955,46 | **R$ 41.012,25** |
| Entradas | R$ 45.441,75 | **R$ 50.281,18** |
| Vinculado (fora da conta) | R$ 17.824,24 | **R$ 23.353,68** |

A coluna da direita é a que sempre esteve na tabela de referência — os números
históricos foram calibrados **com** a fatura de julho. O `+R$ 5.529,44` do
vinculado é exatamente o total declarado dela: com a fatura presente, o
pagamento que aparece no extrato Bradesco encontra o documento e sai da conta,
que é o mecanismo funcionando. Os R$ 41.853,57 de entradas da tabela antiga não
batem com nenhum dos dois conjuntos: são de um estado de pasta anterior.

**A lição: número de referência sem o conjunto de arquivos ao lado não é
reproduzível.** Por isso `scripts/diagnostico.ts` deixou de ter a lista fixa de
quatro nomes (que dava `ENOENT` em qualquer outra pasta) e passa a **ler os
PDFs da pasta**, imprimindo quantos achou. A pasta virou a fonte da verdade.

### Números de referência do diagnóstico (recalibrados em 2026-08-09)

| Medida | Valor | Conjunto |
|---|---|---|
| Gasto real total | **R$ 41.012,25** | os 4 PDFs de `D:/extratos/junho2026` |
| Entradas | **R$ 50.281,18** | idem |
| Vinculado (fora da conta) | **R$ 23.353,68** | idem |
| Supermercado | **R$ 918,46** (27 lançamentos) | idem |
| Fatura Nubank — declarado | R$ 8.324,24 | idem |
| Fatura Bradesco — declarado | R$ 5.529,44 | idem |

## Rodada 2026-07-29 — i18n fechado de verdade + performance + confete

Três entregas, todas verificadas (suíte completa, build, lint, tsc, medidor de
overflow e smoke de runtime no Chromium com troca pt→en sem erro de console):

1. **i18n 100%**: fatia final dos modais/Tutorial (planejada) **e** as superfícies
   que tinham ficado de fora — tela de importação inteira (Dropzone, ResultadoImport,
   toasts de importar/salvar do App), ThemeToggle, LinhaTransacao e o **relatório
   jsPDF** (via `tAtual` em `src/i18n/traduzir.ts`, t sem React). `interpolarNos`
   (`src/i18n/interpolarNos.tsx`) injeta spans estilizados em frase traduzida.
2. **Code-splitting do pdf.js**: import dinâmico memoizado em `domain/pdf/load.ts` —
   chunk inicial de 1.340 kB → ~938 kB (gzip 381 → 262). Só quem importa PDF baixa.
3. **Confete** (`src/ui/Celebracao.tsx`): dispara quando o total lido **confere ao
   centavo**; camada `fixed` + `overflow-hidden` + `pointer-events-none` (não entra
   no layout de rolagem) e respeita `prefers-reduced-motion`. Testado.

Também: teste direto de `limparTokenDaUrl` (dívida antiga quitada) e `rotuloTipo`
saiu do domain (rótulo é da UI). **374 testes (52 arquivos).**

### Code review completo (2026-07-29) — achados e correções

Revisão de segurança + design. **Nada explorável encontrado**; o modelo de
isolamento está correto (RLS nas 5 tabelas, políticas por `auth.user_id()`,
o cliente **nunca** manda `user_id`, e um usuário não consegue criar categoria
"global"). Sem XSS (zero `innerHTML`/`eval`), sem segredo versionado.

**Corrigido nesta rodada:**

1. **O aprendizado de categorias não existia na prática.** `aprendizado.ts`
   (`regraDaCorrecao`, `mesclarRegras`) só era chamado pelos próprios testes, e
   a tabela `merchant_rules` — criada no schema inicial, com RLS — nunca foi
   lida nem escrita. `salvar.ts` chamava `categoriaDe(t)` **sem regras**, então
   toda correção do usuário era esquecida e a mesma loja voltava errada todo
   mês. Docs afirmavam o contrário. Agora: `persist/regras.ts`
   (`puxarRegras`/`salvarRegra`, com limpeza do mesmo padrão antes de inserir
   para não acumular regras concorrentes), o App carrega as regras no login,
   `EditarCompra` grava a regra quando a categoria muda (falha aqui **não**
   desfaz a edição), e a prévia da importação já mostra as categorias
   corrigidas. **`salvarDocumento` agora exige `regras`** — parâmetro sem
   default de propósito, para o compilador impedir que outro ponto de chamada
   volte a categorizar só pelas globais. Contrato pinado em
   `aprendizado.round-trip.test.ts` (5 testes, sem rede).
2. **Sem cabeçalhos de segurança** → `vercel.json` com `X-Frame-Options: DENY`
   + CSP `frame-ancestors 'none'` (clickjacking), `nosniff`, HSTS,
   `Referrer-Policy` e `Permissions-Policy`. **CSP completo ficou de fora de
   propósito**: quebraria Google Fonts, o worker do pdf.js e a API do Neon, e
   `vercel.json` não vale no preview local — não daria para testar antes de
   publicar. ✅ **Feito em 2026-08-09** (fatia 4b): as fontes vieram para o
   próprio domínio e `scripts/medir-csp.py` resolveu o "não daria para testar".
3. **Acessibilidade da tela de acesso**: os campos tinham só `placeholder`
   (não é nome acessível — some ao digitar). Agora têm `aria-label` + o
   `autoComplete` certo (`name`/`nickname`/`email`/`current-password` vs
   `new-password`). Sem `<label>` visível, para não mexer no desenho do card.
4. **Código morto removido**: `hashTransacao` (o dedupe real usa
   `chaveTransacao`+`sha256`), `dataLonga` e `removerCategoriaExtra`.

**Não corrigido, por decisão:** `npm audit` acusa 5 CVEs (1 crítica) no
`better-auth 1.4.18`, transitivo do `@neondatabase/neon-js`. **Todas** são de
recursos de *servidor* de auth (oidc-provider, mcp, organization, SCIM) que
este app não roda — quem roda é a Neon — e verifiquei que o bundle **não
contém** `oidc-provider`. A correção exige bump *major* de um SDK em beta, o
que mexeria em todo o login sem ganho real. **Não rodar `npm audit fix
--force`.** Reavaliar quando a Neon publicar SDK estável.

**395 testes (55 arquivos).**

### Correção 2026-07-29 (noite) — modais presos ao container + tema claro padrão

Usuário mostrou o véu do modal cobrindo só a faixa do painel e a confirmação
nascendo no rodapé, fora da tela.

**Causa raiz (medida no Chromium, não deduzida):** `.surgir` — a classe de
entrada do dashboard — anima `transform` com `animation-fill-mode: both`, e um
elemento assim **vira bloco de contenção para descendentes `fixed`, para
sempre**, mesmo depois da animação. Repro isolado: o mesmo `fixed inset-0`
media **1248×18px** dentro do `.surgir` e **1280×800** fora dele.

- **`ui/Portal.tsx`**: pendura os overlays no `<body>` via `createPortal`.
  Aplicado em Confirmacao, Documentos, EditarCompra, EditarPerfil, Tutorial e
  Celebracao. Renderiza no **mesmo commit** (sem gate de montagem) porque o
  Confirmacao foca o Cancelar num efeito de montagem — adiar deixava as refs
  nulas e derrubou 2 testes de foco. Imune a qualquer transform futuro.
- **`useTravarRolagem`** trava o scroll do fundo, com **contador** (Documentos
  + Confirmação empilhados: fechar o de cima não pode destravar).
- **`--color-veu`**: os véus usavam `bg-carvao-950/70`, que no tema **claro é
  creme** — não escurecia nada. Agora é uma cor própria, escura nos dois temas.
- Verificado no build de produção: overlay portado = 1280×800 = viewport.

**Tema claro virou o padrão** (`ThemeToggle.temaInicial`: escolha salva >
preferência do sistema > claro) + script no `index.html` que estampa
`data-theme` **antes da primeira pintura**, senão a página nascia escura e
piscava. Paleta clara refeita: página `#efebe2` e cartão `#fffefc` (no claro,
elevação = mais branco + sombra suave; antes eram dois cremes vizinhos e tudo
lia chapado), `--color-tinta-tenue` de `#8a8377` → `#776f63` (o anterior dava
~3:1 nos rótulos de 10–11px) e `.sombra-flutuante` com valor por tema.
**390 testes (54 arquivos).**

### Correção 2026-07-29 (tarde) — "Não consegui gerar o PDF"

Usuário relatou o toast de erro ao baixar, e que só existia compartilhar.
**Duas causas, ambas corrigidas:**

1. **Chunk obsoleto depois de deploy (a causa do erro).** O hash do chunk do
   jsPDF muda a cada build (`DQmrqhaM`→`y4HQsXkL`→`Mhhn8_ys` só nesta sessão).
   Aba aberta antes do deploy pede um arquivo que não existe mais e o import
   dinâmico rejeita com *"Failed to fetch dynamically imported module"* —
   **confirmado no Chromium contra o build de produção**. O `catch {}` sem
   binding transformava isso em "não consegui gerar o PDF", culpando o
   recurso errado. Agora `lib/chunk.ts` (`ehFalhaDeChunk`, 5 testes) detecta e
   o toast oferece **Recarregar**. Vale para qualquer import dinâmico futuro.
2. **Baixar e compartilhar eram uma decisão automática.** `baixarOuCompartilhar`
   escolhia sozinho: no Chrome/Edge do **Windows** `canShare({files})` é true,
   então o desktop caía sempre no share e o download sumia. Agora
   `lib/compartilhar.ts` expõe `baixarArquivo`, `compartilharArquivo` e
   `podeCompartilharArquivo` (7 testes), e a UI tem **dois botões** — o de
   compartilhar só aparece onde há suporte. Se o share falhar (ex.:
   `NotAllowedError` por user activation expirada durante a geração), **cai
   para o download** em vez de perder um PDF já pronto. Pinado em
   `Dashboard.pdf.test.tsx` (3 testes).

Todo `catch` de PDF agora faz `console.error` com o erro real.
**386 testes (53 arquivos).**

✅ **Migração 0002 CONFERIDA EM PRODUÇÃO (2026-07-29)**: o usuário verificou no
SQL Editor do Neon — `documents.end_balance_cents` existe e o CHECK de
`accounts.bank` já aceita os 5 bancos (aplicada por ele em 2026-07-24, 20:33).
O item 4 da fila está 100% encerrado; **nenhuma pendência de banco restante**.

## Últimas duas rodadas (2026-07-23) — tela de acesso + acabamento

Duas rodadas grandes, **verificadas no navegador pelo usuário** (rolagem e modais
confirmados OK) e enviadas ao ar:

1. **Tela de acesso em duas colunas** — frase à esquerda, card à direita, sem rolagem;
   `MoedaLogo` novo (donut animado, cor de tema); **fim do login automático** depois de
   redefinir a senha (o e-mail guardado só preenche o campo agora, nunca autentica —
   apaga a classe do bug F4). Ver `specs/plans 2026-07-19-tela-de-acesso*`.
2. **Acabamento e confirmações** — `Confirmacao.tsx`, um diálogo modal único (foco preso,
   Esc, foco inicial no Cancelar quando é perigo) ligado em **sair da conta, apagar
   documento, apagar tudo e salvar edição**; sistema de raio/elevação com **hover só no
   que é clicável**; favicon legível a 16px; card OG com donut. Ver
   `specs/plans 2026-07-19-acabamento-e-confirmacoes`.

**294 testes verdes** (31 arquivos), build e lint OK.

### Em andamento (2026-07-23): suporte a mais bancos

Iniciada a rodada de **novos parsers de banco** — spec em
`specs/2026-07-23-novos-bancos-bb-sicredi-sicoob-caixa-design.md`. Amostras reais
(de portais de transparência) guardadas em `.amostras-bancos/` (gitignored).
- **Banco do Brasil:** ✅ **PRONTO E NO AR** (commit `1e825e9`) — 3º banco que o app lê.
  Parser em `parsers/bb-extrato.ts`, confere pela progressão de saldo (novo
  `ParseResult.balance` + ramo no `checksum.ts`), e a varredura interna (aplicação
  automática) é marcada `internal_transfer` para não inflar o gasto. 11 testes.
  Falta só o layout A (2020, `bb-belem.pdf`) — a ordem das colunas de data inverte;
  o parser atual é do layout B (2023). Fazer quando aparecer um extrato nesse formato.
- **Sicoob e Sicredi:** amostras web de texto ricas; falta Task 0.
- **Caixa:** PARADA — o extrato pessoal do usuário veio como **imagem** (sem camada de
  texto); o app só lê texto. Retomar com PDF de texto (internet banking) ou decidir OCR.
- **Sicredi pessoal:** usuário traz depois.
- **Santander/Itaú:** sem material público; só com PDF real fornecido.
- Ferramenta de Task 0: `scripts/_dump-bb.ts` (gitignored) despeja linhas com `x`/`right`.
- Carrossel de bancos na tela de login: adiado até haver ~5 bancos reais.

**Dívida técnica desta rodada, anotada de propósito** (não bloqueia, mas registrar):
- `Confirmacao`: minors de teste em aberto — sem cobertura de `severidade:'normal'`, a
  invariante do `.replace` em `BOTAO_CONFIRMAR_NORMAL` não está pinada por teste, e a
  seção de TDD do relatório da Task 1 super-reportou o RED (2 dos 3 testes eram de
  caracterização). Detalhe no ledger `.superpowers/sdd/progress.md`.
- `EditarCompra` não tem teste próprio; a confirmação de salvar foi ligada sem teste
  de integração (o de `Documentos` foi escrito).
- Confirmar **toda** gravação de edição adiciona atrito a uma ação reversível e
  frequente. Foi escolha explícita do usuário; remover é trivial (uma linha) se incomodar.

## Onde o código está

- **Nome do sistema:** **Capital Financeiro** (era "Controle Financeiro", passou por
  "PayPulse" e voltou atrás — ver armadilha de domínio no fim).
- **Branch:** `main`, direto. A `feat/ingestao-documentos` foi mesclada (PR #1) e
  aposentada — **não se trabalha mais nela**.
- **Remoto:** `git@github.com:cielioqueiroz/controle-financeiro.git`
  (o repositório mantém o nome antigo de propósito: renomear quebraria caminhos).
- **No ar:** **https://capital-financeiro.vercel.app** — projeto `capital-financeiro`
  na Vercel, conectado ao GitHub. **Todo push na `main` publica sozinho** em ~1 min.
- **Pastas:** monorepo npm — `frontend/` (o app React, onde vivem os testes e o
  `index.html`), `backend/` (por ora só `db/migrations/`), `scripts/` na raiz.
- `npm test` = **567 testes verdes** (75 arquivos), `npm run build` e `npm run lint` OK.

## Como validar rapidamente que nada quebrou

```bash
npm test && npm run build && npm run lint      # os três, sempre: test NÃO checa tipos
npx tsx scripts/diagnostico.ts "D:/extratos/junho2026"   # PDFs reais, fora do repo
python scripts/medir-overflow.py                          # com npm run dev rodando
python scripts/medir-contraste.py                         # WCAG dos pares em uso
python scripts/medir-csp.py                               # DEPOIS de npm run build
```

**O `medir-csp.py` mede o `dist/`, não o código.** Rodar sem `npm run build`
antes aprova o build anterior — e ele nem reclama, porque um `dist` velho é um
`dist` válido. Duas jornadas cobrem o app inteiro, porque a tela depende de o
build ter ou não as `VITE_*`:

```bash
npm run build && python scripts/medir-csp.py             # tela de acesso + login real
# e a de importação, que precisa de um build SEM Neon (modo "importa e vê"):
cd frontend && VITE_NEON_DATA_API_URL= VITE_NEON_AUTH_URL= npx vite build --outDir /tmp/dist-anon
python scripts/medir-csp.py --dist /tmp/dist-anon --pdf .amostras-bancos/bb-cmbf.pdf
```

**Depois do deploy, uma terceira medição**, que é a única que prova que a
Vercel entrega os headers — até a borda dela aplicar, o `vercel.json` é uma
intenção. Nesse modo o script lê a CSP **da resposta do servidor**, não do
repositório (divergência entre as duas é justamente o que se quer descobrir),
e confere que `/.env`, `/.git/config` e `/scripts/*` não respondem 200:

```bash
python scripts/medir-csp.py --url https://capital-financeiro.vercel.app
```

**Números de referência** (se algum mudar sem motivo, algo regrediu). O
diagnóstico **soma o que a pasta tem**, sem filtrar competência — número de
referência sem o conjunto de arquivos ao lado não é reproduzível, e foi o que
gerou a dúvida das "Entradas" que durou de 05 a 09/08:

| Medida | Valor esperado | Conjunto |
|---|---|---|
| Gasto real total | **R$ 41.012,25** | os 4 PDFs de `D:/extratos/junho2026` |
| Entradas | **R$ 50.281,18** | idem |
| Vinculado (fora da conta) | **R$ 23.353,68** | idem |
| Supermercado | **R$ 918,46** (27 lançamentos) | idem |
| Fatura Nubank — total declarado | R$ 8.324,24 | idem |
| Fatura Bradesco — total declarado | R$ 5.529,44 | idem |
| Compromissos futuros | 34 parcelas · R$ 5.265,30 | idem |
| Gasto real / Entradas | R$ 40.955,46 / R$ 45.441,75 | **só os 3 PDFs de junho** |
| Extrato BB de amostra (`bb-cmbf.pdf`) | **94 lançamentos**, bate ao centavo | — |
| Testes | **567** (75 arquivos) | — |

Conta de teste no Neon: `teste.migracao@exemplo.com` (senha **não** versionada).
⚠️ **Essa conta nunca recebe e-mail** — `exemplo.com` é domínio reservado. Serve
para logar, nunca para testar e-mail. Para isso use uma conta com caixa real.
Existe também uma conta criada via Google (sem senha própria, então não serve
para testar redefinição), e uma conta criada com e-mail e senha justamente para
testar a recuperação.

---

## ✅ Pronto e verificado

**Ingestão e cálculo**
- 4 parsers (fatura + extrato × Nubank + Bradesco), cada um conferindo o total contra o gabarito do PDF.
- Categorização por regras (30 categorias) + **aprendizado ligado em 2026-07-29** (corrigir a categoria de uma compra ensina o app para as próximas importações, via `merchant_rules`); dedupe por hash de documento e de transação.
- Vínculos entre documentos removem a dupla contagem (fatura × extrato).
- **Competência**: Mês/Ano agrupam pela fatura (`documents.period_end`); Dia/Semana pela data real.

**Persistência (Neon)**
- Data API + Neon Auth + RLS. Schema em `neon/migrations/0001_schema_inicial.sql`.
- Salvar, puxar tudo, apagar documento (cascade) ou tudo, editar transação, categorias do usuário.

**Interface**
- Dashboard por Dia/Semana/Mês/Ano com tiles, donut por categoria, evolução mês a mês e compromissos futuros.
- Lançamentos por categoria (drill-down) e por dia (com subtotais).
- Filtro por banco (Total geral / Nubank / Bradesco).
- Editar compra e criar categorias personalizadas.
- Painel de Documentos (apagar fatura ou tudo).
- Login com nome + apelido, saudação, tutorial guiado.
- **Editar perfil** (2026-07-24): menu da conta → "Editar perfil" troca o apelido da
  saudação (local) e o nome completo (Neon Auth via `updateUser`), com prévia ao vivo.
  Componente `src/ui/EditarPerfil.tsx` (6 testes). Tutorial ganhou o passo "Do seu jeito".
- Tema claro/escuro, responsivo, toasts no topo-centro.
- "Baixar PDF" via `window.print()` + `@media print` — **veja a ressalva no item 3 da fila**.

**Entregue em 2026-07-18**
- **Validação do acesso** — o toast nomeia exatamente os campos vazios e o foco pula para o primeiro (`src/ui/auth-validacao.ts`, puro e testado). Corrigido também um `if (!neon) return` que ficava no topo de `submeter` e engolia a validação em silêncio.
- **Olho de revelar senha**, com teste que prova o `type="button"` (validado por mutação: removi o atributo, o teste falhou; restaurei, passou).
- **Fundo animado** de partículas em three.js (`src/ui/FundoAnimado.tsx` + `src/ui/fundo/particulas.ts`), na camada `#bg-animation` (`position: fixed`, `z-index: 0`).
- **Logotipo** `src/ui/Marca.tsx` — "Capital" em tinta, "Financeiro" em âmbar, com salto em onda no hover (hover no pai, atraso por letra).
- **Paleta âmbar** substituindo o verde neon; **toasts** com presença de diálogo; **campos do login** com raio de 12px, hover e foco âmbar; **assinatura do rodapé** maior e na cor da marca.
- **Card de compartilhamento** (Open Graph) + `public/og.png` 1200×630, gerado por `scripts/gerar-og.py` a partir de `scripts/og-card.html`.
- **Deploy completo na Vercel**, com login funcionando.

---

**Entregue em 2026-07-19 — recuperação de senha (código pronto, falta verificar no navegador)**
- Fluxo em dois passos dentro do card do acesso: pedir o link e definir a nova senha.
- `lib/recuperar-senha.ts` (HTTP puro), `lib/url-token.ts`, `ui/RecuperarSenha.tsx`,
  `validarNovaSenha` e `emailValido` em `ui/auth-validacao.ts`.
- Extraídos para não duplicar: `ui/IconeOlho.tsx` e `ui/estilos-campo.ts`.
- **211 → 275 testes.** Ver a seção de armadilhas para o que quase escapou.

---

## 🚧 Fila do que falta — em ordem

> **Estado em 2026-08-29:** a correção de integridade da migração `0003` foi aplicada
> em produção. O que permanece na fila são três frentes, duas dependentes de
> configuração/amostra e uma de validação manual:
>
> 1. **Fatia 1b (backend real)** — precisa da `DATABASE_URL` do Neon (role
>    `authenticated`, sem BYPASSRLS) no `.env.local` da raiz. Sem ela não há o
>    que testar contra o banco.
> 2. **Mais bancos** — parada desde 2026-07-23 por falta de amostra: a Caixa só
>    veio como imagem (o app lê texto), e o layout A do BB (2020) espera um PDF
>    nesse formato aparecer.
> 3. **Conferir logado, no navegador** — as telas das rodadas de agosto (as sete
>    páginas, os gráficos novos) foram exercidas por teste de componente e pelo
>    Chromium sem sessão. A senha da conta de teste não é versionada, então
>    quem valida contra dado real é o usuário.
>
> A fila histórica abaixo fica como registro do que foi decidido em cada item.

> **Atualização 2026-07-24 (fim da sessão):** o usuário concluiu e **testou** os itens
> **0** (recuperação de senha ponta a ponta), **1** (nome no e-mail — trocou o
> *Application Name* no Neon) e **5** (filtro por banco e categorias personalizadas
> conferidos logado). Itens **2** (PDF real + compartilhar) e **4** (saldo por conta)
> foram entregues nesta sessão, junto do **polimento de design** (erro coeso, foco por
> teclado, alvos de toque, donut sticky, ações no topo-direito). **Atualização
> 2026-07-29: o item 3 (i18n) foi CONCLUÍDO** — resta só "mais bancos" (bloqueada até
> vir amostra de PDF de texto). As migrações `0002` e `0003` já foram aplicadas e
> conferidas em produção.
> O envio por **e-mail** (antigo passo 3 do item 2) foi **descartado**.
> Spec/plano do design em `docs/superpowers/specs/2026-07-24-polimento-design-design.md`.

### 0. ~~Verificar a recuperação de senha no navegador~~ ✅ FEITO E TESTADO (2026-07-24)

⚠️ **Atualização 2026-07-23:** o login automático pós-reset foi **removido** (agora
sempre volta ao card de entrar com o e-mail preenchido). Isso muda o roteiro abaixo:
o passo 4 já não "entra direto", e o passo 7 (F1: reset com sessão de outra conta
ativa) precisa ser refeito contra o comportamento novo. O usuário verificou modais e
rolagem em 2026-07-23, mas **não** o fluxo de troca de senha real ponta a ponta.

O código está no ar e revisado; o fluxo de e-mail real ainda não foi exercido no navegador.

⚠️ **Este roteiro troca a senha de verdade** da conta de teste — não é
ambiente de teste. Anote a senha que usar.

Roteiro, em ordem (**1 e 2 já feitos em 2026-07-19**, o servidor sobe em
`http://localhost:5173/` e o medidor deu OK em 1280×800 e 390×844):

1. ~~`npm run dev`, `Ctrl+Shift+R` (nasceram arquivos novos).~~ ✅
2. ~~`python scripts/medir-overflow.py` — sem rolagem lateral.~~ ✅
3. "Esqueceu a senha?" → pedir link para a conta de teste.
4. Abrir o link **no mesmo navegador** → trocar a senha → deve entrar direto,
   e o `?token=` deve sumir da barra de endereços.
5. Limpar `localStorage.removeItem('cf:email-reset')` antes de abrir outro link
   → a senha troca e o card volta ao login com aviso.
6. Reabrir um link já usado → "Este link expirou ou já foi usado." + botão de
   pedir outro.
7. **O caso que mais importa:** estando logado, abrir um link de redefinição e
   concluir. Tem que aparecer o card de login, não o dashboard. Foi um bug real
   (F1 do review final) e é onde um possível piscar do card apareceria.

Aproveite a sessão logada para conferir o **item 5** desta fila (filtro por banco
e categorias personalizadas, que nunca foram validados contra o banco).

### 1. ~~Nome errado no e-mail de redefinição~~ ✅ FEITO (2026-07-24 — Application Name trocado no Neon)

O e-mail sai como **"controle-financeiro"**, não "Capital Financeiro". Não é código.

**Onde corrigir (confirmado no painel em 2026-07-24):** *Neon → Auth → Configuration
→ Project Info → **Application Name***. O campo diz explicitamente *"This name appears
in verification emails and auth communications."* Trocar para **"Capital Financeiro"**
e salvar. **Não** é o "Sender address" (`auth@mail.myneon.app`, compartilhado) nem o
nome do projeto Neon/Vercel — é um texto de exibição, seguro de mudar (não toca URL de
Auth, JWKS ou domínio). Passo manual do usuário; nada a fazer no repositório.

Vale prioridade porque **é o único e-mail que pedimos ao usuário para confiar**,
e chegar sob um nome que ele não reconhece tem forma de phishing.

### 2. Relatório: PDF de verdade → compartilhar — ✅ CONCLUÍDO (2026-07-24)

Spec/plano em `docs/superpowers/specs|plans/2026-07-24-relatorio-pdf-compartilhar*`.

- **PDF real**: `src/lib/relatorio-pdf.ts` gera um Blob com **jsPDF + jspdf-autotable**
  (cabeçalho, totais, saldo por conta, tabela por categoria), a partir de
  `montarDadosRelatorio` (pura, testada). jsPDF entra por **import dinâmico** — fica em
  chunk próprio, fora do bundle inicial.
- **Compartilhar/baixar**: `src/lib/compartilhar.ts` — `navigator.share` com o arquivo no
  celular; download no desktop; cancelar a folha não é erro.
- O botão virou **"Baixar / Compartilhar PDF"** e o `window.print()` saiu de cena.
  (O CSS `@media print` e o bloco `somente-impressao` ficaram órfãos — limpeza trivial
  quando/se incomodar.)

**E-mail: descartado do roadmap (decisão do usuário, 2026-07-24).** Era o passo 3
(botão de enviar por e-mail via serverless + Resend). Não será feito.

### 3. i18n pt/en/es — ✅ COMPLETO (fatia final 2026-07-29)

**Fatia final (2026-07-29):** modais (EditarPerfil, EditarCompra, Documentos,
Confirmacao) e Tutorial 100% por `t()`; `Documentos` formata período/data pela
locale ativa (`mesAbrev`/`dataLongaDe`, fim do array `MESES` fixo) e as contagens
ganharam singular (`docs.contDoc1`/`docs.contLanc1`); destaque de números do
"apagar tudo" preservado por `realcarNumeros` (independe do idioma). Teste de
modal em en: `src/ui/Tutorial.i18n.test.tsx`. **Todas as superfícies + toasts
traduzidos; en/es seguem aguardando revisão do usuário nativo.**

Botão de idioma trocando **todo** o texto do sistema, **feito por fatias**.
Spec/plano em `docs/superpowers/specs|plans/2026-07-24-i18n-mecanismo-e-login*`.

**Entregue (fatia 1 — mecanismo + tela de acesso):**
- `src/i18n/idioma.ts` (detecção + storage `cf:idioma`), dicionários `pt/en/es`
  (pt = fonte da verdade; en/es tipados, chave faltando quebra o build),
  `IdiomaProvider` + `useT` (**default pt** → componentes funcionam sem provider, os
  testes atuais não precisaram de wrapper), `SeletorIdioma` (PT/EN/ES) no cabeçalho.
- Tela de acesso 100% traduzida (Auth, RecuperarSenha, CampoSenha, CarrosselBancos,
  TelaAcesso, Rodape). **en/es são minhas traduções — o usuário nativo revisa.**

**Deferido dentro da fatia:** a mensagem composta de "campos faltando"
(`mensagemCamposFaltando`) e os erros vindos de `lib/recuperar-senha`/`validarNovaSenha`
ficam em pt por ora (gramática de lista por idioma) — `auth-validacao.ts` intacto.

**Entregue (fatia 2 — dashboard, 2026-07-24):**
- **Moeda por locale**: `domain/normalize/locale.ts` (var de módulo + setter) →
  `formatBRL` usa a locale ativa (BRL sempre, só formata, **não converte**).
- **Datas por locale**: `domain/normalize/data.ts` (`mesAbrev`/`dataLonga` via `Intl`) —
  Dashboard, SaldoConta, CompromissosFuturos e o PDF.
- **Nomes das 30 categorias** traduzidos (`nomeCategoria` + mapa en/es em `categorias.ts`);
  categoria do usuário nunca traduz. Aplicado no donut, listas e PDF.
- **Chrome do dashboard + saudação do header + menu da conta** traduzidos (~45 chaves).
- `IdiomaProvider` aplica os setters de locale/categoria durante o render.

**Próximas fatias (em ordem sugerida):**
1. **Modais**: EditarCompra (inclui a grade de categorias), Documentos, EditarPerfil,
   Confirmação; e o **Tutorial**.
2. Toasts/erros ainda em pt (o deferido da fatia 1: campos-faltando e erros da lib de
   recuperação), quando valer o esforço da gramática de lista por idioma.

### 4. Saldo bancário por conta — ✅ CONCLUÍDO (migração conferida em produção 2026-07-29)

Implementado nesta rodada (spec/plano em `docs/superpowers/specs|plans/2026-07-24-saldo-bancario*`):
- Os **5 parsers de extrato** expõem `ParseResult.balance.final` (Nubank e Bradesco
  ganharam nesta rodada; BB/Sicredi/Sicoob já tinham). Cada um conferido contra a amostra.
- `persist/saldos.ts` — `saldosPorConta` deriva o saldo atual por conta (extrato de
  maior `period_end`), puro e testado.
- `salvar.ts` grava `documents.end_balance_cents`; `puxarSaldos()` lê. **Defensivo**:
  antes da migração, o insert refaz sem a coluna e a leitura volta `[]` — importar e o
  painel nunca quebram; a fileira de saldo só não aparece.
- `ui/SaldoConta.tsx` + fileira no Dashboard acima do filtro de banco.

✅ **Migração aplicada e conferida em produção (2026-07-29):**
`documents.end_balance_cents` existe e `accounts_bank_check` aceita
nubank/bradesco/bb/sicredi/sicoob/desconhecido (verificado via
`pg_get_constraintdef` no SQL Editor do Neon). Saldo por conta ativo.

### 5. ~~Verificações que nunca foram feitas contra o banco~~ ✅ FEITO E TESTADO (2026-07-24)

Duas features foram implementadas numa sessão em que a rede **perdeu o DNS do Neon**, e
ficaram validadas só por typecheck:
- **Filtro por banco** (Total geral / Nubank / Bradesco)
- **Categorias personalizadas** (criar categoria no editor de compra)

Ao retomar: logar (local ou produção) e conferir as duas na prática. O DNS voltou a
resolver em 2026-07-18.

---

## ⚠️ Notas de armadilha — mudaram para o `CLAUDE.md`

As ~35 armadilhas de ferramenta e ambiente que viviam aqui (o `vi.stubEnv` que não
alcança `import.meta.env`, o hash de CSP em CRLF, o canvas em HiDPI, a Deployment
Protection da Vercel) foram para [`CLAUDE.md`](../CLAUDE.md) em 2026-08-17, **sem
perda de conteúdo**.

O motivo: elas mordem *toda* sessão de trabalho neste repositório, e num arquivo que
o agente carrega sozinho elas chegam **antes** do erro. Aqui dependiam de alguém
rolar 1.500 linhas de diário até encontrá-las — que é exatamente como elas foram
redescobertas na marra, mais de uma vez.

---

## O que quase escapou na recuperação de senha (2026-07-19)

Vale ler antes de escrever o próximo plano. **Os dois bugs mais graves da rodada
vieram do código de exemplo do próprio plano**, transcrito fielmente pelos
implementadores. Plano detalhado não substitui review.

1. **`salvarSenha` sem `try/catch`.** Se o `signIn.email` *lançasse* em vez de
   devolver `error`, o usuário ficava com a senha já trocada, o token já apagado
   e o botão travado em `…` — sem toast, sem saída. O `Auth.tsx` já tratava a
   mesma chamada como lançável; o exemplo não.
2. **`tokenReset` era `const` sem setter**, então `precisaLogin` ficava `true`
   para sempre: quem redefinia a senha continuava vendo o formulário de nova
   senha, com o cabeçalho já dizendo que estava logado. **Nenhum teste pegava.**

Mais dois, achados só no review final, que **nenhum review por tarefa poderia
ver** porque só emergem com as peças montadas:

3. Com **sessão ativa**, um reset concluído sem login automático mostrava o
   dashboard enquanto o toast dizia "Entre com a senha nova".
4. O e-mail guardado em `cf:email-reset` era **entrada de uma chamada de
   autenticação sem verificação**. Duas contas da casa com a mesma senha → o
   auto-login entrava na conta errada, e a saudação usa o apelido local, então
   nem o cabeçalho denunciava. Hoje o registro tem carimbo de tempo e vale 1h,
   o mesmo tempo de vida do token.

E duas lições sobre testes:
- **Teste que passa dos dois jeitos é pior que nenhum.** O teste do olho de
  revelar clicava com os campos vazios: passaria igual se o botão fosse
  `type="submit"`. Encher os campos primeiro foi o que o tornou real.
- **Asserção positiva não guarda promessa negativa.** O teste "não afirma que o
  e-mail existe" só conferia a presença da frase condicional — enquanto a tela
  dizia "Enviamos um link" logo acima. O bug e o teste conviviam.

---

## Decisões de design já tomadas (não reabrir sem motivo)

> Só decisões **visuais** ficam aqui: são baratas de reverter e não valem um ADR.
> As nove decisões duras — competência, vínculo, PDF no cliente, Neon, escopo
> retrospectivo, parser por banco, code-splitting, SDK do Neon e o descarte do
> shadcn/ui — foram para [`docs/adr/`](./adr/) em 2026-08-17.

- **`--color-marca` (âmbar) é separada de `--color-confere`.** A marca é identidade
  (logotipo, favicon, moeda, foco); o "confere" carrega **semântica** de "o total bate".
  Âmbar já era a cor de `--color-ressalva`: unificar faria o toast de sucesso parecer aviso.
- **O "confere" continua verde**, porém oliva dessaturado (`#6b8f4e`). Verde=certo /
  vermelho=errado é leitura aprendida; trocar prejudicaria a compreensão.
- **Cada tema tem seus próprios tons.** Âmbar claro não tem contraste sobre creme, então o
  tema claro usa versões escurecidas de marca, confere, ressalva e falha.
- **Partículas leem `--color-particula` e `--particula-alfa`**, variáveis próprias por tema,
  com **blending normal** nos dois — aditivo só clareia e apagaria cor escura.
- **O tutorial diz "Bem-vindo(a) ao seu controle financeiro"** — frase comum, não marca.
  Fica em português mesmo depois do rename.

---

## Melhorias futuras mapeadas (não urgentes)

**Adiados de propósito no review final da recuperação de senha (2026-07-19).**
Todos avaliados, nenhum bloqueia:
- ~~`limparTokenDaUrl` não tem teste direto~~ ✅ **resolvido**: `lib/url-token.test.ts`
  tem o `describe` próprio dele (conferido em 13/08).
- ~~**`CampoSenha` ficou duplicado**~~ ✅ **resolvido (2026-07-24)**: extraído para
  `src/ui/CampoSenha.tsx` e usado em `Auth.tsx` e `RecuperarSenha.tsx`.
- ~~**Mesma frase, severidade diferente**: senha curta é `toast.warning` no login e
  `toast.error` na recuperação~~ ✅ **resolvido (2026-08-13)**: `error` nos dois.
- ~~**`tsconfig.app.json` e `tsconfig.test.json` são quase-duplicatas**~~ ✅
  **resolvido (2026-07-24)**: criado `tsconfig.base.json` com as 15 chaves comuns;
  os dois o estendem e só sobrescrevem `tsBuildInfoFile`, `types` e `include/exclude`.
- **Classificação de erro do `/reset-password`**: hoje *qualquer* 400 vira "token
  expirado". Mapear os códigos do Better Auth exigiria sondar a taxonomia de erros
  dele, que nunca foi levantada. O único gatilho realista (senha > 128 caracteres)
  já está barrado por `maxLength` no campo.

- Refinar as policies de RLS para `auth.uid()`.
- Chaves próprias do Google OAuth (hoje usa as compartilhadas do Neon; só então será
  necessário mexer nos redirect URIs do Google Cloud Console).
- ~~Code-splitting do bundle~~ ❌ **MEDIDO E RECUSADO (2026-08-13)**: fatiar as rotas
  rende **2,6%** de gzip e cria uma falha de navegação depois de cada deploy. O peso é do
  SDK do Neon (**39%** da primeira pintura, medido com build A/B), que precisa carregar no
  boot e importa `zod` estaticamente. Detalhes e a tabela na rodada de 13/08, item 7.
  **Não reabrir sem número novo.**
- Proteger **só os deploys de preview** na Vercel, mantendo a produção aberta.
- Promover `@testing-library/jest-dom/vitest` para `setupFiles` global — a condição que o
  item esperava ("quando houver um segundo teste de componente") aconteceu faz tempo:
  são **35** arquivos repetindo o import (conferido em 13/08).
- ~~`mensagemCamposFaltando([])` com lista vazia gera texto com espaço duplo~~ ✅ **sem
  objeto**: a função não existe mais (conferido em 13/08).

---

## Onde ficam os specs e planos

`docs/superpowers/specs/` e `docs/superpowers/plans/` — cada rodada tem o seu par:
2026-07-18 (ajustes do formulário de acesso; fundo animado + rename + card OG) e
2026-07-19 (`*-recuperacao-de-senha*`). O plano da recuperação guarda, na Task 0, o
formato real do link confirmado contra o servidor.

O ledger de execução fica em `.superpowers/sdd/progress.md` (git-ignored) — é ele que
registra, por tarefa, o que cada review achou e o que foi adiado de propósito.
