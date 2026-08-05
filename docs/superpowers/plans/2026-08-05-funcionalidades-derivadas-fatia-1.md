# Funcionalidades derivadas — Fatia 1 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acender no painel quatro números que o app já tem como dado mas não
mostra — saldo em aberto da fatura, fatura quitada vs em aberto, saldo do mês e
as maiores saídas do período.

**Architecture:** Cada funcionalidade é uma função **pura** em `domain/` ou
`persist/` (testável sem rede, como `saldos.ts` e `agrupar.ts` já são) mais um
componente de apresentação que reusa os padrões existentes (`SaldoConta`,
`Tile`, `LinhaTransacao`). Nenhuma migração de banco: as quatro colunas do A1
vivem no schema **0001** desde o início e já são gravadas por `salvar.ts`.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, Vitest, motion/react,
Neon Data API (`@neondatabase/neon-js`).

## Global Constraints

- **NÃO COMMITAR E NÃO DAR PUSH.** Instrução explícita do usuário nesta
  sessão: ele quer rodar localmente antes de mudar produção. Cada task termina
  com verificação, não com commit. O `git add`/`git commit` fica para quando
  ele aprovar depois de ver rodando.
- **Não mudar aparência.** Reusar componentes e classes existentes. A única
  exceção autorizada está na Task 5 (o 4º tile obriga a mexer na grade), e está
  declarada no spec.
- Valores monetários **sempre** em `BIGINT` de centavos (`number` inteiro).
  Nunca float, nunca divisão antes de formatar.
- **Toda chave nova de i18n entra nos três dicionários** (`pt`, `en`, `es`).
  `Dicionario = typeof pt` — chave faltando em en/es **quebra o build**.
  `pt.ts` é a fonte da verdade.
- Funções de domínio/persistência puras: **sem import de React, sem rede**.
- `npm test` = **395 testes (55 arquivos)** antes desta fatia. Só pode subir.
- Os números de referência do `docs/ESTADO-ATUAL.md` (gasto real de junho
  R$ 41.012,25 = `4101225`; entradas R$ 41.853,57 = `4185357`) **não podem
  mudar** — esta fatia só lê e deriva.
- Verificação padrão ao fim de cada task: `npm test && npm run build && npm run lint`.

---

### Task 1: A1 — módulo puro `faturasAbertas`

**Files:**
- Create: `src/persist/aberto.ts`
- Create: `src/persist/aberto.test.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: `type DocParaAberto`, `type FaturaAberta`, `function faturasAbertas(docs: DocParaAberto[]): FaturaAberta[]`. As tasks 2 usa os três.

Espelha `src/persist/saldos.ts` de propósito: mesmo formato de entrada (linhas
cruas de `documents`), mesma regra de "vence o de maior `period_end` por
conta", mesma saída achatada. Quem já entendeu `saldosPorConta` entende este.

- [ ] **Step 1: Write the failing test**

Create `src/persist/aberto.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { faturasAbertas, type DocParaAberto } from './aberto'

const base: DocParaAberto = {
  bank: 'nubank',
  account_id: 'c1',
  doc_type: 'fatura',
  period_end: '2026-06-20',
  total_open_balance: 268823,
  next_invoice_balance: 127016,
  next_close_date: '2026-07-20',
  future_installments_total: null,
}

describe('faturasAbertas', () => {
  it('escolhe a fatura de maior period_end por conta', () => {
    const docs: DocParaAberto[] = [
      { ...base, period_end: '2026-05-20', total_open_balance: 100000 },
      { ...base, period_end: '2026-06-20', total_open_balance: 268823 },
    ]
    expect(faturasAbertas(docs)).toEqual([
      {
        accountId: 'c1',
        bank: 'nubank',
        abertoCents: 268823,
        proximaCents: 127016,
        proximoFechamento: '2026-07-20',
        date: '2026-06-20',
      },
    ])
  })

  it('ignora extratos (só fatura declara saldo em aberto)', () => {
    expect(faturasAbertas([{ ...base, doc_type: 'extrato' }])).toEqual([])
  })

  it('ignora fatura que não declara saldo em aberto', () => {
    expect(faturasAbertas([{ ...base, total_open_balance: null }])).toEqual([])
  })

  it('ignora fatura sem period_end (não há como saber qual é a mais nova)', () => {
    expect(faturasAbertas([{ ...base, period_end: null }])).toEqual([])
  })

  it('aceita fatura sem próximo fechamento (Bradesco não declara)', () => {
    const docs: DocParaAberto[] = [
      { ...base, next_invoice_balance: null, next_close_date: null },
    ]
    expect(faturasAbertas(docs)[0]).toMatchObject({
      abertoCents: 268823,
      proximaCents: null,
      proximoFechamento: null,
    })
  })

  it('uma linha por conta, várias contas coexistem', () => {
    const docs: DocParaAberto[] = [
      { ...base, account_id: 'c1', bank: 'nubank' },
      { ...base, account_id: 'c2', bank: 'bradesco' },
    ]
    expect(faturasAbertas(docs)).toHaveLength(2)
  })

  it('agrupa por banco quando a fatura não tem account_id', () => {
    const docs: DocParaAberto[] = [
      { ...base, account_id: null, bank: 'nubank', period_end: '2026-05-20' },
      { ...base, account_id: null, bank: 'nubank', period_end: '2026-06-20' },
    ]
    const r = faturasAbertas(docs)
    expect(r).toHaveLength(1)
    expect(r[0].date).toBe('2026-06-20')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/persist/aberto.test.ts`
Expected: FAIL — `Failed to resolve import "./aberto"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/persist/aberto.ts`:

```ts
/** Saldo em aberto do cartão, declarado pela própria fatura.
 *
 *  As quatro colunas lidas aqui existem no schema 0001 e são gravadas por
 *  `salvar.ts` desde sempre — mas nenhum ponto do app as lia. Este módulo é
 *  o leitor que faltava. Nubank declara saldo em aberto e próximo
 *  fechamento; Bradesco declara só o total das próximas faturas.
 *
 *  Gêmeo de `saldos.ts` (saldo do extrato): mesma forma de entrada, mesma
 *  regra de "vence o de maior period_end por conta", mesma saída. Puro. */

export type DocParaAberto = {
  bank: string
  account_id: string | null
  doc_type: string
  period_end: string | null
  total_open_balance: number | null
  next_invoice_balance: number | null
  next_close_date: string | null
  future_installments_total: number | null
}

export type FaturaAberta = {
  accountId: string | null
  bank: string
  /** Saldo em aberto total declarado pela fatura, em centavos. */
  abertoCents: number
  /** Saldo em aberto da próxima fatura, quando o banco declara. */
  proximaCents: number | null
  /** Data do próximo fechamento (YYYY-MM-DD), quando o banco declara. */
  proximoFechamento: string | null
  /** `period_end` da fatura de onde os números vieram. */
  date: string
}

/** Para cada conta com ao menos uma fatura que declare saldo em aberto,
 *  vence a fatura de maior `period_end`. Extrato e fatura sem saldo (ou sem
 *  data) são ignorados — sem data não há como saber qual é a mais nova. */
export function faturasAbertas(docs: DocParaAberto[]): FaturaAberta[] {
  const porConta = new Map<string, FaturaAberta & { _pe: string }>()
  for (const d of docs) {
    if (d.doc_type !== 'fatura') continue
    if (d.total_open_balance == null || d.period_end == null) continue
    // Sem account_id (documento antigo), agrupa por banco para não colidir.
    const chave = d.account_id ?? `${d.bank}:sem-conta`
    const atual = porConta.get(chave)
    if (!atual || d.period_end > atual._pe) {
      porConta.set(chave, {
        accountId: d.account_id,
        bank: d.bank,
        abertoCents: d.total_open_balance,
        proximaCents: d.next_invoice_balance,
        proximoFechamento: d.next_close_date,
        date: d.period_end,
        _pe: d.period_end,
      })
    }
  }
  return [...porConta.values()].map(({ _pe, ...f }) => f)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/persist/aberto.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 5: Verify nothing else broke**

Run: `npm test && npm run build && npm run lint`
Expected: total de testes = 395 + 7 = **402**. Build e lint sem erro.
**Não commitar** (ver Global Constraints).

---

### Task 2: A1 — ligar no banco e mostrar no painel

**Files:**
- Modify: `src/persist/documentos.ts:28-45` (widen o select de `puxarSaldos`)
- Create: `src/ui/SaldoAberto.tsx`
- Modify: `src/ui/Dashboard.tsx` (import, `useMemo`, grade de cartões)
- Modify: `src/i18n/dicionarios/pt.ts`, `en.ts`, `es.ts`

**Interfaces:**
- Consumes: `faturasAbertas`, `DocParaAberto`, `FaturaAberta` da Task 1.
- Produces: `puxarSaldos(): Promise<DocDoPainel[]>` onde
  `type DocDoPainel = DocParaSaldo & DocParaAberto`; componente
  `<SaldoAberto bank abertoCents proximoFechamento />`.

**Decisão registrada — o nome `puxarSaldos` NÃO muda.**
`src/ui/Dashboard.pdf.test.tsx:31` faz
`vi.mock('../persist/documentos', () => ({ puxarSaldos: vi.fn()... }))`.
Renomear a função quebraria esse mock (o Dashboard importaria um nome que o
mock não expõe) sem ganho real — "saldos" cobre tanto o saldo do extrato
quanto o saldo em aberto do cartão. O que muda é só o tipo de retorno.

**Por que não precisa de migração:** `total_open_balance`,
`next_invoice_balance`, `next_close_date` e `future_installments_total` são
colunas do **0001** (schema inicial), não do 0002. Existem em qualquer banco
que rodou a instalação. O `try/catch` defensivo que já está lá continua
protegendo o único campo arriscado (`end_balance_cents`, do 0002).

- [ ] **Step 1: Write the failing test**

Create `src/ui/SaldoAberto.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaldoAberto } from './SaldoAberto'

describe('SaldoAberto', () => {
  it('mostra o valor em aberto formatado', () => {
    render(<SaldoAberto bank="nubank" abertoCents={268823} proximoFechamento="2026-07-20" />)
    expect(screen.getByText(/2\.688,23/)).toBeTruthy()
  })

  it('nomeia o banco pelo catálogo canônico', () => {
    render(<SaldoAberto bank="nubank" abertoCents={100} proximoFechamento={null} />)
    expect(screen.getByText('Nubank')).toBeTruthy()
  })

  it('omite a linha de fechamento quando o banco não declara', () => {
    render(<SaldoAberto bank="bradesco" abertoCents={552944} proximoFechamento={null} />)
    expect(screen.queryByText(/fecha/i)).toBeNull()
  })

  it('banco fora do catálogo não quebra', () => {
    render(<SaldoAberto bank="inventado" abertoCents={1} proximoFechamento={null} />)
    expect(screen.getByText(/0,01/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/SaldoAberto.test.tsx`
Expected: FAIL — `Failed to resolve import "./SaldoAberto"`.

- [ ] **Step 3: Add the i18n keys (three dictionaries)**

Em `src/i18n/dicionarios/pt.ts`, logo depois de `'saldo.em'` (linha 105):

```ts
  'aberto.rotulo': 'Em aberto',
  'aberto.fecha': 'fecha em {data}',
```

Em `src/i18n/dicionarios/en.ts`, depois de `'saldo.em'` (linha 93):

```ts
  'aberto.rotulo': 'Outstanding',
  'aberto.fecha': 'closes {data}',
```

Em `src/i18n/dicionarios/es.ts`, depois de `'saldo.em'` (linha 93):

```ts
  'aberto.rotulo': 'Pendiente',
  'aberto.fecha': 'cierra el {data}',
```

- [ ] **Step 4: Write the component**

Create `src/ui/SaldoAberto.tsx`. Copia deliberada da estrutura de
`SaldoConta.tsx` — mesmo cartão, mesma tipografia, mesma função `dataCurta`.

```tsx
import { BANCOS } from '../domain/banks'
import type { Bank } from '../domain/pdf/detect'
import { formatBRL } from '../domain/normalize/money'
import { mesAbrev } from '../domain/normalize/data'
import { useT } from '../i18n/IdiomaProvider'

/** "2026-07-20" → "20/jul" (mês na locale ativa). Constrói a data local para
 *  não escorregar de fuso (a data já é local, da fatura). */
function dataCurta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}/${mesAbrev(new Date(y, (m ?? 1) - 1, d))}`
}

type Props = {
  bank: string
  abertoCents: number
  proximoFechamento: string | null
}

/** Card compacto do saldo em aberto do cartão, declarado pela fatura.
 *  Irmão de `SaldoConta` (que mostra o saldo do extrato) e mora na mesma
 *  grade. Banco fora do catálogo cai no tema "desconhecido" sem quebrar. */
export function SaldoAberto({ bank, abertoCents, proximoFechamento }: Props) {
  const tema = BANCOS[bank as Bank] ?? BANCOS.desconhecido
  const { t } = useT()
  return (
    <div className="rounded-xl border border-carvao-700 bg-carvao-900/80 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tema.accent }} aria-hidden />
        <span className="text-[10px] uppercase tracking-widest text-tinta-tenue">
          {t('aberto.rotulo')}
        </span>
        <span className="truncate text-sm text-tinta">{tema.nome}</span>
      </div>
      <p className="tabular mt-1 text-lg text-tinta">{formatBRL(abertoCents)}</p>
      {proximoFechamento && (
        <p className="text-[11px] text-tinta-tenue">
          {t('aberto.fecha', { data: dataCurta(proximoFechamento) })}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui/SaldoAberto.test.tsx`
Expected: PASS, 4 testes.

- [ ] **Step 6: Widen the query**

Em `src/persist/documentos.ts`, trocar o bloco do `puxarSaldos` (linhas 28-45)
por:

```ts
/** Uma linha de `documents` com tudo que o painel deriva dela: o saldo final
 *  do extrato (`saldos.ts`) e o saldo em aberto da fatura (`aberto.ts`). */
export type DocDoPainel = DocParaSaldo & DocParaAberto

/** Documentos com os campos que alimentam o saldo por conta E o saldo em
 *  aberto do cartão. Query SEPARADA (não o `puxarDocumentos` do painel) e
 *  DEFENSIVA: se a migração 0002 ainda não rodou, a coluna
 *  `end_balance_cents` não existe e o select erra — aqui isso vira lista
 *  vazia (as fileiras simplesmente não aparecem), sem contaminar o resto do
 *  dashboard. As outras quatro colunas são do schema 0001 e sempre existem.
 *
 *  O nome continua `puxarSaldos` de propósito: `Dashboard.pdf.test.tsx`
 *  mocka este módulo por nome, e renomear quebraria o mock sem ganho. */
export async function puxarSaldos(): Promise<DocDoPainel[]> {
  if (!neon) return []
  try {
    const { data, error } = await neon
      .from('documents')
      .select(
        'bank, account_id, doc_type, period_end, end_balance_cents, total_open_balance, next_invoice_balance, next_close_date, future_installments_total',
      )
    if (error) return []
    return (data ?? []) as DocDoPainel[]
  } catch {
    return []
  }
}
```

E acrescentar o import no topo do arquivo, junto do que já existe:

```ts
import type { DocParaAberto } from './aberto'
```

- [ ] **Step 7: Render in the Dashboard**

Em `src/ui/Dashboard.tsx`:

(a) Nos imports, depois de `import { SaldoConta } from './SaldoConta'`:

```ts
import { SaldoAberto } from './SaldoAberto'
```

(b) Junto do import de `saldosPorConta` (linha 32), acrescentar:

```ts
import { faturasAbertas } from '../persist/aberto'
```

(c) Trocar o tipo do estado `docsSaldo` (linha 130) para o novo:

```ts
const [docsSaldo, setDocsSaldo] = useState<DocDoPainel[]>([])
```

ajustando o import da linha 31-32 para trazer o tipo:

```ts
import { puxarSaldos, type DocDoPainel } from '../persist/documentos'
import { saldosPorConta } from '../persist/saldos'
```

(d) Depois do `useMemo` de `saldos` (linha 182), acrescentar:

```ts
  // Saldo em aberto do cartão, declarado pela fatura mais recente de cada
  // conta. Dado que já era gravado desde sempre e nunca era lido.
  const abertos = useMemo(() => faturasAbertas(docsSaldo), [docsSaldo])
```

(e) Trocar o bloco da grade de saldos (linhas 366-378) por:

```tsx
      {/* Saldo atual por conta (extrato) + saldo em aberto do cartão (fatura) */}
      {(saldos.length > 0 || abertos.length > 0) && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {saldos.map((s) => (
            <SaldoConta
              key={`saldo-${s.bank}-${s.accountId ?? 'sem-conta'}`}
              bank={s.bank}
              balanceCents={s.balanceCents}
              date={s.date}
            />
          ))}
          {abertos.map((a) => (
            <SaldoAberto
              key={`aberto-${a.bank}-${a.accountId ?? 'sem-conta'}`}
              bank={a.bank}
              abertoCents={a.abertoCents}
              proximoFechamento={a.proximoFechamento}
            />
          ))}
        </div>
      )}
```

A grade **não muda de classe** — os cartões novos entram na mesma grade
responsiva que já existia. As `key` ganharam prefixo porque agora duas listas
compartilham o mesmo pai e um `bank` pode aparecer nas duas.

- [ ] **Step 8: Verify**

Run: `npm test && npm run build && npm run lint`
Expected: **406 testes**, build e lint limpos. **Não commitar.**

---

### Task 3: A2 — módulo puro `faturasQuitadas`

**Files:**
- Create: `src/domain/quitacao.ts`
- Create: `src/domain/quitacao.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `type FaturaParaQuitacao`, `type PagamentoParaQuitacao`,
  `function faturasQuitadas(faturas, pagamentos): Set<string>` (o Set contém
  os `id` das faturas quitadas). A Task 4 usa os três.

**O que este módulo conserta.** `vincular()` (`domain/link/vinculos.ts:104`)
casa pagamento com fatura **apenas dentro do lote de uma importação**. Se a
fatura entra num dia e o extrato que a quita entra noutro, o vínculo nunca
acontece. Aqui a mesma regra roda sobre **tudo que está salvo**.

**Duas travas de desenho, ambas contra falso positivo:**

1. **Consumo, não reuso.** Um pagamento quita **uma** fatura. Sem isso, um
   único pagamento de R$ 500 marcaria como quitadas todas as faturas de
   R$ 500 do histórico.
2. **Proximidade no tempo, com janela.** Entre os pagamentos de valor igual,
   vence o **mais próximo** do `period_end` da fatura, e só se estiver dentro
   de **45 dias**. Sem isso, duas faturas de meses diferentes com o mesmo
   total ficariam indistinguíveis, e um pagamento de 2024 quitaria uma fatura
   de 2026.

- [ ] **Step 1: Write the failing test**

Create `src/domain/quitacao.test.ts`. Os valores são os de referência do
`ESTADO-ATUAL.md`: fatura Nubank R$ 8.324,24 e Bradesco R$ 5.529,44.

```ts
import { describe, it, expect } from 'vitest'
import {
  faturasQuitadas,
  type FaturaParaQuitacao,
  type PagamentoParaQuitacao,
} from './quitacao'

const NUBANK: FaturaParaQuitacao = { id: 'f-nu', declared_total: 832424, period_end: '2026-06-20' }
const BRADESCO: FaturaParaQuitacao = { id: 'f-bra', declared_total: 552944, period_end: '2026-06-10' }

const pg = (over: Partial<PagamentoParaQuitacao>): PagamentoParaQuitacao => ({
  id: 'p1',
  date: '2026-06-20',
  amount_cents: -832424,
  kind: 'card_payment',
  ...over,
})

describe('faturasQuitadas', () => {
  it('marca a fatura cujo total bate com um pagamento', () => {
    expect(faturasQuitadas([NUBANK], [pg({})])).toEqual(new Set(['f-nu']))
  })

  it('casa independente do sinal do lançamento', () => {
    expect(faturasQuitadas([NUBANK], [pg({ amount_cents: 832424 })])).toEqual(new Set(['f-nu']))
  })

  it('não marca quando não há pagamento de valor igual', () => {
    expect(faturasQuitadas([NUBANK], [pg({ amount_cents: -1000 })])).toEqual(new Set())
  })

  it('ignora lançamentos que não são pagamento de fatura', () => {
    expect(faturasQuitadas([NUBANK], [pg({ kind: 'expense' })])).toEqual(new Set())
  })

  it('um pagamento quita uma só fatura (sem reuso)', () => {
    const gemea: FaturaParaQuitacao = { id: 'f-gemea', declared_total: 832424, period_end: '2026-05-20' }
    const r = faturasQuitadas([NUBANK, gemea], [pg({})])
    expect(r.size).toBe(1)
  })

  it('entre faturas de mesmo total, quita a mais próxima do pagamento', () => {
    const maio: FaturaParaQuitacao = { id: 'f-maio', declared_total: 832424, period_end: '2026-05-20' }
    // Pagamento em 21/mai casa com a de maio, não com a de junho.
    const r = faturasQuitadas([NUBANK, maio], [pg({ date: '2026-05-21' })])
    expect(r).toEqual(new Set(['f-maio']))
  })

  it('pagamento fora da janela de 45 dias não quita', () => {
    const r = faturasQuitadas([NUBANK], [pg({ date: '2024-01-15' })])
    expect(r).toEqual(new Set())
  })

  it('duas faturas de bancos diferentes, dois pagamentos', () => {
    const pagamentos = [
      pg({ id: 'p1', amount_cents: -832424, date: '2026-06-20' }),
      pg({ id: 'p2', amount_cents: -552944, date: '2026-06-10' }),
    ]
    expect(faturasQuitadas([NUBANK, BRADESCO], pagamentos)).toEqual(
      new Set(['f-nu', 'f-bra']),
    )
  })

  it('ignora fatura sem total declarado ou sem period_end', () => {
    const semTotal: FaturaParaQuitacao = { id: 'x', declared_total: null, period_end: '2026-06-20' }
    const semData: FaturaParaQuitacao = { id: 'y', declared_total: 832424, period_end: null }
    expect(faturasQuitadas([semTotal, semData], [pg({})])).toEqual(new Set())
  })

  it('é determinístico: a ordem da entrada não muda o resultado', () => {
    const maio: FaturaParaQuitacao = { id: 'f-maio', declared_total: 832424, period_end: '2026-05-20' }
    const a = faturasQuitadas([NUBANK, maio], [pg({ date: '2026-05-21' })])
    const b = faturasQuitadas([maio, NUBANK], [pg({ date: '2026-05-21' })])
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/quitacao.test.ts`
Expected: FAIL — `Failed to resolve import "./quitacao"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/quitacao.ts`:

```ts
/** Quais faturas já foram quitadas, derivado do que está salvo.
 *
 *  A regra é a mesma do `link/vinculos.ts`: um lançamento de pagamento de
 *  fatura cujo valor bate com o total declarado da fatura a quita. A
 *  diferença é o alcance — `vincular()` só cruza os documentos do LOTE de uma
 *  importação, então fatura e extrato importados em dias diferentes nunca se
 *  encontram. Aqui a regra roda sobre todo o histórico salvo.
 *
 *  Puro: sem rede, sem React. */

export type FaturaParaQuitacao = {
  id: string
  /** Total declarado no rodapé do PDF, em centavos. */
  declared_total: number | null
  /** Vencimento da fatura (YYYY-MM-DD). */
  period_end: string | null
}

export type PagamentoParaQuitacao = {
  id: string
  /** Data real do lançamento (YYYY-MM-DD). */
  date: string
  amount_cents: number
  kind: string
}

/** Quão longe do vencimento um pagamento ainda pode estar para ser aceito
 *  como quitação daquela fatura. Guarda contra um pagamento antigo de valor
 *  coincidente quitar uma fatura recente. */
const JANELA_DIAS = 45

const DIA_MS = 86400_000

function diasEntre(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b)) / DIA_MS
}

/** Devolve os `id` das faturas quitadas.
 *
 *  Cada pagamento quita no máximo UMA fatura (é consumido). Entre as
 *  candidatas de valor igual vence a mais próxima do vencimento, e a ordem
 *  de processamento é por `period_end` crescente — assim o resultado não
 *  depende da ordem em que os documentos chegaram. */
export function faturasQuitadas(
  faturas: FaturaParaQuitacao[],
  pagamentos: PagamentoParaQuitacao[],
): Set<string> {
  const candidatas = faturas
    .filter((f) => f.declared_total != null && f.period_end != null)
    .sort((a, b) => (a.period_end! < b.period_end! ? -1 : 1))

  const disponiveis = pagamentos.filter((p) => p.kind === 'card_payment')
  const usados = new Set<string>()
  const quitadas = new Set<string>()

  for (const f of candidatas) {
    const total = f.declared_total!
    const vencimento = f.period_end!

    let melhor: PagamentoParaQuitacao | null = null
    let melhorDist = Infinity
    for (const p of disponiveis) {
      if (usados.has(p.id)) continue
      if (Math.abs(p.amount_cents) !== total) continue
      const dist = diasEntre(p.date, vencimento)
      if (dist > JANELA_DIAS) continue
      if (dist < melhorDist) {
        melhor = p
        melhorDist = dist
      }
    }

    if (melhor) {
      usados.add(melhor.id)
      quitadas.add(f.id)
    }
  }

  return quitadas
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/quitacao.test.ts`
Expected: PASS, 10 testes.

- [ ] **Step 5: Verify**

Run: `npm test && npm run build && npm run lint`
Expected: **416 testes**. **Não commitar.**

---

### Task 4: A2 — selo "quitada / em aberto" no painel Documentos

**Files:**
- Modify: `src/ui/Dashboard.tsx` (passar os pagamentos ao painel)
- Modify: `src/ui/Documentos.tsx` (receber a prop e desenhar o selo)
- Modify: `src/i18n/dicionarios/pt.ts`, `en.ts`, `es.ts`

**Interfaces:**
- Consumes: `faturasQuitadas`, `PagamentoParaQuitacao` da Task 3.
- Produces: `Documentos` ganha a prop
  `pagamentos: PagamentoParaQuitacao[]`.

`puxarDocumentos()` já traz `declared_total` e `period_end`
(`documentos.ts:20`), então `DocumentoSalvo` já satisfaz
`FaturaParaQuitacao` — falta só o `id`, que também já vem. Nada muda na query.

- [ ] **Step 1: Write the failing test**

Create `src/ui/Documentos.quitacao.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Documentos } from './Documentos'

vi.mock('../persist/documentos', () => ({
  puxarDocumentos: vi.fn().mockResolvedValue([
    {
      id: 'f-nu',
      bank: 'nubank',
      doc_type: 'fatura',
      period_start: '2026-05-21',
      period_end: '2026-06-20',
      filename: 'nubank.pdf',
      imported_at: '2026-06-21T10:00:00Z',
      declared_total: 832424,
    },
    {
      id: 'f-bra',
      bank: 'bradesco',
      doc_type: 'fatura',
      period_start: '2026-05-11',
      period_end: '2026-06-10',
      filename: 'bradesco.pdf',
      imported_at: '2026-06-21T10:00:00Z',
      declared_total: 552944,
    },
  ]),
  apagarDocumento: vi.fn(),
  apagarTudo: vi.fn(),
}))

const props = {
  onFechar: () => {},
  onMudou: () => {},
  contagem: new Map<string, { qtd: number; totalCents: number }>(),
}

describe('Documentos — selo de quitação', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marca como quitada a fatura que tem pagamento correspondente', async () => {
    render(
      <Documentos
        {...props}
        pagamentos={[
          { id: 'p1', date: '2026-06-20', amount_cents: -832424, kind: 'card_payment' },
        ]}
      />,
    )
    expect(await screen.findByText('quitada')).toBeInTheDocument()
  })

  it('a fatura sem pagamento aparece em aberto', async () => {
    render(<Documentos {...props} pagamentos={[]} />)
    expect(await screen.findAllByText('em aberto')).toHaveLength(2)
  })

  it('sem pagamento nenhum, nenhuma fatura é quitada', async () => {
    render(<Documentos {...props} pagamentos={[]} />)
    await screen.findAllByText('em aberto')
    expect(screen.queryByText('quitada')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/Documentos.quitacao.test.tsx`
Expected: FAIL — TypeScript reclama da prop `pagamentos` inexistente, e
`screen.findByText('quitada')` não encontra nada.

- [ ] **Step 3: Add the i18n keys (three dictionaries)**

Em `src/i18n/dicionarios/pt.ts`, junto de `'doc.fatura'` (linha 150):

```ts
  'doc.quitada': 'quitada',
  'doc.emAberto': 'em aberto',
```

Em `src/i18n/dicionarios/en.ts`, junto de `'doc.fatura'` (linha 133):

```ts
  'doc.quitada': 'paid',
  'doc.emAberto': 'open',
```

Em `src/i18n/dicionarios/es.ts`, junto de `'doc.fatura'` (linha 133):

```ts
  'doc.quitada': 'pagada',
  'doc.emAberto': 'pendiente',
```

- [ ] **Step 4: Fix the pre-existing EN translation bug**

Em `src/i18n/dicionarios/en.ts:133-134`, hoje:

```ts
  'doc.fatura': 'Statement',
  'doc.extrato': 'Bank statement',
```

Os dois dizem "statement" — em inglês o painel não distingue fatura de
extrato, e o selo novo vai ficar exatamente ao lado desse texto. Trocar por:

```ts
  'doc.fatura': 'Card bill',
  'doc.extrato': 'Bank statement',
```

- [ ] **Step 5: Compute and pass the payments from the Dashboard**

Em `src/ui/Dashboard.tsx`:

(a) Depois do `useMemo` de `contagemPorDoc` (que termina na linha 208),
acrescentar:

```ts
  // Pagamentos de fatura de todo o histórico. O painel de Documentos deriva
  // deles quais faturas estão quitadas — cruzamento que a importação sozinha
  // não faz quando fatura e extrato entram em dias diferentes.
  const pagamentos = useMemo(
    () =>
      (todas ?? [])
        .filter((t) => t.kind === 'card_payment')
        .map((t) => ({
          id: t.id,
          date: t.date,
          amount_cents: t.amount_cents,
          kind: t.kind,
        })),
    [todas],
  )
```

(b) No render do painel (linhas 488-493), acrescentar a prop:

```tsx
        {mostrarDocs && (
          <Documentos
            contagem={contagemPorDoc}
            pagamentos={pagamentos}
            onFechar={() => setMostrarDocs(false)}
            onMudou={carregar}
          />
        )}
```

- [ ] **Step 6: Draw the badge**

Em `src/ui/Documentos.tsx`:

(a) Nos imports, acrescentar:

```ts
import { faturasQuitadas, type PagamentoParaQuitacao } from '../domain/quitacao'
```

(b) No type `Props`, acrescentar:

```ts
  /** Pagamentos de fatura de todo o histórico, vindos do dashboard (já em
   *  memória). Deles se deriva qual fatura está quitada. */
  pagamentos: PagamentoParaQuitacao[]
```

(c) Na assinatura do componente (linha 43):

```ts
export function Documentos({ onFechar, onMudou, contagem, pagamentos }: Props) {
```

(d) Depois do `const docAlvo = ...` (linha 105), acrescentar:

```ts
  // Faturas quitadas, derivado de todo o histórico de pagamentos. Só as
  // faturas entram: um extrato que por acaso tenha `declared_total` igual ao
  // de um pagamento CONSUMIRIA aquele pagamento (a regra é um-para-um) e
  // deixaria a fatura de verdade marcada como em aberto.
  const quitadas = faturasQuitadas(
    (docs ?? []).filter((d) => d.doc_type === 'fatura'),
    pagamentos,
  )
```

(e) Dentro do `docs.map`, o `<p>` da linha 185-189 ganha o selo. Trocar o
bloco por:

```tsx
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-tinta">
                        {t(ehFatura ? 'doc.fatura' : 'doc.extrato')} ·{' '}
                        <span className="capitalize">{d.bank}</span>
                        <span className="text-tinta-tenue"> · {periodoCurto(d.period_start, d.period_end)}</span>
                        {ehFatura && d.declared_total != null && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
                              quitadas.has(d.id)
                                ? 'bg-confere/15 text-confere'
                                : 'bg-ressalva/15 text-ressalva'
                            }`}
                          >
                            {t(quitadas.has(d.id) ? 'doc.quitada' : 'doc.emAberto')}
                          </span>
                        )}
                      </p>
```

O selo só aparece em **fatura com total declarado** — extrato não se "quita",
e fatura sem total declarado não tem como ser conferida. Cores: `confere`
(verde oliva) e `ressalva` (âmbar), as duas semânticas que o projeto já usa.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/ui/Documentos.quitacao.test.tsx`
Expected: PASS, 3 testes.

- [ ] **Step 8: Verify**

Run: `npm test && npm run build && npm run lint`
Expected: **419 testes**. `Documentos.test.tsx` (o antigo) vai falhar por
falta da prop `pagamentos` — **corrigir passando `pagamentos={[]}`** nos
renders daquele arquivo. **Não commitar.**

---

### Task 5: B1 — tile "Saldo do mês"

**Files:**
- Modify: `src/persist/agrupar.ts:62-97` (`Resumo` e `agregar`)
- Modify: `src/ui/Dashboard.tsx:549-565` (grade de tiles)
- Modify: `src/i18n/dicionarios/pt.ts`, `en.ts`, `es.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `Resumo.saldoCents: number`.

**⚠️ A única mudança de aparência autorizada desta fatia.** A grade dos tiles
é hoje `grid-cols-1 sm:grid-cols-3`. Um quarto tile obriga a mexer nisso. Este
plano usa `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`: em telas médias vira
2×2 e em telas grandes fica em fileira única. Está declarado no spec para o
usuário revisar depois — se ele preferir outra grade, é uma classe.

- [ ] **Step 1: Write the failing test**

Acrescentar em `src/persist/agrupar.test.ts` dentro do
`describe('agregar', ...)` que já existe (linha 58):

```ts
  it('saldo do mês é entradas menos gasto', () => {
    const txs = [
      { date: '2026-06-05', competencia: '2026-06', amount_cents: 42000, kind: 'expense', category_slug: 'aluguel' },
      { date: '2026-06-15', competencia: '2026-06', amount_cents: -152000, kind: 'income', category_slug: null },
    ]
    const r = agregar(txs)
    expect(r.gastoCents).toBe(42000)
    expect(r.entradasCents).toBe(152000)
    expect(r.saldoCents).toBe(110000)
  })

  it('saldo negativo quando se gasta mais do que entra', () => {
    const txs = [
      { date: '2026-06-05', competencia: '2026-06', amount_cents: 200000, kind: 'expense', category_slug: 'outros' },
      { date: '2026-06-15', competencia: '2026-06', amount_cents: -50000, kind: 'income', category_slug: null },
    ]
    expect(agregar(txs).saldoCents).toBe(-150000)
  })

  it('vínculos não entram no saldo (não são gasto nem entrada)', () => {
    const txs = [
      { date: '2026-06-20', competencia: '2026-06', amount_cents: 832424, kind: 'card_payment', category_slug: null },
      { date: '2026-06-15', competencia: '2026-06', amount_cents: -152000, kind: 'income', category_slug: null },
    ]
    expect(agregar(txs).saldoCents).toBe(152000)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/persist/agrupar.test.ts`
Expected: FAIL — `saldoCents` não existe em `Resumo`.

- [ ] **Step 3: Add `saldoCents` to `agregar`**

Em `src/persist/agrupar.ts`, no type `Resumo` (linha 62):

```ts
export type Resumo = {
  gastoCents: number
  entradasCents: number
  /** Entradas menos gasto. Positivo = sobrou. Vínculos não entram (não são
   *  gasto nem entrada), então o número é o que de fato sobrou no período. */
  saldoCents: number
  contagem: number
  porCategoria: CategoriaResumo[]
}
```

E no `return` de `agregar` (linha 91):

```ts
  return {
    gastoCents,
    entradasCents,
    saldoCents: entradasCents - gastoCents,
    contagem: txs.length,
    porCategoria: [...mapa.values()].sort((a, b) => b.totalCents - a.totalCents),
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/persist/agrupar.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the i18n keys (three dictionaries)**

`pt.ts`, junto de `'dash.lancamentos'` (linha 72):

```ts
  'dash.saldoMes': 'Saldo do período',
```

`en.ts` (linha 62):

```ts
  'dash.saldoMes': 'Period balance',
```

`es.ts` (linha 62):

```ts
  'dash.saldoMes': 'Saldo del período',
```

- [ ] **Step 6: Add the tile**

Em `src/ui/Dashboard.tsx`, trocar a grade de tiles (linhas 549-565) por:

```tsx
      {/* Tiles de resumo — largura total, com números que "contam" */}
      <div className="grid grid-cols-1 gap-px bg-carvao-800 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div {...entra(0.05)}>
          <Tile rotulo={t('dash.gasto')} destaque>
            <ValorAnimado valor={resumo.gastoCents} />
          </Tile>
        </motion.div>
        <motion.div {...entra(0.12)}>
          <Tile rotulo={t('dash.entradas')} cor="var(--color-confere)">
            <ValorAnimado valor={resumo.entradasCents} />
          </Tile>
        </motion.div>
        <motion.div {...entra(0.19)}>
          <Tile
            rotulo={t('dash.saldoMes')}
            cor={resumo.saldoCents < 0 ? 'var(--color-falha)' : undefined}
          >
            <ValorAnimado valor={resumo.saldoCents} />
          </Tile>
        </motion.div>
        <motion.div {...entra(0.26)}>
          <Tile rotulo={t('dash.lancamentos')}>
            <ValorAnimado valor={resumo.contagem} moeda={false} />
          </Tile>
        </motion.div>
      </div>
```

O saldo negativo fica em `--color-falha` (a cor de "algo está errado" que o
projeto já usa); positivo fica na cor normal de tinta, sem verde — verde é de
`--color-confere`, reservado a "o total bate", e usar aqui diluiria a
semântica (ver decisões de design no `ESTADO-ATUAL.md`).

- [ ] **Step 7: Verify**

Run: `npm test && npm run build && npm run lint`
Expected: **422 testes**. Se `Dashboard.pdf.test.tsx` asseverar a contagem de
tiles, ajustar. **Não commitar.**

---

### Task 6: B2 — módulo puro `maioresSaidas`

**Files:**
- Modify: `src/persist/agrupar.ts` (acrescentar a função ao fim)
- Modify: `src/persist/agrupar.test.ts` (acrescentar o describe)

**Interfaces:**
- Consumes: `TxAgrupavel` (já existe em `agrupar.ts:8`).
- Produces: `function maioresSaidas<T extends TxAgrupavel>(txs: T[], n?: number): T[]`.
  A Task 7 usa. Genérico como `porCategoriaDetalhado`, para preservar
  `TransacaoSalva` (que tem `description`/`label`/`id`) na saída.

- [ ] **Step 1: Write the failing test**

Acrescentar ao fim de `src/persist/agrupar.test.ts`:

```ts
describe('maioresSaidas', () => {
  const tx = (over: Partial<TxAgrupavel> & { id?: string }) => ({
    id: 'x',
    date: '2026-06-05',
    competencia: '2026-06',
    amount_cents: 1000,
    kind: 'expense',
    category_slug: 'outros',
    ...over,
  })

  it('ordena por valor desc e corta em n', () => {
    const txs = [
      tx({ id: 'a', amount_cents: 42000 }),
      tx({ id: 'b', amount_cents: 31000 }),
      tx({ id: 'c', amount_cents: 22840 }),
      tx({ id: 'd', amount_cents: 14280 }),
    ]
    expect(maioresSaidas(txs, 2).map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('só despesas — entradas e vínculos ficam de fora', () => {
    const txs = [
      tx({ id: 'gasto', amount_cents: 1000 }),
      tx({ id: 'entrada', amount_cents: -900000, kind: 'income' }),
      tx({ id: 'quitacao', amount_cents: 800000, kind: 'card_payment' }),
    ]
    expect(maioresSaidas(txs).map((t) => t.id)).toEqual(['gasto'])
  })

  it('devolve menos que n quando não há despesas suficientes', () => {
    expect(maioresSaidas([tx({ id: 'a' })], 5)).toHaveLength(1)
  })

  it('lista vazia devolve lista vazia', () => {
    expect(maioresSaidas([], 5)).toEqual([])
  })

  it('não muta a lista recebida', () => {
    const txs = [tx({ id: 'a', amount_cents: 100 }), tx({ id: 'b', amount_cents: 200 })]
    maioresSaidas(txs)
    expect(txs.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('n padrão é 5', () => {
    const txs = Array.from({ length: 9 }, (_, i) =>
      tx({ id: `t${i}`, amount_cents: (i + 1) * 100 }),
    )
    expect(maioresSaidas(txs)).toHaveLength(5)
  })
})
```

Garantir que o import no topo do arquivo de teste inclui `maioresSaidas` e o
tipo `TxAgrupavel`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/persist/agrupar.test.ts`
Expected: FAIL — `maioresSaidas is not a function` / erro de import.

- [ ] **Step 3: Write minimal implementation**

Acrescentar ao fim de `src/persist/agrupar.ts`:

```ts
/** As n maiores despesas do período, da maior para a menor.
 *
 *  Só `kind === 'expense'`: entrada não é saída, e vínculo
 *  (`card_payment`/`internal_transfer`) é dinheiro que só mudou de lugar —
 *  incluí-lo poria a quitação da fatura no topo do ranking todo mês,
 *  escondendo os gastos de verdade.
 *
 *  Copia antes de ordenar: a lista que chega é a mesma que o dashboard usa
 *  noutros cálculos, e `sort` muta no lugar. */
export function maioresSaidas<T extends TxAgrupavel>(txs: T[], n = 5): T[] {
  return txs
    .filter((t) => t.kind === 'expense')
    .slice()
    .sort((a, b) => b.amount_cents - a.amount_cents)
    .slice(0, n)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/persist/agrupar.test.ts`
Expected: PASS, 6 testes novos.

- [ ] **Step 5: Verify**

Run: `npm test && npm run build && npm run lint`
Expected: **428 testes**. **Não commitar.**

---

### Task 7: B2 — card "Maiores saídas do período"

**Files:**
- Create: `src/ui/MaioresSaidas.tsx`
- Create: `src/ui/MaioresSaidas.test.tsx`
- Modify: `src/ui/Dashboard.tsx` (import, `useMemo`, render no aside)
- Modify: `src/i18n/dicionarios/pt.ts`, `en.ts`, `es.ts`

**Interfaces:**
- Consumes: `maioresSaidas` da Task 6; `TransacaoSalva` de `persist/puxar`;
  `categoria`/`nomeCategoria` de `domain/categorize/categorias`.
- Produces: `<MaioresSaidas itens onEditar />`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/MaioresSaidas.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { MaioresSaidas } from './MaioresSaidas'
import type { TransacaoSalva } from '../persist/puxar'

const tx = (over: Partial<TransacaoSalva>): TransacaoSalva => ({
  id: 'x',
  date: '2026-06-05',
  competencia: '2026-06',
  description: 'ALUGUEL JUNHO',
  label: null,
  amount_cents: 42000,
  kind: 'expense',
  category_slug: 'aluguel',
  bank: 'nubank',
  doc_type: 'extrato',
  document_id: 'd1',
  installment: null,
  ...over,
})

describe('MaioresSaidas', () => {
  it('lista os itens com posição e valor', () => {
    render(<MaioresSaidas itens={[tx({})]} onEditar={() => {}} />)
    expect(screen.getByText('ALUGUEL JUNHO')).toBeInTheDocument()
    expect(screen.getByText(/420,00/)).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('prefere o rótulo do usuário à descrição do banco', () => {
    render(<MaioresSaidas itens={[tx({ label: 'Aluguel da casa' })]} onEditar={() => {}} />)
    expect(screen.getByText('Aluguel da casa')).toBeInTheDocument()
    expect(screen.queryByText('ALUGUEL JUNHO')).not.toBeInTheDocument()
  })

  it('mostra o nome da categoria', () => {
    render(<MaioresSaidas itens={[tx({})]} onEditar={() => {}} />)
    expect(screen.getByText('Aluguel')).toBeInTheDocument()
  })

  it('clicar na linha chama onEditar com a transação', async () => {
    const onEditar = vi.fn()
    const item = tx({ id: 'clicavel' })
    render(<MaioresSaidas itens={[item]} onEditar={onEditar} />)
    await userEvent.click(screen.getByRole('button', { name: /ALUGUEL JUNHO/ }))
    expect(onEditar).toHaveBeenCalledWith(item)
  })

  it('não renderiza nada quando não há itens', () => {
    const { container } = render(<MaioresSaidas itens={[]} onEditar={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/MaioresSaidas.test.tsx`
Expected: FAIL — `Failed to resolve import "./MaioresSaidas"`.

- [ ] **Step 3: Add the i18n keys (three dictionaries)**

`pt.ts`, junto das chaves `dash.*`:

```ts
  'maiores.titulo': 'Maiores saídas do período',
```

`en.ts`:

```ts
  'maiores.titulo': 'Largest expenses in period',
```

`es.ts`:

```ts
  'maiores.titulo': 'Mayores gastos del período',
```

- [ ] **Step 4: Write the component**

Create `src/ui/MaioresSaidas.tsx`:

```tsx
import { motion } from 'motion/react'
import { formatBRL } from '../domain/normalize/money'
import { categoria, nomeCategoria } from '../domain/categorize/categorias'
import { useT } from '../i18n/IdiomaProvider'
import type { TransacaoSalva } from '../persist/puxar'

type Props = {
  /** Já vem cortado e ordenado por `maioresSaidas`. */
  itens: TransacaoSalva[]
  onEditar: (t: TransacaoSalva) => void
}

/** Ranking das maiores despesas do período. Mora no aside, junto do donut e
 *  de CompromissosFuturos — a coluna do "resumo visual". Cada linha é
 *  clicável e abre o editor, como as demais listas do painel. */
export function MaioresSaidas({ itens, onEditar }: Props) {
  const { t } = useT()
  if (itens.length === 0) return null

  return (
    <div>
      <p className="tabular mb-2 text-[10px] uppercase tracking-widest text-tinta-tenue">
        {t('maiores.titulo')}
      </p>
      <ul className="space-y-0.5">
        {itens.map((item, i) => {
          const cat = categoria(item.category_slug ?? 'outros')
          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.3 }}
            >
              <button
                onClick={() => onEditar(item)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-carvao-850"
              >
                <span className="tabular w-3 shrink-0 text-[11px] text-tinta-tenue">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-tinta">
                    {item.label ?? item.description}
                  </span>
                  <span
                    className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px]"
                    style={{ background: `${cat.cor}22`, color: cat.cor }}
                  >
                    {nomeCategoria(cat)}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm text-tinta">
                  {formatBRL(item.amount_cents)}
                </span>
              </button>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui/MaioresSaidas.test.tsx`
Expected: PASS, 5 testes.

- [ ] **Step 6: Wire into the Dashboard**

Em `src/ui/Dashboard.tsx`:

(a) Acrescentar `maioresSaidas` à lista de imports de `../persist/agrupar`
(linhas 7-17), junto de `porDia`:

```ts
  maioresSaidas,
```

(b) Nos imports de componentes, depois de `import { CompromissosFuturos }`:

```ts
import { MaioresSaidas } from './MaioresSaidas'
```

(c) Dentro do componente `Conteudo`, junto dos `useMemo` que já existem
(linhas 528-529):

```ts
  const maiores = useMemo(() => maioresSaidas(txs, 5), [txs])
```

(d) No aside, depois do `<GraficoCategorias>` e antes do `<GraficoEvolucao>`
(entre as linhas 578 e 581):

```tsx
            <MaioresSaidas itens={maiores} onEditar={onEditar} />
```

O componente devolve `null` quando não há itens, então não precisa de guarda
no chamador — mesmo contrato de `CompromissosFuturos`.

- [ ] **Step 7: Verify everything**

Run: `npm test && npm run build && npm run lint`
Expected: **433 testes**, build e lint limpos. **Não commitar.**

- [ ] **Step 8: Verify in the real app**

```bash
npm run dev
```

Reiniciar o `npm run dev` e dar `Ctrl+Shift+R` — nasceram arquivos novos, e
o Vite não recarrega bem nesse caso (armadilha registrada no
`ESTADO-ATUAL.md`). Logar, e conferir:

1. Fileira de cartões: saldo do extrato **e** "Em aberto" da fatura Nubank.
2. Quarto tile "Saldo do período", com o número = entradas − gasto.
3. Card "Maiores saídas do período" no aside, e clicar numa linha abre o editor.
4. Abrir Documentos: fatura com selo "quitada" ou "em aberto".
5. Trocar o idioma para EN e ES — nenhuma chave crua aparecendo.

```bash
python scripts/medir-overflow.py     # com o dev rodando: sem rolagem lateral
npx tsx scripts/diagnostico.ts "D:/extratos/junho2026"
```

O diagnóstico tem que continuar dando **R$ 41.012,25** de gasto real em junho
e **R$ 41.853,57** de entradas. Se mudou, alguma derivação vazou para o
cálculo existente.

---

## Contagem de testes esperada por task

| Task | Novos | Total |
|---|---|---|
| — (antes) | — | 395 |
| 1 · `faturasAbertas` | 7 | 402 |
| 2 · `SaldoAberto` + query | 4 | 406 |
| 3 · `faturasQuitadas` | 10 | 416 |
| 4 · selo no painel | 3 | 419 |
| 5 · tile de saldo | 3 | 422 |
| 6 · `maioresSaidas` | 6 | 428 |
| 7 · card de maiores saídas | 5 | 433 |

Se a suíte falhar sem que nada tenha mudado, **rode de novo antes de
investigar**: a armadilha de não-determinismo por timeout sob carga está
registrada no `ESTADO-ATUAL.md`.
