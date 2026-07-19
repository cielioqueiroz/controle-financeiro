# Recuperação de senha — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a quem esqueceu a senha um caminho de volta, dentro do próprio card de acesso, usando os endpoints de reset do Neon Auth.

**Architecture:** Um módulo HTTP puro (`lib/recuperar-senha.ts`) fala com o `VITE_NEON_AUTH_URL`; um componente (`ui/RecuperarSenha.tsx`) desenha os dois passos dentro do card do `Auth`; as regras de validação e a leitura do token são funções puras, testadas sem navegador. O `App` passa a olhar a URL para decidir se mostra o formulário de nova senha.

**Tech Stack:** React 19, TypeScript, Vitest 4 + jsdom, @testing-library/react, sonner (toasts), Tailwind v4.

Spec: [`docs/superpowers/specs/2026-07-19-recuperacao-de-senha-design.md`](../specs/2026-07-19-recuperacao-de-senha-design.md)

## Global Constraints

- **Sem router.** O projeto não tem um. Telas são escolhidas por estado no `App.tsx`.
- **`neon` pode ser `null`.** O app funciona sem Neon (modo "importa e vê"). Todo caminho novo checa isso, e a checagem vem **depois** da validação de campos — nunca no topo da função, que foi um bug já corrigido.
- **Prefixo de `localStorage` é `cf:`** (`cf:apelido`, `cf:tutorial-visto`). A chave nova é **`cf:email-reset`**. O spec dizia `capital:`; a convenção do código vence.
- **Textos em português**, tom do app: direto, sem jargão, sem exclamação.
- **Não revelar se um e-mail tem conta.** O endpoint responde 200 sempre, por design. A UI nunca afirma "e-mail enviado".
- **Testes de componente importam `@testing-library/jest-dom/vitest` localmente** (ainda não é `setupFiles` global).
- **`vi.mock('../lib/neon', ...)` no topo** de qualquer teste que renderize `Auth`.
- Comandos: `npm test`, `npm run build`, `npm run lint`.
- Ao final, `npm test` deve passar de 211 para o novo total, com **zero** falhas.

---

## Task 0: Confirmar o formato do link no e-mail real

**Bloqueia todas as demais.** O nome do parâmetro (`?token=`) é o padrão do Better Auth, mas **nunca foi confirmado**. Se vier como fragmento (`#token=`) ou com outro nome, a Task 2 muda de forma.

**Files:** nenhum. É verificação manual.

- [ ] **Step 1: Disparar um pedido real**

Com o `VITE_NEON_AUTH_URL` do projeto (veja `.env`), rodar:

```bash
curl -s -X POST "$VITE_NEON_AUTH_URL/request-password-reset" \
  -H 'Content-Type: application/json' \
  -d '{"email":"teste.migracao@exemplo.com","redirectTo":"https://capital-financeiro.vercel.app/"}'
```

Esperado: `{"status":true,"message":"If this email exists…"}`

- [ ] **Step 2: Abrir o e-mail recebido e copiar o link**

Remetente: `auth@mail.myneon.app`.

- [ ] **Step 3: Registrar o formato encontrado**

Anotar aqui, no plano, a URL recebida com o token mascarado. Exemplo do que se espera:
`https://capital-financeiro.vercel.app/?token=ABC…`

**Se o parâmetro NÃO for `?token=`:** pare e ajuste a Task 2 (`lerTokenDaUrl`) e a Task 6 antes de continuar. Se for um fragmento (`#token=`), a função precisa receber `window.location.hash` em vez de `search`.

- [ ] **Step 4: Commit da anotação**

```bash
git add docs/superpowers/plans/2026-07-19-recuperacao-de-senha.md
git commit -m "docs: confirma o formato do link de reset no e-mail real"
```

---

## Task 1: Validação da nova senha (pura)

**Files:**
- Modify: `src/ui/auth-validacao.ts`
- Test: `src/ui/auth-validacao.test.ts` (existente — acrescentar um `describe`)

**Interfaces:**
- Consumes: nada.
- Produces: `validarNovaSenha(senha: string, confirmacao: string): string | null` — devolve a mensagem de erro, ou `null` quando está tudo certo.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `src/ui/auth-validacao.test.ts` (e incluir `validarNovaSenha` no `import` que já existe no topo do arquivo):

```ts
describe('validarNovaSenha', () => {
  it('recusa senha vazia', () => {
    expect(validarNovaSenha('', '')).toBe('Digite a nova senha.')
  })

  it('recusa senha com menos de 8 caracteres', () => {
    expect(validarNovaSenha('abc123', 'abc123')).toBe(
      'A senha precisa ter ao menos 8 caracteres.',
    )
  })

  it('recusa confirmação vazia quando a senha foi preenchida', () => {
    expect(validarNovaSenha('senhaboa123', '')).toBe('Repita a nova senha para confirmar.')
  })

  it('recusa senhas diferentes', () => {
    expect(validarNovaSenha('senhaboa123', 'senhaboa124')).toBe('As senhas não coincidem.')
  })

  // Espaço é caractere válido de senha: não aparar.
  it('trata espaço como caractere significativo', () => {
    expect(validarNovaSenha('senha com espaco', 'senha com espaco')).toBeNull()
    expect(validarNovaSenha(' 12345678', '12345678')).toBe('As senhas não coincidem.')
  })

  it('aceita senhas iguais com 8 caracteres ou mais', () => {
    expect(validarNovaSenha('senhaboa123', 'senhaboa123')).toBeNull()
  })

  // Vazio vence curta, que vence divergente: uma mensagem de cada vez,
  // sempre a mais fundamental, como já faz camposFaltando.
  it('prioriza vazia sobre curta', () => {
    expect(validarNovaSenha('', 'abc')).toBe('Digite a nova senha.')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/auth-validacao.test.ts`
Expected: FAIL — `validarNovaSenha is not a function` (ou erro de tipo no import).

- [ ] **Step 3: Implementar**

Acrescentar ao fim de `src/ui/auth-validacao.ts`:

```ts
/** Valida o par senha/confirmação da redefinição. Devolve a mensagem de erro
 *  ou null. A ordem importa: vazia vence curta, que vence divergente — uma
 *  queixa por vez, sempre a mais fundamental. A senha não é aparada, porque
 *  espaço é caractere válido. */
export function validarNovaSenha(senha: string, confirmacao: string): string | null {
  if (!senha) return 'Digite a nova senha.'
  if (senha.length < 8) return 'A senha precisa ter ao menos 8 caracteres.'
  if (!confirmacao) return 'Repita a nova senha para confirmar.'
  if (senha !== confirmacao) return 'As senhas não coincidem.'
  return null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/ui/auth-validacao.test.ts`
Expected: PASS, todos os testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add src/ui/auth-validacao.ts src/ui/auth-validacao.test.ts
git commit -m "feat: valida o par senha/confirmacao da redefinicao"
```

---

## Task 2: Leitura do token da URL (pura)

**Files:**
- Create: `src/lib/url-token.ts`
- Test: `src/lib/url-token.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `lerTokenDaUrl(search: string): string | null`
  - `limparTokenDaUrl(): void` — remove o parâmetro da barra de endereços via `history.replaceState`, sem recarregar.

> Se a Task 0 revelou fragmento em vez de query, troque `search` por `hash` aqui e no chamador da Task 6, e ajuste os testes.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/url-token.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { lerTokenDaUrl } from './url-token'

describe('lerTokenDaUrl', () => {
  it('extrai o token da query string', () => {
    expect(lerTokenDaUrl('?token=abc123')).toBe('abc123')
  })

  it('extrai o token quando há outros parâmetros', () => {
    expect(lerTokenDaUrl('?foo=1&token=abc123&bar=2')).toBe('abc123')
  })

  it('funciona sem a interrogação inicial', () => {
    expect(lerTokenDaUrl('token=abc123')).toBe('abc123')
  })

  it('devolve null quando não há token', () => {
    expect(lerTokenDaUrl('?foo=1')).toBeNull()
  })

  it('devolve null com query vazia', () => {
    expect(lerTokenDaUrl('')).toBeNull()
    expect(lerTokenDaUrl('?')).toBeNull()
  })

  // ?token= sem valor é lixo, não um token: não pode abrir o formulário.
  it('devolve null quando o token está vazio', () => {
    expect(lerTokenDaUrl('?token=')).toBeNull()
    expect(lerTokenDaUrl('?token=%20')).toBeNull()
  })

  it('decodifica valor percent-encoded', () => {
    expect(lerTokenDaUrl('?token=a%2Bb')).toBe('a+b')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/url-token.test.ts`
Expected: FAIL — não consegue resolver `./url-token`.

- [ ] **Step 3: Implementar**

Criar `src/lib/url-token.ts`:

```ts
/** O token de redefinição de senha chega pela URL, no link do e-mail.
 *  Isolado aqui para ser testável sem navegador — e porque o formato é do
 *  Better Auth, não nosso: se ele mudar, muda só este arquivo. */

const PARAMETRO = 'token'

/** Token da query string, ou null. Aceita com ou sem '?' inicial.
 *  Valor em branco conta como ausente: '?token=' é lixo, não credencial. */
export function lerTokenDaUrl(search: string): string | null {
  const token = new URLSearchParams(search).get(PARAMETRO)
  return token?.trim() ? token : null
}

/** Tira o token da barra de endereços sem recarregar a página. Sem isto, um
 *  F5 reenviaria um token já gasto e o usuário veria um erro que não é dele. */
export function limparTokenDaUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete(PARAMETRO)
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/url-token.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/url-token.ts src/lib/url-token.test.ts
git commit -m "feat: le e limpa o token de redefinicao na URL"
```

---

## Task 3: Módulo HTTP do reset

**Files:**
- Create: `src/lib/recuperar-senha.ts`
- Test: `src/lib/recuperar-senha.test.ts`

**Interfaces:**
- Consumes: nada dos outros arquivos.
- Produces:
  - `type ResultadoReset = { ok: true } | { ok: false; erro: string }`
  - `pedirLink(email: string, redirectTo: string): Promise<ResultadoReset>`
  - `redefinirSenha(token: string, novaSenha: string): Promise<ResultadoReset>`

Ambas **nunca lançam**: devolvem `{ ok: false, erro }` com a mensagem já em português, pronta para o toast. O componente não decide texto de erro de rede.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/recuperar-senha.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// O módulo lê a URL do auth no import; fixamos antes de importá-lo.
vi.mock('./neon', () => ({ neon: null, neonConfigurado: true }))
vi.stubEnv('VITE_NEON_AUTH_URL', 'https://auth.exemplo.test')

const { pedirLink, redefinirSenha } = await import('./recuperar-senha')

function respostaFake(status: number, corpo: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pedirLink', () => {
  it('faz POST em /request-password-reset com email e redirectTo', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(200, { status: true }))

    const r = await pedirLink('alguem@exemplo.com', 'https://app.test/')

    expect(r).toEqual({ ok: true })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://auth.exemplo.test/request-password-reset')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'alguem@exemplo.com',
      redirectTo: 'https://app.test/',
    })
  })

  it('devolve erro amigável quando a rede falha', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const r = await pedirLink('alguem@exemplo.com', 'https://app.test/')

    expect(r).toEqual({
      ok: false,
      erro: 'Não consegui falar com o servidor. Tente de novo.',
    })
  })

  it('devolve erro quando o servidor recusa', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(500))

    const r = await pedirLink('alguem@exemplo.com', 'https://app.test/')

    expect(r.ok).toBe(false)
  })
})

describe('redefinirSenha', () => {
  it('faz POST em /reset-password com token e newPassword', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(200, { status: true }))

    const r = await redefinirSenha('tok123', 'senhaboa123')

    expect(r).toEqual({ ok: true })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://auth.exemplo.test/reset-password')
    expect(JSON.parse(init?.body as string)).toEqual({
      token: 'tok123',
      newPassword: 'senhaboa123',
    })
  })

  // 400 aqui quer dizer token gasto ou expirado. A mensagem precisa dizer
  // isso, porque a saída é pedir outro link — não tentar de novo.
  it('traduz 400 como link expirado ou já usado', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaFake(400, { message: 'invalid token' }))

    const r = await redefinirSenha('tok123', 'senhaboa123')

    expect(r).toEqual({ ok: false, erro: 'Este link expirou ou já foi usado.' })
  })

  it('devolve erro amigável quando a rede falha', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const r = await redefinirSenha('tok123', 'senhaboa123')

    expect(r).toEqual({
      ok: false,
      erro: 'Não consegui falar com o servidor. Tente de novo.',
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/recuperar-senha.test.ts`
Expected: FAIL — não consegue resolver `./recuperar-senha`.

- [ ] **Step 3: Implementar**

Criar `src/lib/recuperar-senha.ts`:

```ts
/** Recuperação de senha do Neon Auth (Better Auth).
 *
 *  O cliente neon-js NÃO expõe estes métodos, então são chamadas HTTP
 *  diretas. Sondagem de 2026-07-18 contra o servidor real:
 *    POST /forget-password        → 404, não existe
 *    POST /request-password-reset → 200 sempre, mesmo para e-mail sem conta
 *    POST /reset-password         → exige { token, newPassword }
 *
 *  Nenhuma função aqui lança: todas devolvem ResultadoReset com a mensagem
 *  já em português, para o componente só exibir. */

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
const authUrl = env.VITE_NEON_AUTH_URL

export type ResultadoReset = { ok: true } | { ok: false; erro: string }

const ERRO_REDE = 'Não consegui falar com o servidor. Tente de novo.'
const ERRO_TOKEN = 'Este link expirou ou já foi usado.'

async function postar(caminho: string, corpo: unknown): Promise<Response> {
  return fetch(`${authUrl}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

/** Pede o e-mail com o link. O servidor responde 200 mesmo quando a conta
 *  não existe — de propósito, para não revelar quem tem cadastro. Portanto
 *  ok:true significa "pedido aceito", NUNCA "e-mail enviado". */
export async function pedirLink(email: string, redirectTo: string): Promise<ResultadoReset> {
  try {
    const r = await postar('/request-password-reset', { email, redirectTo })
    if (!r.ok) return { ok: false, erro: ERRO_REDE }
    return { ok: true }
  } catch {
    return { ok: false, erro: ERRO_REDE }
  }
}

/** Troca a senha usando o token do e-mail. 400 aqui é token gasto ou
 *  expirado — a saída é pedir outro link, não repetir a tentativa. */
export async function redefinirSenha(
  token: string,
  novaSenha: string,
): Promise<ResultadoReset> {
  try {
    const r = await postar('/reset-password', { token, newPassword: novaSenha })
    if (r.status === 400) return { ok: false, erro: ERRO_TOKEN }
    if (!r.ok) return { ok: false, erro: ERRO_REDE }
    return { ok: true }
  } catch {
    return { ok: false, erro: ERRO_REDE }
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/recuperar-senha.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recuperar-senha.ts src/lib/recuperar-senha.test.ts
git commit -m "feat: modulo HTTP do reset de senha do Neon Auth"
```

---

## Task 4: Guardar e recuperar o e-mail do pedido

O link do e-mail traz só o token; o `/reset-password` não devolve o e-mail. Sem e-mail não há `signIn.email` — então o login automático depende de lembrarmos quem pediu.

**Files:**
- Modify: `src/lib/perfil.ts`
- Test: `src/lib/perfil.test.ts` (criar se não existir; veja o Step 1)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `guardarEmailReset(email: string): void`
  - `lerEmailReset(): string | null`
  - `esquecerEmailReset(): void`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/perfil.test.ts` (ou acrescentar o `describe` se o arquivo já existir — confira antes com `ls src/lib/`):

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { guardarEmailReset, lerEmailReset, esquecerEmailReset } from './perfil'

beforeEach(() => {
  localStorage.clear()
})

describe('e-mail do pedido de reset', () => {
  it('devolve null quando nada foi guardado', () => {
    expect(lerEmailReset()).toBeNull()
  })

  it('guarda e devolve o e-mail', () => {
    guardarEmailReset('alguem@exemplo.com')
    expect(lerEmailReset()).toBe('alguem@exemplo.com')
  })

  it('apara espaços ao guardar', () => {
    guardarEmailReset('  alguem@exemplo.com  ')
    expect(lerEmailReset()).toBe('alguem@exemplo.com')
  })

  it('esquece o e-mail', () => {
    guardarEmailReset('alguem@exemplo.com')
    esquecerEmailReset()
    expect(lerEmailReset()).toBeNull()
  })

  it('guardar vazio não deixa lixo', () => {
    guardarEmailReset('   ')
    expect(lerEmailReset()).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/perfil.test.ts`
Expected: FAIL — `guardarEmailReset is not a function`.

- [ ] **Step 3: Implementar**

Em `src/lib/perfil.ts`, acrescentar a constante junto das outras chaves (linha 6-7) e as funções ao fim do arquivo:

```ts
const CHAVE_EMAIL_RESET = 'cf:email-reset'
```

```ts
/** Quem pede o link de redefinição fica anotado aqui, porque o link do
 *  e-mail traz só o token — sem o e-mail não dá para fazer o login
 *  automático depois. Quem abrir o link em OUTRO aparelho não terá esta
 *  anotação, e cairá no login normal; é o limite do protocolo, não um bug. */
export function guardarEmailReset(email: string): void {
  const e = email.trim()
  if (e) localStorage.setItem(CHAVE_EMAIL_RESET, e)
  else localStorage.removeItem(CHAVE_EMAIL_RESET)
}

export function lerEmailReset(): string | null {
  return localStorage.getItem(CHAVE_EMAIL_RESET)
}

export function esquecerEmailReset(): void {
  localStorage.removeItem(CHAVE_EMAIL_RESET)
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/perfil.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfil.ts src/lib/perfil.test.ts
git commit -m "feat: lembra o e-mail que pediu o link de redefinicao"
```

---

## Task 5: Componente RecuperarSenha

**Files:**
- Create: `src/ui/RecuperarSenha.tsx`
- Test: `src/ui/RecuperarSenha.test.tsx`

**Interfaces:**
- Consumes: `pedirLink`, `redefinirSenha`, `ResultadoReset` (Task 3); `validarNovaSenha` (Task 1); `guardarEmailReset`, `lerEmailReset`, `esquecerEmailReset` (Task 4); `limparTokenDaUrl` (Task 2).
- Produces:

```ts
type Props = {
  /** Com token, mostra o passo de nova senha. Sem, o de pedir o link. */
  token: string | null
  /** Voltar ao card de login. Recebe o e-mail a preencher, se houver. */
  onVoltar: (email?: string) => void
  /** Redefiniu e entrou: o App deve re-checar a sessão. */
  onAutenticado: () => void
}
export function RecuperarSenha(props: Props): React.ReactElement
```

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/ui/RecuperarSenha.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecuperarSenha } from './RecuperarSenha'
import { Notificacoes } from './Notificacoes'

vi.mock('../lib/neon', () => ({ neon: null, neonConfigurado: false }))
vi.mock('../lib/recuperar-senha', () => ({
  pedirLink: vi.fn(),
  redefinirSenha: vi.fn(),
}))

const { pedirLink, redefinirSenha } = await import('../lib/recuperar-senha')

function montar(token: string | null = null) {
  return render(
    <>
      <Notificacoes />
      <RecuperarSenha token={token} onVoltar={() => {}} onAutenticado={() => {}} />
    </>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('RecuperarSenha — pedir o link', () => {
  it('não chama a rede com e-mail vazio', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByText(/preencha seu e-mail/i)).toBeInTheDocument()
    expect(pedirLink).not.toHaveBeenCalled()
  })

  it('não chama a rede com e-mail malformado', async () => {
    const usuario = userEvent.setup()
    montar()

    await usuario.type(screen.getByPlaceholderText('seu@email.com'), 'nao-e-email')
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByText(/não parece válido/i)).toBeInTheDocument()
    expect(pedirLink).not.toHaveBeenCalled()
  })

  // O endpoint responde 200 mesmo sem conta. Confirmar o envio revelaria
  // quem tem cadastro — a mensagem tem que ser condicional.
  it('após enviar, não afirma que o e-mail existe', async () => {
    const usuario = userEvent.setup()
    vi.mocked(pedirLink).mockResolvedValue({ ok: true })
    montar()

    await usuario.type(screen.getByPlaceholderText('seu@email.com'), 'alguem@exemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByText(/se houver conta com esse e-mail/i)).toBeInTheDocument()
  })

  it('guarda o e-mail no localStorage ao pedir o link', async () => {
    const usuario = userEvent.setup()
    vi.mocked(pedirLink).mockResolvedValue({ ok: true })
    montar()

    await usuario.type(screen.getByPlaceholderText('seu@email.com'), 'alguem@exemplo.com')
    await usuario.click(screen.getByRole('button', { name: 'Enviar link' }))

    await screen.findByText(/se houver conta com esse e-mail/i)
    expect(localStorage.getItem('cf:email-reset')).toBe('alguem@exemplo.com')
  })
})

describe('RecuperarSenha — definir a nova senha', () => {
  it('com token, mostra os dois campos de senha', () => {
    montar('tok123')

    expect(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('repita a nova senha')).toBeInTheDocument()
  })

  it('não chama a rede quando as senhas diferem', async () => {
    const usuario = userEvent.setup()
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa124')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument()
    expect(redefinirSenha).not.toHaveBeenCalled()
  })

  it('envia token e senha quando o formulário está válido', async () => {
    const usuario = userEvent.setup()
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(redefinirSenha).toHaveBeenCalledWith('tok123', 'senhaboa123')
  })

  it('token expirado mostra o convite a pedir outro link', async () => {
    const usuario = userEvent.setup()
    vi.mocked(redefinirSenha).mockResolvedValue({
      ok: false,
      erro: 'Este link expirou ou já foi usado.',
    })
    montar('tok123')

    await usuario.type(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)'), 'senhaboa123')
    await usuario.type(screen.getByPlaceholderText('repita a nova senha'), 'senhaboa123')
    await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByText('Este link expirou ou já foi usado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pedir um novo link' })).toBeInTheDocument()
  })

  // O olho é type="button": clicar não pode submeter o formulário.
  it('o olho de revelar não submete o formulário', async () => {
    const usuario = userEvent.setup()
    montar('tok123')

    await usuario.click(screen.getAllByRole('button', { name: 'Mostrar senha' })[0])

    await new Promise((r) => setTimeout(r, 100))
    expect(redefinirSenha).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/RecuperarSenha.test.tsx`
Expected: FAIL — não consegue resolver `./RecuperarSenha`.

- [ ] **Step 3: Implementar**

Criar `src/ui/RecuperarSenha.tsx`:

```tsx
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { neon } from '../lib/neon'
import { pedirLink, redefinirSenha } from '../lib/recuperar-senha'
import { guardarEmailReset, lerEmailReset, esquecerEmailReset } from '../lib/perfil'
import { limparTokenDaUrl } from '../lib/url-token'
import { validarNovaSenha } from './auth-validacao'

type Props = {
  /** Com token, mostra o passo de nova senha. Sem, o de pedir o link. */
  token: string | null
  /** Voltar ao card de login, com o e-mail a preencher, se houver. */
  onVoltar: (email?: string) => void
  /** Redefiniu e entrou: o App deve re-checar a sessão. */
  onAutenticado: () => void
}

const CAMPO =
  'w-full rounded-xl border border-carvao-700 bg-carvao-950 px-4 py-3 text-sm text-tinta outline-none transition-all placeholder:text-tinta-tenue hover:border-carvao-600 focus:-translate-y-px focus:border-marca'

const BOTAO =
  'w-full rounded-xl bg-tinta px-4 py-3 text-sm font-semibold text-carvao-950 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 active:translate-y-0 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none'

export function RecuperarSenha({ token, onVoltar, onAutenticado }: Props) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [tokenMorto, setTokenMorto] = useState(false)

  const refEmail = useRef<HTMLInputElement>(null)
  const refSenha = useRef<HTMLInputElement>(null)

  async function enviarLink(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Preencha seu e-mail para receber o link.')
      refEmail.current?.focus()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Esse e-mail não parece válido.')
      refEmail.current?.focus()
      return
    }

    setOcupado(true)
    // Guardado ANTES da resposta: é o que permite o login automático quando
    // o link for aberto neste mesmo navegador.
    guardarEmailReset(email)
    const r = await pedirLink(email.trim(), window.location.origin + '/')
    setOcupado(false)

    if (!r.ok) {
      toast.error(r.erro)
      return
    }
    setEnviado(true)
    // O servidor responde 200 mesmo sem conta, de propósito. Afirmar o envio
    // revelaria quem tem cadastro — daí o "se houver".
    toast.success('Se houver conta com esse e-mail, o link já está a caminho.', {
      description: 'Confira também o spam.',
    })
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return

    const erro = validarNovaSenha(senha, confirmacao)
    if (erro) {
      toast.error(erro)
      refSenha.current?.focus()
      return
    }

    setOcupado(true)
    const r = await redefinirSenha(token, senha)

    if (!r.ok) {
      setOcupado(false)
      toast.error(r.erro)
      if (/expirou/.test(r.erro)) setTokenMorto(true)
      return
    }

    // Token gasto: fora da URL antes de qualquer coisa, para um F5 não
    // reenviá-lo e produzir um erro que não é do usuário.
    limparTokenDaUrl()

    const emailSalvo = lerEmailReset()
    esquecerEmailReset()

    if (emailSalvo && neon) {
      const { error } = await neon.auth.signIn.email({ email: emailSalvo, password: senha })
      setOcupado(false)
      if (!error) {
        toast.success('Senha alterada. Bem-vindo de volta.')
        onAutenticado()
        return
      }
      toast.success('Senha alterada. Entre com a senha nova.')
      onVoltar(emailSalvo)
      return
    }

    // Sem e-mail guardado: o link foi aberto em outro aparelho. Não dá para
    // fazer login automático — só avisar e mandar ao login.
    setOcupado(false)
    toast.success('Senha alterada. Entre com a senha nova.')
    onVoltar(emailSalvo ?? undefined)
  }

  if (token && !tokenMorto) {
    return (
      <div>
        <h2 className="text-center font-display text-2xl text-tinta">Nova senha</h2>
        <p className="mt-2 text-center text-sm text-tinta-fraca">
          Escolha uma senha e repita para confirmar.
        </p>

        <form onSubmit={salvarSenha} noValidate className="mt-6 space-y-3">
          <CampoSenha
            refCampo={refSenha}
            valor={senha}
            aoMudar={setSenha}
            visivel={verSenha}
            alternar={() => setVerSenha(!verSenha)}
            placeholder="nova senha (mín. 8 caracteres)"
          />
          <CampoSenha
            valor={confirmacao}
            aoMudar={setConfirmacao}
            visivel={verSenha}
            alternar={() => setVerSenha(!verSenha)}
            placeholder="repita a nova senha"
          />
          <button type="submit" disabled={ocupado} className={BOTAO}>
            {ocupado ? '…' : 'Salvar nova senha'}
          </button>
        </form>

        <button
          onClick={() => onVoltar()}
          className="mt-5 w-full text-center text-xs text-tinta-tenue hover:text-tinta"
        >
          ‹ Voltar ao login
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-center font-display text-2xl text-tinta">Recuperar acesso</h2>
      <p className="mt-2 text-center text-sm text-tinta-fraca">
        {tokenMorto
          ? 'Peça um link novo para continuar.'
          : 'Enviamos um link para o e-mail cadastrado.'}
      </p>

      <form onSubmit={enviarLink} noValidate className="mt-6 space-y-3">
        <input
          type="email"
          ref={refEmail}
          required
          placeholder="seu@email.com"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className={CAMPO}
        />
        <button type="submit" disabled={ocupado} className={BOTAO}>
          {ocupado ? '…' : tokenMorto ? 'Pedir um novo link' : enviado ? 'Enviar de novo' : 'Enviar link'}
        </button>
      </form>

      <button
        onClick={() => onVoltar()}
        className="mt-5 w-full text-center text-xs text-tinta-tenue hover:text-tinta"
      >
        ‹ Voltar ao login
      </button>
    </div>
  )
}

/** Campo de senha com o olho de revelar. O botão é type="button": dentro de
 *  um <form>, o padrão seria submit, e clicar no olho enviaria o formulário. */
function CampoSenha({
  refCampo,
  valor,
  aoMudar,
  visivel,
  alternar,
  placeholder,
}: {
  refCampo?: React.RefObject<HTMLInputElement | null>
  valor: string
  aoMudar: (v: string) => void
  visivel: boolean
  alternar: () => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <input
        ref={refCampo}
        type={visivel ? 'text' : 'password'}
        required
        minLength={8}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className={CAMPO + ' pr-11'}
      />
      <button
        type="button"
        onClick={alternar}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-tinta-tenue transition-colors hover:text-tinta"
      >
        <IconeOlho aberto={visivel} />
      </button>
    </div>
  )
}

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

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/ui/RecuperarSenha.test.tsx`
Expected: PASS, 9 testes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/RecuperarSenha.tsx src/ui/RecuperarSenha.test.tsx
git commit -m "feat: componente dos dois passos da recuperacao de senha"
```

---

## Task 6: Ligar no Auth e no App

**Files:**
- Modify: `src/ui/Auth.tsx`
- Modify: `src/App.tsx`
- Test: `src/ui/Auth.test.tsx` (acrescentar um `describe`)

**Interfaces:**
- Consumes: `RecuperarSenha` (Task 5), `lerTokenDaUrl` (Task 2).
- Produces: `Auth` ganha a prop opcional `tokenReset?: string | null`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `src/ui/Auth.test.tsx`:

```tsx
describe('Auth — porta de entrada da recuperação', () => {
  it('o link "Esqueceu a senha?" troca o card para o pedido de link', async () => {
    const usuario = userEvent.setup()
    render(<Auth onAutenticado={() => {}} />)

    await usuario.click(screen.getByRole('button', { name: /esqueceu a senha/i }))

    expect(screen.getByRole('button', { name: 'Enviar link' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument()
  })

  it('voltar ao login restaura o formulário de entrar', async () => {
    const usuario = userEvent.setup()
    render(<Auth onAutenticado={() => {}} />)

    await usuario.click(screen.getByRole('button', { name: /esqueceu a senha/i }))
    await usuario.click(screen.getByRole('button', { name: /voltar ao login/i }))

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('com tokenReset, abre direto no formulário de nova senha', () => {
    render(<Auth onAutenticado={() => {}} tokenReset="tok123" />)

    expect(screen.getByPlaceholderText('nova senha (mín. 8 caracteres)')).toBeInTheDocument()
  })

  // No modo criar, oferecer "esqueceu a senha?" não faz sentido: ainda não
  // existe senha para esquecer.
  it('o link não aparece no modo criar', async () => {
    const usuario = userEvent.setup()
    render(<Auth onAutenticado={() => {}} />)

    await usuario.click(screen.getByRole('button', { name: 'Não tem conta? Criar uma' }))

    expect(screen.queryByRole('button', { name: /esqueceu a senha/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/Auth.test.tsx`
Expected: FAIL — não encontra o botão "Esqueceu a senha?".

- [ ] **Step 3: Implementar no Auth.tsx**

3a. Acrescentar ao import block do topo:

```tsx
import { RecuperarSenha } from './RecuperarSenha'
```

3b. Estender o tipo `Props` (linha 9-12):

```tsx
type Props = {
  /** Chamado após login/cadastro bem-sucedido, para o App re-checar a sessão. */
  onAutenticado: () => void
  /** Token vindo do link do e-mail. Presente → abre direto a nova senha. */
  tokenReset?: string | null
}
```

3c. Trocar a assinatura e o `useState` do modo (linhas 17-18):

```tsx
export function Auth({ onAutenticado, tokenReset }: Props) {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'recuperar'>(
    tokenReset ? 'recuperar' : 'entrar',
  )
```

3d. Dentro do `<motion.div>`, logo **depois** do bloco da `<Marca />` (após a linha 120), inserir o desvio:

```tsx
        {modo === 'recuperar' ? (
          <RecuperarSenha
            token={tokenReset ?? null}
            onVoltar={(emailVolta) => {
              if (emailVolta) setEmail(emailVolta)
              setModo('entrar')
            }}
            onAutenticado={onAutenticado}
          />
        ) : (
          <>
```

E fechar o `</>` e o `)}` imediatamente antes do `</motion.div>` de fechamento (linha 217), envolvendo todo o resto do card — do `<h2>` até o botão "Não tem conta? Criar uma".

3e. Acrescentar o link, logo **depois** do `</form>` (linha 190), dentro do fragmento:

```tsx
      {modo === 'entrar' && (
        <button
          type="button"
          onClick={() => setModo('recuperar')}
          className="mt-3 w-full text-center text-xs text-tinta-tenue hover:text-tinta"
        >
          Esqueceu a senha?
        </button>
      )}
```

> Cuidado com o `modo === 'entrar' ? 'Entrar' : 'Criar conta'` nas linhas 123 e 188: agora há um terceiro modo. Como o bloco inteiro só renderiza quando o modo **não** é `recuperar`, os ternários continuam corretos — mas o TypeScript pode reclamar do tipo. Se reclamar, deixe explícito com `modo === 'criar' ? 'Criar conta' : 'Entrar'`.

- [ ] **Step 4: Implementar no App.tsx**

4a. Acrescentar ao import block:

```tsx
import { lerTokenDaUrl } from './lib/url-token'
```

4b. Logo após os `useState` (após a linha 39), acrescentar:

```tsx
  // Lido uma vez, na montagem. Quem clica no link do e-mail quer redefinir,
  // mesmo já tendo sessão ativa — por isso o token vence o `logado` abaixo.
  const [tokenReset] = useState(() => lerTokenDaUrl(window.location.search))
```

4c. Trocar a linha do `precisaLogin` (linha 116):

```tsx
  // Com Neon configurado e sem login → tela de entrar. Token de redefinição
  // na URL também leva ao card, mesmo com sessão ativa.
  const precisaLogin = neonConfigurado && (!logado || Boolean(tokenReset))
```

4d. Trocar a renderização do `Auth` (linha 203):

```tsx
          <Auth onAutenticado={checarSessao} tokenReset={tokenReset} />
```

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS. Contagem esperada: **211 + 7 (Task 1) + 7 (Task 2) + 6 (Task 3) + 5 (Task 4) + 9 (Task 5) + 4 (Task 6) = 249 testes**, 26 arquivos, zero falhas. Se o número divergir, conte de novo antes de seguir — não arredonde.

- [ ] **Step 6: Build e lint**

Run: `npm run build && npm run lint`
Expected: ambos verdes. O `tsc -b` é onde aparece qualquer erro do terceiro modo no `Auth.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/ui/Auth.tsx src/ui/Auth.test.tsx src/App.tsx
git commit -m "feat: liga a recuperacao de senha no card de acesso"
```

---

## Task 7: Verificação no navegador e no servidor real

Nenhum teste acima toca o Neon de verdade. Esta task é o que separa "compila" de "funciona" — e o handoff registra que **build verde não é runtime verde** neste projeto.

**Files:** nenhum (só a documentação no fim).

- [ ] **Step 1: Reiniciar o dev server**

Vite não recarrega bem quando arquivos nascem. Como criamos quatro:

```bash
npm run dev
```

E no navegador, `Ctrl+Shift+R`.

- [ ] **Step 2: Medir o overflow**

Run: `python scripts/medir-overflow.py`
Expected: sem rolagem lateral. (O medidor só reprova rolagem **lateral**; vertical é normal.)

- [ ] **Step 3: Pedir o link com a conta de teste**

No app: "Esqueceu a senha?" → `teste.migracao@exemplo.com` → Enviar link.
Esperado: toast condicional ("se houver conta…"), e o e-mail chega de `auth@mail.myneon.app`.

Se der `403 INVALID_CALLBACKURL` ou similar: o `redirectTo` não está nos Domains do Neon Auth (*Neon → Auth → Configuration → Domains*). `Allow Localhost` cobre o dev.

- [ ] **Step 4: Redefinir e conferir o login automático**

Abrir o link **no mesmo navegador** → formulário de nova senha → senha nova duas vezes → Salvar.
Esperado: entra direto no dashboard, e o `?token=` some da barra de endereços.

- [ ] **Step 5: Conferir o caminho sem e-mail guardado**

Pedir outro link. Antes de abri-lo, limpar a chave no console: `localStorage.removeItem('cf:email-reset')`.
Esperado: a senha troca, o toast diz "Entre com a senha nova", e o card volta ao login.

- [ ] **Step 6: Conferir o token gasto**

Abrir de novo o link do Step 4 (já usado).
Esperado: "Este link expirou ou já foi usado." e o botão **Pedir um novo link**.

- [ ] **Step 7: Aproveitar a sessão para o item 5 da fila**

Já logado, conferir as duas features que nunca foram validadas contra o banco:
o **filtro por banco** (Total geral / Nubank / Bradesco) e as **categorias personalizadas** (criar categoria no editor de compra). Anotar o resultado.

- [ ] **Step 8: Atualizar o ESTADO-ATUAL e commitar**

Em `docs/ESTADO-ATUAL.md`: mover a recuperação de senha da fila para "Pronto e verificado", registrar o formato real do link confirmado na Task 0, anotar o limite do login automático (mesmo navegador), e atualizar a contagem de testes. Se o Step 7 foi feito, atualizar também o item 5 da fila.

```bash
git add docs/ESTADO-ATUAL.md
git commit -m "docs: recuperacao de senha entregue e verificada"
git push
```

O push publica sozinho na Vercel em ~1 min. **Lembre:** variáveis `VITE_*` são assadas no build — nada aqui muda variável, então não é preciso Redeploy manual.
