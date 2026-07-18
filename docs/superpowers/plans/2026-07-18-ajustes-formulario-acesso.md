# Ajustes no Formulário de Acesso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o toast de validação do login/cadastro para nomear exatamente os campos vazios, e adicionar o botão de revelar senha.

**Architecture:** A lógica de validação sai do componente para um módulo puro (`src/ui/auth-validacao.ts`), testável sem renderizar React — é onde mora o bug. O `Auth.tsx` passa a consumir esse módulo, foca o primeiro campo vazio via `ref`, e ganha um botão de olho controlando o `type` do input de senha.

**Tech Stack:** React 19 + TypeScript, Vitest (jsdom, `globals: true`), @testing-library/react, sonner (toasts), Tailwind v4, oxlint.

## Global Constraints

- Tudo em **português do Brasil**, incluindo nomes de teste e mensagens.
- Testes ficam **ao lado** do arquivo testado (`x.ts` → `x.test.ts`), padrão do repo.
- Imports de teste são **explícitos** (`import { describe, it, expect } from 'vitest'`), mesmo com `globals: true` — é o padrão em `src/domain/normalize/money.test.ts`.
- **Não alterar:** estilo do cartão, animações `motion`, fluxo `comGoogle`, função `traduzErro`.
- Senha **nunca** leva `.trim()` — espaço é caractere válido.
- Sufixo das mensagens: modo `criar` → `"para criar sua conta."`; modo `entrar` → `"para entrar."`
- Critério de aceite final: `npm test`, `npm run build` e `npm run lint` verdes.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/ui/auth-validacao.ts` | **Criar.** Funções puras: quais campos faltam e qual mensagem exibir. Zero dependência de React. |
| `src/ui/auth-validacao.test.ts` | **Criar.** Testes unitários do módulo acima. |
| `src/ui/Auth.tsx` | **Modificar.** Consome o módulo, foca o primeiro campo vazio, adiciona o olho da senha. |

---

### Task 1: Módulo puro de validação

**Files:**
- Create: `src/ui/auth-validacao.ts`
- Test: `src/ui/auth-validacao.test.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces:
  - `type ModoAcesso = 'entrar' | 'criar'`
  - `type CampoAcesso = 'nome' | 'email' | 'senha'`
  - `type CamposAcesso = { nome: string; email: string; senha: string }`
  - `camposFaltando(modo: ModoAcesso, campos: CamposAcesso): CampoAcesso[]`
  - `mensagemCamposFaltando(modo: ModoAcesso, faltando: CampoAcesso[]): string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/ui/auth-validacao.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { camposFaltando, mensagemCamposFaltando } from './auth-validacao'

const vazio = { nome: '', email: '', senha: '' }

describe('camposFaltando', () => {
  it('no modo criar, lista nome, email e senha na ordem da tela', () => {
    expect(camposFaltando('criar', vazio)).toEqual(['nome', 'email', 'senha'])
  })

  it('no modo entrar, ignora o campo nome (que nem existe na tela)', () => {
    expect(camposFaltando('entrar', vazio)).toEqual(['email', 'senha'])
  })

  it('no modo entrar, ignora nome mesmo quando preenchido', () => {
    expect(camposFaltando('entrar', { ...vazio, nome: 'Cielio' })).toEqual(['email', 'senha'])
  })

  it('não acusa campo preenchido', () => {
    expect(camposFaltando('criar', { nome: 'Cielio', email: 'a@b.com', senha: 'segredo12' })).toEqual([])
  })

  it('trata espaço em branco como vazio em nome e email', () => {
    expect(camposFaltando('criar', { nome: '   ', email: '  ', senha: 'segredo12' })).toEqual(['nome', 'email'])
  })

  it('NÃO apara a senha — espaço é caractere válido', () => {
    expect(camposFaltando('criar', { nome: 'Cielio', email: 'a@b.com', senha: '   ' })).toEqual([])
  })
})

describe('mensagemCamposFaltando', () => {
  it('lista os três campos com vírgula e "e"', () => {
    expect(mensagemCamposFaltando('criar', ['nome', 'email', 'senha']))
      .toBe('Preencha nome, e-mail e senha para criar sua conta.')
  })

  it('liga dois campos com "e"', () => {
    expect(mensagemCamposFaltando('entrar', ['email', 'senha']))
      .toBe('Preencha e-mail e senha para entrar.')
  })

  it('usa possessivo quando falta só um campo', () => {
    expect(mensagemCamposFaltando('criar', ['nome']))
      .toBe('Preencha seu nome para criar sua conta.')
    expect(mensagemCamposFaltando('entrar', ['senha']))
      .toBe('Preencha sua senha para entrar.')
    expect(mensagemCamposFaltando('entrar', ['email']))
      .toBe('Preencha seu e-mail para entrar.')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/ui/auth-validacao.test.ts`
Expected: FAIL — `Failed to resolve import "./auth-validacao"`.

- [ ] **Step 3: Implementar o mínimo**

Criar `src/ui/auth-validacao.ts`:

```ts
/** Validação do formulário de acesso, separada do componente para ser
 *  testável sem renderizar React. */

export type ModoAcesso = 'entrar' | 'criar'
export type CampoAcesso = 'nome' | 'email' | 'senha'
export type CamposAcesso = { nome: string; email: string; senha: string }

const ROTULO: Record<CampoAcesso, string> = {
  nome: 'nome',
  email: 'e-mail',
  senha: 'senha',
}

const POSSESSIVO: Record<CampoAcesso, string> = {
  nome: 'seu nome',
  email: 'seu e-mail',
  senha: 'sua senha',
}

/** Campos vazios, na ordem em que aparecem na tela.
 *  `nome` só conta no modo criar; `apelido` é opcional e nunca entra.
 *  A senha não é aparada: espaço é caractere válido. */
export function camposFaltando(modo: ModoAcesso, campos: CamposAcesso): CampoAcesso[] {
  const faltando: CampoAcesso[] = []
  if (modo === 'criar' && !campos.nome.trim()) faltando.push('nome')
  if (!campos.email.trim()) faltando.push('email')
  if (!campos.senha) faltando.push('senha')
  return faltando
}

/** "a", "a e b", "a, b e c" */
function ligar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? ''
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

export function mensagemCamposFaltando(modo: ModoAcesso, faltando: CampoAcesso[]): string {
  const fim = modo === 'criar' ? 'para criar sua conta' : 'para entrar'
  const lista =
    faltando.length === 1
      ? POSSESSIVO[faltando[0]]
      : ligar(faltando.map((c) => ROTULO[c]))
  return `Preencha ${lista} ${fim}.`
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/ui/auth-validacao.test.ts`
Expected: PASS — 9 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/auth-validacao.ts src/ui/auth-validacao.test.ts
git commit -m "feat: módulo puro de validação do formulário de acesso"
```

---

### Task 2: Ligar a validação ao formulário + foco

**Files:**
- Modify: `src/ui/Auth.tsx:23-43` (função `submeter`), `src/ui/Auth.tsx:16-21` (estado), `src/ui/Auth.tsx:121-159` (inputs recebem `ref`)

**Interfaces:**
- Consumes: `camposFaltando`, `mensagemCamposFaltando`, `CampoAcesso` de `./auth-validacao` (Task 1).
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Importar o módulo e criar as refs**

Em `src/ui/Auth.tsx`, adicionar ao topo (junto dos imports existentes):

```tsx
import { useRef, useState } from 'react'
import { camposFaltando, mensagemCamposFaltando, type CampoAcesso } from './auth-validacao'
```

Nota: a linha 1 hoje é `import { useState } from 'react'` — substituir por `useRef, useState`.

Logo após `const [ocupado, setOcupado] = useState(false)` (linha 21), adicionar:

```tsx
  // Uma ref por campo obrigatório, para focar o primeiro que estiver vazio.
  const refs: Record<CampoAcesso, React.RefObject<HTMLInputElement | null>> = {
    nome: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    senha: useRef<HTMLInputElement>(null),
  }
```

- [ ] **Step 2: Reescrever o bloco de validação**

Substituir INTEIRO o trecho das linhas 25-43 (do `if (!neon) return` até o fechamento da checagem de senha curta) por:

```tsx
    // Validação primeiro: campo vazio sempre vence formato inválido, para
    // as duas mensagens nunca competirem.
    const faltando = camposFaltando(modo, { nome, email, senha })
    if (faltando.length > 0) {
      toast.error(mensagemCamposFaltando(modo, faltando))
      refs[faltando[0]].current?.focus()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Esse e-mail não parece válido.')
      refs.email.current?.focus()
      return
    }
    if (senha.length < 8) {
      toast.warning('A senha precisa ter ao menos 8 caracteres.')
      refs.senha.current?.focus()
      return
    }

    // Só agora o Neon importa. Antes ficava no topo da função e engolia a
    // validação em silêncio quando o banco não estava configurado.
    if (!neon) {
      toast.error('O banco de dados não está configurado neste ambiente.')
      return
    }
```

- [ ] **Step 3: Pendurar as refs nos inputs**

No input de nome (linha ~121), adicionar `ref={refs.nome}` logo após `type="text"`.
No input de e-mail (linha ~143), adicionar `ref={refs.email}` logo após `type="email"`.
No input de senha (linha ~151), adicionar `ref={refs.senha}` logo após o `type`.

O input de **apelido** não recebe ref — é opcional.

- [ ] **Step 4: Verificar tipos e lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: sem erros. Se `tsc` reclamar de `RefObject`, confirmar que o tipo declarado é `HTMLInputElement | null` (React 19 exige o `| null`).

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — 183 testes anteriores + 9 da Task 1 = 192 verdes.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Auth.tsx
git commit -m "fix: toast de acesso nomeia os campos vazios e foca o primeiro"
```

---

### Task 3: Botão de revelar senha

**Files:**
- Modify: `src/ui/Auth.tsx` — estado, campo de senha, e um novo componente `IconeOlho` no rodapé do arquivo

**Interfaces:**
- Consumes: as refs da Task 2 (`refs.senha`).
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/ui/Auth.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Auth } from './Auth'

// O componente importa o cliente do Neon no topo; no teste ele não existe.
vi.mock('../lib/neon', () => ({ neon: null, neonConfigurado: false }))

describe('Auth — revelar senha', () => {
  it('começa oculta e alterna para texto ao clicar no olho', async () => {
    const usuario = userEvent.setup()
    render(<Auth onAutenticado={() => {}} />)

    const senha = screen.getByPlaceholderText(/senha/i)
    expect(senha).toHaveAttribute('type', 'password')

    await usuario.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(senha).toHaveAttribute('type', 'text')

    await usuario.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(senha).toHaveAttribute('type', 'password')
  })
})
```

Se `@testing-library/user-event` não estiver instalado, instalar antes:

```bash
npm install --save-dev @testing-library/user-event
```

O `toHaveAttribute` vem de `@testing-library/jest-dom`, já nas devDependencies. Se o matcher não for reconhecido, adicionar no topo do teste: `import '@testing-library/jest-dom/vitest'`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/ui/Auth.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name "Mostrar senha"`.

- [ ] **Step 3: Implementar o botão**

Adicionar o estado junto dos outros `useState` (após `ocupado`):

```tsx
  const [verSenha, setVerSenha] = useState(false)
```

Substituir o input de senha inteiro (linhas ~151-159 no arquivo original) por:

```tsx
        <div className="relative">
          <input
            ref={refs.senha}
            type={verSenha ? 'text' : 'password'}
            required
            minLength={8}
            placeholder="senha (mín. 8 caracteres)"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-sm border border-carvao-700 bg-carvao-950 px-3 py-2 pr-10 text-sm text-tinta outline-none focus:border-tinta-tenue"
          />
          <button
            type="button"
            onClick={() => setVerSenha(!verSenha)}
            aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={verSenha}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-tinta-tenue transition-colors hover:text-tinta"
          >
            <IconeOlho aberto={verSenha} />
          </button>
        </div>
```

Pontos que não podem escapar: `type="button"` (sem isso o botão submete o formulário) e `pr-10` no input (sem isso o texto da senha passa por baixo do ícone).

Adicionar o ícone no rodapé do arquivo, junto de `GoogleIcon`:

```tsx
/** Olho aberto/cortado para revelar a senha. */
function IconeOlho({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
      {!aberto && <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" strokeLinecap="round" />}
    </svg>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/ui/Auth.test.tsx`
Expected: PASS.

- [ ] **Step 5: Suíte inteira, build e lint**

Run: `npm test && npm run build && npm run lint`
Expected: tudo verde, 193 testes.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Auth.tsx src/ui/Auth.test.tsx package.json package-lock.json
git commit -m "feat: botão de revelar senha no formulário de acesso"
```

---

### Task 4: Verificação no navegador

**Files:** nenhum (verificação manual)

- [ ] **Step 1: Reiniciar o dev server**

Reiniciar é obrigatório — arquivo novo (`auth-validacao.ts`) não é captado bem pelo HMR do Vite, conforme `docs/ESTADO-ATUAL.md`.

```bash
npm run dev
```

Abrir `http://localhost:5173/` e dar `Ctrl+Shift+R`.

- [ ] **Step 2: Conferir os quatro casos**

| Ação | Esperado |
|---|---|
| "Criar conta" com tudo vazio | Toast: "Preencha nome, e-mail e senha para criar sua conta." · foco no campo nome |
| "Criar conta" só com o nome preenchido | Toast: "Preencha e-mail e senha para criar sua conta." · foco no e-mail |
| "Entrar" com tudo vazio | Toast: "Preencha e-mail e senha para entrar." · foco no e-mail |
| Clicar no olho com senha digitada | A senha vira texto legível; o formulário **não** é enviado |

- [ ] **Step 3: Commit (só se algo precisou de ajuste)**

Se os quatro casos passarem sem alteração de código, não há o que commitar.

---

## Notas

- Normalizei duas inconsistências do spec: o sufixo do modo `criar` é sempre `"para criar sua conta."` (o spec alternava com "para criar a conta"), e mensagens de múltiplos campos não levam artigo (`"e-mail e senha"`, não `"o e-mail e a senha"`). O possessivo aparece só quando falta um campo único.
- A correção da ordem do `if (!neon)` na Task 2 não estava no spec: foi descoberta ao ler o código. Sem ela a validação inteira fica inalcançável quando o banco não está configurado.
