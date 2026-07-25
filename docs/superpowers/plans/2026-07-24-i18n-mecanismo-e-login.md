# i18n — mecanismo + fatia do login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Dar um seletor PT/EN/ES que troca o texto, com o mecanismo leve e a tela de acesso como primeira fatia traduzida.

**Architecture:** Núcleo puro (locale + storage) → dicionários tipados pt/en/es → contexto/hook `useT` com **default pt** (componentes funcionam sem provider, testes atuais intactos) → seletor → troca dos literais do login por `t(...)`.

**Tech Stack:** TypeScript, React 19, Vitest. Sem dependência nova.

## Global Constraints
- **pt é a fonte da verdade**: cada valor pt é **idêntico** ao literal atual (para os testes de componente não mudarem). en/es são traduções.
- `useT()` tem **contexto default em pt** → componentes renderizam sem `IdiomaProvider`; nenhum teste atual precisa de wrapper.
- **Nesta fatia NÃO se traduz** a mensagem composta de campos-faltando (`mensagemCamposFaltando`) — fica pt; `auth-validacao.ts` e seu teste ficam **intactos**. Os toasts de string única (e-mail inválido, senha curta, Google, erros de login/recuperação) **são** traduzidos.
- Moeda/datas e categorias: fora (fatia do dashboard). Login não mostra dinheiro.
- Após cada task: `npm test`. Fim: `build && lint && tsc -b`. Commits diretos na main. Co-author: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Núcleo do locale — `src/i18n/idioma.ts`

**Files:** Create `src/i18n/idioma.ts`, `src/i18n/idioma.test.ts`

**Interfaces (Produces):**
```ts
export type Idioma = 'pt' | 'en' | 'es'
export const IDIOMAS: readonly Idioma[]
export function detectarIdioma(): Idioma
export function lerIdioma(): Idioma
export function salvarIdioma(id: Idioma): void
```

- [ ] **Step 1: Teste que falha** — `src/i18n/idioma.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { detectarIdioma, lerIdioma, salvarIdioma } from './idioma'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

function idiomaNavegador(v: string) {
  vi.stubGlobal('navigator', { language: v })
}

describe('idioma', () => {
  it('detecta pt/en/es pelo navegador, senão pt', () => {
    idiomaNavegador('en-US'); expect(detectarIdioma()).toBe('en')
    idiomaNavegador('es-AR'); expect(detectarIdioma()).toBe('es')
    idiomaNavegador('pt-BR'); expect(detectarIdioma()).toBe('pt')
    idiomaNavegador('fr-FR'); expect(detectarIdioma()).toBe('pt')
  })
  it('lerIdioma usa o storage; salvarIdioma persiste', () => {
    idiomaNavegador('en-US')
    expect(lerIdioma()).toBe('en') // sem storage → detecta
    salvarIdioma('es')
    expect(lerIdioma()).toBe('es')
  })
  it('valor inválido no storage cai na detecção', () => {
    localStorage.setItem('cf:idioma', 'zz')
    idiomaNavegador('en-US')
    expect(lerIdioma()).toBe('en')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/i18n/idioma.test.ts` → FAIL.

- [ ] **Step 3: Implementar** — `src/i18n/idioma.ts`:
```ts
export type Idioma = 'pt' | 'en' | 'es'
export const IDIOMAS = ['pt', 'en', 'es'] as const

const CHAVE = 'cf:idioma'
function ehIdioma(v: unknown): v is Idioma {
  return v === 'pt' || v === 'en' || v === 'es'
}

/** pt/en/es pelo prefixo de navigator.language; qualquer outro → pt. */
export function detectarIdioma(): Idioma {
  const pref = (navigator?.language ?? 'pt').slice(0, 2).toLowerCase()
  return ehIdioma(pref) ? pref : 'pt'
}

export function lerIdioma(): Idioma {
  try {
    const v = localStorage.getItem(CHAVE)
    if (ehIdioma(v)) return v
  } catch {
    /* storage indisponível */
  }
  return detectarIdioma()
}

export function salvarIdioma(id: Idioma): void {
  try {
    localStorage.setItem(CHAVE, id)
  } catch {
    /* ignora */
  }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/i18n/idioma.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(i18n): nucleo do locale (deteccao + storage)"`.

---

### Task 2: Dicionários pt/en/es

**Files:** Create `src/i18n/dicionarios/pt.ts`, `en.ts`, `es.ts`

**Interfaces (Produces):** `export const pt` (objeto plano); `export type Dicionario = typeof pt`; `en`/`es` do tipo `Dicionario`.

- [ ] **Step 1: `pt.ts` — chaves da fatia, valores = literais ATUAIS (verbatim)**

Extrair de `TelaAcesso.tsx`, `CarrosselBancos.tsx`, `Auth.tsx`, `RecuperarSenha.tsx`,
`CampoSenha.tsx`, `Rodape.tsx`. Grupos e valores pt (exatos do código de hoje):
```ts
export const pt = {
  'acesso.frase1': 'Seu extrato vira gráfico,',
  'acesso.frase2': 'em menos de um minuto.',
  'auth.entrar': 'Entrar',
  'auth.criar': 'Criar conta',
  'auth.subtitulo': 'Seus dados financeiros, só seus.',
  'auth.ph.nome': 'nome e sobrenome',
  'auth.ph.apelido': 'como quer ser chamado? (apelido, opcional)',
  'auth.ajuda.apelido': 'É assim que vamos te saudar. Se deixar em branco, usamos seu primeiro nome.',
  'auth.ph.email': 'seu@email.com',
  'auth.ph.senha': 'senha (mín. 8 caracteres)',
  'auth.esqueceu': 'Esqueceu a senha?',
  'auth.ou': 'ou',
  'auth.google': 'Continuar com o Google',
  'auth.trocarParaCriar': 'Não tem conta? Criar uma',
  'auth.trocarParaEntrar': 'Já tem conta? Entrar',
  'auth.toast.criada': 'Conta criada. Se pedirmos confirmação, confira seu e-mail.',
  'auth.toast.semBanco': 'O banco de dados não está configurado neste ambiente.',
  'auth.toast.googleFalha': 'Falha ao entrar com o Google.',
  'auth.toast.authFalha': 'Falha na autenticação.',
  'auth.erro.credenciais': 'E-mail ou senha incorretos.',
  'auth.erro.jaExiste': 'Este e-mail já tem conta.',
  'auth.erro.confirme': 'Confirme seu e-mail antes de entrar.',
  'validacao.emailInvalido': 'Esse e-mail não parece válido.',
  'validacao.senhaCurta': 'A senha precisa ter ao menos 8 caracteres.',
  'campo.mostrarSenha': 'Mostrar senha',
  'campo.ocultarSenha': 'Ocultar senha',
  // recuperar.* — extrair de RecuperarSenha.tsx (títulos, ajudas, botões, toasts)
  // rodape.* — extrair de Rodape.tsx (as duas linhas de privacidade, "Criado por")
  // acesso.bancos — o rótulo do CarrosselBancos ("já lê os extratos de")
  'seletorIdioma': 'Idioma',
} as const
export type Dicionario = typeof pt
```
> As chaves `recuperar.*`, `rodape.*` e `acesso.bancos` são preenchidas lendo os
> respectivos arquivos; o valor pt é **idêntico** ao literal de hoje.

- [ ] **Step 2: `en.ts` e `es.ts`** — mesmas chaves, `satisfies Dicionario` (o compilador cobra chave faltando). Traduções (a frase-hero em en/es também traduzida; o app não trava a frase-hero fora do pt — só o pt precisa bater com testes/OG).

- [ ] **Step 3: Verificação de tipos** — `npx tsc -b --force` → exit 0 (prova que en/es têm todas as chaves).
- [ ] **Step 4: Commit** — `git commit -m "feat(i18n): dicionarios pt/en/es da fatia do login"`.

---

### Task 3: Provider + `useT` — `src/i18n/IdiomaProvider.tsx`

**Files:** Create `src/i18n/IdiomaProvider.tsx`, `src/i18n/IdiomaProvider.test.tsx`; Modify `src/main.tsx`

**Interfaces:**
- Consumes: `Idioma`, `lerIdioma`, `salvarIdioma` (Task 1); `pt/en/es`, `Dicionario` (Task 2).
- Produces:
  ```ts
  export function IdiomaProvider({ children }: { children: React.ReactNode }): React.JSX.Element
  export function useT(): { idioma: Idioma; setIdioma: (i: Idioma) => void; t: (chave: keyof Dicionario, params?: Record<string, string | number>) => string }
  ```

- [ ] **Step 1: Teste que falha** — `IdiomaProvider.test.tsx`:
```tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdiomaProvider, useT } from './IdiomaProvider'

function Sonda() {
  const { t, setIdioma, idioma } = useT()
  return (
    <div>
      <p>{t('auth.entrar')}</p>
      <span>{idioma}</span>
      <button onClick={() => setIdioma('en')}>en</button>
    </div>
  )
}

describe('useT', () => {
  it('sem provider, cai no default pt', () => {
    render(<Sonda />)
    expect(screen.getByText('Entrar')).toBeInTheDocument()
  })
  it('troca de idioma reflete no t', async () => {
    const u = userEvent.setup()
    render(<IdiomaProvider><Sonda /></IdiomaProvider>)
    expect(screen.getByText('Entrar')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'en' }))
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })
})
```
> `en['auth.entrar']` deve ser `'Sign in'` (Task 2).

- [ ] **Step 2: Rodar e ver falhar** → FAIL.

- [ ] **Step 3: Implementar** — `IdiomaProvider.tsx`:
```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { type Idioma, lerIdioma, salvarIdioma } from './idioma'
import { pt, type Dicionario } from './dicionarios/pt'
import { en } from './dicionarios/en'
import { es } from './dicionarios/es'

const DICTS: Record<Idioma, Dicionario> = { pt, en, es }

function traduzir(idioma: Idioma, chave: keyof Dicionario, params?: Record<string, string | number>): string {
  const bruto = DICTS[idioma][chave] ?? pt[chave]
  if (!params) return bruto
  return bruto.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

type Ctx = {
  idioma: Idioma
  setIdioma: (i: Idioma) => void
  t: (chave: keyof Dicionario, params?: Record<string, string | number>) => string
}

const IdiomaContext = createContext<Ctx>({
  idioma: 'pt',
  setIdioma: () => {},
  t: (chave, params) => traduzir('pt', chave, params),
})

export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>(() => lerIdioma())
  const valor = useMemo<Ctx>(
    () => ({
      idioma,
      setIdioma: (i) => { salvarIdioma(i); setIdiomaState(i) },
      t: (chave, params) => traduzir(idioma, chave, params),
    }),
    [idioma],
  )
  return <IdiomaContext.Provider value={valor}>{children}</IdiomaContext.Provider>
}

export function useT() {
  return useContext(IdiomaContext)
}
```

- [ ] **Step 4: Envolver o app** — em `src/main.tsx`, envolver `<App/>` com `<IdiomaProvider>`.
- [ ] **Step 5: Rodar e ver passar** → PASS; depois `npm test` (tudo verde).
- [ ] **Step 6: Commit** — `git commit -m "feat(i18n): IdiomaProvider + useT (default pt) e wrap no main"`.

---

### Task 4: `SeletorIdioma` + na `TelaAcesso`

**Files:** Create `src/ui/SeletorIdioma.tsx`, `src/ui/SeletorIdioma.test.tsx`; Modify `src/ui/TelaAcesso.tsx`

**Interfaces:** Consumes `useT`, `IDIOMAS`. Produces `export function SeletorIdioma(): JSX.Element`.

- [ ] **Step 1: Teste que falha** — `SeletorIdioma.test.tsx`:
```tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdiomaProvider, useT } from '../i18n/IdiomaProvider'
import { SeletorIdioma } from './SeletorIdioma'

function Espia() {
  const { idioma } = useT()
  return <span data-testid="idioma">{idioma}</span>
}

describe('SeletorIdioma', () => {
  it('troca o idioma ao clicar em EN', async () => {
    const u = userEvent.setup()
    render(<IdiomaProvider><SeletorIdioma /><Espia /></IdiomaProvider>)
    await u.click(screen.getByRole('button', { name: /english|^en$/i }))
    expect(screen.getByTestId('idioma')).toHaveTextContent('en')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL.

- [ ] **Step 3: Implementar** — `SeletorIdioma.tsx` (segmentado PT/EN/ES, estilo das pílulas de período; `aria-pressed` no ativo; `aria-label` de cada botão com o nome do idioma):
```tsx
import { IDIOMAS, type Idioma } from '../i18n/idioma'
import { useT } from '../i18n/IdiomaProvider'

const NOME: Record<Idioma, string> = { pt: 'Português', en: 'English', es: 'Español' }

export function SeletorIdioma() {
  const { idioma, setIdioma } = useT()
  return (
    <div className="flex gap-0.5 rounded-full border border-carvao-700 bg-carvao-900/60 p-0.5">
      {IDIOMAS.map((id) => (
        <button
          key={id}
          onClick={() => setIdioma(id)}
          aria-label={NOME[id]}
          aria-pressed={idioma === id}
          className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors ${
            idioma === id ? 'bg-tinta text-carvao-950' : 'text-tinta-tenue hover:text-tinta'
          }`}
        >
          {id}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Colocar na `TelaAcesso`** — no header (`<header>` com `<Marca/>` e `<ThemeToggle/>`), pôr `<SeletorIdioma/>` ao lado do `ThemeToggle` (agrupar num `flex items-center gap-2`).
- [ ] **Step 5: Rodar e ver passar** → PASS; `npm test`.
- [ ] **Step 6: Commit** — `git commit -m "feat(i18n): SeletorIdioma no cabecalho da tela de acesso"`.

---

### Task 5: Trocar literais por `t(...)` na fatia do acesso

**Files:** Modify `src/ui/TelaAcesso.tsx`, `src/ui/CarrosselBancos.tsx`, `src/ui/Auth.tsx`, `src/ui/RecuperarSenha.tsx`, `src/ui/CampoSenha.tsx`, `src/ui/Rodape.tsx`

**Interfaces:** Consumes `useT`.

- [ ] **Step 1:** Em cada arquivo, `const { t } = useT()` e trocar cada literal pela chave correspondente do dicionário (Task 2). Onde há interpolação, usar `t('chave', { param })`. **NÃO** mexer em `auth-validacao.ts` nem na chamada `mensagemCamposFaltando` (fica pt nesta fatia). `FraseDeslogado` passa a usar `t('acesso.frase1')` + `t('acesso.frase2')`.

- [ ] **Step 2: Rodar os testes atuais** — `npm test`. Os testes de `Auth`, `TelaAcesso`, `RecuperarSenha` devem seguir **verdes em pt** (o default do contexto). Se algum quebrar, o valor pt no dicionário divergiu do literal — corrigir o dicionário para bater **exatamente**.

- [ ] **Step 3: Typecheck + build** — `npx tsc -b --force` (exit 0), `npm run build`.
- [ ] **Step 4: Commit** — `git commit -m "feat(i18n): tela de acesso traduzida via t() (pt identico)"`.

---

### Task 6: Teste de troca de idioma na tela real + verificação final + docs

**Files:** Create/'`src/ui/Auth.i18n.test.tsx`'; Modify `README.md`, `docs/ESTADO-ATUAL.md`

- [ ] **Step 1: Teste** — renderiza `Auth` dentro de `IdiomaProvider`, troca para `en` (via `setIdioma` de um botão auxiliar ou o `SeletorIdioma`) e afirma um texto traduzido (ex.: "Sign in"), provando a fatia ponta a ponta.

- [ ] **Step 2: Verificação** — `npm test && npm run build && npm run lint && npx tsc -b --force` — tudo verde/OK.

- [ ] **Step 3: Docs** — `ESTADO-ATUAL.md`: registrar que o i18n começou (mecanismo + fatia do login), com as fatias seguintes listadas (dashboard — inclui moeda/datas/categorias — depois Documentos/Tutorial/etc.). `README.md`: mencionar o seletor de idioma (pt/en/es) em desenvolvimento por fatias. Atualizar contagem de testes.

- [ ] **Step 4: Commit e push** — `git push origin main`.

---

## Notas
- **Revisão das traduções:** en/es são minhas; o usuário (nativo pt) confere depois. pt é a verdade.
- **Próximas fatias:** dashboard (aqui entram **moeda/datas por locale** e a decisão dos **nomes das 30 categorias**), depois modais e tutorial.
