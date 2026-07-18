# Ingestão de Documentos Financeiros — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o pipeline que transforma um PDF de fatura/extrato de banco em transações categorizadas, conferidas contra o total declarado pelo banco, exibidas numa tela de revisão — tudo no navegador, sem backend.

**Architecture:** Pipeline de funções puras encadeadas: `File → TextItem[] → Line[] → DocKind → ParseResult → Transaction[]`. O pdf.js entrega texto com coordenadas X/Y; a reconstrução de linhas por posição resolve colunas (Crédito vs Débito no Bradesco só se distinguem pelo X). Cada parser é dedicado a um emissor+tipo e devolve a mesma interface `ParseResult`, permitindo adicionar bancos sem tocar em nada a jusante. A validação compara o total extraído com o total que o próprio documento declara.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind v4, pdfjs-dist, Sonner, Zod.

## Global Constraints

- **Sem persistência nesta fatia.** O pipeline termina na tela de revisão. Supabase, auth e schema são fatia 1. Nenhuma task aqui escreve em banco.
- **Sem OCR.** Todos os documentos de referência são PDF de texto nativo.
- **Tolerância de validação: R$ 0,00.** Os quatro gabaritos batem exatamente.
- **Fixtures são JSON de `TextItem[]` anonimizados**, commitados em `tests/fixtures/`. PDFs reais nunca entram no git (`.gitignore` já bloqueia `*.pdf`).
- **`description` é imutável.** Texto do usuário vai em `label`. Nunca sobrescrever a descrição do banco.
- **Valores monetários em centavos (`number` inteiro) internamente** — evita erro de ponto flutuante. Conversão para exibição só na UI.
- Idioma de UI e mensagens: **português brasileiro**.

## Estado da execução

| Task | Estado |
|---|---|
| 1. Scaffold | ✅ commit `150f2e7` |
| 2. Primitivas de normalização | ✅ commit `150f2e7` |
| 3. Extração pdf.js + fixtures | ✅ commit `47fd273` |
| 4. Reconstrução de linhas | ✅ commit `47fd273` |
| 5. Detecção de emissor/tipo | ✅ commit `47fd273` |
| 6–14 | pendentes de redação |

PDFs de referência em `D:\extratos\junho2026` (fora do repositório). Fixtures gerados com `npm run fixtures -- D:/extratos/junho2026`.

**73 testes passando.**

---

## Coordenadas medidas (referência para as Tasks 6–14)

Medidas nos fixtures reais. **Estes números são fato, não estimativa** — qualquer parser que os contradiga está errado.

### Descoberta que corrige o design original

**Valores monetários são alinhados à DIREITA.** O X do `TextItem` é a borda *esquerda*, então um valor curto tem X maior que um longo na mesma coluna:

| Valor | X (esquerda) | Borda direita | Coluna |
|---|---|---|---|
| `0,00` | ~415 | **426,7** | Crédito |
| `298,56` | ~405 | **426,8** | Crédito |
| `10.000,00` | ~395 | **426,8** | Crédito |

Pela borda esquerda, `0,00` e `10.000,00` estão a 20pt de distância — seriam classificados como colunas diferentes, fazendo **crédito virar débito conforme o tamanho do número**. Pela borda direita, a 0,1pt.

Por isso `cellAtRight(line, right, tol=3)` casa por borda direita, e `cellAt(line, xMin, xMax)` (borda esquerda) só serve para texto alinhado à esquerda, como descrições.

### Extrato Bradesco — colunas

| Coluna | Cabeçalho X | **Borda direita dos valores** |
|---|---|---|
| Data | 46,1 | — (texto, use `cellAt`) |
| Histórico | 110,6 | — (texto) |
| Docto. | 304,9 | — |
| Crédito (R$) | 385,0 | **426,7** |
| Débito (R$) | 451,7 | **490,5** |
| Saldo (R$) | 519,8 | **550,5** |

Cabeçalho da tabela em Y=680,7 na página 1.

### Contagem de items por documento

| Fixture | Items | Páginas |
|---|---|---|
| `bradesco-fatura` | 467 | 3 |
| `bradesco-extrato` | 183 | 3 |
| `nubank-extrato` | 166 | 3 |
| `nubank-fatura` | 502 | 8 |

### Gabaritos a validar (Task 10)

| Documento | Fórmula | Resultado |
|---|---|---|
| Extrato Nubank | `108,24 + 8.531,25 − 8.613,81` | `25,68` |
| Extrato Bradesco | `55.575,13 + 33.265,53 − 41.841,65` | `46.999,01` |
| Fatura Bradesco | `4.782,64 − 4.839,43 + 5.586,23` | `5.529,44` |
| Fatura Nubank | `8.320,22 + 4,02` | `8.324,24` |

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Delete: `js/` (12 arquivos), `css/`, `index.html` antigo — substituídos pela nova stack
- Test: `src/smoke.test.ts`

**Interfaces:**
- Consumes: nada (primeira task)
- Produces: projeto Vite rodando com `npm run dev`; Vitest rodando com `npm test`

**Nota sobre o app antigo:** o `index.html` + `js/` + `css/` atuais são a versão de digitação manual que esta reescrita substitui. Eles saem neste commit. O histórico do git preserva tudo — nada é perdido.

- [ ] **Step 1: Criar o projeto Vite**

```bash
cd d:/Projetos_Programacao/controle-financeiro
npm create vite@latest . -- --template react-ts
```

Responder `y` para prosseguir em diretório não-vazio. O comando preserva `.git`, `docs/`, `.gitignore`, `public/`.

- [ ] **Step 2: Instalar dependências**

```bash
npm install
npm install pdfjs-dist sonner zod
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configurar Vite com Tailwind e Vitest**

Substituir `vite.config.ts` inteiro:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: Configurar Tailwind v4**

Substituir `src/index.css` inteiro:

```css
@import "tailwindcss";
```

- [ ] **Step 5: Adicionar script de teste**

Em `package.json`, dentro de `"scripts"`, adicionar:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Escrever o teste de fumaça**

Criar `src/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('scaffold', () => {
  it('roda testes', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 7: Rodar o teste**

Run: `npm test`
Expected: PASS — 1 teste passa.

- [ ] **Step 8: Remover o app antigo**

```bash
git rm -r js/ css/
```

O `index.html` já foi sobrescrito pelo Vite no Step 1.

- [ ] **Step 9: Verificar que o dev server sobe**

Run: `npm run dev`
Expected: servidor em `http://localhost:5173`, página React padrão carrega sem erro no console. Encerrar com Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold React 19 + TS + Vite + Tailwind v4 + Vitest

Substitui o app vanilla-JS de digitação manual pela stack da reescrita.
O app antigo permanece no histórico do git.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Primitivas de normalização

Funções puras, sem dependência de PDF. **Não bloqueada pelos fixtures** — pode ser feita antes dos arquivos chegarem.

**Files:**
- Create: `src/normalize/money.ts`, `src/normalize/date.ts`, `src/normalize/installment.ts`, `src/normalize/merchant.ts`
- Test: `src/normalize/money.test.ts`, `src/normalize/date.test.ts`, `src/normalize/installment.test.ts`, `src/normalize/merchant.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `parseBRL(raw: string): number` — devolve **centavos** (inteiro). Negativo para crédito.
  - `inferYear(day: number, month: number, reference: Date): Date`
  - `extractInstallment(desc: string): { installment: Installment | null; clean: string }`
  - `type Installment = { current: number; total: number }`
  - `normalizeMerchant(desc: string): string`

- [ ] **Step 1: Escrever os testes de `parseBRL`**

Criar `src/normalize/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseBRL } from './money'

describe('parseBRL', () => {
  it('converte valor simples para centavos', () => {
    expect(parseBRL('599,75')).toBe(59975)
  })

  it('converte valor com separador de milhar', () => {
    expect(parseBRL('1.277,68')).toBe(127768)
  })

  it('converte valor com prefixo R$', () => {
    expect(parseBRL('R$ 8.324,24')).toBe(832424)
  })

  it('trata sufixo hífen do Bradesco como crédito (negativo)', () => {
    expect(parseBRL('4.782,64 -')).toBe(-478264)
  })

  it('trata estorno do Bradesco como crédito', () => {
    expect(parseBRL('56,79 -')).toBe(-5679)
  })

  it('trata MINUS SIGN U+2212 do Nubank como negativo', () => {
    expect(parseBRL('−R$ 3.644,97')).toBe(-364497)
  })

  it('trata hífen ASCII prefixado como negativo', () => {
    expect(parseBRL('-R$ 3.644,97')).toBe(-364497)
  })

  it('converte zero', () => {
    expect(parseBRL('0,00')).toBe(0)
  })

  it('lança em valor inválido', () => {
    expect(() => parseBRL('abc')).toThrow('Valor monetário inválido')
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/normalize/money.test.ts`
Expected: FAIL — `Failed to resolve import "./money"`.

- [ ] **Step 3: Implementar `parseBRL`**

Criar `src/normalize/money.ts`:

```ts
/** Converte valor monetário brasileiro para centavos (inteiro).
 *  Negativo = crédito. O Bradesco marca crédito com hífen no FIM
 *  ("56,79 -"); o Nubank usa MINUS SIGN U+2212 no início ("−R$ 3.644,97"). */
export function parseBRL(raw: string): number {
  const trimmed = raw.trim()
  const negative = /-\s*$/.test(trimmed) || /^[−-]/.test(trimmed)

  const digits = trimmed.replace(/[R$\s−-]/g, '')
  if (!/^\d{1,3}(\.\d{3})*,\d{2}$|^\d+,\d{2}$|^\d+$/.test(digits)) {
    throw new Error(`Valor monetário inválido: ${raw}`)
  }

  const normalized = digits.replace(/\./g, '').replace(',', '.')
  const value = Math.round(Number(normalized) * 100)
  if (!Number.isFinite(value)) {
    throw new Error(`Valor monetário inválido: ${raw}`)
  }

  return negative ? -value : value
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/normalize/money.test.ts`
Expected: PASS — 9 testes.

- [ ] **Step 5: Escrever os testes de `inferYear`**

Criar `src/normalize/date.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { inferYear } from './date'

describe('inferYear', () => {
  it('atribui o ano da referência quando a data é anterior', () => {
    // Fatura Bradesco vence 28/06/2026; transação em 08/04
    const result = inferYear(8, 4, new Date(2026, 5, 28))
    expect(result).toEqual(new Date(2026, 3, 8))
  })

  it('atribui o ano da referência quando a data é o próprio vencimento', () => {
    const result = inferYear(28, 6, new Date(2026, 5, 28))
    expect(result).toEqual(new Date(2026, 5, 28))
  })

  it('subtrai um ano na virada — dezembro numa fatura de janeiro', () => {
    // Fatura vence 10/01/2027; transação em 28/12 é de 2026
    const result = inferYear(28, 12, new Date(2027, 0, 10))
    expect(result).toEqual(new Date(2026, 11, 28))
  })

  it('trata 20 MAI numa fatura de 29 JUN 2026', () => {
    const result = inferYear(20, 5, new Date(2026, 5, 29))
    expect(result).toEqual(new Date(2026, 4, 20))
  })
})
```

- [ ] **Step 6: Rodar e verificar que falha**

Run: `npx vitest run src/normalize/date.test.ts`
Expected: FAIL — `Failed to resolve import "./date"`.

- [ ] **Step 7: Implementar `inferYear`**

Criar `src/normalize/date.ts`:

```ts
/** Faturas trazem data sem ano ("08/04", "20 MAI"). Infere o ano a partir
 *  de uma referência (vencimento ou fim do período vigente): se a data
 *  cair depois da referência, é do ano anterior. Cobre a virada de ano. */
export function inferYear(day: number, month: number, reference: Date): Date {
  const candidate = new Date(reference.getFullYear(), month - 1, day)
  if (candidate.getTime() > reference.getTime()) {
    return new Date(reference.getFullYear() - 1, month - 1, day)
  }
  return candidate
}

const MESES: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
}

/** Converte mês abreviado do Nubank ("MAI") para número (5). */
export function parseMesAbreviado(abbr: string): number {
  const key = abbr.trim().toUpperCase().slice(0, 3)
  const month = MESES[key]
  if (!month) throw new Error(`Mês inválido: ${abbr}`)
  return month
}
```

- [ ] **Step 8: Adicionar teste de `parseMesAbreviado`**

Acrescentar a `src/normalize/date.test.ts`:

```ts
import { parseMesAbreviado } from './date'

describe('parseMesAbreviado', () => {
  it('converte MAI para 5', () => {
    expect(parseMesAbreviado('MAI')).toBe(5)
  })

  it('converte JUN para 6', () => {
    expect(parseMesAbreviado('JUN')).toBe(6)
  })

  it('é insensível a caixa', () => {
    expect(parseMesAbreviado('dez')).toBe(12)
  })

  it('lança em mês inválido', () => {
    expect(() => parseMesAbreviado('XYZ')).toThrow('Mês inválido')
  })
})
```

- [ ] **Step 9: Rodar e verificar que passa**

Run: `npx vitest run src/normalize/date.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 10: Escrever os testes de `extractInstallment`**

Criar `src/normalize/installment.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractInstallment } from './installment'

describe('extractInstallment', () => {
  it('extrai parcela explícita do Nubank', () => {
    expect(extractInstallment('Dias Gomes Comercio - Parcela 5/8')).toEqual({
      installment: { current: 5, total: 8 },
      clean: 'Dias Gomes Comercio',
    })
  })

  it('extrai parcela grudada do Bradesco', () => {
    expect(extractInstallment('ARAI KAMINISHI COS02/06')).toEqual({
      installment: { current: 2, total: 6 },
      clean: 'ARAI KAMINISHI COS',
    })
  })

  it('extrai parcela com espaço do Bradesco', () => {
    expect(extractInstallment('GOT SERVICOS ADMI 02/02')).toEqual({
      installment: { current: 2, total: 2 },
      clean: 'GOT SERVICOS ADMI',
    })
  })

  it('extrai parcela de linha remendada do Bradesco', () => {
    // "MERCADOLIVRE*MERCADO03/0" + "4" já unidos pela reconstrução de linhas
    expect(extractInstallment('MERCADOLIVRE*MERCADO03/04')).toEqual({
      installment: { current: 3, total: 4 },
      clean: 'MERCADOLIVRE*MERCADO',
    })
  })

  it('extrai parcela da anuidade', () => {
    expect(extractInstallment('ANUIDADE DIFERENCIADA 10/12')).toEqual({
      installment: { current: 10, total: 12 },
      clean: 'ANUIDADE DIFERENCIADA',
    })
  })

  it('devolve null quando não há parcela', () => {
    expect(extractInstallment('Ofertao Supermercado')).toEqual({
      installment: null,
      clean: 'Ofertao Supermercado',
    })
  })

  it('não confunde número de loja com parcela', () => {
    expect(extractInstallment('AUTO POSTO SANTANA 2')).toEqual({
      installment: null,
      clean: 'AUTO POSTO SANTANA 2',
    })
  })

  it('rejeita parcela atual maior que o total', () => {
    expect(extractInstallment('LOJA 09/03')).toEqual({
      installment: null,
      clean: 'LOJA 09/03',
    })
  })

  it('rejeita total acima de 24', () => {
    expect(extractInstallment('LOJA 01/48')).toEqual({
      installment: null,
      clean: 'LOJA 01/48',
    })
  })
})
```

- [ ] **Step 11: Rodar e verificar que falha**

Run: `npx vitest run src/normalize/installment.test.ts`
Expected: FAIL — `Failed to resolve import "./installment"`.

- [ ] **Step 12: Implementar `extractInstallment`**

Criar `src/normalize/installment.ts`:

```ts
export type Installment = { current: number; total: number }

const NUBANK = /\s*-\s*Parcela\s+(\d{1,2})\/(\d{1,2})\s*$/i
/** Bradesco cola a parcela na descrição, com ou sem espaço:
 *  "ARAI KAMINISHI COS02/06", "GOT SERVICOS ADMI 02/02" */
const BRADESCO = /(\d{2})\/(\d{2})\s*$/

/** Parcelamento acima de 24x não existe em cartão brasileiro. O limite
 *  evita casar sufixo numérico de loja ou data solta como parcela. */
const MAX_PARCELAS = 24

export function extractInstallment(desc: string): {
  installment: Installment | null
  clean: string
} {
  const nu = desc.match(NUBANK)
  if (nu?.index !== undefined) {
    return {
      installment: { current: Number(nu[1]), total: Number(nu[2]) },
      clean: desc.slice(0, nu.index).trim(),
    }
  }

  const br = desc.match(BRADESCO)
  if (br?.index !== undefined) {
    const current = Number(br[1])
    const total = Number(br[2])
    const plausible =
      current >= 1 && total >= 1 && current <= total && total <= MAX_PARCELAS
    if (plausible) {
      return {
        installment: { current, total },
        clean: desc.slice(0, br.index).trim(),
      }
    }
  }

  return { installment: null, clean: desc.trim() }
}
```

- [ ] **Step 13: Rodar e verificar que passa**

Run: `npx vitest run src/normalize/installment.test.ts`
Expected: PASS — 9 testes.

- [ ] **Step 14: Escrever os testes de `normalizeMerchant`**

Criar `src/normalize/merchant.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeMerchant } from './merchant'

describe('normalizeMerchant', () => {
  it('descasca a adquirente HNA e revela O Boticário', () => {
    expect(normalizeMerchant('Hna*Oboticario - Parcela 1/2')).toBe('OBOTICARIO')
  })

  it('descasca o Mercado Pago', () => {
    expect(normalizeMerchant('Mp *Cristilene')).toBe('CRISTILENE')
  })

  it('descasca a EBN e revela o Spotify', () => {
    expect(normalizeMerchant('EBN*SPOTIFY')).toBe('SPOTIFY')
  })

  it('descasca a Paygo', () => {
    expect(normalizeMerchant('Paygo*Ga Glesia Artes')).toBe('GA GLESIA ARTES')
  })

  it('remove parcela grudada do Bradesco', () => {
    expect(normalizeMerchant('ARAI KAMINISHI COS02/06')).toBe('ARAI KAMINISHI COS')
  })

  it('remove código de loja entre arrobas', () => {
    expect(normalizeMerchant('PAGUE MENOS @0756@ 02/03')).toBe('PAGUE MENOS')
  })

  it('remove acentos e normaliza caixa', () => {
    expect(normalizeMerchant('Panificadora Farturão')).toBe('PANIFICADORA FARTURAO')
  })

  it('mantém merchant simples intacto', () => {
    expect(normalizeMerchant('Ofertao Supermercado')).toBe('OFERTAO SUPERMERCADO')
  })

  it('colapsa espaços múltiplos', () => {
    expect(normalizeMerchant('MERCADO    JOSIAS')).toBe('MERCADO JOSIAS')
  })
})
```

- [ ] **Step 15: Rodar e verificar que falha**

Run: `npx vitest run src/normalize/merchant.test.ts`
Expected: FAIL — `Failed to resolve import "./merchant"`.

- [ ] **Step 16: Implementar `normalizeMerchant`**

Criar `src/normalize/merchant.ts`:

```ts
import { extractInstallment } from './installment'

/** Prefixos de adquirente/gateway que mascaram o estabelecimento real.
 *  "Hna*Oboticario" é O Boticário via HNA, não uma empresa chamada HNA. */
const ADQUIRENTES = [
  /^MP\s*\*\s*/i,
  /^HNA\s*\*\s*/i,
  /^PAYGO\s*\*\s*/i,
  /^EBN\s*\*\s*/i,
  /^AMAZONMKTPLC\s*\*\s*/i,
  /^JIM\.COM\s*\*\s*/i,
]

export function normalizeMerchant(desc: string): string {
  let s = extractInstallment(desc).clean

  for (const re of ADQUIRENTES) {
    if (re.test(s)) {
      s = s.replace(re, '')
      break
    }
  }

  s = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/@\d+@/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return s
}
```

- [ ] **Step 17: Rodar e verificar que passa**

Run: `npx vitest run src/normalize/merchant.test.ts`
Expected: PASS — 9 testes.

- [ ] **Step 18: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — 35 testes (1 smoke + 9 money + 8 date + 9 installment + 9 merchant).

- [ ] **Step 19: Commit**

```bash
git add src/normalize/
git commit -m "feat: primitivas de normalização (moeda, data, parcela, merchant)

- parseBRL devolve centavos; trata o hífen-sufixo de crédito do Bradesco
  ('56,79 -') e o MINUS SIGN U+2212 do Nubank ('−R\$ 3.644,97').
- inferYear cobre a virada de ano em fatura sem ano na transação.
- extractInstallment lê tanto '- Parcela 5/8' quanto o formato grudado
  do Bradesco ('COS02/06'), com guarda contra sufixo de loja.
- normalizeMerchant descasca prefixo de adquirente: 'Hna*Oboticario'
  vira 'OBOTICARIO', não 'HNA'.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Extração pdf.js e geração dos fixtures

**BLOQUEADA** até os 4 PDFs reais estarem em disco.

**Files:**
- Create: `src/pdf/types.ts`, `src/pdf/extract.ts`, `scripts/gerar-fixtures.ts`
- Create: `tests/fixtures/*.items.json` (4 arquivos, gerados)
- Test: `src/pdf/extract.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type TextItem = { text: string; x: number; y: number; width: number; height: number; page: number }`
  - `extractTextItems(file: File | ArrayBuffer): Promise<TextItem[]>`

- [ ] **Step 1: Definir os tipos**

Criar `src/pdf/types.ts`:

```ts
/** Um fragmento de texto com sua posição na página. A coordenada X é
 *  essencial: no extrato Bradesco, Crédito e Débito têm texto idêntico
 *  e só se distinguem pela coluna em que estão. */
export type TextItem = {
  text: string
  x: number
  y: number
  width: number
  height: number
  page: number
}
```

- [ ] **Step 2: Implementar a extração**

Criar `src/pdf/extract.ts`:

```ts
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { TextItem } from './types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export async function extractTextItems(
  source: File | ArrayBuffer,
): Promise<TextItem[]> {
  const data =
    source instanceof File ? await source.arrayBuffer() : source

  const doc = await pdfjs.getDocument({ data }).promise
  const items: TextItem[] = []

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()

    for (const item of content.items) {
      if (!('str' in item)) continue
      if (item.str.trim() === '') continue

      // transform = [scaleX, skewX, skewY, scaleY, translateX, translateY]
      const [, , , , x, y] = item.transform
      items.push({
        text: item.str,
        x,
        y,
        width: item.width,
        height: item.height,
        page: pageNum,
      })
    }
  }

  return items
}

/** Um PDF escaneado tem páginas mas nenhum texto extraível. */
export function pareceDigitalizado(items: TextItem[]): boolean {
  return items.length === 0
}
```

- [ ] **Step 3: Escrever o script de geração de fixtures**

Criar `scripts/gerar-fixtures.ts`:

```ts
/** Gera fixtures JSON anonimizados a partir dos PDFs reais.
 *
 *  Os PDFs contêm CPF, agência, conta e nomes de terceiros. O parser
 *  consome TextItem[], não o PDF — então o fixture é um dump desses
 *  items com as coordenadas intactas e os dados pessoais trocados.
 *  Testa exatamente a mesma coisa, sem expor nada.
 *
 *  Uso: npx tsx scripts/gerar-fixtures.ts <pasta-com-os-pdfs>
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { extractTextItems } from '../src/pdf/extract'
import type { TextItem } from '../src/pdf/types'

const ENTRADAS = [
  { arquivo: 'BradescoCartoes14-07-2026-17-40-28.pdf', saida: 'bradesco-fatura' },
  { arquivo: 'extratoBradescoJunho.pdf', saida: 'bradesco-extrato' },
  { arquivo: 'NuBank_extratoConta.pdf', saida: 'nubank-extrato' },
  { arquivo: 'Nubank_faturaCartao.pdf', saida: 'nubank-fatura' },
]

/** Substituições literais. Preservam o COMPRIMENTO do texto sempre que
 *  possível, para não deslocar nada que dependa de largura. */
const SUBSTITUICOES: Array<[RegExp, string]> = [
  [/JACIELIO DA SILVA QUEIROZ/gi, 'MARIA APARECIDA SANTOS'],
  [/JACIELIO DA SILVA QU/gi, 'MARIA APARECIDA SANT'],
  [/JACIELIO DA SILVA QUE/gi, 'MARIA APARECIDA SANTO'],
  [/Jacielio da Silva Queiroz/g, 'Maria Aparecida Santos'],
  [/Jacielio S Queiroz/g, 'Maria A Santos'],
  [/Jacielio/g, 'Maria'],
  [/Jacilene Queiroz de Carvalho/g, 'Joana Ferreira de Souza'],
  [/DOUGLAS LEITE CAVALCA/g, 'ROBERTO ALVES PEREIRA'],
  [/ISRAEL LEITE CAVALCAN/g, 'FERNANDO ALVES PERELL'],
  [/Solange Silva Nunes d/g, 'Beatriz Costa Lima da'],
  [/JUSCELINO PEREIRA DA/g, 'ANTONIO MACHADO SOU'],
  [/SUSLEY B RIBEIRO AIRE/g, 'CARLA M TEIXEIRA NUNE'],
  [/DEIVIDY CARDOSO FERRE/g, 'RICARDO MENDES BARBO'],
  [/Maria Juliana Andrade Chagas/g, 'Luciana Ramos Pinto Silva'],
  [/Educandario Meninopol/g, 'Instituto Aprendermai'],
  [/JCJR ORTOPEDIA E SAUD/g, 'ABCD ORTOPEDIA E CLIN'],
  [/•••\.127\.464-••/g, '•••.999.888-••'],
  [/4066 XXXX XXXX 5164/g, '4111 XXXX XXXX 9999'],
  [/74217157-1/g, '99887766-5'],
  [/4750-3/g, '1234-5'],
  [/168011852160/g, '999000111222'],
  [/168 01185 2160/g, '999 00011 1222'],
  [/8304/g, '7777'],
]

function anonimizar(items: TextItem[]): TextItem[] {
  return items.map((item) => {
    let texto = item.text
    for (const [padrao, troca] of SUBSTITUICOES) {
      texto = texto.replace(padrao, troca)
    }
    return { ...item, text: texto }
  })
}

async function main() {
  const pasta = process.argv[2]
  if (!pasta) {
    console.error('Uso: npx tsx scripts/gerar-fixtures.ts <pasta-com-os-pdfs>')
    process.exit(1)
  }

  await mkdir('tests/fixtures', { recursive: true })

  for (const { arquivo, saida } of ENTRADAS) {
    const buffer = await readFile(join(pasta, arquivo))
    const items = await extractTextItems(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    )
    const anonimos = anonimizar(items)

    const destino = `tests/fixtures/${saida}.items.json`
    await writeFile(destino, JSON.stringify(anonimos, null, 2))
    console.log(`${destino}: ${anonimos.length} items`)
  }
}

main()
```

- [ ] **Step 4: Instalar o tsx**

```bash
npm install -D tsx
```

- [ ] **Step 5: Gerar os fixtures**

Run: `npx tsx scripts/gerar-fixtures.ts <CAMINHO_INFORMADO_PELO_USUARIO>`
Expected: 4 linhas de saída, uma por documento, cada uma com contagem de items > 0.

- [ ] **Step 6: Auditar os fixtures**

Run: `grep -riE "jacielio|127\.464|4750-3|74217157|douglas|israel|solange|8304" tests/fixtures/`
Expected: **nenhum resultado.** Se algo aparecer, acrescentar a substituição em `SUBSTITUICOES` e regerar antes de prosseguir.

- [ ] **Step 7: Escrever o teste de sanidade dos fixtures**

Criar `src/pdf/extract.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import type { TextItem } from './types'

const carregar = (nome: string): TextItem[] =>
  JSON.parse(readFileSync(`tests/fixtures/${nome}.items.json`, 'utf-8'))

describe('fixtures', () => {
  const nomes = [
    'bradesco-fatura',
    'bradesco-extrato',
    'nubank-extrato',
    'nubank-fatura',
  ]

  for (const nome of nomes) {
    it(`${nome} tem items com coordenadas`, () => {
      const items = carregar(nome)
      expect(items.length).toBeGreaterThan(0)
      for (const item of items) {
        expect(typeof item.text).toBe('string')
        expect(Number.isFinite(item.x)).toBe(true)
        expect(Number.isFinite(item.y)).toBe(true)
        expect(item.page).toBeGreaterThanOrEqual(1)
      }
    })

    it(`${nome} não contém dados pessoais reais`, () => {
      const texto = carregar(nome)
        .map((i) => i.text)
        .join(' ')
      expect(texto).not.toMatch(/jacielio/i)
      expect(texto).not.toMatch(/127\.464/)
      expect(texto).not.toMatch(/74217157/)
      expect(texto).not.toMatch(/4750-3/)
    })
  }
})
```

- [ ] **Step 8: Rodar e verificar que passa**

Run: `npx vitest run src/pdf/extract.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 9: Commit**

```bash
git add src/pdf/ scripts/ tests/fixtures/ package.json package-lock.json
git commit -m "feat: extração de texto com coordenadas via pdf.js + fixtures anonimizados

O parser consome TextItem[], não PDF — então o fixture é um dump desses
items com coordenadas intactas e dados pessoais substituídos. Testa a
mesma coisa sem expor CPF, conta ou nomes de terceiros no histórico.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Reconstrução de linhas por coordenada

**Files:**
- Create: `src/pdf/lines.ts`
- Test: `src/pdf/lines.test.ts`

**Interfaces:**
- Consumes: `TextItem` de `src/pdf/types.ts`
- Produces:
  - `type Cell = { text: string; x: number; width: number }`
  - `type Line = { cells: Cell[]; text: string; y: number; page: number }`
  - `buildLines(items: TextItem[], tolerancia?: number): Line[]`
  - `cellAt(line: Line, xMin: number, xMax: number): string | null`

- [ ] **Step 1: Escrever os testes**

Criar `src/pdf/lines.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildLines, cellAt } from './lines'
import type { TextItem } from './types'

const item = (text: string, x: number, y: number, page = 1): TextItem => ({
  text, x, y, width: text.length * 5, height: 10, page,
})

describe('buildLines', () => {
  it('agrupa items com mesmo Y numa linha', () => {
    const lines = buildLines([
      item('01/06/2026', 50, 700),
      item('PIX ENVIADO', 120, 700),
      item('300,00', 480, 700),
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('01/06/2026 PIX ENVIADO 300,00')
  })

  it('ordena as células por X, não pela ordem de extração', () => {
    const lines = buildLines([
      item('300,00', 480, 700),
      item('01/06/2026', 50, 700),
      item('PIX ENVIADO', 120, 700),
    ])
    expect(lines[0].text).toBe('01/06/2026 PIX ENVIADO 300,00')
  })

  it('separa items com Y diferente em linhas distintas', () => {
    const lines = buildLines([
      item('LINHA A', 50, 700),
      item('LINHA B', 50, 680),
    ])
    expect(lines).toHaveLength(2)
    expect(lines[0].text).toBe('LINHA A')
    expect(lines[1].text).toBe('LINHA B')
  })

  it('tolera desalinhamento vertical pequeno', () => {
    const lines = buildLines([
      item('MESMA', 50, 700),
      item('LINHA', 120, 698.5),
    ])
    expect(lines).toHaveLength(1)
    expect(lines[0].text).toBe('MESMA LINHA')
  })

  it('ordena linhas de cima para baixo (Y decrescente no PDF)', () => {
    const lines = buildLines([
      item('BAIXO', 50, 100),
      item('TOPO', 50, 700),
    ])
    expect(lines[0].text).toBe('TOPO')
    expect(lines[1].text).toBe('BAIXO')
  })

  it('separa páginas mesmo com Y coincidente', () => {
    const lines = buildLines([
      item('PAGINA 2', 50, 700, 2),
      item('PAGINA 1', 50, 700, 1),
    ])
    expect(lines).toHaveLength(2)
    expect(lines[0].text).toBe('PAGINA 1')
    expect(lines[0].page).toBe(1)
    expect(lines[1].text).toBe('PAGINA 2')
  })
})

describe('cellAt', () => {
  it('encontra a célula dentro da faixa X — coluna Débito', () => {
    const [line] = buildLines([
      item('01/06/2026', 50, 700),
      item('PIX ENVIADO', 120, 700),
      item('300,00', 480, 700),
    ])
    expect(cellAt(line, 460, 520)).toBe('300,00')
  })

  it('devolve null quando a faixa X está vazia — coluna Crédito', () => {
    const [line] = buildLines([
      item('01/06/2026', 50, 700),
      item('300,00', 480, 700),
    ])
    expect(cellAt(line, 380, 440)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/pdf/lines.test.ts`
Expected: FAIL — `Failed to resolve import "./lines"`.

- [ ] **Step 3: Implementar**

Criar `src/pdf/lines.ts`:

```ts
import type { TextItem } from './types'

export type Cell = { text: string; x: number; width: number }
export type Line = { cells: Cell[]; text: string; y: number; page: number }

/** Items na mesma linha visual raramente têm Y idêntico. */
const TOLERANCIA_Y = 2

/** Agrupa items por linha visual e ordena as células por X.
 *
 *  A ordem de extração do pdf.js NÃO acompanha a ordem visual, e a
 *  coordenada X é o que distingue Crédito de Débito no extrato
 *  Bradesco — onde os dois têm texto idêntico em colunas diferentes. */
export function buildLines(
  items: TextItem[],
  tolerancia: number = TOLERANCIA_Y,
): Line[] {
  const grupos: TextItem[][] = []

  const ordenados = [...items].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page
    return b.y - a.y // Y do PDF cresce para cima
  })

  for (const item of ordenados) {
    const grupo = grupos.find((g) => {
      const ref = g[0]
      return ref.page === item.page && Math.abs(ref.y - item.y) <= tolerancia
    })
    if (grupo) grupo.push(item)
    else grupos.push([item])
  }

  return grupos.map((grupo) => {
    const cells = grupo
      .sort((a, b) => a.x - b.x)
      .map((i) => ({ text: i.text, x: i.x, width: i.width }))

    return {
      cells,
      text: cells.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim(),
      y: grupo[0].y,
      page: grupo[0].page,
    }
  })
}

/** Devolve o texto das células cujo X cai na faixa. Usado para ler uma
 *  coluna específica: cellAt(linha, 460, 520) lê a coluna Débito. */
export function cellAt(line: Line, xMin: number, xMax: number): string | null {
  const dentro = line.cells.filter((c) => c.x >= xMin && c.x <= xMax)
  if (dentro.length === 0) return null
  return dentro.map((c) => c.text).join(' ').trim()
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/pdf/lines.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 5: Commit**

```bash
git add src/pdf/lines.ts src/pdf/lines.test.ts
git commit -m "feat: reconstrução de linhas por coordenada

A ordem de extração do pdf.js não acompanha a ordem visual. cellAt lê
uma coluna por faixa de X — é o que distingue Crédito de Débito no
extrato Bradesco, onde ambos têm texto idêntico.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Detecção de emissor e tipo

**Files:**
- Create: `src/pdf/detect.ts`
- Test: `src/pdf/detect.test.ts`

**Interfaces:**
- Consumes: `Line` de `src/pdf/lines.ts`
- Produces:
  - `type Bank = 'bradesco' | 'nubank' | 'desconhecido'`
  - `type DocType = 'fatura' | 'extrato' | 'desconhecido'`
  - `type DocKind = { bank: Bank; docType: DocType }`
  - `detectDocument(lines: Line[]): DocKind`

- [ ] **Step 1: Escrever os testes**

Criar `src/pdf/detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLines } from './lines'
import { detectDocument } from './detect'
import type { TextItem } from './types'

const linhasDe = (nome: string) =>
  buildLines(JSON.parse(readFileSync(`tests/fixtures/${nome}.items.json`, 'utf-8')) as TextItem[])

describe('detectDocument', () => {
  it('reconhece a fatura do Bradesco', () => {
    expect(detectDocument(linhasDe('bradesco-fatura'))).toEqual({
      bank: 'bradesco', docType: 'fatura',
    })
  })

  it('reconhece o extrato do Bradesco', () => {
    expect(detectDocument(linhasDe('bradesco-extrato'))).toEqual({
      bank: 'bradesco', docType: 'extrato',
    })
  })

  it('reconhece a fatura do Nubank', () => {
    expect(detectDocument(linhasDe('nubank-fatura'))).toEqual({
      bank: 'nubank', docType: 'fatura',
    })
  })

  it('reconhece o extrato do Nubank', () => {
    expect(detectDocument(linhasDe('nubank-extrato'))).toEqual({
      bank: 'nubank', docType: 'extrato',
    })
  })

  it('devolve desconhecido para documento não reconhecido', () => {
    const lines = buildLines([
      { text: 'BANCO INVENTADO S.A.', x: 50, y: 700, width: 100, height: 10, page: 1 },
    ])
    expect(detectDocument(lines)).toEqual({
      bank: 'desconhecido', docType: 'desconhecido',
    })
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/pdf/detect.test.ts`
Expected: FAIL — `Failed to resolve import "./detect"`.

- [ ] **Step 3: Implementar**

Criar `src/pdf/detect.ts`:

```ts
import type { Line } from './lines'

export type Bank = 'bradesco' | 'nubank' | 'desconhecido'
export type DocType = 'fatura' | 'extrato' | 'desconhecido'
export type DocKind = { bank: Bank; docType: DocType }

/** Assinaturas textuais observadas nos documentos de referência.
 *  Só as primeiras páginas importam — o rodapé se repete em todas. */
const ASSINATURAS: Array<{ kind: DocKind; marcadores: RegExp[] }> = [
  {
    kind: { bank: 'bradesco', docType: 'extrato' },
    marcadores: [/Bradesco Celular/i, /Extrato de:\s*Ag[êe]ncia/i],
  },
  {
    kind: { bank: 'bradesco', docType: 'fatura' },
    marcadores: [/Fatura Mensal/i, /Hist[óo]rico de Lan[çc]amentos|Op[çc][õo]es de pagamento/i],
  },
  {
    kind: { bank: 'nubank', docType: 'fatura' },
    marcadores: [/Esta [ée] a sua fatura de/i, /Alternativas de pagamento|TRANSA[ÇC][ÕO]ES/i],
  },
  {
    kind: { bank: 'nubank', docType: 'extrato' },
    marcadores: [/Movimenta[çc][õo]es/i, /Saldo final do per[íi]odo/i],
  },
]

export function detectDocument(lines: Line[]): DocKind {
  const texto = lines
    .filter((l) => l.page <= 2)
    .map((l) => l.text)
    .join('\n')

  for (const { kind, marcadores } of ASSINATURAS) {
    if (marcadores.every((re) => re.test(texto))) return kind
  }

  return { bank: 'desconhecido', docType: 'desconhecido' }
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/pdf/detect.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/pdf/detect.ts src/pdf/detect.test.ts
git commit -m "feat: detecção de emissor e tipo de documento

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

*[Tasks 6–14 pendentes de redação: parsers dos 4 documentos, validação por gabarito, categorização, dedup, vínculos e tela de revisão.]*
