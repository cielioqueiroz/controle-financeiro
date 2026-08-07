# Reforma — Fatia 2 (router e páginas)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quebrar o `Dashboard.tsx` de 846 linhas em sete páginas navegáveis por uma barra superior, com os filtros na URL — e, como consequência, eliminar a barra de rolagem da coluna lateral.

**Architecture:** React Router com um shell (cabeçalho + navegação + rodapé) e sete rotas. Um `DadosProvider` carrega tudo uma vez e as páginas consomem por contexto — não sete requisições. Os dois modais que viram página (`Documentos`, `Categorias`) têm o miolo extraído para um componente de conteúdo, e o invólucro (`Portal`, trava de rolagem, Escape, clique-fora) é descartado, não adaptado.

**Tech Stack:** react-router-dom 7, React 19, Vite 8, Vitest 4.

## Global Constraints

- **`npm test` NÃO checa tipos.** Verificação sempre `npm test && npm run build && npm run lint`.
- **Contagem de partida: 505 testes / 66 arquivos.** A fatia adiciona testes; se algum sumir sem eu ter apagado, investigar.
- **`EditarCompra` continua modal.** É edição pontual sobre uma lista — virar página perderia o contexto de onde se estava.
- **Não mexer em cor, fonte ou espaçamento.** É Fatia 3. Esta fatia é estrutura; misturar as duas torna impossível saber qual quebrou o quê.
- **Sem Poupança.** Decisão registrada em 2026-08-05 e reafirmada pelo usuário.
- **A barra de rolagem só sai na Task 7**, depois que o conteúdo já estiver distribuído. Tirar antes reintroduz o bug de conteúdo inalcançável.

## Rotas

| Rota | Página | De onde vem |
|---|---|---|
| `/` | Painel | `Dashboard.tsx` (enxugado) |
| `/lancamentos` | Lançamentos | `ListaTodos` + `ListaPorCategoria` + `ListaPorDia` |
| `/faturas` | Faturas | modal `Documentos` |
| `/importar` | Importação | `Dropzone` + `ResultadoImport` (hoje no `App.tsx`) |
| `/categorias` | Categorias | modal `Categorias` |
| `/recorrencias` | Recorrências | card `Recorrencias` |
| `/datas` | Datas | novo (calendário do mês, a partir de `diaTipico`) |

## Estrutura de arquivos

```
frontend/src/
  App.tsx                     shell: provider + rotas
  navegacao/
    rotas.tsx                 tabela de rotas (uma fonte da verdade)
    NavPrincipal.tsx          barra superior
  dados/
    DadosProvider.tsx         carrega uma vez, expõe por contexto
    filtros.ts                lerFiltros/escreverFiltros — PURO, testado
  paginas/
    Painel.tsx  Lancamentos.tsx  Faturas.tsx  Importacao.tsx
    Categorias.tsx  Recorrencias.tsx  Datas.tsx
  ui/                         componentes existentes (miolos extraídos)
```

---

### Task 1: `filtros.ts` — o estado da tela na URL

**Files:**
- Create: `frontend/src/dados/filtros.ts`
- Test: `frontend/src/dados/filtros.test.ts`

**Interfaces:**
- Produces: `type Filtros = { periodo: Periodo; ref: Date; banco: string; categoria: string | null; busca: string }`, `lerFiltros(search: string): Filtros`, `escreverFiltros(f: Filtros): string`.

Começa por aqui porque é puro, sem React, e é a peça que todas as páginas consomem. Um bug aqui aparece em sete telas.

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, it, expect } from 'vitest'
import { lerFiltros, escreverFiltros } from './filtros'

describe('lerFiltros', () => {
  it('cai nos padrões quando a URL está vazia', () => {
    const f = lerFiltros('')
    expect(f.periodo).toBe('mes')
    expect(f.banco).toBe('geral')
    expect(f.categoria).toBeNull()
    expect(f.busca).toBe('')
  })

  it('lê período, banco, categoria e busca', () => {
    const f = lerFiltros('?p=ano&banco=nubank&cat=mercado&q=posto')
    expect(f.periodo).toBe('ano')
    expect(f.banco).toBe('nubank')
    expect(f.categoria).toBe('mercado')
    expect(f.busca).toBe('posto')
  })

  // Período inválido vindo de URL editada à mão não pode quebrar a tela:
  // `filtrar()` faria switch sem caso e devolveria undefined.
  it('ignora período que não existe e usa o padrão', () => {
    expect(lerFiltros('?p=decada').periodo).toBe('mes')
  })

  it('lê a referência como AAAA-MM', () => {
    const f = lerFiltros('?ref=2026-09')
    expect(f.ref.getFullYear()).toBe(2026)
    expect(f.ref.getMonth()).toBe(8) // setembro = 8
  })

  it('ignora referência malformada', () => {
    expect(lerFiltros('?ref=banana').ref).toBeInstanceOf(Date)
    expect(Number.isNaN(lerFiltros('?ref=banana').ref.getTime())).toBe(false)
  })
})

describe('escreverFiltros', () => {
  it('omite o que está no padrão, para a URL ficar curta', () => {
    const s = escreverFiltros(lerFiltros(''))
    expect(s).not.toContain('banco=')
    expect(s).not.toContain('cat=')
    expect(s).not.toContain('q=')
  })

  it('faz a volta completa sem perder nada', () => {
    const original = lerFiltros('?p=dia&banco=bradesco&cat=lanches&q=café&ref=2025-03')
    const volta = lerFiltros(escreverFiltros(original))
    expect(volta.periodo).toBe('dia')
    expect(volta.banco).toBe('bradesco')
    expect(volta.categoria).toBe('lanches')
    expect(volta.busca).toBe('café')
    expect(volta.ref.getFullYear()).toBe(2025)
    expect(volta.ref.getMonth()).toBe(2)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/dados/filtros.test.ts --root frontend`
Expected: FAIL — `Cannot find module './filtros'`

- [ ] **Step 3: Implementar**

```ts
import type { Periodo } from '../persist/agrupar'

export type Filtros = {
  periodo: Periodo
  ref: Date
  banco: string
  categoria: string | null
  busca: string
}

const PERIODOS: readonly Periodo[] = ['dia', 'semana', 'mes', 'ano']

/** Estado da tela vindo da URL. Tudo tem padrão: URL vazia é tela padrão,
 *  e valor inválido (URL editada à mão, link velho) cai no padrão em vez de
 *  quebrar — `filtrar()` faria switch sem caso e devolveria undefined. */
export function lerFiltros(search: string): Filtros {
  const p = new URLSearchParams(search)
  const periodo = p.get('p')
  const ref = p.get('ref')
  const m = ref?.match(/^(\d{4})-(\d{2})$/)
  return {
    periodo: PERIODOS.includes(periodo as Periodo) ? (periodo as Periodo) : 'mes',
    ref: m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(),
    banco: p.get('banco') || 'geral',
    categoria: p.get('cat') || null,
    busca: p.get('q') || '',
  }
}

/** Só o que difere do padrão entra na URL — link curto e legível. */
export function escreverFiltros(f: Filtros): string {
  const p = new URLSearchParams()
  if (f.periodo !== 'mes') p.set('p', f.periodo)
  p.set('ref', `${f.ref.getFullYear()}-${String(f.ref.getMonth() + 1).padStart(2, '0')}`)
  if (f.banco !== 'geral') p.set('banco', f.banco)
  if (f.categoria) p.set('cat', f.categoria)
  if (f.busca) p.set('q', f.busca)
  return `?${p.toString()}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/dados/filtros.test.ts --root frontend`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/dados/
git commit -m "feat(nav): filtros na URL, puros e testados

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Instalar o router e montar o shell

**Files:**
- Modify: `frontend/package.json` (dependência)
- Create: `frontend/src/navegacao/rotas.tsx`, `frontend/src/navegacao/NavPrincipal.tsx`
- Test: `frontend/src/navegacao/NavPrincipal.test.tsx`

**Interfaces:**
- Produces: `ROTAS: ReadonlyArray<{ caminho: string; rotulo: string }>` e `<NavPrincipal/>`.

Nesta task a navegação existe mas **todas as rotas ainda apontam para o Dashboard atual**. O app continua idêntico; só ganha barra e URLs. Isso mantém a task revisável sozinha.

- [ ] **Step 1: Instalar**

```bash
npm install react-router-dom --workspace frontend
```

- [ ] **Step 2: Escrever a tabela de rotas**

Uma fonte da verdade: a barra e o roteador leem a mesma lista, então não há como a barra oferecer uma rota que não existe.

```tsx
export const ROTAS = [
  { caminho: '/', rotulo: 'Painel' },
  { caminho: '/lancamentos', rotulo: 'Lançamentos' },
  { caminho: '/faturas', rotulo: 'Faturas' },
  { caminho: '/importar', rotulo: 'Importação' },
  { caminho: '/categorias', rotulo: 'Categorias' },
  { caminho: '/recorrencias', rotulo: 'Recorrências' },
  { caminho: '/datas', rotulo: 'Datas' },
] as const
```

- [ ] **Step 3: Escrever o teste da barra**

```tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavPrincipal } from './NavPrincipal'
import { ROTAS } from './rotas'

describe('NavPrincipal', () => {
  it('oferece um link para cada rota', () => {
    render(<MemoryRouter><NavPrincipal /></MemoryRouter>)
    for (const r of ROTAS) {
      expect(screen.getByRole('link', { name: r.rotulo })).toHaveAttribute('href', r.caminho)
    }
  })

  it('não oferece Poupança', () => {
    render(<MemoryRouter><NavPrincipal /></MemoryRouter>)
    expect(screen.queryByRole('link', { name: /poupan/i })).toBeNull()
  })

  // aria-current é o que um leitor de tela usa para dizer "você está aqui".
  // Sem ele, a página ativa só se distingue por cor.
  it('marca a rota ativa com aria-current', () => {
    render(<MemoryRouter initialEntries={['/faturas']}><NavPrincipal /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Faturas' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Painel' })).not.toHaveAttribute('aria-current')
  })
})
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run src/navegacao --root frontend`
Expected: FAIL — módulo não existe

- [ ] **Step 5: Implementar `NavPrincipal`**

`NavLink` do react-router já emite `aria-current="page"` sozinho na rota ativa. Estilo mínimo e provisório — a Fatia 3 redesenha.

```tsx
import { NavLink } from 'react-router-dom'
import { ROTAS } from './rotas'

export function NavPrincipal() {
  return (
    <nav aria-label="Seções" className="flex flex-wrap gap-1 border-b border-carvao-700">
      {ROTAS.map((r) => (
        <NavLink
          key={r.caminho}
          to={r.caminho}
          end={r.caminho === '/'}
          className={({ isActive }) =>
            `px-3 py-2 text-sm transition-colors ${
              isActive ? 'text-tinta' : 'text-tinta-tenue hover:text-tinta'
            }`
          }
        >
          {r.rotulo}
        </NavLink>
      ))}
    </nav>
  )
}
```

`end` no `/` é obrigatório: sem ele o Painel fica ativo em **todas** as rotas, porque `/` é prefixo de tudo.

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/navegacao --root frontend`
Expected: PASS (3 testes)

- [ ] **Step 7: Ligar no `App.tsx`**

Envolver a área logada em `<BrowserRouter>`, pôr `<NavPrincipal/>` abaixo do cabeçalho e `<Routes>` com **todas as rotas apontando para `<Dashboard/>` por enquanto**. A tela de acesso (`precisaLogin`) fica fora do router — ela não tem navegação.

- [ ] **Step 8: Verificação completa**

Run: `npm test && npm run build && npm run lint`
Expected: 508+ testes, tudo verde. O app funciona igual, agora com barra.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(nav): barra de navegacao e rotas (ainda todas no Painel)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `DadosProvider` — carregar uma vez para sete páginas

**Files:**
- Create: `frontend/src/dados/DadosProvider.tsx`
- Test: `frontend/src/dados/DadosProvider.test.tsx`
- Modify: `frontend/src/ui/Dashboard.tsx` (passa a consumir o contexto)

**Interfaces:**
- Produces: `<DadosProvider>`, e `useDados(): { todas, docsSaldo, carregando, erro, recarregar, aplicarEdicao }`.

O `Dashboard.tsx:161-193` já tem exatamente essa lógica (`carregar`, com `Promise.all` de categorias/transações/saldos). A task **move** esse bloco, não reescreve.

- [ ] **Step 1: Escrever o teste**

```tsx
it('carrega uma vez só, mesmo com vários consumidores', async () => {
  render(
    <DadosProvider>
      <Consumidor /><Consumidor /><Consumidor />
    </DadosProvider>,
  )
  await waitFor(() => expect(puxarTudo).toHaveBeenCalledTimes(1))
})

it('expõe o erro sem derrubar a árvore', async () => {
  vi.mocked(puxarTudo).mockRejectedValueOnce(new Error('rede caiu'))
  render(<DadosProvider><Consumidor /></DadosProvider>)
  await screen.findByText(/rede caiu/)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/dados/DadosProvider --root frontend`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar movendo o bloco do Dashboard**

Recortar `carregar`, os estados `todas`/`docsSaldo`/`carregando`/`erro` e `aplicarEdicao` do `Dashboard.tsx` para o provider, expondo por contexto. Preservar o comportamento de abrir na competência mais recente (`Dashboard.tsx:175-183`).

- [ ] **Step 4: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS. Os testes do Dashboard continuam verdes — precisam do provider em volta; onde falharem por falta dele, envolver no `render`.

- [ ] **Step 5: Verificação e commit**

```bash
npm test && npm run build && npm run lint
git add -A
git commit -m "refactor(dados): DadosProvider carrega uma vez para todas as paginas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Faturas e Categorias — de modal para página

**Files:**
- Modify: `frontend/src/ui/Documentos.tsx` → extrai `<ConteudoDocumentos/>`
- Modify: `frontend/src/ui/Categorias.tsx` → extrai `<ConteudoCategorias/>`
- Create: `frontend/src/paginas/Faturas.tsx`, `frontend/src/paginas/Categorias.tsx`

**Interfaces:**
- Consumes: `useDados()` da Task 3.
- Produces: `<ConteudoDocumentos onMudou contagem pagamentos/>` e `<ConteudoCategorias onMudou usoPorSlug/>` — **sem `onFechar`**, que é conceito de modal.

O invólucro de modal (`Portal`, `useTravarRolagem`, tecla Escape, clique no véu, botão de fechar) é **descartado**, não adaptado: numa página ele seria um bug (travaria a rolagem da página inteira e o Escape não teria o que fechar).

- [ ] **Step 1: Escrever o teste de que a página não trava a rolagem**

```tsx
it('não trava a rolagem do body — isso é comportamento de modal', () => {
  render(<MemoryRouter><DadosProvider><Faturas /></DadosProvider></MemoryRouter>)
  expect(document.body.style.overflow).not.toBe('hidden')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/paginas --root frontend`
Expected: FAIL — página não existe

- [ ] **Step 3: Extrair o miolo**

Em `Documentos.tsx`, separar o que hoje está dentro de `<Portal>` num `ConteudoDocumentos` que não conhece `onFechar`. O `Documentos` modal deixa de ser usado e é **apagado junto com seu invólucro** — não fica código morto. `Documentos.test.tsx` e `Documentos.quitacao.test.tsx` são reapontados para o conteúdo.

Mesmo procedimento em `Categorias.tsx`.

- [ ] **Step 4: Escrever as páginas**

Cada página lê o que precisa de `useDados()` e monta o conteúdo. Os `useMemo` de `contagemPorDoc`, `pagamentos` e `usoPorSlug` saem do `Dashboard.tsx` e vão para a página que os usa.

- [ ] **Step 5: Apontar as rotas**

Em `App.tsx`, `/faturas` → `<Faturas/>`, `/categorias` → `<Categorias/>`. Remover os botões "Documentos" e "Categorias" do topo do Dashboard e os estados `mostrarDocs`/`mostrarCats` — a navegação agora é a barra.

- [ ] **Step 6: Verificação e commit**

```bash
npm test && npm run build && npm run lint
git add -A
git commit -m "feat(nav): Faturas e Categorias viram paginas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Lançamentos, Recorrências e Importação

**Files:**
- Create: `frontend/src/paginas/Lancamentos.tsx`, `Recorrencias.tsx`, `Importacao.tsx`
- Modify: `frontend/src/App.tsx` (o fluxo de importar sai do branch e vira rota)

- [ ] **Step 1: Página de Lançamentos**

Recebe as três vistas que hoje vivem no `Conteudo` do Dashboard (`por categoria`, `por dia`, `todos`), com a busca e o filtro de categoria vindos de `lerFiltros`. Mudar filtro escreve na URL via `escreverFiltros`.

- [ ] **Step 2: Página de Recorrências**

Envolve `<Recorrencias recorrencias alertas/>`, que já existe e não muda. Os `useMemo` de `detectarRecorrencias`/`alertasDe` saem do Dashboard.

- [ ] **Step 3: Página de Importação**

Move o `Dropzone` + `ResultadoImport` do `App.tsx` (hoje um branch por `estado.fase`/`importando`) para a rota `/importar`. Salvar com sucesso navega para `/` — hoje isso é `setImportando(false)`.

- [ ] **Step 4: Verificação e commit**

```bash
npm test && npm run build && npm run lint
git add -A
git commit -m "feat(nav): Lancamentos, Recorrencias e Importacao viram paginas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Página Datas (nova)

**Files:**
- Create: `frontend/src/paginas/Datas.tsx`, `frontend/src/dados/calendario.ts`
- Test: `frontend/src/dados/calendario.test.ts`

**Interfaces:**
- Consumes: `detectarRecorrencias()` de `domain/recorrencias` — o `diaTipico` (mediana do dia) **já é** o calendário, como registrado em 2026-08-05.
- Produces: `diasDoMes(recorrencias, ano, mes): Array<{ dia: number; itens: Recorrencia[] }>`

Única página com lógica nova. Nada de dado digitado: deriva do que já é importado, como manda a decisão estruturante do projeto.

- [ ] **Step 1: Testes de `diasDoMes`**

```ts
it('agrupa recorrências pelo dia típico', () => {
  const r = [rec({ diaTipico: 5 }), rec({ diaTipico: 5 }), rec({ diaTipico: 20 })]
  const dias = diasDoMes(r, 2026, 8)
  expect(dias.find((d) => d.dia === 5)?.itens).toHaveLength(2)
  expect(dias.find((d) => d.dia === 20)?.itens).toHaveLength(1)
})

// Fevereiro não tem dia 30: uma série com diaTipico 30 tem que aparecer no
// último dia do mês, não sumir da tela nem gerar um dia inexistente.
it('encaixa dia 30 em fevereiro no último dia do mês', () => {
  const dias = diasDoMes([rec({ diaTipico: 30 })], 2026, 2)
  expect(dias.find((d) => d.itens.length > 0)?.dia).toBe(28)
})
```

- [ ] **Step 2: Rodar, ver falhar, implementar, ver passar**

Run: `npx vitest run src/dados/calendario --root frontend`

- [ ] **Step 3: Montar a página** — grade do mês, dias com compromisso destacados.

- [ ] **Step 4: Verificação e commit**

```bash
npm test && npm run build && npm run lint
git add -A
git commit -m "feat(nav): pagina Datas derivada do dia tipico das recorrencias

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Enxugar o Painel e matar a barra de rolagem

**Files:**
- Modify: `frontend/src/ui/Dashboard.tsx` → `frontend/src/paginas/Painel.tsx`

Só agora, com o conteúdo distribuído, a coluna lateral deixa de ser mais alta que a janela — e a regra que criou a barra pode sair sem reintroduzir o bug que ela conserta.

- [ ] **Step 1: Escrever o teste que prova a ausência da barra**

```tsx
it('não põe barra de rolagem própria na coluna lateral', () => {
  const { container } = render(<MemoryRouter><DadosProvider><Painel /></DadosProvider></MemoryRouter>)
  expect(container.querySelector('.overflow-y-auto')).toBeNull()
  expect(container.innerHTML).not.toContain('max-h-[calc(100vh')
})
```

- [ ] **Step 2: Rodar e ver falhar** — a classe ainda está lá.

- [ ] **Step 3: Remover a regra**

Apagar `xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto` do `<div>` da coluna lateral. O Painel fica com: tiles, saldos por conta, gráfico de categorias, maiores saídas, evolução e compromissos futuros. Recorrências e as listas longas já moraram para outras páginas.

- [ ] **Step 4: Rodar e ver passar**

- [ ] **Step 5: Medir de verdade, no navegador**

```bash
npm run dev &
python scripts/medir-overflow.py
```

Expected: OK em 1280×800 e 390×844. O medidor só reprova rolagem **lateral** — a checagem de que a coluna não gruda é o teste do Step 1.

- [ ] **Step 6: Verificação e commit**

```bash
npm test && npm run build && npm run lint
git add -A
git commit -m "fix(painel): fim da barra de rolagem da coluna lateral

A regra xl:max-h + overflow-y-auto existia porque a coluna acumulava
donut, maiores saidas, evolucao, recorrencias e compromissos e passava
da altura da janela — sticky mais alto que a viewport gruda e o que
sobra embaixo fica inalcancavel. Com o conteudo distribuido em sete
paginas a coluna nao alcanca mais esse tamanho, entao a regra sai sem
trazer de volta o bug que ela consertava.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verificação final da fatia

- [ ] `npm test && npm run build && npm run lint` verdes
- [ ] As 7 rotas abrem, e recarregar em cada uma funciona (o rewrite de SPA já está no ar desde a Fatia 1a)
- [ ] Voltar/avançar do navegador funciona
- [ ] Um link com filtros (`/lancamentos?q=posto&cat=combustivel`) reabre no mesmo recorte
- [ ] `python scripts/medir-overflow.py` OK nos dois viewports
- [ ] Nenhuma barra de rolagem interna sobrou; nada de conteúdo cortado
- [ ] `Dashboard.tsx` não existe mais como arquivo de 846 linhas
