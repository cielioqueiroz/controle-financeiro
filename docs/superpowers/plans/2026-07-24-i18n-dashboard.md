# i18n — fatia do dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps usam checkbox.

**Goal:** Traduzir o dashboard (moeda, datas, nomes de categoria e chrome) para pt/en/es.

**Architecture:** Locale de módulo (setter chamado pelo IdiomaProvider) torna `formatBRL`/datas/`nomeCategoria` cientes do idioma sem prop-drilling; o chrome usa `t()`.

**Tech Stack:** TS, React 19, Vitest, Intl.

## Global Constraints
- **BRL sempre**; só muda o separador. Datas via `Intl`.
- Estado de módulo (locale/idioma de categoria): **testes que trocam restauram pt no `afterEach`**.
- pt = fonte da verdade; en/es a revisar. `slug` de categoria nunca muda.
- Testes atuais seguem verdes em pt (default). Após cada task `npm test`. Commits diretos na main; co-author padrão.

---

### Task 1: Locale de módulo + `formatBRL` ciente

**Files:** Create `src/domain/normalize/locale.ts`, `src/domain/normalize/locale.test.ts`; Modify `src/domain/normalize/money.ts`, `src/domain/normalize/money.test.ts`

- [ ] **Step 1:** `locale.test.ts`:
```ts
import { describe, it, expect, afterEach } from 'vitest'
import { definirLocale, localeAtual } from './locale'
afterEach(() => definirLocale('pt-BR'))
describe('locale', () => {
  it('default pt-BR; definirLocale troca', () => {
    expect(localeAtual()).toBe('pt-BR')
    definirLocale('en-US')
    expect(localeAtual()).toBe('en-US')
  })
})
```
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** `locale.ts`:
```ts
export type LocaleBCP47 = 'pt-BR' | 'en-US' | 'es-ES'
let ativo: LocaleBCP47 = 'pt-BR'
export function definirLocale(l: LocaleBCP47): void { ativo = l }
export function localeAtual(): LocaleBCP47 { return ativo }
```
- [ ] **Step 4:** em `money.ts`, `formatBRL` usa `localeAtual()`:
```ts
import { localeAtual } from './locale'
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString(localeAtual(), { style: 'currency', currency: 'BRL' })
}
```
- [ ] **Step 5:** adicionar teste em `money.test.ts` (com `afterEach(() => definirLocale('pt-BR'))`):
```ts
it('formata na locale ativa (en-US mantém BRL)', () => {
  definirLocale('en-US')
  expect(formatBRL(123456)).toMatch(/1,234\.56/)
})
```
- [ ] **Step 6:** `npm test` verde. Commit: `feat(i18n): formatBRL ciente da locale de modulo`.

---

### Task 2: Datas por locale — `data.ts`

**Files:** Create `src/domain/normalize/data.ts`, `data.test.ts`; Modify `src/ui/Dashboard.tsx` (usa `mesAbrev` no `rotulo`, remove `MESES`), `src/ui/SaldoConta.tsx` (usa `mesAbrev`), `src/lib/relatorio-pdf.ts` (usa `mesAbrev`/`dataLonga`).

- [ ] **Step 1:** `data.test.ts` (com `afterEach` restaurando pt-BR):
```ts
import { describe, it, expect, afterEach } from 'vitest'
import { definirLocale } from './locale'
import { mesAbrev } from './data'
afterEach(() => definirLocale('pt-BR'))
describe('mesAbrev', () => {
  it('mês abreviado pela locale', () => {
    const jun = new Date(2026, 5, 15)
    expect(mesAbrev(jun).toLowerCase()).toContain('jun') // pt/en: jun
    definirLocale('en-US')
    expect(mesAbrev(jun).toLowerCase()).toContain('jun')
  })
})
```
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** `data.ts`:
```ts
import { localeAtual } from './locale'
export function mesAbrev(d: Date): string {
  return new Intl.DateTimeFormat(localeAtual(), { month: 'short' }).format(d).replace('.', '')
}
export function dataLonga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(localeAtual(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(y, m - 1, d))
}
```
- [ ] **Step 4:** `Dashboard.tsx`: remover `const MESES = [...]`; `rotulo()` usa `mesAbrev(new Date(...))` para dia/semana/mês. (Ajustar as montagens de rótulo que hoje indexam `MESES[d.getMonth()]`.)
- [ ] **Step 5:** `SaldoConta.tsx`: trocar o `MESES_SALDO`/`dataCurta` local por `mesAbrev`. `relatorio-pdf.ts`: trocar `MESES_SALDO` e `geradoEm.toLocaleDateString('pt-BR')` por `mesAbrev`/`dataLonga`.
- [ ] **Step 6:** `npm test` (os testes que fixam "jun"/"30/jun" devem seguir em pt) + `tsc -b`. Commit: `feat(i18n): datas por locale (mesAbrev/dataLonga)`.

> Atenção: se algum teste fixa um rótulo de data em pt exato, ele segue verde no default pt-BR. Se `Intl` devolver "jun." com ponto, o `.replace('.', '')` limpa.

---

### Task 3: Nomes de categoria por idioma

**Files:** Modify `src/domain/categorize/categorias.ts`, `src/domain/categorize/categorias.test.ts` (ou novo); depois exibição: `GraficoCategorias.tsx`, `ListaPorCategoria.tsx`, `ListaPorDia.tsx`, `EditarCompra.tsx`, `src/lib/relatorio-pdf.ts`.

- [ ] **Step 1:** teste (com `afterEach(() => definirIdiomaCategorias('pt'))`):
```ts
import { nomeCategoria, definirIdiomaCategorias, categoria } from './categorias'
afterEach(() => definirIdiomaCategorias('pt'))
it('traduz embutida; mantém a do usuário', () => {
  const sup = categoria('supermercado')
  expect(nomeCategoria(sup)).toBe('Supermercado')
  definirIdiomaCategorias('en')
  expect(nomeCategoria(sup)).toBe('Groceries')
  const user = { slug: 'u-x', nome: 'Meu rótulo', icone: '🏷️', cor: '#fff' }
  expect(nomeCategoria(user)).toBe('Meu rótulo')
})
```
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** em `categorias.ts` adicionar (mapa completo dos 30 slugs):
```ts
const NOMES_I18N: Record<string, { en: string; es: string }> = {
  supermercado: { en: 'Groceries', es: 'Supermercado' },
  padaria: { en: 'Bakery', es: 'Panadería' },
  farmacia: { en: 'Pharmacy & Health', es: 'Farmacia y Salud' },
  combustivel: { en: 'Fuel & Car', es: 'Combustible y Coche' },
  marketplace: { en: 'Marketplace', es: 'Marketplace' },
  assinaturas: { en: 'Subscriptions', es: 'Suscripciones' },
  beleza: { en: 'Beauty', es: 'Belleza' },
  telecom: { en: 'Telecom', es: 'Telecom' },
  viagem: { en: 'Travel', es: 'Viaje' },
  delivery: { en: 'Delivery', es: 'Delivery' },
  educacao: { en: 'Education', es: 'Educación' },
  papelaria: { en: 'Stationery', es: 'Papelería' },
  servicos: { en: 'Services', es: 'Servicios' },
  taxas: { en: 'Bank fees', es: 'Comisiones bancarias' },
  rendimentos: { en: 'Earnings', es: 'Rendimientos' },
  transferencia: { en: 'Transfers', es: 'Transferencias' },
  agua: { en: 'Water', es: 'Agua' },
  luz: { en: 'Electricity', es: 'Luz' },
  transporte: { en: 'Transport', es: 'Transporte' },
  restaurante: { en: 'Restaurant', es: 'Restaurante' },
  lazer: { en: 'Leisure', es: 'Ocio' },
  vestuario: { en: 'Clothing', es: 'Ropa' },
  pets: { en: 'Pets', es: 'Mascotas' },
  casa: { en: 'Home & Housing', es: 'Casa y Hogar' },
  aluguel: { en: 'Rent', es: 'Alquiler' },
  academia: { en: 'Gym', es: 'Gimnasio' },
  investimentos: { en: 'Investments', es: 'Inversiones' },
  presentes: { en: 'Gifts', es: 'Regalos' },
  impostos: { en: 'Taxes & Fees', es: 'Impuestos y Tasas' },
  outros: { en: 'Other', es: 'Otros' },
}
let idiomaCat: 'pt' | 'en' | 'es' = 'pt'
export function definirIdiomaCategorias(id: 'pt' | 'en' | 'es'): void { idiomaCat = id }
export function nomeCategoria(cat: Categoria): string {
  if (idiomaCat === 'pt') return cat.nome
  return NOMES_I18N[cat.slug]?.[idiomaCat] ?? cat.nome
}
```
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** trocar `cat.nome`/`c.nome`/`grupo.cat.nome` por `nomeCategoria(...)` na exibição dos 5 arquivos citados (não no `slug` nem em lógica). No PDF, `montarDadosRelatorio` recebe os nomes já resolvidos: passar `nomeCategoria(c.cat)` ao montar `categorias[].nome`.
- [ ] **Step 6:** `npm test` + `tsc -b`. Commit: `feat(i18n): nomes de categoria por idioma (nomeCategoria)`.

---

### Task 4: IdiomaProvider liga os setters

**Files:** Modify `src/i18n/IdiomaProvider.tsx`

- [ ] **Step 1:** no provider, derivar o bcp47 e aplicar os setters em um efeito síncrono ao render (useMemo/useEffect) sempre que `idioma` mudar:
```ts
import { definirLocale } from '../domain/normalize/locale'
import { definirIdiomaCategorias } from '../domain/categorize/categorias'
const BCP47 = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' } as const
// dentro do provider, antes do return (durante o render, para valer já na 1ª pintura):
definirLocale(BCP47[idioma])
definirIdiomaCategorias(idioma)
```
> Chamar durante o render (não em useEffect) garante que a 1ª pintura já use a locale certa; é idempotente (só grava vars de módulo).
- [ ] **Step 2:** `npm test` verde (o default pt segue). Commit: `feat(i18n): provider aplica locale de moeda/datas/categorias`.

---

### Task 5: Chrome do dashboard traduzido

**Files:** Modify dicionários `pt/en/es.ts` (novas chaves `dash.*/saldo.*/estado.*/conta.*/header.*`); Modify `Dashboard.tsx`, `SaldoConta.tsx`, `ErroCarregar.tsx`, `MenuAcoes.tsx`, `CompromissosFuturos.tsx`, `App.tsx` (saudação), `ContaMenu.tsx`.

- [ ] **Step 1:** extrair os literais visíveis de cada arquivo e adicionar as chaves ao `pt.ts` (valor = literal atual, verbatim) e traduzir em `en.ts`/`es.ts`. A saudação usa interpolação: `'header.ola': 'Olá, {nome}!'`.
- [ ] **Step 2:** em cada componente, `const { t } = useT()` e trocar o literal por `t('chave', params?)`. `App.tsx` já usa `FraseDeslogado` do dicionário; adicionar `t('header.ola', { nome })` e `t('header.sub')`.
- [ ] **Step 3:** `npm test` — os testes atuais (App, Documentos, etc.) seguem verdes em pt. Se algum quebrar, o valor pt no dicionário divergiu — corrigir para bater exato.
- [ ] **Step 4:** `tsc -b` + `npm run build`. Commit: `feat(i18n): chrome do dashboard e header traduzidos`.

---

### Task 6: Teste do dashboard em en + verificação + docs

**Files:** Create um teste que renderiza o dashboard (ou um subcomponente com tiles) em `en` dentro do `IdiomaProvider` e afirma um rótulo traduzido; Modify `README.md`, `docs/ESTADO-ATUAL.md`.

- [ ] **Step 1:** teste en (ex.: `SaldoConta` mostra "Balance"/"Saldo" conforme idioma, ou os tiles do dashboard). Restaurar estado no `afterEach`.
- [ ] **Step 2:** `npm test && npm run build && npm run lint && npx tsc -b --force`.
- [ ] **Step 3:** README/ESTADO: registrar a fatia do dashboard (moeda/datas/categorias/chrome), deixando **modais + tutorial** como próxima fatia. Atualizar contagem de testes.
- [ ] **Step 4:** commit + `git push origin main`.

## Notas
- **en/es a revisar** pelo usuário (inclui nomes de categoria).
- **Próxima fatia:** modais (EditarCompra/Documentos/EditarPerfil/Confirmacao) + Tutorial; e os toasts deferidos.
