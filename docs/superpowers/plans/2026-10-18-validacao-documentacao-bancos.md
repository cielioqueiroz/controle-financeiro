# Validação real, bancos, traduções e documentação

> Execução autorizada no chat; dependências externas são registradas sem simular conclusão.

**Goal:** atualizar a fila e preparar as frentes dependentes de recursos reais.
**Architecture:** inventário e documentação rastreáveis; nenhuma alteração de Auth
ou gravação em produção. **Tech Stack:** Markdown e ferramentas locais existentes.
**Spec:** `docs/superpowers/specs/2026-10-18-pendencias-design.md`.

### Task 1: corrigir a documentação

- [x] Atualizar README: backend descartado, SDK já atualizado, confirmação por
  código; separar implementação de validação real.
- [x] Corrigir roteiro manual de confirmação por link para o fluxo implementado.
- [x] Criar checklist de OAuth próprio sem inventar redirect URI ou credenciais.

### Task 2: bancos e revisão de idioma

- [x] Inventariar nomes de amostras existentes no workspace e pastas já citadas,
  sem publicar dados pessoais. Documentar requisitos para Caixa/BB antigo.
- [x] Conferir cobertura e consistência técnica pt/en/es nas novas superfícies.
- [x] Registrar revisão nativa e ensaios de e-mail/Google como dependências
  humanas enquanto não houver conta/caixa de entrada autorizada e acessível.

**Achado que mudou o escopo:** as amostras Caixa e BB A já existiam e tinham
texto. A análise por página comprovou GovConta com transações e BB A; a
implementação e as provas estão no [plano dos parsers](./2026-10-18-parsers-caixa-bb-antigo.md).
O [registro de recursos externos](../../validacoes/2026-10-18-recursos-externos.md)
guarda as métricas sem conteúdo pessoal. Cobertura técnica de tradução:
25 chaves `regrasOp.`/`vinculos.` com placeholders consistentes na varredura;
a verificação final de tipos acompanha a integração.

### Task 3: provas e continuidade

- [x] Rodar medidor de login com Auth sintético; distinguir claramente do
  Neon real.
- [x] Registrar o que foi implementado, comprovado e ainda depende de recurso
  externo; atualizar estado atual sem apagar a história.

Em 20/10, `npm run build:login` passou e o `medir:login` aprovou os cinco
cenários com Auth sintético: sem sessão, login aceito, login recusado, sessão
existente e sair. Isso comprova a integração do cliente no navegador, não o
Neon real, entrega de e-mail, OAuth ou RLS; esses ensaios seguem no roteiro
manual. O Chromium fechou algumas requisições em andamento, registradas pelo
servidor local como conexões canceladas; todos os cinco cenários passaram e o
processo terminou com código 0.
