# Reforma — Fatia 1a (arquitetura) + 4a (seletor de idioma)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar o repositório em `frontend/` e `backend/` com npm workspaces, sem mudar o comportamento do app, e tirar o seletor de idioma da interface preservando todo o código de i18n.

**Architecture:** Monorepo com npm workspaces. Todo o app React vai para `frontend/` (incluindo `tests/fixtures`, para que os 13 testes que leem fixture por caminho relativo ao CWD continuem funcionando sem edição). As migrations SQL vão para `backend/db/migrations/`. `scripts/` fica na raiz e tem os imports corrigidos. O backend funcional (`backend/api/`) é a Fatia 1b, bloqueada por credencial — esta fatia só prepara o lugar dele.

**Tech Stack:** npm workspaces, Vite 8, Vitest 4, TypeScript 6, oxlint, Vercel.

## Global Constraints

- **`npm test` NÃO checa tipos.** Toda verificação é `npm test && npm run build && npm run lint`. Verde no Vitest não é verde.
- **Vite não recarrega bem quando arquivos mudam de lugar.** Depois de mover pastas, reiniciar o `npm run dev` e dar `Ctrl+Shift+R`. Não é defeito.
- **Usar `git mv`, nunca `mv`.** Preserva o histórico de 165 arquivos.
- **Números de referência a preservar:** 504 testes, 66 arquivos. Se o total cair, algo deixou de ser coletado — investigar antes de seguir.
- **Não tocar em `src/i18n/`.** A Fatia 4a remove o seletor da UI; o mecanismo inteiro fica.
- **Nada de `backend/api/` nesta fatia.** Só a pasta e as migrations.

## Estrutura final desta fatia

```
package.json          raiz — workspaces + scripts que delegam
vercel.json           raiz — build aponta para frontend
.oxlintrc.json        raiz — lint do monorepo
frontend/
  package.json        deps do app
  index.html          (movido; `/src/main.tsx` continua correto)
  index.test.ts       (movido; lê ./index.html por import.meta.url)
  vite.config.ts      (movido)
  tsconfig*.json      (movidos)
  public/             (movido)
  src/                (movido)
  tests/fixtures/     (movido — mantém os readFileSync intactos)
backend/
  package.json        mínimo (o workspace exige)
  db/migrations/      0001 e 0002, movidos de neon/
scripts/              fica na raiz, imports corrigidos para ../frontend/src
docs/                 inalterado
```

---

### Task 1: Criar os workspaces e mover o frontend

**Files:**
- Create: `frontend/package.json`, `backend/package.json`
- Modify: `package.json` (raiz — vira manifesto de workspace)
- Move: `src/`, `public/`, `tests/`, `index.html`, `index.test.ts`, `vite.config.ts`, `tsconfig.app.json`, `tsconfig.base.json`, `tsconfig.node.json`, `tsconfig.test.json`, `tsconfig.json` → `frontend/`

**Interfaces:**
- Produces: `npm test`, `npm run build`, `npm run lint` e `npm run dev` na raiz, delegando ao workspace `frontend`.

- [ ] **Step 1: Registrar a contagem de testes ANTES de mover**

```bash
npm test 2>&1 | tail -5
```

Anote o número exato. Esperado: `Tests  504 passed (504)` em `66` arquivos. Este é o gabarito da tarefa — no fim, tem de bater.

- [ ] **Step 2: Criar as pastas e mover o frontend com `git mv`**

```bash
mkdir -p frontend backend/db
git mv src public tests index.html index.test.ts vite.config.ts frontend/
git mv tsconfig.json tsconfig.base.json tsconfig.app.json tsconfig.node.json tsconfig.test.json frontend/
git mv neon/migrations backend/db/migrations
rmdir neon 2>/dev/null || true
```

`tests/` vai junto de propósito: 13 arquivos de teste fazem `readFileSync('tests/fixtures/…')` — caminho relativo ao CWD. Com o Vitest rodando de `frontend/`, eles continuam resolvendo sem que nenhum precise ser editado.

- [ ] **Step 3: Escrever `frontend/package.json`**

Todas as dependências saem da raiz e vêm para cá. `tsx` e `oxlint` NÃO vêm — ficam na raiz, porque `scripts/` fica na raiz.

```json
{
  "name": "@capital/frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@neondatabase/neon-js": "^0.6.2-beta",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.8",
    "motion": "^12.42.2",
    "pdfjs-dist": "^5.4.149",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "sonner": "^2.0.7",
    "three": "^0.185.1"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.16",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^24.13.2",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.185.1",
    "@vitejs/plugin-react": "^6.0.3",
    "jsdom": "^28.0.0",
    "tailwindcss": "^4.1.16",
    "typescript": "~6.0.2",
    "vite": "^8.1.1",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 4: Escrever `backend/package.json`**

Mínimo — o workspace exige um manifesto. A Fatia 1b o preenche.

```json
{
  "name": "@capital/backend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test": "echo \"(sem testes ainda — Fatia 1b)\" && exit 0"
  }
}
```

- [ ] **Step 5: Reescrever o `package.json` da raiz**

```json
{
  "name": "capital-financeiro",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": ["frontend", "backend"],
  "scripts": {
    "dev": "npm run dev --workspace frontend",
    "build": "npm run build --workspace frontend",
    "preview": "npm run preview --workspace frontend",
    "test": "npm run test --workspace frontend",
    "test:watch": "npm run test:watch --workspace frontend",
    "lint": "oxlint",
    "fixtures": "tsx scripts/gerar-fixtures.ts"
  },
  "devDependencies": {
    "oxlint": "^1.71.0",
    "tsx": "^4.20.6",
    "typescript": "~6.0.2"
  }
}
```

- [ ] **Step 6: Reinstalar as dependências**

```bash
rm -rf node_modules package-lock.json && npm install
```

O lockfile é regenerado com a árvore de workspaces — mudança grande e esperada no diff.

- [ ] **Step 7: Corrigir o `include` do `frontend/tsconfig.test.json`**

`scripts` e `index.test.ts` estavam no include. `index.test.ts` veio junto para `frontend/`, mas `scripts/` **ficou na raiz** e agora está fora do alcance deste tsconfig.

Trocar a linha `"include"` por:

```json
  "include": ["src/**/*.test.ts", "src/**/*.test.tsx", "index.test.ts"]
```

- [ ] **Step 8: Rodar a verificação completa**

```bash
npm test && npm run build && npm run lint
```

Esperado: **504 testes em 66 arquivos**, build limpo, lint com os 3 avisos pré-existentes e nada mais. Se a contagem de testes divergir do Step 1, o Vitest deixou de coletar algum arquivo — conferir antes de commitar.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(arq): frontend/ e backend/ como workspaces npm

Todo o app React vai para frontend/, incluindo tests/fixtures — os 13
testes que leem fixture por caminho relativo ao CWD continuam intactos.
As migrations SQL vao para backend/db/migrations/.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Corrigir os scripts da raiz

**Files:**
- Modify: `scripts/gerar-fixtures.ts` (rastreado)
- Modify: `scripts/diagnostico.ts`, `scripts/_dump-bb.ts`, `scripts/_fix-bb.ts`, `scripts/_fix-sicoob.ts`, `scripts/_fix-sicredi.ts` (gitignored, mas existem no disco e são as ferramentas de trabalho do usuário — quebrá-las em silêncio é o pior resultado)
- Modify: `scripts/medir-overflow.py`

**Interfaces:**
- Consumes: a estrutura `frontend/` da Task 1.

- [ ] **Step 1: Provar que os scripts estão quebrados**

```bash
npx tsx scripts/gerar-fixtures.ts 2>&1 | head -5
```

Esperado: FALHA com `Cannot find module '../src/domain/pdf/extract'`. É o defeito que esta tarefa conserta.

- [ ] **Step 2: Corrigir os imports em todos os scripts `.ts`**

Todo `from '../src/` vira `from '../frontend/src/`:

```bash
sed -i "s|from '\.\./src/|from '../frontend/src/|g" scripts/*.ts
```

- [ ] **Step 3: Corrigir os caminhos de escrita de fixture**

Os scripts escrevem em `tests/fixtures/` relativo ao CWD da raiz, mas as fixtures agora estão em `frontend/tests/fixtures/`:

```bash
sed -i "s|'tests/fixtures|'frontend/tests/fixtures|g" scripts/*.ts
```

- [ ] **Step 4: Verificar que o script volta a rodar**

```bash
npx tsx scripts/gerar-fixtures.ts 2>&1 | head -5
```

Esperado: já não reclama de módulo. (Pode reclamar de PDF ausente — os PDFs reais não são versionados. Isso é aceitável; o que importa é a resolução de import.)

- [ ] **Step 5: Não tocar no `medir-overflow.py`**

Já verificado: a única referência externa dele é
`URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"` (linha 19).
Ele fala com o dev server por HTTP, não com o disco, e a porta não muda.
**Nenhuma edição necessária** — o passo existe para registrar que foi conferido,
não presumido.

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "fix(scripts): apontar para frontend/ depois da mudanca de pastas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Apontar a Vercel para o novo layout

**Files:**
- Modify: `vercel.json`

**Interfaces:**
- Consumes: a estrutura `frontend/` da Task 1.

Sem isto o próximo push publica um site quebrado: a Vercel procura o build na raiz, onde já não há `index.html`.

- [ ] **Step 1: Acrescentar build e rewrite de SPA ao `vercel.json`**

Manter o bloco `headers` inteiro como está e acrescentar as chaves abaixo no mesmo objeto raiz:

```json
  "buildCommand": "npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "npm install",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
```

O rewrite já entra aqui, e não na Fatia 2, porque é inofensivo hoje (só há uma rota) e evita um segundo deploy de risco quando o router chegar. O negative lookahead preserva `/api/*` para o backend da Fatia 1b.

- [ ] **Step 2: Provar que o build de produção funciona a partir da raiz**

```bash
npm run build && ls frontend/dist/index.html
```

Esperado: o arquivo existe. É exatamente o caminho que `outputDirectory` declara.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "build(vercel): apontar para frontend/dist + rewrite de SPA

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4 (Fatia 4a): Tirar o seletor de idioma da interface

**Files:**
- Modify: `frontend/src/ui/TelaAcesso.tsx:5` (import) e `:57` (renderização)
- Test: `frontend/src/ui/TelaAcesso.test.tsx` (acrescenta o teste)
- Test: `frontend/src/ui/SeletorIdioma.test.tsx` — **permanece e continua passando**

**Interfaces:**
- Produces: nenhuma mudança de API. `useT()` segue funcionando, fixo em pt.

**Não apagar nada de `src/i18n/`.** O pedido foi explícito: tirar a opção da tela, deixar o código para melhorar depois. Os dicionários en/es, o `IdiomaProvider` e os testes de i18n ficam — apagá-los é que tornaria a volta cara.

**Já verificado:** `SeletorIdioma` é renderizado em **um único lugar** —
`TelaAcesso.tsx` (a tela de login). O `App.tsx` nunca o montou, então o
cabeçalho logado não tem seletor e não precisa de mudança.

- [ ] **Step 1: Escrever o teste que prova a remoção**

Os botões do seletor têm `aria-label` com o nome do idioma por extenso
(`SeletorIdioma.tsx:16`), não a sigla — então o nome acessível é "English",
não "EN". Procurar por "EN" faria um teste que passa dos dois jeitos.

Em `frontend/src/ui/TelaAcesso.test.tsx`, acrescentar:

```tsx
it('não oferece troca de idioma na tela de acesso', () => {
  render(<TelaAcesso><div /></TelaAcesso>)
  expect(screen.queryByRole('button', { name: 'English' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Español' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Português' })).toBeNull()
})
```

- [ ] **Step 2: Rodar o teste e vê-lo falhar**

```bash
npm test -- TelaAcesso
```

Esperado: FALHA nos três `expect` — o seletor está na tela. Se passar já
agora, o `render` não está montando o que você pensa; conferir antes de seguir.

- [ ] **Step 3: Remover a renderização**

Em `frontend/src/ui/TelaAcesso.tsx`, apagar a linha 5
(`import { SeletorIdioma } from './SeletorIdioma'`) e o `<SeletorIdioma />`
da linha 57, junto do elemento que só existia para posicioná-lo (conferir se
o `<div>` em volta fica vazio — se ficar, sai também).

**Manter** o `IdiomaProvider` envolvendo o app — é ele que faz `useT()`
funcionar. Removê-lo derruba toda a tela.

- [ ] **Step 4: Rodar a verificação completa**

```bash
npm test && npm run build && npm run lint
```

Esperado: o teste novo passa; `SeletorIdioma.test.tsx` **continua verde** (o
componente segue existindo e testável, só não é mais montado). Contagem
esperada: 505 testes. O `lint` pode acusar import não usado em
`TelaAcesso.tsx` se o Step 3 esqueceu a linha 5 — é a rede de segurança aqui.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(i18n): tirar o seletor de idioma da interface

O mecanismo inteiro (IdiomaProvider, dicionarios pt/en/es, useT e os
testes) fica no lugar e funcionando, fixo em pt. Reativar e devolver
uma linha ao cabecalho.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verificação final da fatia

- [ ] `npm test && npm run build && npm run lint` — 505 testes, build e lint limpos
- [ ] `npm run dev` sobe e o app funciona logado (reiniciar o dev server e `Ctrl+Shift+R`, pela armadilha registrada)
- [ ] `python scripts/medir-overflow.py` — sem rolagem lateral em 1280×800 e 390×844
- [ ] `git status` limpo
- [ ] Nenhum arquivo de `frontend/src/i18n/` foi apagado: `ls frontend/src/i18n/dicionarios/` mostra `pt.ts`, `en.ts`, `es.ts`

## O que esta fatia deliberadamente NÃO faz

- **Não cria `backend/api/`.** A Fatia 1b depende da `DATABASE_URL`, que ainda não existe no `.env.local`.
- **Não toca em `lib/neon.ts`.** O app continua falando com a Data API pelo cliente. Trocar isso é a Fatia 1b.
- **Não mexe em layout, cor ou tipografia.** Fatias 2 e 3.
- **Não remove a barra de rolagem** de `Dashboard.tsx:681`. Ela sai na Fatia 2, quando as páginas tornarem a coluna sticky desnecessária — tirá-la antes reintroduz o bug de conteúdo inalcançável que ela conserta.
