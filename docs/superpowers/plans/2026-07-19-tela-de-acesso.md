# Tela de acesso — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a tela de acesso em layout de duas colunas sem rolagem, com frase e logo novos, e remover o login automático depois da redefinição de senha.

**Architecture:** Um componente novo (`TelaAcesso`) passa a ser dono da tela inteira enquanto o usuário não está logado, em vez de reaproveitar o `<header>` que serve ao estado logado. O logo sai de dentro do `Auth.tsx` para arquivo próprio, porque ganha estados de animação. O `RecuperarSenha` perde o caminho de autenticação, ficando com uma única saída.

**Tech Stack:** React 19, TypeScript, Tailwind v4, `motion/react`, Vitest + Testing Library, Neon Auth (Better Auth).

## Global Constraints

- **Português do Brasil** em todo texto de interface, comentário e mensagem de commit.
- **Sem cor fixa em código.** Toda cor sai de variável CSS de `src/index.css`, que tem valores próprios por tema.
- **`--color-confere` e `--color-ressalva` são proibidas como decoração.** Carregam semântica ("o total bate" / "atenção"); só a família `--color-marca` pode enfeitar.
- **`dvh`, nunca `vh`**, para altura de tela cheia.
- **`prefers-reduced-motion` desliga animação**, via `useReducedMotion()` do `motion/react` — padrão já usado em `src/ui/Marca.tsx:23`.
- **Reinicie o `npm run dev` e dê `Ctrl+Shift+R`** depois de criar arquivo: o Vite não recarrega bem quando arquivos nascem.
- **Rode `npm test` duas vezes** antes de declarar verde. A suíte teve flakiness por timeout (corrigido em `35b4f84`), e uma execução só não distingue regressão de máquina ocupada.

---

### Task 1: Fim do login automático depois da redefinição

O `RecuperarSenha` deixa de autenticar. O e-mail guardado é rebaixado de *entrada de chamada de autenticação* para *preenchimento de campo de texto* — é a mudança que apaga a classe de bug do F4, em vez de contê-la com um prazo de 1h.

**Files:**
- Modify: `src/ui/RecuperarSenha.tsx` (props, `salvarSenha`, import de `neon`)
- Modify: `src/ui/Auth.tsx:139-157` (deixa de passar `onAutenticado`)
- Modify: `src/ui/RecuperarSenha.test.tsx:26,205` (prop removida das duas renderizações)
- Test: `src/App.test.tsx` (inverte o teste 1)

**Interfaces:**
- Consumes: `lerEmailReset()`, `esquecerEmailReset()` de `src/lib/perfil.ts` (inalterados).
- Produces: `RecuperarSenha` passa a ter as props `{ token: string | null; onVoltar: (email?: string) => void }`. A prop `onAutenticado` **deixa de existir**.

- [ ] **Step 1: Inverter o teste que hoje afirma o contrário**

Em `src/App.test.tsx`, substituir o primeiro `it(...)` (linhas 91-108) por:

```tsx
  it('após redefinir a senha, volta ao login com o e-mail preenchido e nunca autentica sozinho', async () => {
    const usuario = userEvent.setup()
    guardarEmailReset('alguem@exemplo.com')
    vi.mocked(redefinirSenha).mockResolvedValue({ ok: true })
    comTokenNaUrl()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument()
    await preencherEEnviarNovaSenha(usuario)

    // Trocar a senha não entra na conta: quem redefiniu precisa usar a senha
    // nova, o que também confirma que ela funciona.
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD_STUB')).not.toBeInTheDocument()

    // O e-mail guardado serve só para poupar digitação.
    expect(screen.getByPlaceholderText('seu@email.com')).toHaveValue('alguem@exemplo.com')

    // Asserção negativa explícita: o requisito é "não autentica". Conferir
    // apenas que o card de entrar apareceu deixaria passar um login que
    // acontecesse e falhasse por outro motivo.
    expect(authMocks.signInEmail).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — o app ainda mostra `DASHBOARD_STUB` e `signInEmail` foi chamado.

- [ ] **Step 3: Remover a autenticação do `RecuperarSenha`**

Em `src/ui/RecuperarSenha.tsx`, apagar a linha 3 (`import { neon } from '../lib/neon'`) — fica sem uso e o lint acusa.

Trocar o bloco de props (linhas 11-18) por:

```tsx
type Props = {
  /** Com token, mostra o passo de nova senha. Sem, o de pedir o link. */
  token: string | null
  /** Voltar ao card de login, com o e-mail a preencher, se houver. */
  onVoltar: (email?: string) => void
}

export function RecuperarSenha({ token, onVoltar }: Props) {
```

Substituir tudo entre a linha 93 e a linha 135 (do comentário "Token gasto" até o fim de `salvarSenha`) por:

```tsx
    // Token gasto: fora da URL antes de qualquer coisa, para um F5 não
    // reenviá-lo e produzir um erro que não é do usuário.
    limparTokenDaUrl()

    // O e-mail guardado preenche o campo do login e NADA MAIS. Ele já foi
    // entrada de um signIn.email automático, e era essa propriedade — uma
    // entrada não verificada alimentando autenticação — que produzia o F4:
    // com duas contas da casa usando a mesma senha, o auto-login entrava na
    // conta errada, e como a saudação usa o apelido local, nem o cabeçalho
    // denunciava. Preenchendo um campo de texto, o pior caso é sugerir o
    // e-mail errado, visível e editável.
    const emailSalvo = lerEmailReset()
    esquecerEmailReset()
    setOcupado(false)
    toast.success('Senha alterada. Entre com a senha nova.')
    onVoltar(emailSalvo ?? undefined)
  }
```

- [ ] **Step 4: Parar de passar `onAutenticado` no `Auth.tsx`**

Em `src/ui/Auth.tsx`, trocar o bloco `<RecuperarSenha .../>` (linhas 140-157) por:

```tsx
          <RecuperarSenha
            token={tokenReset ?? null}
            onVoltar={(emailVolta) => {
              if (emailVolta) setEmail(emailVolta)
              setModo('entrar')
              onRecuperacaoConcluida?.()
            }}
          />
```

O `setModo('entrar')` defensivo que existia no antigo `onAutenticado` sai junto: ele cobria uma corrida com o `checarSessao` que deixa de ser possível quando ninguém mais autentica por este caminho.

- [ ] **Step 5: Tirar a prop das renderizações do teste do componente**

Em `src/ui/RecuperarSenha.test.tsx`, nas linhas 26 e 205, remover ` onAutenticado={() => {}}` das duas tags `<RecuperarSenha ... />`.

- [ ] **Step 6: Rodar a suíte inteira, duas vezes**

Run: `npm test` (duas vezes)
Expected: PASS nas duas, 275 testes.

- [ ] **Step 7: Commit**

```bash
git add src/ui/RecuperarSenha.tsx src/ui/Auth.tsx src/ui/RecuperarSenha.test.tsx src/App.test.tsx
git commit -m "feat: redefinir a senha volta ao login em vez de entrar sozinho"
```

---

### Task 2: `MoedaLogo` em arquivo próprio, tematizado e animado

**Files:**
- Create: `src/ui/MoedaLogo.tsx`
- Create: `src/ui/MoedaLogo.test.tsx`
- Modify: `src/index.css` (nova variável, nos dois temas)
- Modify: `src/ui/Auth.tsx` (apaga a `MoedaLogo` local, importa a nova)

**Interfaces:**
- Produces: `MoedaLogo()` — componente sem props, exportado de `src/ui/MoedaLogo.tsx`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/ui/MoedaLogo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MoedaLogo } from './MoedaLogo'

describe('MoedaLogo', () => {
  it('não usa cor fixa em código — todo traço sai de variável de tema', () => {
    const { container } = render(<MoedaLogo />)
    const svg = container.querySelector('svg')!

    // #065f37 era o verde da paleta neon anterior ao rename, fixo em código:
    // a moeda ficava âmbar por fora e verde no contorno, sem responder ao
    // tema. Este teste existe para isso não voltar.
    expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{6}/i)
  })

  it('gera ids únicos por instância, para duas moedas não colidirem', () => {
    const { container } = render(
      <>
        <MoedaLogo />
        <MoedaLogo />
      </>,
    )
    const clips = [...container.querySelectorAll('clipPath')].map((c) => c.id)
    expect(clips).toHaveLength(2)
    expect(clips[0]).not.toBe(clips[1])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/MoedaLogo.test.tsx`
Expected: FAIL — "Failed to resolve import './MoedaLogo'".

- [ ] **Step 3: Adicionar a variável de cor nos dois temas**

Em `src/index.css`, logo depois da linha `--color-marca: #d9a441;` (bloco `:root`, tema escuro):

```css
  /* Traço da moeda do logo. Marrom profundo: a face da moeda é sempre
     --color-marca (âmbar) nos dois temas, então um só tom escuro serve
     para ambos. Antes era #065f37 fixo, verde da paleta anterior. */
  --color-moeda-traco: #4a3208;
```

E no bloco `:root[data-theme="light"]`, depois de `--color-marca: #9a6a15;`:

```css
  --color-moeda-traco: #3d2a06;
```

- [ ] **Step 4: Escrever o componente**

Criar `src/ui/MoedaLogo.tsx`:

```tsx
import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/** Raio do anel externo — o que se abre em fatias. */
const R_ANEL = 23
const CIRCUNFERENCIA = 2 * Math.PI * R_ANEL
const FATIAS = 4
const VAO = 9

/** Fechado, os quatro arcos se tocam e leem como um anel contínuo; aberto,
 *  cada um encolhe e abre a fatia — o donut de categorias do dashboard. */
const ANEL_FECHADO = `${CIRCUNFERENCIA / FATIAS} 0`
const ANEL_ABERTO = `${CIRCUNFERENCIA / FATIAS - VAO} ${VAO}`

/** Moeda R$ do logo. Três camadas de movimento: a entrada (que quem monta
 *  controla, com o giro em mola), um brilho que varre a face em repouso, e
 *  o anel externo que periodicamente se abre em fatias de donut.
 *
 *  Respeita `prefers-reduced-motion`: quem pede menos movimento recebe a
 *  moeda parada, com o anel fechado. */
export function MoedaLogo() {
  const semMovimento = useReducedMotion()
  // Dois logos na mesma página colidiriam se os ids fossem fixos, e o
  // segundo herdaria o clip do primeiro.
  //
  // Os dois-pontos precisam sair: o useId devolve algo como ":r0:", e
  // dois-pontos dentro de url(#...) quebram a referência — o clip e o
  // gradiente simplesmente não se aplicam, sem erro nenhum no console.
  const id = useId().replace(/:/g, '')
  const idFace = `moeda-face-${id}`
  const idBrilho = `moeda-brilho-${id}`

  return (
    <svg width="56" height="56" viewBox="0 0 64 64" className="drop-shadow-lg" aria-hidden>
      <defs>
        <clipPath id={idFace}>
          <circle cx="32" cy="32" r={R_ANEL} />
        </clipPath>
        <linearGradient id={idBrilho} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-tinta)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--color-tinta)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--color-tinta)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <circle cx="32" cy="32" r={R_ANEL} fill="var(--color-marca)" />

      {/* A inclinação fica num <g> por fora, e não como atributo do próprio
          rect: o motion anima `x` via CSS transform, que sobrescreve o
          atributo transform do SVG — o skew seria descartado em silêncio e
          o brilho viraria uma barra reta. */}
      <g clipPath={`url(#${idFace})`}>
        <g transform="skewX(-18)">
          <motion.rect
            x="0"
            y="-4"
            width="16"
            height="72"
            fill={`url(#${idBrilho})`}
            initial={{ x: -30 }}
            animate={semMovimento ? { x: -30 } : { x: [-30, 80] }}
            transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 4.2, ease: 'easeInOut' }}
          />
        </g>
      </g>

      <motion.circle
        cx="32"
        cy="32"
        r={R_ANEL}
        fill="none"
        stroke="var(--color-moeda-traco)"
        strokeWidth="2.5"
        opacity="0.55"
        style={{ transformOrigin: '32px 32px' }}
        initial={{ strokeDasharray: ANEL_FECHADO, rotate: 0 }}
        animate={
          semMovimento
            ? { strokeDasharray: ANEL_FECHADO, rotate: 0 }
            : { strokeDasharray: [ANEL_FECHADO, ANEL_ABERTO, ANEL_FECHADO], rotate: [0, 90] }
        }
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 3.4, ease: 'easeInOut' }}
      />

      <circle
        cx="32"
        cy="32"
        r="18.5"
        fill="none"
        stroke="var(--color-moeda-traco)"
        strokeWidth="1.6"
        opacity="0.4"
      />

      <text
        x="32"
        y="41.5"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="800"
        fontSize="24"
        fill="var(--color-moeda-traco)"
      >
        R$
      </text>
    </svg>
  )
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/ui/MoedaLogo.test.tsx`
Expected: PASS (2 testes).

- [ ] **Step 6: Trocar o uso no `Auth.tsx`**

Em `src/ui/Auth.tsx`: apagar a função `MoedaLogo` local (linhas 272-292) e adicionar aos imports:

```tsx
import { MoedaLogo } from './MoedaLogo'
```

O `<MoedaLogo />` dentro do `motion.div` de entrada (linha 132) não muda — o giro de entrada continua sendo do `Auth`.

- [ ] **Step 7: Rodar tudo e commitar**

Run: `npm test && npm run build && npm run lint`
Expected: tudo verde, 277 testes.

```bash
git add src/ui/MoedaLogo.tsx src/ui/MoedaLogo.test.tsx src/ui/Auth.tsx src/index.css
git commit -m "feat: moeda do logo vira donut, com brilho e cor de tema"
```

---

### Task 3: `TelaAcesso` — layout em duas colunas

**Files:**
- Create: `src/ui/TelaAcesso.tsx`
- Create: `src/ui/TelaAcesso.test.tsx`
- Modify: `src/ui/Auth.tsx:115` (a margem do card sai; quem posiciona é o layout)

**Interfaces:**
- Consumes: `Marca` de `./Marca`, `ThemeToggle` de `./ThemeToggle`.
- Produces: `TelaAcesso({ children }: { children: ReactNode })` — `children` é o card, renderizado na coluna direita.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/ui/TelaAcesso.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TelaAcesso } from './TelaAcesso'

describe('TelaAcesso', () => {
  it('mostra a frase da tela deslogada e o card que recebe', () => {
    render(
      <TelaAcesso>
        <p>CARD_STUB</p>
      </TelaAcesso>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Seu extrato vira gráfico, em menos de um minuto.',
    )
    expect(screen.getByText('CARD_STUB')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/TelaAcesso.test.tsx`
Expected: FAIL — "Failed to resolve import './TelaAcesso'".

- [ ] **Step 3: Escrever o componente**

Criar `src/ui/TelaAcesso.tsx`:

```tsx
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Marca } from './Marca'
import { ThemeToggle } from './ThemeToggle'

/** Tela inteira enquanto ninguém está logado: marca e tema no topo, frase à
 *  esquerda e card à direita em telas largas, tudo empilhado no celular.
 *
 *  Existe porque o <header> do App serve ao estado LOGADO — largura total,
 *  saudação, menu de conta. A tela de acesso herdava esse cabeçalho e caía
 *  embaixo dele, o que produzia uma página de 1044px num viewport de 800px
 *  com as laterais vazias.
 *
 *  A altura usa dvh, não vh: em navegador de celular a barra de endereço
 *  retrátil faz 100vh ser maior que a área visível, o que traria de volta
 *  exatamente a rolagem que este componente remove. */
export function TelaAcesso({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col px-4 py-6 sm:px-6 lg:px-10">
      <header className="mx-auto flex w-full max-w-[104rem] items-center justify-between gap-4">
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="tabular flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-tinta-tenue"
        >
          <motion.span
            className="inline-block h-1.5 w-1.5 rounded-full bg-marca"
            animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Marca />
        </motion.p>
        <ThemeToggle />
      </header>

      <div className="mx-auto grid w-full max-w-[104rem] flex-1 items-center gap-10 py-10 lg:grid-cols-2 lg:gap-16">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="font-display text-4xl leading-[1.05] text-tinta sm:text-5xl lg:text-6xl"
        >
          Seu extrato vira gráfico,
          <br />
          <span className="text-tinta-fraca">em menos de um minuto.</span>
        </motion.h1>

        <div className="w-full lg:justify-self-end">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Tirar a margem própria do card**

Em `src/ui/Auth.tsx`, linha 115, trocar:

```tsx
    <div className="relative mx-auto mt-6 max-w-sm sm:mt-12">
```

por:

```tsx
    <div className="relative mx-auto w-full max-w-sm">
```

O `mt-6 sm:mt-12` existia para descolar o card do header antigo. No layout novo quem centraliza é a grade, e a margem empurraria o card para baixo do eixo.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/ui/TelaAcesso.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/TelaAcesso.tsx src/ui/TelaAcesso.test.tsx src/ui/Auth.tsx
git commit -m "feat: tela de acesso em duas colunas, sem rolagem"
```

---

### Task 4: Ligar o `TelaAcesso` no `App` e trocar a frase da tela logada

**Files:**
- Modify: `src/App.tsx` (branch de `precisaLogin`, header, imports)

**Interfaces:**
- Consumes: `TelaAcesso` da Task 3.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `src/App.test.tsx`, dentro do `describe` existente:

```tsx
  it('deslogado, mostra a frase da tela de acesso; logado, a de importar', async () => {
    const { unmount } = render(<App />)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Seu extrato vira gráfico, em menos de um minuto.',
    )
    unmount()

    authMocks.setSessaoAtiva(true)
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Importe a fatura, o resto a gente calcula.',
    )
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — o heading deslogado ainda diz "Importe o PDF. Veja para onde o dinheiro foi."

- [ ] **Step 3: Dar saída antecipada ao branch de acesso**

Em `src/App.tsx`, logo depois da linha `const precisaLogin = ...` (linha 124) e **antes** do `return` principal, inserir:

```tsx
  // Saída antecipada: a tela de acesso não compartilha nada com a tela
  // logada além do fundo e dos toasts. Todos os hooks já rodaram acima —
  // este return não pode subir daqui, sob pena de quebrar a ordem deles.
  if (precisaLogin) {
    return (
      <div className="grao min-h-dvh">
        <FundoAnimado />
        <Notificacoes />
        <TelaAcesso>
          <Auth
            onAutenticado={checarSessao}
            tokenReset={tokenReset}
            onRecuperacaoConcluida={() => {
              setTokenReset(null)
              // F1: uma sessão de OUTRA conta pode continuar ativa neste
              // navegador (quem clicou no link não precisa ser quem estava
              // logado). Sem isto, precisaLogin vira false assim que o token
              // some e o Dashboard da sessão antiga reaparece por cima —
              // mesmo a UI tendo acabado de dizer "entre com a senha nova".
              setLogado(false)
              setUsuario(null)
            }}
          />
        </TelaAcesso>
      </div>
    )
  }
```

Adicionar aos imports: `import { TelaAcesso } from './ui/TelaAcesso'`.

- [ ] **Step 4: Remover o branch antigo e simplificar o header**

Em `src/App.tsx`, apagar o `{precisaLogin ? (<Auth ... />) : ` e o `)` correspondente (linhas 210-229 do arquivo original), deixando `estado.fase === 'pronto' ? (` como o primeiro teste do encadeamento.

No header, trocar todo o bloco `<AnimatePresence mode="wait">…</AnimatePresence>` (linhas 147-178) por:

```tsx
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 22 }}
              className="screen-only mt-4 font-display text-4xl leading-[1.05] text-tinta sm:text-5xl"
            >
              Olá, {comoChamar(usuario?.nome, usuario?.email)}!{' '}
              <motion.span
                aria-hidden
                className="inline-block origin-[70%_80%]"
                animate={{ rotate: [0, 20, -12, 20, -6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.1 }}
              >
                👋
              </motion.span>
              <br />
              <span className="text-tinta-fraca">Importe a fatura, o resto a gente calcula.</span>
            </motion.h1>
```

O `AnimatePresence` com `key={logado}` existia para animar a troca entre as duas frases. O header passa a ter um estado só, então ele perde o propósito.

- [ ] **Step 5: Limpar o import que sobrou**

Run: `npm run lint`

Se `AnimatePresence` não for usado em nenhum outro ponto de `src/App.tsx`, remover da linha 2, deixando `import { motion } from 'motion/react'`.

- [ ] **Step 6: Rodar tudo, duas vezes**

Run: `npm test && npm run build && npm run lint` (a suíte duas vezes)
Expected: verde, 279 testes.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: App usa a TelaAcesso e a frase logada convida a importar"
```

---

### Task 5: Verificação no navegador

Nada aqui é automatizável. É a parte que os testes não alcançam, e a razão de existir como tarefa própria em vez de virar rodapé da Task 4.

**Files:** nenhum (só `docs/ESTADO-ATUAL.md` no fim)

- [ ] **Step 1: Subir o app limpo**

```bash
npm run dev
```

Depois `Ctrl+Shift+R` no navegador — nasceram três arquivos, e o Vite não recarrega bem nesse caso.

- [ ] **Step 2: Conferir a altura, que é o defeito original**

Run: `python scripts/medir-overflow.py`
Expected: "RESULTADO: OK".

**Este script não basta.** Ele só reprova rolagem lateral; a queixa era vertical. No navegador em 1280×800, com o modo "Entrar", conferir à mão que **não há barra de rolagem vertical**. No modo "Criar conta" ela pode aparecer — foi a decisão tomada.

- [ ] **Step 3: Conferir o layout**

- Tela larga: frase à esquerda no eixo vertical, card à direita, laterais aproveitadas.
- Celular (ou 390×844 no devtools): empilhado, sem rolagem lateral.
- Trocar o tema pelo botão: a moeda muda de tom junto com o resto.

- [ ] **Step 4: Conferir o logo — só olho humano resolve**

A moeda deve mostrar o brilho varrendo a face de tempos em tempos e o anel externo abrindo em quatro fatias. Em jsdom nada disso é observável, e navegador headless roda em DPR 1 — o mesmo ponto cego que já escondeu o bug do canvas neste projeto.

Com `prefers-reduced-motion` ligado no sistema, a moeda deve ficar parada e com o anel fechado.

- [ ] **Step 5: Refazer o item 0 do ESTADO-ATUAL, que ficou vencido**

⚠️ **Troca a senha de verdade** de `cielioqueiroz@hotmail.com`. Anote a que usar.

1. "Esqueceu a senha?" → pedir link.
2. Abrir o link no mesmo navegador → trocar a senha → **agora tem que voltar ao card de entrar**, com o e-mail preenchido, e o `?token=` sumir da barra de endereços. Entrar com a senha nova.
3. Reabrir um link já usado → "Este link expirou ou já foi usado."
4. **O caso F1:** estando logado, abrir um link de redefinição e concluir. Tem que aparecer o card de login, não o dashboard.

- [ ] **Step 6: Atualizar o ESTADO-ATUAL e commitar**

Registrar em `docs/ESTADO-ATUAL.md`: o item 0 concluído, a nova contagem de testes, o comportamento pós-reset (volta ao login) e a decisão de que `cf:email-reset` nunca mais alimenta autenticação.

```bash
git add docs/ESTADO-ATUAL.md
git commit -m "docs: fecha o item 0 e registra a tela de acesso nova"
git push origin main
```

---

## Autorrevisão

**Cobertura do spec:** seção A → Tasks 3 e 4; B → Tasks 3 e 4; C → Task 2; D → Task 1; testes → distribuídos; verificação → Task 5. Sem lacunas.

**Correção ao spec:** ele previa remover testes do caminho `signIn.email` em `RecuperarSenha.test.tsx`. Esses testes não existem — o arquivo mocka `neon` como `null` (linha 9), então o auto-login nunca foi exercitado ali. A inversão acontece só no `App.test.tsx`, e a Task 1 reflete isso. O `try/catch` some do código de qualquer forma.

**Consistência de tipos:** `RecuperarSenha` passa a `{ token, onVoltar }` na Task 1, e nenhuma tarefa posterior lhe passa `onAutenticado`. `TelaAcesso({ children })` é definido na Task 3 e consumido na Task 4 com essa forma. `MoedaLogo()` não tem props na Task 2 nem ganha nenhuma depois.

**Contagem de testes:** 275 → 277 (Task 2: +2) → 278 (Task 3: +1) → 279 (Task 4: +1). A Task 1 inverte um teste sem mudar a contagem.

**Dois defeitos corrigidos nesta revisão**, ambos no código de exemplo da Task 2 e ambos do
tipo que falha em silêncio — sem erro no console, sem teste vermelho:

1. `useId()` devolve `":r0:"`, e dois-pontos dentro de `url(#...)` quebram a referência. O
   clip e o gradiente não se aplicariam. Corrigido com `.replace(/:/g, '')`.
2. O `transform="skewX(-18)"` estava no mesmo elemento que o motion anima. O motion escreve
   `transform` via CSS, que vence o atributo do SVG: a inclinação sumiria e o brilho viraria
   uma barra reta. Corrigido movendo o skew para um `<g>` externo.

Nenhum dos dois apareceria nos testes deste plano — só olhando a moeda. É o argumento de
existir a Task 5.
