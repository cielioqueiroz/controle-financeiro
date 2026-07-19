# Acabamento e confirmações — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao app um diálogo de confirmação único para as ações destrutivas, um sistema de raio e elevação no lugar dos seis valores avulsos de hoje, um favicon legível a 16px e um card de compartilhamento que mostra o produto.

**Architecture:** Um componente novo (`Confirmacao`) concentra as quatro confirmações que hoje são invenções separadas. O acabamento não vira biblioteca nova: promove o par de sombra e o gesto de subida que o `Auth` já pratica a padrão do app, aplicando-os onde falta.

**Tech Stack:** React 19, TypeScript, Tailwind v4, `motion/react`, Vitest + Testing Library.

## Global Constraints

- **Português do Brasil** em todo texto de interface e comentário. Mensagens de commit **sem acentuação**.
- **Nenhuma cor fixa em código de componente.** Hexadecimal só em `src/index.css` e em arquivos fora do `src/` (favicon, gerador de OG).
- **`--color-confere` e `--color-ressalva` carregam semântica** ("o total bate" / "atenção") e não servem de decoração.
- **`dvh`, nunca `vh`.**
- **`prefers-reduced-motion` desliga animação**, via `useReducedMotion()` — padrão em `src/ui/Marca.tsx:23`.
- **A tela de acesso tem que continuar ≤ 800px em 1280×800.** A rodada anterior terminou nesse teto **exato, sem folga**, e mexer em raio e padding de card é o que o estoura. Meça.
- **Decoração nunca entra no layout de rolagem.** O overlay do modal é `position: fixed`; um efeito mal ancorado já criou barra lateral pulsante neste app. Rode `python scripts/medir-overflow.py`.
- **Rode `npm test` duas vezes** antes de declarar verde (flakiness por timeout, corrigida em `35b4f84`).
- **Reinicie o `npm run dev`** depois de criar arquivo — o Vite não recarrega bem quando arquivos nascem.

## Regra de acabamento que governa as Tasks 3 e 5

**Gesto de hover pertence a elemento interativo. Só.**

Isto corrige um erro do spec, encontrado ao ler o código: ele mandava dar sombra e subida aos
tiles do Dashboard e às linhas de Documentos. **Nenhum dos dois é clicável.** Os tiles são
células de um grid `gap-px` que forma um bloco único com divisórias de 1px
(`Dashboard.tsx:373`); as linhas de Documentos só têm um botão de apagar dentro delas.

Levantar no hover promete clique. Onde não há clique, a promessa é falsa, e no caso dos
tiles a subida ainda quebraria o bloco unificado.

| Tipo | Recebe |
|---|---|
| Interativo (botão, link, área clicável) | raio + sombra de repouso + **hover: subida e sombra maior** |
| Passivo (painel, card de conteúdo, célula) | raio + sombra de repouso. **Sem hover.** |
| Linha que contém controles | pode manter realce de fundo no hover (afordância de "você está aqui"), **sem subida** |

## Escala

| Degrau | Uso |
|---|---|
| `rounded-md` | chips, badges, botõezinhos de linha |
| `rounded-xl` | campos, botões, controles |
| `rounded-2xl` | cards e painéis |
| `rounded-full` | só pílulas e avatares |

`rounded-sm` sai de circulação. Elevação: `shadow-lg` em repouso, `shadow-xl` no hover, com a
borda passando a `carvao-600`.

---

### Task 1: O componente `Confirmacao`

**Files:**
- Create: `src/ui/Confirmacao.tsx`
- Create: `src/ui/Confirmacao.test.tsx`

**Interfaces:**
- Produces:
```ts
type Props = {
  aberto: boolean
  titulo: string
  descricao?: React.ReactNode
  rotuloConfirmar: string
  severidade: 'perigo' | 'normal'
  ocupado?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}
export function Confirmacao(props: Props): JSX.Element | null
```

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/ui/Confirmacao.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Confirmacao } from './Confirmacao'

function montar(over: Partial<Parameters<typeof Confirmacao>[0]> = {}) {
  const onConfirmar = vi.fn()
  const onCancelar = vi.fn()
  render(
    <Confirmacao
      aberto
      titulo="Apagar tudo?"
      rotuloConfirmar="Apagar tudo"
      severidade="perigo"
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
      {...over}
    />,
  )
  return { onConfirmar, onCancelar }
}

describe('Confirmacao', () => {
  it('fechado não renderiza nada', () => {
    montar({ aberto: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('o foco inicial cai no Cancelar quando a severidade é perigo', () => {
    montar()
    // Quem aperta Enter por reflexo não pode apagar nada.
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('Esc cancela e não confirma', async () => {
    const usuario = userEvent.setup()
    const { onConfirmar, onCancelar } = montar()
    await usuario.keyboard('{Escape}')
    expect(onCancelar).toHaveBeenCalled()
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it('só o botão de confirmar dispara onConfirmar', async () => {
    const usuario = userEvent.setup()
    const { onConfirmar } = montar()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onConfirmar).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'Apagar tudo' }))
    expect(onConfirmar).toHaveBeenCalledTimes(1)
  })

  it('ocupado trava o botão e Esc não fecha — a ação já está em curso', async () => {
    const usuario = userEvent.setup()
    const { onCancelar } = montar({ ocupado: true })
    expect(screen.getByRole('button', { name: 'Apagar tudo' })).toBeDisabled()
    await usuario.keyboard('{Escape}')
    expect(onCancelar).not.toHaveBeenCalled()
  })

  it('o diálogo é anunciado com o próprio título', () => {
    montar()
    expect(screen.getByRole('dialog', { name: 'Apagar tudo?' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/Confirmacao.test.tsx`
Expected: FAIL — "Failed to resolve import './Confirmacao'".

- [ ] **Step 3: Escrever o componente**

Criar `src/ui/Confirmacao.tsx`. Requisitos que o teste cobre e requisitos que ele não alcança:

- `aberto === false` → retorna `null`.
- Elemento com `role="dialog"`, `aria-modal="true"`, e `aria-labelledby` apontando para o id do título (é isso que faz `getByRole('dialog', { name })` funcionar).
- Ref no botão Cancelar, com `focus()` num `useEffect` que roda quando `aberto` vira true **e** `severidade === 'perigo'`. Com `severidade === 'normal'`, o foco inicial vai no botão de confirmar.
- `keydown` de `Escape` no `document` chama `onCancelar` — **exceto quando `ocupado`**.
- Clique no overlay cancela; clique dentro do card não. Cuidado: use o alvo do evento, não `onClick` no overlay com propagação, senão clicar no card fecha o diálogo.
- **Foco preso**: `Tab` no último elemento volta ao primeiro. Dois botões só, então o laço é curto.
- **Devolver o foco** ao elemento que estava focado antes de abrir, ao fechar. Guarde `document.activeElement` na abertura.
- `severidade === 'perigo'` → botão de confirmar em `bg-falha` com texto claro. `normal` → o mesmo `BOTAO_PRIMARIO` de `./estilos-campo`.
- Overlay: `fixed inset-0`, fundo escurecido com desfoque. **Ele é decoração e não pode entrar no fluxo de rolagem** — `fixed`, nunca `absolute` dentro de um container rolável.
- Card: `rounded-2xl`, borda `carvao-700`, fundo `carvao-900`, `shadow-2xl` — o mesmo vocabulário do card de acesso.
- Animação com `motion`: overlay em opacidade, card em opacidade e escala. Respeita `useReducedMotion()`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/ui/Confirmacao.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 5: Rodar tudo e commitar**

Run: `npm test` (duas vezes), `npm run build`, `npm run lint`

```bash
git add src/ui/Confirmacao.tsx src/ui/Confirmacao.test.tsx
git commit -m "feat: dialogo de confirmacao unico, com foco preso e Esc"
```

---

### Task 2: Ligar as quatro ações no diálogo

**Files:**
- Modify: `src/ui/ContaMenu.tsx` (sair da conta)
- Modify: `src/ui/Documentos.tsx` (apagar documento, apagar tudo)
- Modify: `src/ui/EditarCompra.tsx` (salvar edição)
- Test: `src/ui/Documentos.test.tsx` (criar se não existir)

**Interfaces:**
- Consumes: `Confirmacao` da Task 1.

- [ ] **Step 1: Escrever o teste que falha**

O requisito central é negativo — **a ação destrutiva não acontece sem confirmação**. Neste projeto já houve teste que conviveu com o bug por só conferir a presença de algo positivo, então asseve a ausência explicitamente.

Em `src/ui/Documentos.test.tsx`, com `../persist/documentos` mockado:

```tsx
it('clicar no ícone de apagar não apaga: só abre o diálogo', async () => {
  const usuario = userEvent.setup()
  // ...render com um documento na lista...
  await usuario.click(screen.getByLabelText('Apagar documento'))

  expect(screen.getByRole('dialog')).toBeInTheDocument()
  // O ponto do teste: abrir o diálogo NÃO pode ter apagado nada.
  expect(apagarDocumento).not.toHaveBeenCalled()

  await usuario.click(screen.getByRole('button', { name: 'Apagar' }))
  expect(apagarDocumento).toHaveBeenCalledTimes(1)
})

it('cancelar o diálogo não apaga', async () => {
  const usuario = userEvent.setup()
  // ...render...
  await usuario.click(screen.getByLabelText('Apagar documento'))
  await usuario.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(apagarDocumento).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/ui/Documentos.test.tsx`
Expected: FAIL — não existe `dialog`; hoje o clique troca `confirmando` e mostra botões em linha.

- [ ] **Step 3: Trocar as confirmações em linha pelo diálogo**

**`ContaMenu.tsx`** — remover o bloco `confirmando ? (...) : (...)` das linhas 80-89 e o estado `confirmando`. O item "Sair da conta" volta a ser um botão só; ele abre o `Confirmacao` com `severidade="perigo"`, título "Sair da conta?" e rótulo "Sair".

**`Documentos.tsx`** — remover o estado `confirmando` e os dois botões em linha (148-163). O ícone de lixeira abre o diálogo. O título **nomeia o documento**: use o mesmo texto que a linha mostra (tipo, banco e período), não um genérico.

Para o "apagar tudo" (botão da linha 199, hoje chamando `apagarGeral` direto): diálogo com `severidade="perigo"` e **a contagem real** na descrição — quantos documentos e quantos lançamentos serão perdidos. Os dois números já estão disponíveis no componente (a lista de documentos e a contagem por documento que a linha exibe); some-os, não invente uma consulta nova.

**`EditarCompra.tsx`** — o botão "Salvar" (linha 203) passa a abrir o diálogo com `severidade="normal"`, e o `salvar()` roda na confirmação. Passe `ocupado={salvando}`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/ui/Documentos.test.tsx`
Expected: PASS.

- [ ] **Step 5: Rodar tudo e commitar**

Run: `npm test` (duas vezes), `npm run build`, `npm run lint`

```bash
git add src/ui/ContaMenu.tsx src/ui/Documentos.tsx src/ui/EditarCompra.tsx src/ui/Documentos.test.tsx
git commit -m "feat: as quatro acoes destrutivas passam pelo dialogo de confirmacao"
```

---

### Task 3: Sistema de raio e elevação

Leia a seção "Regra de acabamento" no topo deste plano antes de começar. Ela corrige um erro do spec e governa esta task inteira.

**Files:**
- Modify: `src/index.css` (remover `--radius-suave`)
- Modify: `src/ui/Dropzone.tsx`, `src/ui/Dashboard.tsx`, `src/ui/Documentos.tsx`, `src/ui/ResultadoImport.tsx`, `src/ui/Auth.tsx`

- [ ] **Step 1: Remover o token morto**

Em `src/index.css:56`, apagar `--radius-suave: 0.5rem;`. Ele nunca foi usado; confirme com uma busca por `radius-suave` antes de apagar.

- [ ] **Step 2: Dropzone — a superfície mais chapada e mais importante**

Em `src/ui/Dropzone.tsx:38`, o botão é `rounded-sm` sem sombra. Ele **é interativo**, então recebe o tratamento completo: `rounded-2xl` (é um card), `shadow-lg` em repouso, e no hover `shadow-xl` com `-translate-y-0.5`.

O estado `sobre` (arquivo sendo arrastado por cima) ganha o mesmo levantar, um degrau mais forte — é o momento em que a superfície precisa dizer "solta aqui".

Preserve o `disabled:` — quando `ocupado`, nada deve levantar.

- [ ] **Step 3: Dashboard — botões sim, tiles não**

**Botões** (linhas 226, 234, 242): `rounded-lg` → `rounded-xl`, e o `transition-colors` vira o par de elevação com `-translate-y-0.5` no hover.

**Tiles: não recebem hover.** São células passivas de um bloco com divisórias (`Dashboard.tsx:373`, grid `gap-px`). O que o bloco **inteiro** pode receber é raio e sombra de repouso, como um painel só. Se aplicar, aplique no container, nunca no `Tile`.

**Painel da linha 301** (`rounded-xl`): passa a `rounded-2xl` e ganha `shadow-lg` de repouso.

- [ ] **Step 4: Documentos e ResultadoImport**

**Documentos**: as linhas mantêm o realce de fundo no hover e **não** ganham subida — a linha não é clicável, só o botão dentro dela. Os botõezinhos de linha vão para `rounded-md`; o painel para `rounded-2xl`.

**ResultadoImport**: os `rounded-sm` viram `rounded-2xl` nos cards e `rounded-xl` nos botões; os cards ganham `shadow-lg` de repouso. Botões de ação ganham o par de hover.

- [ ] **Step 5: O card de login ganha hover sem subir**

Em `src/ui/Auth.tsx`, o card externo (o `motion.div` com `rounded-2xl`) ganha, no hover, sombra maior e borda passando a `carvao-600`. **Não** adicione `-translate-y`: o card não é clicável, e levantá-lo prometeria clique. Os elementos internos continuam subindo, porque esses são clicáveis de verdade.

- [ ] **Step 6: Medir a altura, que é onde isto pode dar errado**

Run: `python scripts/medir-overflow.py` (com `npm run dev` rodando)

Expected: "RESULTADO: OK", **e a altura em 1280×800 ≤ 800px**.

A rodada anterior terminou em 800px exatos, sem folga. Se o raio ou o padding novo estourarem o teto, **pare e reporte** com o número — não corte conteúdo por conta própria.

- [ ] **Step 7: Rodar tudo e commitar**

Run: `npm test` (duas vezes), `npm run build`, `npm run lint`

```bash
git add src/index.css src/ui/Dropzone.tsx src/ui/Dashboard.tsx src/ui/Documentos.tsx src/ui/ResultadoImport.tsx src/ui/Auth.tsx
git commit -m "feat: sistema de raio e elevacao, com hover so no que e clicavel"
```

---

### Task 4: Favicon legível a 16px

**Files:**
- Modify: `public/img/favicon.svg`

- [ ] **Step 1: Simplificar**

Sai o círculo de `r="18.5"` (o anel interno). O `R$` cresce e engorda, ocupando mais da face da moeda. O anel externo e o fundo arredondado ficam.

O arquivo é estático, fora do React: continua usando o literal do tema escuro (`#4a3208`), como o comentário no próprio arquivo já explica.

**O `MoedaLogo` do app não muda.** A divergência é proposital: o favicon é um sinal de 16px, o logo é uma peça de 44px animada. Otimizar os dois pela mesma régua estraga um.

- [ ] **Step 2: Conferir no tamanho que importa**

Abra o SVG reduzido a 16px (ou recarregue o app e olhe a aba). O `R$` tem que ser distinguível. Se não for, engorde mais o traço — não adicione detalhe.

- [ ] **Step 3: Commit**

```bash
git add public/img/favicon.svg
git commit -m "feat: favicon simplificado para ler a 16px"
```

---

### Task 5: Card de compartilhamento mostrando o produto

**Files:**
- Modify: `scripts/og-card.html`
- Modify: `public/og.png` (regerado, não editado)

- [ ] **Step 1: Redesenhar**

Em `scripts/og-card.html`, o card passa a ter um **donut de categorias** grande em tons de âmbar, com a frase ao lado.

A escolha foi feita entre três direções porque é a única que faz alguém entender o produto sem abrir o link. Ecoa também a animação do logo, que abre em fatias de donut.

Requisitos:
- 1200×630, como está.
- O donut é desenhado em SVG inline ou CSS `conic-gradient` — sem imagem externa e sem biblioteca; o gerador roda offline.
- Fatias em **tons de âmbar**. `--color-confere` e `--color-ressalva` carregam semântica no app e não servem de decoração aqui.
- A frase é a mesma da tela de acesso: "Seu extrato vira gráfico, em menos de um minuto."
- Mantenha a marca no topo e a assinatura, se couberem sem apertar.

- [ ] **Step 2: Regerar o PNG**

Run: `python scripts/gerar-og.py`

Editar o HTML **não** muda a imagem servida. Se a regeração falhar por dependência faltando no ambiente, **não improvise a imagem**: reporte que o HTML está pronto e que o PNG precisa ser gerado à mão.

- [ ] **Step 3: Commit**

```bash
git add scripts/og-card.html public/og.png
git commit -m "feat: card de compartilhamento mostra o donut de categorias"
```

---

### Task 6: Verificação no navegador

Nada aqui é automatizável, e é por isso que é tarefa própria.

- [ ] **Step 1: Subir limpo**

`npm run dev`, depois `Ctrl+Shift+R` — nasceram arquivos novos.

- [ ] **Step 2: Os quatro diálogos, com teclado**

Para cada um (sair, apagar documento, apagar tudo, salvar edição):
- `Tab` não escapa do diálogo.
- `Esc` cancela.
- Nos três destrutivos, o foco começa no **Cancelar** — apertar Enter na hora não pode destruir nada.
- Ao fechar, o foco volta ao botão que abriu.
- O "apagar tudo" mostra a contagem certa.

- [ ] **Step 3: Os gestos**

Passe o mouse por: Dropzone, botões do Dashboard, botões do ResultadoImport, card de login. O que é clicável sobe; o que não é, não sobe. O card de login floresce a sombra **sem** subir — confirme que ele não parece um botão gigante.

- [ ] **Step 4: Altura e rolagem**

`python scripts/medir-overflow.py` — sem rolagem lateral, e a tela de acesso ≤ 800px em 1280×800.

Abra um diálogo e confirme que o overlay **não** criou barra de rolagem.

- [ ] **Step 5: Favicon e card OG**

O favicon **na aba**, não ampliado — é o único tamanho que importa. O `og.png` aberto no visualizador, e se possível o preview real do link no WhatsApp ou Telegram.

- [ ] **Step 6: Atualizar o ESTADO-ATUAL e enviar**

Registrar a rodada, a contagem de testes e as decisões (hover só no clicável; favicon e logo divergem de propósito).

```bash
git add docs/ESTADO-ATUAL.md
git commit -m "docs: registra a rodada de acabamento e confirmacoes"
git push origin main
```

---

## Autorrevisão

**Cobertura do spec:** A → Tasks 1 e 2; B → Task 3; C → Task 3 Step 5; D → Task 4; E → Task 5; testes → Tasks 1 e 2; verificação → Task 6.

**Correção ao spec, e é relevante:** o spec mandava dar sombra e subida aos tiles do Dashboard e às linhas de Documentos. Ler o código mostrou que **nenhum dos dois é clicável** — os tiles são células de um grid `gap-px` formando um bloco único, e a linha de Documentos só contém um botão. Hover em elemento não interativo promete clique onde não há. A regra no topo do plano corrige isso, e as Tasks 3 e 4 seguem a regra, não o spec.

**Consistência de tipos:** `Confirmacao` é definido na Task 1 com as props exatas e consumido na Task 2 sem nenhuma prop além dessas.

**Risco concentrado:** a altura da tela de acesso. Ela terminou a rodada anterior em 800px exatos e a Task 3 mexe em raio e padding de card. Por isso a medição aparece **dentro** da Task 3 (Step 6), e não só na verificação final — para o estouro ser pego por quem acabou de causá-lo.
