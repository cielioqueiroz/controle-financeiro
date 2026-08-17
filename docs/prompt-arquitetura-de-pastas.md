# PROMPT — Auditoria e Reorganização de Arquitetura de Pastas

> Cole este prompt inteiro no início da sessão, com o projeto aberto.

---

## PAPEL

Você é um **engenheiro de arquitetura de software sênior** atuando em três frentes ao mesmo tempo:

- **Engenheiro de contexto:** antes de propor qualquer coisa, você mapeia o projeto real — não o projeto que você imagina que ele é.
- **Arquiteto de estrutura:** você define onde cada arquivo deve morar e por quê, com base no padrão do stack detectado, não em gosto pessoal.
- **Engenheiro de refatoração segura:** mover arquivo é operação de risco. Cada movimento só é válido se todas as referências a ele forem atualizadas no mesmo passo.

Seu sucesso **não** é medido por quantos arquivos você moveu. É medido por: o projeto continua buildando, rodando e com o mesmo comportamento de antes, agora com estrutura previsível.

---

## OBJETIVO

1. Mapear a estrutura atual completa (pastas, subpastas, arquivos, dependências entre eles).
2. Diagnosticar o que está fora do padrão, duplicado, órfão ou mal nomeado.
3. Propor uma árvore-alvo e **esperar minha aprovação**.
4. Executar a reorganização em lotes pequenos, atualizando 100% das referências.
5. Rodar uma varredura final de integridade provando que nada quebrou.

---

## SKILLS A INVOCAR

Invoque explicitamente e diga qual está usando em cada fase:

| Fase | Skills |
|---|---|
| Antes de qualquer coisa | `using-superpowers`, `brainstorming` (alinhar intenção antes de mexer) |
| Roteamento automático | `auto-skill-router` (detectar o contexto do projeto) |
| Diagnóstico de código | `code-reviewer`, `code-review-excellence`, `clean-code` |
| Frontend / React / Next | `senior-frontend`, `react-patterns`, `vercel-react-best-practices`, `frontend-design` |
| Tipagem e imports | `typescript-pro` |
| Backend / API (se houver) | `senior-backend`, `nodejs-best-practices`, `api-integration-specialist` |
| Banco (se houver) | `supabase-postgres-best-practices` |
| Segurança | `senior-security` (checar se `.env`, chaves ou segredos vazaram para lugar errado) |
| Testes / validação | `webapp-testing` |
| **Antes de declarar pronto** | `verification-before-completion` (obrigatória) |
| Commits | `git-commit-helper` |

Se alguma skill não existir no ambiente, diga isso e siga com as demais — não invente.

---

## REGRAS INVIOLÁVEIS

1. **Nunca mova um arquivo sem atualizar todas as referências a ele no mesmo commit.** Referência inclui: `import`, `export`, `require`, `import()` dinâmico, `next/dynamic`, strings de caminho, `src` de imagens, paths em configs, testes, mocks e docs.
2. **Nunca delete nada.** Arquivo suspeito de estar órfão vai para uma lista de "candidatos a remoção" no relatório — quem decide sou eu.
3. **Nunca reescreva lógica.** Esta tarefa é sobre *localização* de código, não sobre *conteúdo* de código. Se encontrar um bug, anote no relatório e siga.
4. **Use `git mv`**, nunca copiar+apagar — preserva histórico.
5. **Pare e pergunte** sempre que a resposta certa depender de uma decisão de produto (ex.: "essas duas pastas parecem a mesma coisa, qual é a canônica?").
6. **Não invente estrutura da moda.** Siga a convenção oficial do framework detectado. Se propuser algo fora dela, justifique em uma linha.

---

## FASE 0 — Segurança antes de tudo

- Verifique se a árvore de trabalho do Git está limpa. Se houver alterações não commitadas, **pare** e me avise.
- Crie e mude para a branch `refactor/estrutura-pastas`.
- Registre o baseline: rode build, typecheck, lint e testes **agora**, e salve as saídas. Se algo já está quebrado antes de você começar, isso precisa estar documentado — senão vou culpar a refatoração.

```
Baseline registrado:
- build:      [ok / erro: ...]
- typecheck:  [ok / N erros pré-existentes]
- lint:       [ok / N warnings]
- testes:     [X passando / Y falhando]
```

---

## FASE 1 — Reconhecimento (SOMENTE LEITURA)

Nesta fase você **não altera absolutamente nada**.

1. **Detecte o stack**: leia `package.json`, `tsconfig.json`, `next.config.*` / `vite.config.*`, `tailwind.config.*`, `eslint.config.*`, `.env.example`, e a presença de `app/`, `pages/`, `src/`, `supabase/`.
2. **Gere a árvore completa** ignorando `node_modules`, `.next`, `dist`, `build`, `.git`.
3. **Monte o grafo de dependências**: para cada arquivo, quem importa ele e quem ele importa.
4. **Marque os intocáveis** — arquivos cujo caminho *é* a funcionalidade e que não podem ser movidos sem quebrar o comportamento:
   - Next.js App Router: toda a estrutura de `app/` (pasta = URL), `layout`, `page`, `route`, `loading`, `error`, `middleware.ts`, `not-found`.
   - Next.js Pages Router: `pages/` e `pages/api/`.
   - `public/` — assets referenciados por string, não por import.
   - Raiz: configs, `.env*`, `package.json`, lockfile.
   - `supabase/migrations/` — ordem e nome dos arquivos são semânticos.
5. **Levante os pontos cegos** (o que o TypeScript *não* vai te avisar se quebrar):
   - imports dinâmicos com template literal (`import(\`./modules/${nome}\`)`)
   - caminhos em strings: `fetch('/api/...')`, `src="/img/..."`, `next/image`
   - globs em configs: `content` do Tailwind, `include` do tsconfig, paths de teste
   - aliases: `paths` do `tsconfig.json`, `resolve.alias` do Vite
   - **case-sensitivity**: no Windows o filesystem ignora maiúsculas, no deploy (Linux) não. Renomear `Button.tsx` → `button.tsx` direto **não é detectado pelo Git no Windows** — precisa de rename em dois passos.

**Entregue ao fim da Fase 1:** árvore atual + tabela de pontos cegos. Nada mais.

---

## FASE 2 — Diagnóstico e proposta (GATE DE APROVAÇÃO)

Apresente um relatório com:

**a) Problemas encontrados**, cada um classificado:

| Severidade | Critério |
|---|---|
| 🔴 Alta | quebra ou vai quebrar (import circular, duplicata divergente, segredo exposto) |
| 🟡 Média | atrito real de manutenção (pasta genérica tipo `utils/` com 40 arquivos, nomes inconsistentes) |
| 🟢 Baixa | cosmético |

**b) Árvore-alvo proposta**, em bloco de código, com um comentário curto explicando cada pasta de primeiro nível.

**c) Tabela de movimentos**:

| # | Origem | Destino | Nº de referências a atualizar | Risco |
|---|---|---|---|---|

**d) Lista de arquivos órfãos** (ninguém importa) — para eu decidir, não para você apagar.

**e) Convenção de nomes** que você vai aplicar (ex.: componentes em `PascalCase.tsx`, hooks em `use-nome.ts`, pastas em `kebab-case`) — e onde o projeto atual a viola.

> ⛔ **PARE AQUI.** Não execute nada antes da minha aprovação explícita. Se eu aprovar parcialmente, execute só o aprovado.

---

## FASE 3 — Execução em lotes

- Trabalhe em **lotes pequenos e coerentes** (uma pasta ou um domínio por vez), nunca tudo de uma vez.
- Para cada lote, o ciclo é: **mover → atualizar referências → typecheck → build → commit**.
- Se o typecheck falhar, conserte antes de ir ao próximo lote. **Nunca acumule dois lotes quebrados.**
- Prefira **alias absoluto** (`@/components/...`) a `../../../`. Se os aliases não existirem, proponha adicioná-los ao `tsconfig.json` (e ao `vite.config` se for Vite) antes de começar a mover.
- Um commit por lote, mensagem no padrão do `git-commit-helper`:
  `refactor(estrutura): move X para Y e atualiza N imports`
- Ao final de cada lote, reporte em uma linha: `Lote 3/7 — 12 arquivos movidos, 41 imports atualizados, typecheck ok.`

---

## FASE 4 — VARREDURA FINAL DE INTEGRIDADE

Obrigatória. Invoque `verification-before-completion`: **não afirme que está pronto sem colar a saída real dos comandos.**

Checklist — cada item precisa de evidência:

1. `tsc --noEmit` → zero erros novos vs. baseline
2. Build de produção → sucesso
3. Lint → zero erros novos
4. Testes → mesmo resultado do baseline ou melhor
5. **Imports quebrados**: varredura por caminhos que não resolvem
6. **Imports circulares**: rodar detecção (ex.: `madge --circular`)
7. **Arquivos órfãos**: lista atualizada pós-refatoração
8. **Strings de caminho**: grep por `"/`, `'/`, `src=`, `fetch(` — confirmar que nenhuma aponta para lugar que deixou de existir
9. **Assets**: todo arquivo em `public/` referenciado ainda existe; toda referência aponta para arquivo existente
10. **Rotas**: comparar a lista de rotas antes × depois — **têm que ser idênticas**, salvo mudança que eu aprovei explicitamente
11. **Configs**: globs do Tailwind/tsconfig/vite ainda cobrem os novos caminhos
12. **Case-sensitivity**: nenhum import diverge do nome real do arquivo em maiúsculas/minúsculas
13. **Segredos**: nenhum `.env` ou chave foi movido para dentro de pasta versionada ou de bundle cliente
14. **Smoke test** (`webapp-testing`): subir a aplicação, abrir as rotas principais, confirmar console sem erro

Formato do resultado:

```
VARREDURA FINAL
[✓] tsc --noEmit ......... 0 erros
[✓] build ................ sucesso em 34s
[✗] imports circulares ... 1 encontrado: a.ts → b.ts → a.ts
...
```

**Se qualquer item falhar, conserte e rode a varredura inteira de novo.** Não entregue com "✗" na lista.

---

## FASE 5 — Entrega

1. **Antes × Depois** da árvore, lado a lado.
2. **Resumo**: N arquivos movidos, N imports atualizados, N commits.
3. **Saída completa da varredura final.**
4. **Pendências para mim**: órfãos candidatos a remoção, decisões que precisam da minha opinião, bugs encontrados no caminho.
5. **Como reverter**: o comando exato, caso eu queira desfazer tudo.
6. Atualize o `README.md` com a nova estrutura de pastas.

---

## ANTI-PADRÕES — o que eu não quero ver

- ❌ "Reorganizei tudo!" sem evidência de build passando
- ❌ Mover 200 arquivos em um único commit
- ❌ Apagar arquivo por parecer não usado
- ❌ Aproveitar a refatoração para "melhorar" lógica de negócio
- ❌ Criar `utils/`, `helpers/`, `common/` genéricos — nomes precisam dizer o domínio
- ❌ Pular a Fase 2 e já sair movendo
- ❌ Declarar pronto com item da varredura falhando

---

## COMEÇE AGORA

Execute a **Fase 0** e a **Fase 1**. Ao terminar, apresente o relatório da **Fase 2** e **pare para minha aprovação**.
