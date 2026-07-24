# Relatório em PDF + compartilhar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar um arquivo PDF de verdade do relatório e baixá-lo ou compartilhá-lo (WhatsApp etc.), no lugar do `window.print()`.

**Architecture:** Uma função pura molda os números do dashboard num objeto `DadosRelatorio`; outra gera um Blob PDF com jsPDF (import dinâmico); uma terceira decide entre `navigator.share` (celular) e download (desktop). O Dashboard liga tudo no clique.

**Tech Stack:** TypeScript, React 19, Vitest, **jsPDF** + **jspdf-autotable** (só via import dinâmico), Web Share API.

## Global Constraints

- Valores em **centavos**; formatação de exibição via `formatBRL` de `src/domain/normalize/money.ts`.
- jsPDF/jspdf-autotable **só por import dinâmico** — nunca no topo de um módulo que entra no bundle inicial.
- Botão único: rótulo **"Baixar / Compartilhar PDF"**. Nome do arquivo: `relatorio-<slug>.pdf`.
- Cancelar a folha de compartilhar (`AbortError`) **não é erro** — silencioso.
- **E-mail está fora** desta rodada e do roadmap (remover o passo 3 no `ESTADO-ATUAL`).
- Após cada task: `npm test`. No fim: `npm run build && npm run lint && npx tsc -b --force`.
- Commits diretos na `main` (push publica na Vercel). Co-author: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `montarDadosRelatorio` — moldagem pura dos dados

**Files:**
- Create: `src/lib/relatorio-pdf.ts`
- Test: `src/lib/relatorio-pdf.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SaldoLinha = { bank: string; balanceCents: number; date: string }
  export type CategoriaLinha = { nome: string; valorCents: number; pct: number }
  export type DadosRelatorio = {
    periodoLabel: string
    agrupamento: string
    geradoEm: Date
    entradasCents: number
    saidasCents: number
    saldoPeriodoCents: number
    saldos: SaldoLinha[]
    categorias: CategoriaLinha[]
  }
  export type EntradaRelatorio = {
    periodoLabel: string
    agrupamento: string
    geradoEm?: Date
    resumo: { gastoCents: number; entradasCents: number; porCategoria: { cat: { nome: string }; totalCents: number }[] }
    saldos: SaldoLinha[]
  }
  export function montarDadosRelatorio(e: EntradaRelatorio): DadosRelatorio
  ```

- [ ] **Step 1: Escrever o teste que falha**

Create `src/lib/relatorio-pdf.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { montarDadosRelatorio } from './relatorio-pdf'

const entrada = {
  periodoLabel: 'Junho 2026',
  agrupamento: 'por fatura',
  geradoEm: new Date('2026-07-24T12:00:00'),
  resumo: {
    gastoCents: 10000,
    entradasCents: 30000,
    porCategoria: [
      { cat: { nome: 'Supermercado' }, totalCents: 7000 },
      { cat: { nome: 'Transporte' }, totalCents: 3000 },
    ],
  },
  saldos: [{ bank: 'nubank', balanceCents: 250000, date: '2026-06-30' }],
}

describe('montarDadosRelatorio', () => {
  it('mapeia totais e saldo do período', () => {
    const d = montarDadosRelatorio(entrada)
    expect(d.entradasCents).toBe(30000)
    expect(d.saidasCents).toBe(10000)
    expect(d.saldoPeriodoCents).toBe(20000)
  })

  it('calcula % por categoria e preserva a ordem', () => {
    const d = montarDadosRelatorio(entrada)
    expect(d.categorias[0]).toEqual({ nome: 'Supermercado', valorCents: 7000, pct: 70 })
    expect(d.categorias[1]).toEqual({ nome: 'Transporte', valorCents: 3000, pct: 30 })
  })

  it('não divide por zero quando não há gasto', () => {
    const d = montarDadosRelatorio({ ...entrada, resumo: { gastoCents: 0, entradasCents: 0, porCategoria: [] } })
    expect(d.categorias).toEqual([])
    expect(d.saldoPeriodoCents).toBe(0)
  })

  it('repassa os saldos por conta', () => {
    const d = montarDadosRelatorio(entrada)
    expect(d.saldos).toEqual([{ bank: 'nubank', balanceCents: 250000, date: '2026-06-30' }])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/relatorio-pdf.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

Create `src/lib/relatorio-pdf.ts`:

```ts
export type SaldoLinha = { bank: string; balanceCents: number; date: string }
export type CategoriaLinha = { nome: string; valorCents: number; pct: number }

export type DadosRelatorio = {
  periodoLabel: string
  agrupamento: string
  geradoEm: Date
  entradasCents: number
  saidasCents: number
  saldoPeriodoCents: number
  saldos: SaldoLinha[]
  categorias: CategoriaLinha[]
}

export type EntradaRelatorio = {
  periodoLabel: string
  agrupamento: string
  geradoEm?: Date
  resumo: {
    gastoCents: number
    entradasCents: number
    porCategoria: { cat: { nome: string }; totalCents: number }[]
  }
  saldos: SaldoLinha[]
}

/** Molda os números já em memória no dashboard para o relatório. Pura. */
export function montarDadosRelatorio(e: EntradaRelatorio): DadosRelatorio {
  const { gastoCents, entradasCents, porCategoria } = e.resumo
  const categorias: CategoriaLinha[] = porCategoria.map((c) => ({
    nome: c.cat.nome,
    valorCents: c.totalCents,
    pct: gastoCents > 0 ? (c.totalCents / gastoCents) * 100 : 0,
  }))
  return {
    periodoLabel: e.periodoLabel,
    agrupamento: e.agrupamento,
    geradoEm: e.geradoEm ?? new Date(),
    entradasCents,
    saidasCents: gastoCents,
    saldoPeriodoCents: entradasCents - gastoCents,
    saldos: e.saldos,
    categorias,
  }
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/lib/relatorio-pdf.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorio-pdf.ts src/lib/relatorio-pdf.test.ts
git commit -m "feat: montarDadosRelatorio molda os numeros do relatorio

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `gerarRelatorioPdf` — Blob PDF com jsPDF

**Files:**
- Modify: `src/lib/relatorio-pdf.ts` (adiciona a função de geração)
- Test: `src/lib/relatorio-pdf.test.ts` (adiciona o smoke)
- Modify: `package.json` (deps `jspdf`, `jspdf-autotable`)

**Interfaces:**
- Consumes: `DadosRelatorio`, `montarDadosRelatorio` (Task 1); `formatBRL` de `../domain/normalize/money`.
- Produces: `export async function gerarRelatorioPdf(dados: DadosRelatorio): Promise<Blob>`

- [ ] **Step 1: Instalar as dependências**

Run:
```bash
npm install jspdf jspdf-autotable
```
Expected: adiciona as duas a `dependencies` sem erro.

- [ ] **Step 2: Escrever o smoke que falha**

Adicione ao `src/lib/relatorio-pdf.test.ts`:

```ts
import { gerarRelatorioPdf } from './relatorio-pdf'

describe('gerarRelatorioPdf', () => {
  it('gera um Blob PDF (começa com %PDF-)', async () => {
    const dados = montarDadosRelatorio(entrada)
    const blob = await gerarRelatorioPdf(dados)
    expect(blob.type).toContain('pdf')
    const head = await blob.slice(0, 5).text()
    expect(head).toBe('%PDF-')
  })
})
```

- [ ] **Step 3: Rodar e ver falhar** — `npx vitest run src/lib/relatorio-pdf.test.ts` → FAIL (`gerarRelatorioPdf` não existe).

- [ ] **Step 4: Implementar**

Adicione ao fim de `src/lib/relatorio-pdf.ts`:

```ts
import { formatBRL } from '../domain/normalize/money'

const MESES_SALDO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function dataCurta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d}/${MESES_SALDO[(m ?? 1) - 1]}`
}

const NOMES_BANCO: Record<string, string> = {
  nubank: 'Nubank', bradesco: 'Bradesco', bb: 'Banco do Brasil', sicredi: 'Sicredi', sicoob: 'Sicoob',
}

/** Gera o PDF do relatório. jsPDF e o plugin de tabela entram por import
 *  dinâmico — ficam fora do bundle inicial, só carregam no clique. */
export async function gerarRelatorioPdf(dados: DadosRelatorio): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const M = 48
  let y = 56

  doc.setFontSize(10).setTextColor(150)
  doc.text('CAPITAL FINANCEIRO', M, y)
  y += 22
  doc.setFontSize(20).setTextColor(20)
  doc.text(`Relatório · ${dados.periodoLabel}`, M, y)
  y += 16
  doc.setFontSize(9).setTextColor(150)
  doc.text(`${dados.agrupamento} · gerado em ${dados.geradoEm.toLocaleDateString('pt-BR')}`, M, y)
  y += 28

  doc.setFontSize(11).setTextColor(40)
  doc.text(`Entradas: ${formatBRL(dados.entradasCents)}`, M, y); y += 16
  doc.text(`Saídas: ${formatBRL(dados.saidasCents)}`, M, y); y += 16
  doc.text(`Saldo do período: ${formatBRL(dados.saldoPeriodoCents)}`, M, y); y += 24

  if (dados.saldos.length > 0) {
    doc.setFontSize(12).setTextColor(20).text('Saldo por conta', M, y); y += 16
    doc.setFontSize(10).setTextColor(60)
    for (const s of dados.saldos) {
      const nome = NOMES_BANCO[s.bank] ?? s.bank
      doc.text(`${nome}: ${formatBRL(s.balanceCents)}  (em ${dataCurta(s.date)})`, M, y)
      y += 15
    }
    y += 12
  }

  autoTable(doc, {
    startY: y,
    head: [['Categoria', 'Valor', '%']],
    body: dados.categorias.map((c) => [c.nome, formatBRL(c.valorCents), `${c.pct.toFixed(1)}%`]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [40, 40, 40] },
    margin: { left: M, right: M },
  })

  const fim = doc.internal.pageSize.getHeight() - 24
  doc.setFontSize(8).setTextColor(160)
  doc.text('Gerado por Capital Financeiro · capital-financeiro.vercel.app', M, fim)

  return doc.output('blob')
}
```

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run src/lib/relatorio-pdf.test.ts` → PASS.

> Se o jsPDF não rodar no jsdom (erro de ambiente ao instanciar), remova o smoke
> `gerarRelatorioPdf` do teste e deixe só os de `montarDadosRelatorio`; a geração é
> verificada no navegador na Task 4. Não invente mocks do jsPDF.

- [ ] **Step 6: Commit**

```bash
git add src/lib/relatorio-pdf.ts src/lib/relatorio-pdf.test.ts package.json package-lock.json
git commit -m "feat: gerarRelatorioPdf monta o PDF com jsPDF (import dinamico)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `baixarOuCompartilhar` — share ou download

**Files:**
- Create: `src/lib/compartilhar.ts`
- Test: `src/lib/compartilhar.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function baixarOuCompartilhar(
    blob: Blob, nomeArquivo: string, meta: { title: string; text: string },
  ): Promise<'compartilhado' | 'baixado'>
  ```

- [ ] **Step 1: Escrever os testes que falham**

Create `src/lib/compartilhar.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { baixarOuCompartilhar } from './compartilhar'

const blob = new Blob(['x'], { type: 'application/pdf' })
const meta = { title: 'T', text: 'texto' }

afterEach(() => {
  vi.restoreAllMocks()
  // limpa o que os testes definirem
  delete (navigator as unknown as { canShare?: unknown }).canShare
  delete (navigator as unknown as { share?: unknown }).share
})

function definir(nome: 'canShare' | 'share', valor: unknown) {
  Object.defineProperty(navigator, nome, { value: valor, configurable: true })
}

describe('baixarOuCompartilhar', () => {
  it('compartilha quando o aparelho suporta arquivos', async () => {
    definir('canShare', () => true)
    const share = vi.fn().mockResolvedValue(undefined)
    definir('share', share)
    const r = await baixarOuCompartilhar(blob, 'relatorio.pdf', meta)
    expect(r).toBe('compartilhado')
    expect(share).toHaveBeenCalled()
  })

  it('cancelar (AbortError) não vira erro', async () => {
    definir('canShare', () => true)
    definir('share', vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')))
    await expect(baixarOuCompartilhar(blob, 'relatorio.pdf', meta)).resolves.toBe('compartilhado')
  })

  it('sem suporte a share, baixa o arquivo', async () => {
    // canShare/share ausentes
    const criar = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revogar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const r = await baixarOuCompartilhar(blob, 'relatorio.pdf', meta)
    expect(r).toBe('baixado')
    expect(criar).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalled()
    expect(revogar).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/compartilhar.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

Create `src/lib/compartilhar.ts`:

```ts
type NavShare = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
}

/** Compartilha o PDF (celular) ou baixa (desktop). Cancelar a folha de
 *  compartilhar não é erro. */
export async function baixarOuCompartilhar(
  blob: Blob,
  nomeArquivo: string,
  meta: { title: string; text: string },
): Promise<'compartilhado' | 'baixado'> {
  const file = new File([blob], nomeArquivo, { type: 'application/pdf' })
  const nav = navigator as NavShare

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: meta.title, text: meta.text })
    } catch (e) {
      // Usuário fechou a folha de compartilhar: não é falha.
      if (!(e instanceof DOMException && e.name === 'AbortError')) throw e
    }
    return 'compartilhado'
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'baixado'
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/lib/compartilhar.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/compartilhar.ts src/lib/compartilhar.test.ts
git commit -m "feat: baixarOuCompartilhar (share no celular, download no desktop)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Ligar no Dashboard e no MenuAcoes

**Files:**
- Modify: `src/ui/Dashboard.tsx`
- Modify: `src/ui/MenuAcoes.tsx`

**Interfaces:**
- Consumes: `montarDadosRelatorio`, `gerarRelatorioPdf` (Tasks 1-2), `baixarOuCompartilhar` (Task 3). Todos por **import dinâmico** no clique.
- No Dashboard já existem em escopo: `resumo` (de `agregar`), `saldos` (de `saldosPorConta`), `periodo`, `ref`, e as funções `rotulo(periodo, ref)` e `agrupamentoDe(periodo)`.

- [ ] **Step 1: Estado de "gerando" e a função no Dashboard**

Em `src/ui/Dashboard.tsx`, adicione o estado perto dos outros:
```ts
const [gerandoPdf, setGerandoPdf] = useState(false)
```
E a função (dentro do componente, perto de `carregar`):
```ts
async function baixarPdf() {
  if (!txs || txs.length === 0) return
  setGerandoPdf(true)
  try {
    const { montarDadosRelatorio, gerarRelatorioPdf } = await import('../lib/relatorio-pdf')
    const { baixarOuCompartilhar } = await import('../lib/compartilhar')
    const label = rotulo(periodo, ref)
    const dados = montarDadosRelatorio({
      periodoLabel: label,
      agrupamento: agrupamentoDe(periodo),
      resumo,
      saldos: saldos.map((s) => ({ bank: s.bank, balanceCents: s.balanceCents, date: s.date })),
    })
    const blob = await gerarRelatorioPdf(dados)
    const slug = label.toLowerCase().replace(/\s+/g, '-')
    await baixarOuCompartilhar(blob, `relatorio-${slug}.pdf`, {
      title: `Relatório · ${label}`,
      text: `Meu relatório de ${label} — Capital Financeiro.`,
    })
  } catch {
    toast.error('Não consegui gerar o PDF.')
  } finally {
    setGerandoPdf(false)
  }
}
```
> Confirme que `toast` já está importado no Dashboard (`import { toast } from 'sonner'`). Se não estiver, adicione.

- [ ] **Step 2: Trocar o botão desktop**

Localize o botão que hoje faz `onClick={() => window.print()}` (rótulo "Baixar PDF") e troque para:
```tsx
<button
  onClick={baixarPdf}
  disabled={gerandoPdf}
  className="rounded-xl border border-carvao-700 px-4 py-2 text-sm text-tinta transition-all hover:-translate-y-0.5 hover:bg-carvao-850 hover:shadow-lg hover:shadow-black/20 active:translate-y-0 disabled:opacity-50"
  title="Gera um PDF do período e abre o compartilhamento (ou baixa)"
>
  {gerandoPdf ? 'Gerando…' : 'Baixar / Compartilhar PDF'}
</button>
```

- [ ] **Step 3: Trocar a chamada do MenuAcoes (mobile)**

Localize `onBaixarPDF={txs && txs.length > 0 ? () => window.print() : undefined}` e troque para:
```tsx
onBaixarPDF={txs && txs.length > 0 ? baixarPdf : undefined}
```

- [ ] **Step 4: Rótulo do item no MenuAcoes**

Em `src/ui/MenuAcoes.tsx`, troque o texto do item de PDF:
```tsx
<span aria-hidden>📤</span> Baixar / Compartilhar PDF
```
(era `⬇️ Baixar PDF`).

- [ ] **Step 5: Verificar**

Run: `npx tsc -b --force` (exit 0) e `npm test` (tudo verde). Não há teste de componente novo aqui — a lógica testável vive nas Tasks 1-3; este passo é fiação.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Dashboard.tsx src/ui/MenuAcoes.tsx
git commit -m "feat: botao gera e compartilha o PDF do relatorio (no lugar do print)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verificação final + docs + push

**Files:**
- Modify: `README.md`
- Modify: `docs/ESTADO-ATUAL.md`

- [ ] **Step 1: Verificação completa**

Run: `npm test && npm run build && npm run lint && npx tsc -b --force`
Expected: testes verdes, build OK (confirme que jsPDF saiu em **chunk próprio**, não no index principal), lint OK, tsc exit 0.

- [ ] **Step 2: README**

Em `README.md`, ajuste o item do relatório para refletir a geração real e o compartilhar (o texto atual já diz "Relatório em PDF" após a rodada anterior — garanta que menciona **gerar arquivo e compartilhar**, não imprimir).

- [ ] **Step 3: ESTADO-ATUAL — concluir item 2 e remover o e-mail**

Em `docs/ESTADO-ATUAL.md`, na fila item 2: marcar **PDF real + compartilhar como concluídos**; **remover o passo 3 (e-mail)** do roadmap (decisão do usuário de 2026-07-24 de não fazer e-mail). Atualizar a contagem de testes.

- [ ] **Step 4: Commit e push**

```bash
git add README.md docs/ESTADO-ATUAL.md
git commit -m "docs: relatorio PDF real + compartilhar no ar; e-mail fora do roadmap

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 5: Teste no navegador (pós-deploy)**

Abrir o app, ir a um período com lançamentos, clicar **Baixar / Compartilhar PDF**:
no desktop deve **baixar** um PDF legível (cabeçalho, totais, saldo por conta, tabela
por categoria); no celular deve abrir a **folha de compartilhamento** com o arquivo.
