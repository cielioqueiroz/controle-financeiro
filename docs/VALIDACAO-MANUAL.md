# Validação manual — o que nenhum medidor alcança

Este roteiro cobre o Neon real e a entrega de e-mail. A suíte mocka o SDK e
`medir:login` usa o SDK real contra um servidor de mentira; eles provam a parte
do app, mas não o serviço real (ver ADR-0008 e ADR-0014). Estas etapas dependem
de uma conta real e, quando indicado, de uma caixa de entrada acessível.

O que **não** está aqui: rolagem lateral, contraste, CSP e as peças que só
aparecem depois de um clique. Esses viraram medidor
(`scripts/medir-overflow.py --jornadas`, `medir-contraste.py`, `medir-csp.py`) e
não devem voltar para esta lista — lista manual que cresce é lista que ninguém
roda.

**Onde rodar:** produção (https://capital-financeiro.vercel.app). O `npm run dev`
serve para o resto; aqui o que se testa é justamente o que só existe no ar —
domínio autorizado no Neon Auth, remetente do e-mail, CSP da Vercel.
Exceção: §5 começa num frontend local ligado à branch Neon de teste. Executar
cadastro, recuperação e OAuth requer uma conta de teste autorizada; o roteiro
documentado não significa que essas ações foram executadas nesta rodada.

---

## Quando rodar

| Situação | Rode |
|---|---|
| Mexeu em `@neondatabase/neon-js`, `lib/neon.ts` ou qualquer coisa de sessão | **Tudo** |
| Mexeu no fluxo de senha (`Auth`, `RecuperarSenha`, `lib/recuperar-senha`) | §2 e §3 |
| Mexeu em `lib/confirmar-email`, `AvisoConfirmarEmail` ou cadastro | §2 |
| Trocou as credenciais do Google | §1 e [roteiro de OAuth](./SETUP-GOOGLE-OAUTH.md) |
| Trocou de projeto no Neon, ou mexeu no `connect-src` da CSP | §1 |
| Deploy comum, sem tocar em autenticação | Nada |
| Antes de publicar o frontend com as novas migrações 0009–0011 | §5 e §6 |

---

## §1 — Entrar (o caminho de todo dia)

1. Abrir o site numa **janela anônima**. A tela de acesso aparece; o console não
   tem erro de CSP.
2. Entrar com e-mail e senha da conta de teste. Cai no Painel com dados.
3. Recarregar com `F5`. **Continua logado** — a sessão sobrevive ao reload.
4. Sair pelo menu da conta. Volta à tela de acesso, e o `F5` não ressuscita a
   sessão.
5. **Continuar com o Google.** Entra sem passar pela senha.
   ⚠️ Se der `403 {"code":"INVALID_CALLBACKURL"}`, o domínio não está autorizado:
   *Neon → Auth → Configuration → Domains*.
   Credenciais próprias, retorno do provedor e identidade visual têm roteiro
   separado em [SETUP-GOOGLE-OAUTH.md](./SETUP-GOOGLE-OAUTH.md).

## §2 — Criar conta e receber o e-mail

Só o e-mail real prova esta parte — o remetente é da Neon, compartilhado.

1. "Não tem conta? Criar uma", com um endereço que você consiga abrir.
2. **O e-mail chega**, e o remetente diz **"Capital Financeiro"** — não
   "controle-financeiro". (Se disser, o campo é *Neon → Auth → Configuration →
   Project Info → Application Name*.) É o único e-mail que pedimos ao usuário
   para confiar; chegar sob nome que ele não reconhece tem forma de phishing.
3. O cadastro pede explicitamente um **código de seis dígitos**. Pedido aceito
   não prova entrega: conferir a caixa de entrada e o spam.
4. No app, abrir **Confirmar agora**, digitar o código recebido e confirmar.
   Abrir o campo não deve pedir outro código. A faixa de confirmação some após
   a releitura da sessão e continua ausente depois de `F5`.
5. Em outra conta de teste ainda não confirmada, testar um código incorreto:
   a mensagem orienta conferir o número ou pedir outro, e o campo permanece
   aberto. **Reenviar código** permite concluir com o novo código recebido.
   Não provocar repetidamente o limite de envio do serviço real.

O fluxo implementado está em `lib/confirmar-email.ts` e
`ui/acesso/AvisoConfirmarEmail.tsx`: envio por
`/email-otp/send-verification-otp` e confirmação por `/email-otp/verify-email`.
Um link de redefinição de senha (§3) pertence a outro fluxo.

## §3 — Trocar a senha

⚠️ **Este roteiro troca a senha de verdade.** Não há ambiente de teste. Anote a
senha que usar.

1. "Esqueceu a senha?" → pedir o link para a conta de teste.
2. Abrir o link **no mesmo navegador** → definir a senha nova. Volta ao card de
   entrar com o e-mail preenchido (**não** entra sozinho — o login automático foi
   removido em 2026-07-23), e o `?token=` some da barra de endereços.
3. Entrar com a senha nova.
4. Reabrir o link já usado: *"Este link expirou ou já foi usado."* mais o botão
   de pedir outro.
5. **O caso que mais importa** (foi bug real, F1 do review de 2026-07-19):
   **estando logado**, abrir um link de redefinição e concluir. Tem que aparecer
   o card de login — não o dashboard, nem um piscar dele.

## §4 — Dado real, uma vez por safra de parser

1. Importar um PDF de verdade de cada banco que você usa.
2. A prévia mostra **`confere`**. Se disser `diverge`, o parser regrediu — é para
   isso que a conferência existe.
3. Importar a **fatura e o extrato do mesmo mês**. O gasto real desconta a
   quitação; o número da dupla contagem aparece.
4. Conferir o gasto real de junho contra a referência de `ESTADO-ATUAL.md`
   (**R$ 41.012,25** sobre os 4 PDFs de `D:/extratos/junho2026`). Mudou sem
   motivo? Regrediu.

## §5 — Gravação pela Data API real (migração 0008)

**Aprovado em 17/10/2026 na branch de teste**, com SDK instalado, Auth/JWT reais,
PDF sintético e interface real. Incluiu concorrência, rollback, isolamento entre
usuários e resposta perdida após commit com recuperação sem F5. Evidências e
validador reproduzível em [validação da RPC real](./validacoes/2026-10-17-rpc-real.md).
O roteiro abaixo serve para repetir o ensaio. A migração foi aplicada e seus
privilégios conferidos em produção em 17/10/2026, após autorização no chat;
os ensaios de escrita continuaram restritos à branch de teste.

1. Usar o frontend desta branch localmente, com Auth e Data API da branch Neon
   `codex-integridade-20261016` (expira em 23/10/2026), e entrar numa conta de teste.
   Conferir os hosts antes de importar. Não usar a produção para este ensaio.
2. Importar um PDF sintético reconhecido ou um PDF do titular da conta. A prévia
   deve conferir; salvar deve mostrar sucesso. Na aba Rede, confirmar uma única
   chamada `rpc/salvar_documento_atomico` e resposta `status: salvo`.
3. O Painel atualiza sem F5. Em documentos, conferir que o detalhe guarda a
   conferência original com as mesmas comparações e contagem da prévia.
4. Repetir o mesmo PDF: aviso de duplicata, sem nova transação. Recarregar a
   página e confirmar os mesmos números.
5. Em uma conta diferente, o documento importado não aparece. Registrar resultado
   HTTP, data e branch em `ESTADO-ATUAL.md`, sem copiar tokens ou conteúdo pessoal.

Em instalações novas, aplicar e conferir `0008` antes de publicar o frontend.
Esta prova histórica não inclui as migrações 0009–0011; o novo ensaio real do
§6 foi concluído em 20/10/2026 antes de ativar o frontend atualizado.
Ausência da RPC deve produzir o aviso de atualização necessária; nunca deve
acionar a antiga escrita em várias chamadas.

## §6 — Vínculos, regras e novos parsers (migrações 0009–0011)

**Data API aprovada em 20/10/2026 na branch de teste**, com Auth/JWT reais:
vínculos nas duas ordens, ambiguidades, correção manual, exclusão, regras e
rollback, fixtures Caixa/BB, interface e RLS. A prova encontrou e corrigiu a
concessão padrão de EXECUTE do Neon ao helper interno.
[Resultados, limites e validador reproduzível](./validacoes/2026-10-20-vinculos-regras-neon.md).
A conferência visual dos PDFs originais e a revisão nativa de idiomas seguem
manuais; o ensaio usa dados sintéticos e fixtures anonimizados.

Executar somente numa branch Neon descartável e com conta de teste. Aplicar
`0009_vinculos_historico.sql`, `0010_regras_consulta.sql` e
`0011-caixa.sql` nessa ordem, revisar o SQL da rodada e confirmar que a sessão
usa a branch certa antes de importar. A aprovação local de PostgreSQL não prova
por si só a Data API/JWT do Neon.

1. Importar uma fatura de cartão e o extrato com o pagamento, primeiro fatura e
   depois extrato; abrir **Faturas → Conferir vínculos** e conferir os dois
   documentos, valor, data, critério e ação para abrir cada um. Repetir em ordem
   inversa com outro período. Não pode haver par quando a correspondência for
   ambígua.
2. Importar as duas pontas de uma transferência entre contas do titular. Conferir
   a evidência recíproca. Corrigir manualmente a natureza de uma ponta, reimportar
   um documento e conferir que a correção prevalece; excluir a contraparte e
   conferir que a ponta restante volta a contar como gasto/entrada.
3. Criar regras como `banco:caixa >100`, `cat:farmacia posto` e
   `sem:categoria <500`. Conferir que elas valem apenas para novos documentos,
   que condição vazia ou contraditória é recusada e que as regras podem ser
   removidas. As transações históricas não devem mudar.
4. Importar amostras autorizadas da Caixa GovConta e do BB layout A; conferir
   manualmente saldo inicial/final, quantidade, valores e direção. Não testar
   uma compilação de bancos como se fosse um documento único.
5. Repetir as jornadas em pt/en/es e no modo discreto. Registrar branch, data,
   resultado, IDs dos documentos de teste e migrações aplicadas, sem anexar
   extratos, tokens ou dados de conta ao repositório.

---

**Deu tudo certo?** Anote a data na rodada corrente do
[`ESTADO-ATUAL.md`](./ESTADO-ATUAL.md). Roteiro rodado e não registrado vira
roteiro rodado de novo.

A preparação de 18/10/2026 e as dependências externas ainda abertas estão em
[recursos externos](./validacoes/2026-10-18-recursos-externos.md).
