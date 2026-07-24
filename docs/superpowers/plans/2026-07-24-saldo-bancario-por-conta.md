# Saldo bancário por conta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no dashboard o saldo atual de cada conta, lido do extrato mais recente de cada banco.

**Architecture:** Os parsers de extrato passam a expor `ParseResult.balance.final` (campo já existente, hoje só o BB usa). O `salvar` grava esse valor em `documents.end_balance_cents` (coluna nova). Uma função pura deriva o saldo atual por conta (extrato de maior `period_end`). Uma fileira de cards no Dashboard mostra o resultado.

**Tech Stack:** TypeScript, React 19, Tailwind v4, Vitest, Neon (Data API + Better Auth), motion/react.

## Global Constraints

- Valores monetários sempre em **BIGINT de centavos**, nunca float.
- `ParseResult.balance` = `{ initial: number; final: number } | null`; sinal: **credor > 0, devedor < 0**.
- Extrato preenche `balance`; **fatura deixa null**.
- Testes de parser carregam fixtures de `tests/fixtures/<banco>-extrato.items.json` via `buildLines(JSON.parse(readFileSync(...)))`.
- Cor/nome de banco vêm sempre de `src/domain/banks.ts` (`BANCOS`), nunca hardcoded na UI.
- Rodar após cada task: `npm test`. Ao final da task de UI: `npm run build && npm run lint && npx tsc -b --force`.
- Migração é arquivo no repo; **aplicar em produção é passo manual gated** (branch do Neon primeiro). Nada no código quebra se a coluna ainda não existir (leitura degrada para "sem saldo").
- Commits diretos na `main` (todo push publica na Vercel). Co-author nos commits: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Nubank — extrato expõe `balance.final`

**Files:**
- Modify: `src/domain/parsers/nubank-extrato.ts`
- Test: `src/domain/parsers/nubank-extrato.test.ts`
- Read-only: `tests/fixtures/nubank-extrato.items.json`

**Interfaces:**
- Consumes: `ParseResult.balance` de `src/domain/parsers/types.ts` (já existe).
- Produces: `parseNubankExtrato(lines).balance = { initial, final }` em centavos.

- [ ] **Step 1: Descobrir o saldo final impresso na fixture**

Rode um dump rápido para achar o número que o Nubank imprime como saldo final do período:

```bash
npx tsx -e "const fs=require('fs');const items=JSON.parse(fs.readFileSync('tests/fixtures/nubank-extrato.items.json','utf-8'));for(const it of items){if(/saldo/i.test(it.str||it.text||'')) console.log(JSON.stringify(it))}"
```

Anote o "Saldo final do período" (e o inicial, se houver) em reais e converta para centavos. Guarde para o Step 2.

- [ ] **Step 2: Escrever o teste que falha**

Adicione ao `nubank-extrato.test.ts` (o arquivo já monta `r = parseNubankExtrato(lines)`):

```ts
describe('parseNubankExtrato — saldo', () => {
  it('expõe o saldo final do período', () => {
    // Valor lido da fixture no Step 1 (centavos, credor > 0).
    expect(r.balance?.final).toBe(SALDO_FINAL_CENTAVOS)
  })
})
```

Substitua `SALDO_FINAL_CENTAVOS` pelo número do Step 1.

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run src/domain/parsers/nubank-extrato.test.ts`
Expected: FAIL — `r.balance` é `null`/`undefined` hoje.

- [ ] **Step 4: Implementar**

Leia `src/domain/parsers/nubank-extrato.ts`. Localize onde o parser identifica a linha "Saldo final do período" (o Nubank a imprime no rodapé do extrato). Capture o valor e, se presente, o saldo inicial, e retorne no `ParseResult`:

```ts
// ao montar o ParseResult:
balance: saldoFinal != null ? { initial: saldoInicial ?? 0, final: saldoFinal } : null,
```

Onde `saldoFinal`/`saldoInicial` são centavos (credor > 0). Não conte a linha de saldo como transação.

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/domain/parsers/nubank-extrato.test.ts`
Expected: PASS. Rode também a suíte toda: `npm test` (329+ verdes).

- [ ] **Step 6: Commit**

```bash
git add src/domain/parsers/nubank-extrato.ts src/domain/parsers/nubank-extrato.test.ts
git commit -m "feat: parser do Nubank expoe saldo final do extrato

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Bradesco — extrato expõe `balance.final`

**Files:**
- Modify: `src/domain/parsers/bradesco-extrato.ts`
- Test: `src/domain/parsers/bradesco-extrato.test.ts`
- Read-only: `tests/fixtures/bradesco-extrato.items.json`

**Interfaces:**
- Produces: `parseBradescoExtrato(lines).balance = { initial, final }` em centavos.

- [ ] **Step 1: Descobrir o saldo final na fixture**

```bash
npx tsx -e "const fs=require('fs');const items=JSON.parse(fs.readFileSync('tests/fixtures/bradesco-extrato.items.json','utf-8'));for(const it of items){if(/saldo/i.test(it.str||it.text||'')) console.log(JSON.stringify(it))}"
```

O Bradesco marca `SALDO ANTERIOR`/`SALDO INICIAL` e o saldo do último dia. Anote inicial e final em centavos.

- [ ] **Step 2: Escrever o teste que falha**

```ts
describe('parseBradescoExtrato — saldo', () => {
  it('expõe saldo inicial e final', () => {
    expect(r.balance).toEqual({ initial: SALDO_INICIAL_CENTAVOS, final: SALDO_FINAL_CENTAVOS })
  })
  it('a variação de saldo fecha com a soma dos lançamentos com sinal', () => {
    const soma = r.transactions.reduce((a, t) => a + t.amountCents, 0)
    expect(soma).toBe(r.balance!.initial - r.balance!.final)
  })
})
```

Substitua os dois valores pelos do Step 1.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/domain/parsers/bradesco-extrato.test.ts`
Expected: FAIL — `r.balance` é null hoje.

- [ ] **Step 4: Implementar**

Leia `src/domain/parsers/bradesco-extrato.ts`. Ele **já lê a coluna de saldo** (`COL.saldoRight`, marcador `SALDO_INICIAL`) para ancorar datas — hoje descarta o valor. Capture o saldo inicial (linha `SALDO ANTERIOR`/`SALDO INICIAL`) e o saldo da última linha de movimento, e exponha:

```ts
balance: { initial: saldoInicialCents, final: saldoFinalCents },
```

Se o segundo teste (invariante) não fechar, o sinal das transações ou a escolha da última linha de saldo está errada — corrija até fechar ao centavo.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/domain/parsers/bradesco-extrato.test.ts` → PASS. Depois `npm test`.

- [ ] **Step 6: Commit**

```bash
git add src/domain/parsers/bradesco-extrato.ts src/domain/parsers/bradesco-extrato.test.ts
git commit -m "feat: parser do Bradesco expoe saldo do extrato

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Sicredi — extrato expõe `balance.final`

**Files:**
- Modify: `src/domain/parsers/sicredi-extrato.ts`
- Test: `src/domain/parsers/sicredi-extrato.test.ts`
- Read-only: `tests/fixtures/sicredi-extrato.items.json`

**Interfaces:**
- Produces: `parseSicrediExtrato(lines).balance = { initial, final } | null` em centavos.

- [ ] **Step 1: Descobrir o saldo na fixture**

```bash
npx tsx -e "const fs=require('fs');const items=JSON.parse(fs.readFileSync('tests/fixtures/sicredi-extrato.items.json','utf-8'));for(const it of items){if(/saldo/i.test(it.str||it.text||'')) console.log(JSON.stringify(it))}"
```

Anote o saldo final (e inicial, se limpo). Se a amostra **não** trouxer saldo de forma confiável, o `balance` fica `null` e esta task documenta isso no teste (ver Step 2b).

- [ ] **Step 2: Escrever o teste que falha**

Se houver saldo final claro:

```ts
describe('parseSicrediExtrato — saldo', () => {
  it('expõe o saldo final', () => {
    expect(r.balance?.final).toBe(SALDO_FINAL_CENTAVOS)
  })
})
```

- [ ] **Step 2b (só se a amostra não tiver saldo confiável):**

```ts
it('sem saldo confiável na amostra, balance fica null (documentado)', () => {
  expect(r.balance ?? null).toBeNull()
})
```

E encerre a task aqui (sem Steps 3-5 de implementação de saldo). Registre no commit que o Sicredi não expõe saldo por falta de dado limpo.

- [ ] **Step 3: Rodar e ver falhar** — `npx vitest run src/domain/parsers/sicredi-extrato.test.ts` → FAIL.

- [ ] **Step 4: Implementar** — Leia `src/domain/parsers/sicredi-extrato.ts`, localize a linha de saldo final, exponha `balance: { initial: saldoInicial ?? 0, final: saldoFinal }` (centavos, credor > 0).

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run src/domain/parsers/sicredi-extrato.test.ts` → PASS; depois `npm test`.

- [ ] **Step 6: Commit**

```bash
git add src/domain/parsers/sicredi-extrato.ts src/domain/parsers/sicredi-extrato.test.ts
git commit -m "feat: parser do Sicredi expoe saldo final do extrato

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Sicoob — extrato expõe `balance.final`

**Files:**
- Modify: `src/domain/parsers/sicoob-extrato.ts`
- Test: `src/domain/parsers/sicoob-extrato.test.ts`
- Read-only: `tests/fixtures/sicoob-extrato.items.json`

**Interfaces:**
- Produces: `parseSicoobExtrato(lines).balance = { initial, final } | null` em centavos.

- [ ] **Step 1: Descobrir o saldo na fixture**

```bash
npx tsx -e "const fs=require('fs');const items=JSON.parse(fs.readFileSync('tests/fixtures/sicoob-extrato.items.json','utf-8'));for(const it of items){if(/saldo/i.test(it.str||it.text||'')) console.log(JSON.stringify(it))}"
```

- [ ] **Step 2: Escrever o teste que falha** (mesma forma da Task 3; use `SALDO_FINAL_CENTAVOS` do Step 1, ou o teste-null do Step 2b se a amostra não tiver saldo confiável).

```ts
describe('parseSicoobExtrato — saldo', () => {
  it('expõe o saldo final', () => {
    expect(r.balance?.final).toBe(SALDO_FINAL_CENTAVOS)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar** — `npx vitest run src/domain/parsers/sicoob-extrato.test.ts` → FAIL.

- [ ] **Step 4: Implementar** — Leia `src/domain/parsers/sicoob-extrato.ts`, localize a linha de saldo, exponha `balance: { initial: saldoInicial ?? 0, final: saldoFinal }`.

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run src/domain/parsers/sicoob-extrato.test.ts` → PASS; depois `npm test`.

- [ ] **Step 6: Commit**

```bash
git add src/domain/parsers/sicoob-extrato.ts src/domain/parsers/sicoob-extrato.test.ts
git commit -m "feat: parser do Sicoob expoe saldo final do extrato

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `saldosPorConta` — derivação pura

**Files:**
- Create: `src/persist/saldos.ts`
- Test: `src/persist/saldos.test.ts`

**Interfaces:**
- Consumes: uma lista de documentos com `{ bank: string; account_id: string | null; doc_type: string; period_end: string | null; end_balance_cents: number | null }`.
- Produces:
  ```ts
  export type SaldoConta = { accountId: string | null; bank: string; balanceCents: number; date: string }
  export type DocParaSaldo = {
    bank: string
    account_id: string | null
    doc_type: string
    period_end: string | null
    end_balance_cents: number | null
  }
  export function saldosPorConta(docs: DocParaSaldo[]): SaldoConta[]
  ```

- [ ] **Step 1: Escrever os testes que falham**

Create `src/persist/saldos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { saldosPorConta, type DocParaSaldo } from './saldos'

const base: DocParaSaldo = {
  bank: 'nubank', account_id: 'a1', doc_type: 'extrato', period_end: '2026-06-30', end_balance_cents: 100000,
}

describe('saldosPorConta', () => {
  it('escolhe o extrato de maior period_end por conta', () => {
    const docs: DocParaSaldo[] = [
      { ...base, period_end: '2026-05-31', end_balance_cents: 50000 },
      { ...base, period_end: '2026-06-30', end_balance_cents: 120000 },
    ]
    expect(saldosPorConta(docs)).toEqual([
      { accountId: 'a1', bank: 'nubank', balanceCents: 120000, date: '2026-06-30' },
    ])
  })

  it('ignora faturas', () => {
    const docs: DocParaSaldo[] = [{ ...base, doc_type: 'fatura' }]
    expect(saldosPorConta(docs)).toEqual([])
  })

  it('ignora documentos sem saldo', () => {
    const docs: DocParaSaldo[] = [{ ...base, end_balance_cents: null }]
    expect(saldosPorConta(docs)).toEqual([])
  })

  it('aceita saldo negativo (conta devedora)', () => {
    const docs: DocParaSaldo[] = [{ ...base, end_balance_cents: -3500 }]
    expect(saldosPorConta(docs)[0].balanceCents).toBe(-3500)
  })

  it('uma linha por conta, várias contas coexistem', () => {
    const docs: DocParaSaldo[] = [
      { ...base, account_id: 'a1', bank: 'nubank', end_balance_cents: 100000 },
      { ...base, account_id: 'a2', bank: 'bb', end_balance_cents: 200000 },
    ]
    expect(saldosPorConta(docs)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/persist/saldos.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

Create `src/persist/saldos.ts`:

```ts
export type SaldoConta = { accountId: string | null; bank: string; balanceCents: number; date: string }
export type DocParaSaldo = {
  bank: string
  account_id: string | null
  doc_type: string
  period_end: string | null
  end_balance_cents: number | null
}

/** Saldo atual por conta: para cada conta com ao menos um extrato que traga
 *  saldo, vence o extrato de maior period_end. Fatura e documento sem saldo
 *  são ignorados. */
export function saldosPorConta(docs: DocParaSaldo[]): SaldoConta[] {
  const porConta = new Map<string, SaldoConta & { _pe: string }>()
  for (const d of docs) {
    if (d.doc_type !== 'extrato') continue
    if (d.end_balance_cents == null || d.period_end == null) continue
    const chave = d.account_id ?? `${d.bank}:sem-conta`
    const atual = porConta.get(chave)
    if (!atual || d.period_end > atual._pe) {
      porConta.set(chave, {
        accountId: d.account_id,
        bank: d.bank,
        balanceCents: d.end_balance_cents,
        date: d.period_end,
        _pe: d.period_end,
      })
    }
  }
  return [...porConta.values()].map(({ _pe, ...s }) => s)
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/persist/saldos.test.ts` → PASS; depois `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/persist/saldos.ts src/persist/saldos.test.ts
git commit -m "feat: saldosPorConta deriva o saldo atual por conta

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Migração `0002` (arquivo no repo)

**Files:**
- Create: `neon/migrations/0002_saldo_e_bancos.sql`

**Interfaces:** nenhuma de código. Adiciona `documents.end_balance_cents` e relaxa o CHECK de `accounts.bank`.

- [ ] **Step 1: Criar o arquivo de migração**

Create `neon/migrations/0002_saldo_e_bancos.sql`:

```sql
-- 0002 — saldo do extrato + bancos novos no CHECK de accounts
--
-- (a) Saldo final do extrato, como fato do documento. Nulável: fatura não tem.
alter table public.documents
  add column if not exists end_balance_cents bigint;

-- (b) Conserto de bug latente: o CHECK de accounts.bank foi criado em 0001 só
--     com ('nubank','bradesco','desconhecido'). O app já lê e tenta SALVAR BB,
--     Sicredi e Sicoob — um insert desses bancos viola o constraint hoje.
--     Confirme o nome real do constraint antes de aplicar:
--       select conname from pg_constraint
--       where conrelid = 'public.accounts'::regclass and contype = 'c';
alter table public.accounts drop constraint if exists accounts_bank_check;
alter table public.accounts add constraint accounts_bank_check
  check (bank in ('nubank','bradesco','bb','sicredi','sicoob','desconhecido'));
```

- [ ] **Step 2: Commit (sem aplicar)**

```bash
git add neon/migrations/0002_saldo_e_bancos.sql
git commit -m "feat(db): migracao 0002 (end_balance_cents + bancos no CHECK)

Aplicacao em producao e passo manual gated (branch do Neon primeiro).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 3: (GATED — passo do usuário) aplicar na branch do Neon e verificar**

Fora do código: aplicar `0002` numa **branch** do Neon, confirmar com
`\d public.accounts` (CHECK com os 5 bancos) e `\d public.documents`
(coluna `end_balance_cents`), depois promover/aplicar em produção. **Não bloqueia
as tasks seguintes** — o código degrada para "sem saldo" enquanto a coluna não existir.

---

### Task 7: Persistir e ler `end_balance_cents`

**Files:**
- Modify: `src/persist/salvar.ts` (insert do documento)
- Modify/Read: `src/persist/documentos.ts` (leitura que a UI usará; confirmar os campos)
- Test: `src/persist/salvar.test.ts` se existir; senão cobrir via a leitura na Task 8

**Interfaces:**
- Consumes: `result.balance?.final` do `ParseResult`.
- Produces: documentos lidos passam a incluir `end_balance_cents` e `period_end` para alimentar `saldosPorConta` (Task 5).

- [ ] **Step 1: Gravar no insert do documento**

Em `src/persist/salvar.ts`, no objeto de insert de `documents` (onde já vão `next_invoice_balance`, `total_open_balance` etc.), adicione:

```ts
end_balance_cents: result.balance?.final ?? null,
```

- [ ] **Step 2: Garantir que a leitura expõe os campos**

Leia `src/persist/documentos.ts`. A busca de documentos (usada pelo painel Documentos) deve selecionar `bank, account_id, doc_type, period_end, end_balance_cents`. Se algum faltar no `select`, adicione. Exponha um tipo compatível com `DocParaSaldo` (Task 5) — ou um mapeamento trivial no Dashboard.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b --force` → exit 0. `npm test` verde.

> Nota: `vi.stubEnv` não alcança `import.meta.env` neste setup (ver ESTADO-ATUAL). Não escreva teste que dependa de URL do Neon; a persistência real é verificada no navegador quando a migração estiver na branch.

- [ ] **Step 4: Commit**

```bash
git add src/persist/salvar.ts src/persist/documentos.ts
git commit -m "feat: grava e le end_balance_cents do documento

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: UI — `SaldoConta` + fileira no Dashboard

**Files:**
- Create: `src/ui/SaldoConta.tsx`
- Test: `src/ui/SaldoConta.test.tsx`
- Modify: `src/ui/Dashboard.tsx` (buscar documentos, chamar `saldosPorConta`, renderizar a fileira acima do seletor de banco)

**Interfaces:**
- Consumes: `saldosPorConta` (Task 5), `BANCOS` (`src/domain/banks.ts`), `formatBRL` (`src/domain/normalize/money`).

- [ ] **Step 1: Escrever o teste do card**

Create `src/ui/SaldoConta.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaldoConta } from './SaldoConta'

describe('SaldoConta', () => {
  it('mostra banco, valor e data', () => {
    render(<SaldoConta bank="nubank" balanceCents={123456} date="2026-06-30" />)
    expect(screen.getByText('Nubank')).toBeInTheDocument()
    expect(screen.getByText(/1\.234,56/)).toBeInTheDocument()
    expect(screen.getByText(/30\/jun|30 jun/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/ui/SaldoConta.test.tsx` → FAIL.

- [ ] **Step 3: Implementar o card**

Create `src/ui/SaldoConta.tsx`:

```tsx
import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'
import { formatBRL } from '../domain/normalize/money'

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function dataCurta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d}/${MESES[m - 1]}`
}

type Props = { bank: string; balanceCents: number; date: string }

/** Card compacto de saldo de uma conta. Cor/nome do catálogo canônico. */
export function SaldoConta({ bank, balanceCents, date }: Props) {
  const tema = BANCOS[bank as Bank] ?? BANCOS.desconhecido
  const negativo = balanceCents < 0
  return (
    <div className="rounded-xl border border-carvao-700 bg-carvao-900/80 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: tema.accent }} aria-hidden />
        <span className="text-[10px] uppercase tracking-widest text-tinta-tenue">Saldo</span>
        <span className="text-sm text-tinta">{tema.nome}</span>
      </div>
      <p className={`tabular mt-1 text-lg ${negativo ? 'text-falha' : 'text-tinta'}`}>
        {formatBRL(balanceCents)}
      </p>
      <p className="text-[11px] text-tinta-tenue">em {dataCurta(date)}</p>
    </div>
  )
}
```

> Confirme o nome da classe de cor de valor negativo em `src/index.css` (`text-falha` ou equivalente). Se não existir, use `text-tinta-fraca`.

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/ui/SaldoConta.test.tsx` → PASS.

- [ ] **Step 5: Ligar no Dashboard**

Em `src/ui/Dashboard.tsx`:
1. Importar `SaldoConta`, `saldosPorConta`.
2. Buscar os documentos (reusar a busca já existente do painel Documentos, ou uma leitura enxuta) e guardar em estado, junto do `carregar()`.
3. Calcular `const saldos = useMemo(() => saldosPorConta(documentos), [documentos])`.
4. Renderizar acima do seletor de banco (o bloco `bancos.length >= 2`):

```tsx
{saldos.length > 0 && (
  <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
    {saldos.map((s) => (
      <SaldoConta key={`${s.bank}-${s.accountId}`} bank={s.bank} balanceCents={s.balanceCents} date={s.date} />
    ))}
  </div>
)}
```

- [ ] **Step 6: Verificação completa**

Run: `npm test && npm run build && npm run lint && npx tsc -b --force`
Expected: testes verdes (todos + os novos), build OK, lint OK, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/ui/SaldoConta.tsx src/ui/SaldoConta.test.tsx src/ui/Dashboard.tsx
git commit -m "feat: fileira de saldo por conta no dashboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: README + ESTADO-ATUAL + push

**Files:**
- Modify: `README.md`
- Modify: `docs/ESTADO-ATUAL.md`

- [ ] **Step 1: Atualizar o README**

No `README.md`, na seção de recursos/features, acrescente que o app mostra o **saldo atual por conta** (lido do extrato mais recente) e que lê os 5 bancos (Nubank, Bradesco, Banco do Brasil, Sicredi, Sicoob). Ajuste qualquer contagem de testes/bancos desatualizada.

- [ ] **Step 2: Atualizar o ESTADO-ATUAL**

Em `docs/ESTADO-ATUAL.md`, marcar a fila item 4 (Saldo bancário) como concluída, registrar a migração `0002` e o número de testes novo. Anotar que a **aplicação da migração em produção** é passo manual (se ainda não feito).

- [ ] **Step 3: Commit e push final**

```bash
git add README.md docs/ESTADO-ATUAL.md
git commit -m "docs: saldo por conta no ar (README + ESTADO-ATUAL)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

O push publica na Vercel e reflete no GitHub automaticamente.

---

## Notas de verificação real (pós-migração)

Quando a migração `0002` estiver aplicada (branch ou produção), fazer um teste
ponta a ponta no navegador: importar um extrato de cada banco, salvar, e conferir
que o card de saldo mostra o número que o banco imprime, na data certa. Antes disso,
a fileira de saldo fica vazia (degradação prevista, sem erro).
