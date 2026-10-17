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
Exceção: §5 começa num frontend local ligado à branch Neon de teste.

---

## Quando rodar

| Situação | Rode |
|---|---|
| Mexeu em `@neondatabase/neon-js`, `lib/neon.ts` ou qualquer coisa de sessão | **Tudo** |
| Mexeu no fluxo de senha (`Auth`, `RecuperarSenha`, `lib/recuperar-senha`) | §2 e §3 |
| Trocou de projeto no Neon, ou mexeu no `connect-src` da CSP | §1 |
| Deploy comum, sem tocar em autenticação | Nada |
| Antes de publicar o frontend com a RPC da migração `0008` | §5 |

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

## §2 — Criar conta e receber o e-mail

Só o e-mail real prova esta parte — o remetente é da Neon, compartilhado.

1. "Não tem conta? Criar uma", com um endereço que você consiga abrir.
2. **O e-mail chega**, e o remetente diz **"Capital Financeiro"** — não
   "controle-financeiro". (Se disser, o campo é *Neon → Auth → Configuration →
   Project Info → Application Name*.) É o único e-mail que pedimos ao usuário
   para confiar; chegar sob nome que ele não reconhece tem forma de phishing.
3. Confirmar pelo link. A faixa de "confirme seu e-mail" some.

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
O roteiro abaixo serve para repetir o ensaio; não indica aplicação em produção.

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

Depois da aprovação para produção: aplicar e conferir a migração `0008` antes
de publicar o frontend. Ausência da RPC deve produzir o aviso de atualização
necessária; nunca deve acionar a antiga escrita em várias chamadas.

---

**Deu tudo certo?** Anote a data na rodada corrente do
[`ESTADO-ATUAL.md`](./ESTADO-ATUAL.md). Roteiro rodado e não registrado vira
roteiro rodado de novo.
