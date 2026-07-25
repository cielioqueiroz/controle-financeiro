# i18n — fatia do dashboard — design

> Spec da rodada. Data: **2026-07-24**. Aprovado em brainstorming.
> Segunda fatia do i18n (após o mecanismo + login). Cobre moeda, datas, nomes de
> categoria e o chrome do dashboard.

## Objetivo
Traduzir a superfície do **dashboard** (a tela diária) para pt/en/es, incluindo
**moeda e datas por locale** e os **nomes das 30 categorias embutidas**. Modais e
tutorial ficam para a próxima fatia.

## Decisões (brainstorming 2026-07-24)
- **Formato por locale de módulo**, ajustado pelo `IdiomaProvider`. `formatBRL` mantém a
  assinatura (zero churn); **BRL sempre**, só muda o separador. `not converte`.
- **Categorias traduzidas agora** — mapa en/es no catálogo; categorias do usuário nunca.

## Componentes

### 1. Locale de formatação — `src/domain/normalize/locale.ts` (novo)
```ts
export type LocaleBCP47 = 'pt-BR' | 'en-US' | 'es-ES'
let localeAtivo: LocaleBCP47 = 'pt-BR'
export function definirLocale(l: LocaleBCP47): void
export function localeAtual(): LocaleBCP47
```
- Sem import de i18n (domínio não depende da UI); o `IdiomaProvider` é quem chama o setter.

### 2. Moeda e datas cientes da locale
- `money.ts` `formatBRL(cents)` passa a usar `localeAtual()` em vez de `'pt-BR'` fixo:
  `(cents/100).toLocaleString(localeAtual(), { style:'currency', currency:'BRL' })`.
- Novo `src/domain/normalize/data.ts`:
  ```ts
  export function mesAbrev(d: Date): string   // Intl.DateTimeFormat(localeAtual(), { month:'short' })
  export function dataLonga(iso: string): string  // dd/mm/yyyy pela locale
  ```
  Substitui o array fixo `MESES` do Dashboard e o `MESES_SALDO`/`toLocaleDateString('pt-BR')`
  do `relatorio-pdf.ts` e o `dataCurta` do `SaldoConta`. `rotulo()` (rótulos de período) usa
  `mesAbrev`. Os testes atuais permanecem pt-BR (default).

### 3. Nomes de categoria por idioma — `categorias.ts`
```ts
// mapa de dados (sem import de i18n); só slugs embutidos
const NOMES_I18N: Record<string, { en: string; es: string }> = { supermercado: { en: 'Groceries', es: 'Supermercado' }, ... }
let idiomaCat: 'pt' | 'en' | 'es' = 'pt'
export function definirIdiomaCategorias(id: 'pt' | 'en' | 'es'): void
export function nomeCategoria(cat: Categoria): string  // slug embutido → traduzido; senão cat.nome
```
- Trocar `cat.nome` por `nomeCategoria(cat)` na **exibição**: `GraficoCategorias`,
  `ListaPorCategoria`, `ListaPorDia`, `EditarCompra` (grade de categorias) e
  `montarDadosRelatorio` (PDF). O `slug` continua sendo a chave persistida (nunca muda).

### 4. Provider liga os setters — `IdiomaProvider`
- Ao montar e a cada troca, mapear `Idioma → LocaleBCP47` (`pt→pt-BR, en→en-US, es→es-ES`)
  e chamar `definirLocale(...)` + `definirIdiomaCategorias(idioma)`. Como o provider
  re-renderiza a árvore, moeda/datas/categorias repintam.

### 5. Chrome do dashboard — novas chaves no dicionário
Traduzir os literais visíveis de: `Dashboard` (tiles, abas de período, "por fatura/por
data da compra", "Total geral", "Documentos", "Baixar / Compartilhar PDF"/"Gerando…",
"+ Importar PDF", "Por categoria/Por dia", "Lançamentos", `aria` ‹/›, "Voltar ao
histórico"), `SaldoConta` ("Saldo", "em {data}"), `ErroCarregar` ("Não consegui
carregar", "Tentar de novo"), `Vazio` ("Nada por aqui ainda", corpo, "+ Importar PDF"),
`MenuAcoes` (itens), `CompromissosFuturos` (título/labels), o **header do `App`**
(saudação "Olá, {nome}!" + "Importe a fatura, o resto a gente calcula." + a frase de
deslogado já vem do dicionário) e `ContaMenu` ("Conectado como", "Editar perfil", "Ver
tutorial", "Sair da conta" + a confirmação). Chaves `dash.*`, `saldo.*`, `estado.*`,
`conta.*`, `header.*`.

## Erro / bordas
- Chave ausente em en/es: build quebra (tipo `Dicionario`).
- Categoria sem tradução (slug embutido novo sem entrada em `NOMES_I18N`): cai em `cat.nome` (pt).
- Datas: `Intl` sempre disponível no alvo (navegadores modernos); sem locale → default pt-BR.

## Testes
- `locale.ts`: `definirLocale`/`localeAtual`.
- `formatBRL` com `definirLocale('en-US')` → `R$ 1,234.56`; volta a pt-BR no `afterEach`.
- `mesAbrev`/`data.ts` em pt/en.
- `nomeCategoria`: embutida traduz em en/es; categoria do usuário fica.
- Regressão: suíte atual verde em pt (default). Um teste novo renderiza tiles/abas do
  dashboard em en.
- **Isolamento:** testes que mudam locale/idioma de categoria **restauram** para pt no
  `afterEach` (estado de módulo global) — senão contaminam outros testes.

## Fora de escopo
- Modais (EditarCompra, Documentos, EditarPerfil, Confirmacao) e Tutorial — próxima fatia.
- Toasts deferidos da fatia 1 (campos-faltando, erros da lib de recuperação).
- Conteúdo do usuário (descrições, apelidos, nomes de categorias criadas).

## Ordem (para o plano)
1. `locale.ts` + `formatBRL` locale-aware + testes.
2. `data.ts` (mesAbrev/dataLonga) + testes; trocar `MESES` no Dashboard e datas no SaldoConta/PDF.
3. `NOMES_I18N` + `nomeCategoria` + setter + testes; trocar `cat.nome` na exibição.
4. `IdiomaProvider` chama os setters (map idioma→bcp47).
5. Chaves `dash.*/saldo.*/estado.*/conta.*/header.*` (pt/en/es) + trocar literais.
6. Teste do dashboard em en; verificação (`test/build/lint/tsc`); README/ESTADO; push.
