# Validação manual — o que nenhum medidor alcança

Este roteiro existe porque **a suíte mocka o SDK do Neon inteiro**
([ADR-0008](./adr/0008-o-login-nao-tem-rede-de-testes.md)): autenticação não tem
teste, e entrega de e-mail não tem como ter. Tudo o que está aqui depende de uma
conta real e de uma caixa de entrada real — por isso é do usuário, não do agente.

O que **não** está aqui: rolagem lateral, contraste, CSP e as peças que só
aparecem depois de um clique. Esses viraram medidor
(`scripts/medir-overflow.py --jornadas`, `medir-contraste.py`, `medir-csp.py`) e
não devem voltar para esta lista — lista manual que cresce é lista que ninguém
roda.

**Onde rodar:** produção (https://capital-financeiro.vercel.app). O `npm run dev`
serve para o resto; aqui o que se testa é justamente o que só existe no ar —
domínio autorizado no Neon Auth, remetente do e-mail, CSP da Vercel.

---

## Quando rodar

| Situação | Rode |
|---|---|
| Mexeu em `@neondatabase/neon-js`, `lib/neon.ts` ou qualquer coisa de sessão | **Tudo** |
| Mexeu no fluxo de senha (`Auth`, `RecuperarSenha`, `lib/recuperar-senha`) | §2 e §3 |
| Trocou de projeto no Neon, ou mexeu no `connect-src` da CSP | §1 |
| Deploy comum, sem tocar em autenticação | Nada |

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

---

**Deu tudo certo?** Anote a data na rodada corrente do
[`ESTADO-ATUAL.md`](./ESTADO-ATUAL.md). Roteiro rodado e não registrado vira
roteiro rodado de novo.
