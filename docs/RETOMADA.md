# Retomada — Capital Financeiro

Roteiro para quem pega o projeto sem o contexto das conversas anteriores (outro
agente, outro editor, ou o dono daqui a semanas). Atualizado em **03/11/2026**.
O histórico completo, com o porquê de cada decisão, está em
[`ESTADO-ATUAL.md`](./ESTADO-ATUAL.md); as regras de código, em
[`../AGENTS.md`](../AGENTS.md); os nomes do domínio, em
[`../CONTEXT.md`](../CONTEXT.md).

## Ordem de leitura

1. Este arquivo.
2. `AGENTS.md` (mapa, padrões, verificação, armadilhas) e `CONTEXT.md`.
3. O topo de `docs/ESTADO-ATUAL.md` (as últimas rodadas).
4. `docs/validacoes/2026-10-30-auditoria-somas-e-melhorias.md` (o roteiro de
   produto; quase tudo já foi entregue).

## Regras de trabalho do dono (valem sempre)

- **Responder em português do Brasil**, inclusive resumos e mensagens curtas.
- **Trabalho vai para BRANCH.** Push na `main` publica em produção (Vercel, ~1
  min, sem homologação). Branch nova sai do PR de que depende, ou da `main`.
- **Não commitar, dar push, mesclar nem aplicar migração no Neon sem pedido
  explícito do dono na conversa em andamento.** "Mesclar com CI verde" é conferir
  `gh pr checks` e mesclar à mão: `gh pr merge --auto` mescla na hora aqui, porque
  não há verificação obrigatória no repositório.
- PR único: merge commit `Merge #NN: <título>` e `--delete-branch`. PR empilhado:
  antes de mesclar a base, `gh pr edit <de cima> --base main`, senão o GitHub fecha
  o de cima.
- Mensagem de commit e corpo de PR vão por arquivo (`git commit -F`,
  `gh pr create --body-file`).
- Arquivos em **CRLF**: não troque o fim de linha. Edite em Python com
  `newline=''` (na leitura também) e confira `git ls-files --eol -m`. O `sed -i`
  do Git Bash regrava tudo em LF.
- Teste de domínio PRIMEIRO, reproduzindo o caso; depois mutação para provar que o
  teste pega o defeito.

## Estado em 03/11/2026

- `main` com tudo até o **#70** (`d60d03c`).
- **Neon (produção, branch `production`):** migrações 0001–**0014** aplicadas. A
  0014 (PIX/boleto que cita o emissor do cartão quita a fatura) foi aplicada em
  03/11, em transação única, com 6 → 10 quitações. O branch de teste
  `teste-0014-vinculo-pix-emissor` segue no Neon até o dono mandar apagar.
- Entregue nesta rodada: #63 "Sem atípicos" nos Relatórios (só no donut) · #64
  Mercado Pago: o pagamento da fatura anterior vem positivo no bloco
  "Movimentações na fatura" · #65 meses recolhíveis em Faturas · #66 calendário
  prevê o valor reajustado · #67 extrato do Bradesco sem "Movimentação entre" ·
  #68 janela dos relatórios por documento + saldo do Bradesco sem "COD. LANC. 0" ·
  #69 migração 0014.
- **A "linha suspeita"** (a conferência que diverge aponta a linha que explica a
  diferença) e a correção de contraste dos selos de banco entraram no #70.

## Pendente do dono (perguntar, não presumir)

- Reimportar o extrato do Bradesco de outubro (o salvo não tem saldo) e conferir
  que a fatura do Mercado Pago de setembro dá "Confere".
- Conferir que setembro e outubro perderam os R$ 1.688,55 contados em dobro.
- Abrir os Relatórios em produção e ver se o "Sobrou"/"Faltou" do fluxo do período
  bate com o card de Resultado. Testar o login REAL (o `medir:login` usa Auth de
  mentira).
- Decidir o detalhe de categoria com "Sem atípicos" ligado: hoje ele lista a
  compra atípica, e o total fica maior que a fatia do donut.

## Fila de trabalho, em ordem

1. **Gráfico do fluxo do período** (`ui/graficos/GraficoFluxoPeriodo.tsx`): o dono
   disse "passo o mouse e não aparece nada". Plano: uma linha de leitura fixa
   acima do gráfico (nome, valor, percentual do item sob o mouse ou o foco); faixa
   destacada bem mais visível; as barras laterais (`rect`) com os mesmos
   handlers; toque na faixa fixa o destaque no celular. As listas continuam sendo
   o equivalente acessível.
2. Conferir a variação do Painel contra mês anterior incompleto.
3. Categoria com total negativo no donut e nas barras (o fluxo já trata como
   "Estornos").
4. O alerta "valor mudou" acusa a SOMA quando o último mês tem duas cobranças
   (salário + férias). O calendário já se protege (#66); o alerta não.
5. Fixture da fatura do Mercado Pago com pagamento anterior (o #64 testou com
   linhas montadas à mão, porque o gerador regera todos os fixtures).
6. Do relatório de melhorias de 03/11 (o dono escolhe): Trusted Types na CSP,
   "Baixar meus dados" (LGPD art. 18), assinatura anual na recorrência, medir o
   contraste não-texto (3:1) e o daltonismo das cores dos gráficos.

## Rotina de verificação

- `npm run verificar` (da RAIZ, ~6 a 10 min, em segundo plano) antes de dizer
  "pronto". `npm test` sozinho NÃO checa tipos.
- Mexeu em layout ou marcação: dev server + `medir-overflow.py` e `medir:a11y` em
  1280 e 375px (o CI não roda esses dois); rode um depois do outro, não junto com
  o `verificar` (disputam CPU). Use a folha de provas `/demo.html`.
- Mexeu no nome de um botão: `grep` em `scripts/` e `npm run build:login &&
  npm run medir:login`. Mexeu em cor ou em `domain/banks.ts`: `python
  scripts/medir-contraste.py`.
- Defeito de leitura de PDF: `npx tsx scripts/_prova-mp.ts <pdfs>` (pipeline real
  e conferência) e `scripts/_dump-mp.ts` (as linhas). São locais, ignorados pelo
  git. Os PDFs reais ficam fora do repositório.
- `node_modules` segue o lockfile da branch: ao trocar de branch, `npm install` da
  raiz. NÃO use `npm ci` (trava em EPERM com dev server aberto).
- O Bash desta máquina não alcança o GitHub: `git push` e `gh` pelo PowerShell.

## Lições desta rodada

- **O PDF do mesmo banco muda de um mês para o outro.** O Bradesco de outubro veio
  sem "Movimentação entre" e sem "COD. LANC. 0"; o Mercado Pago ganhou o bloco
  "Movimentações na fatura". Parser que depende de UMA frase do cabeçalho precisa
  de plano B pelos dados do próprio documento.
- **"Confere" não prova que o documento entrou completo.** O extrato do Bradesco
  foi salvo sem período e sem saldo, com a conferência fechando.
- **Migração de regra do banco:** `create or replace` com o corpo INTEIRO da
  versão anterior; ensaio em branch descartável do Neon; aplicar na produção em
  UMA transação, com autorização explícita; contar antes e depois.
- Mutação que sobrevive costuma ser defeito do TESTE (caso sem candidata, linha de
  R$ 0,00), não do código.
