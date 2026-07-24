# Relatório em PDF de verdade + compartilhar — design

> Spec da rodada. Data: **2026-07-24**. Aprovado em brainstorming antes de escrever.
> Contexto: `docs/ESTADO-ATUAL.md` (fila item 2). Substitui o `window.print()`.

## Objetivo

Gerar um **arquivo PDF de verdade** do relatório do período, no navegador, e
**baixar ou compartilhar** (WhatsApp, Telegram etc. no celular). Hoje o botão
"Baixar PDF" só chama `window.print()` — abre o diálogo do sistema e **não produz
arquivo**, então nada pode ser compartilhado.

## Decisões (brainstorming 2026-07-24)

1. **Geração — jsPDF a partir dos dados** (não "foto da tela"). O app usa Tailwind v4,
   cujas cores `oklch` costumam quebrar no html2canvas; e o valor de um relatório
   financeiro é o **número** (nítido, selecionável, arquivo leve). O jsPDF é carregado
   por **import dinâmico** — não entra no bundle inicial (que já é grande).
2. **Botão único adaptativo** — "Baixar / Compartilhar PDF". No celular abre a folha de
   compartilhamento (`navigator.share` com arquivo); no desktop, onde share de arquivo
   quase não existe, **baixa**.
3. **E-mail está FORA** — de vez. O antigo passo 3 do roadmap (envio por e-mail via
   serverless + Resend) **foi descartado** pelo usuário; remover do `ESTADO-ATUAL`.

## Escopo

**Inclui:** gerar PDF com os números do relatório; baixar; compartilhar no celular.
**Não inclui (YAGNI):** e-mail (descartado); donut/gráfico de evolução no PDF (são
visuais — reconsiderar depois se pedir); lista por dia no PDF.

## Componentes (unidades isoladas)

### 1. `src/lib/relatorio-pdf.ts` — geração
- `montarDadosRelatorio(entrada): DadosRelatorio` — **pura**, molda os números já em
  memória no Dashboard para o formato do relatório. Testável sem jsPDF.
- `gerarRelatorioPdf(dados: DadosRelatorio): Promise<Blob>` — monta o PDF com **jsPDF**
  (+ `jspdf-autotable` para a tabela de categorias). Sem tocar no DOM. Importa jsPDF
  dinamicamente (`await import('jspdf')`).

**`DadosRelatorio`** (interface entre as unidades):
```ts
export type SaldoLinha = { bank: string; balanceCents: number; date: string }
export type CategoriaLinha = { nome: string; valorCents: number; pct: number }
export type DadosRelatorio = {
  periodoLabel: string        // ex.: "Junho 2026"
  agrupamento: string         // "por fatura" | "por data da compra"
  geradoEm: Date
  entradasCents: number
  saidasCents: number
  saldoPeriodoCents: number   // entradas - saídas
  saldos: SaldoLinha[]        // saldo por conta (a feature nova); pode ser []
  categorias: CategoriaLinha[]
}
```

**Conteúdo do PDF:**
- Cabeçalho: "Capital Financeiro" · "Relatório · \<periodoLabel\>" · agrupamento · data de geração.
- Totais: Entradas, Saídas, Saldo do período (os mesmos números dos tiles).
- Saldo por conta (se `saldos` não vazio): "Banco · R$ … · em DD/mmm".
- Tabela por categoria: Categoria · Valor · % (ordenada por valor desc).
- Rodapé: "Gerado por Capital Financeiro · capital-financeiro.vercel.app".
- Valores via o mesmo `formatBRL` (centavos → R$).

### 2. `src/lib/compartilhar.ts` — baixar ou compartilhar
- `baixarOuCompartilhar(blob: Blob, nomeArquivo: string, meta: { title: string; text: string }): Promise<'compartilhado' | 'baixado'>`
- Monta `const file = new File([blob], nomeArquivo, { type: 'application/pdf' })`.
- Se `navigator.canShare?.({ files: [file] })` → `await navigator.share({ files: [file], title, text })` → `'compartilhado'`. Se o usuário cancelar (`AbortError`), não é erro — resolve sem toast.
- Senão → baixa: `URL.createObjectURL` → `<a download>` → clique → `revokeObjectURL` → `'baixado'`.
- Nome do arquivo: `relatorio-<periodo-slug>.pdf` (ex.: `relatorio-junho-2026.pdf`).

### 3. Ligação no `Dashboard` + `MenuAcoes`
- Substituir `onBaixarPDF = () => window.print()` por uma função que: monta
  `DadosRelatorio` → `gerarRelatorioPdf` → `baixarOuCompartilhar`, com estado
  `gerandoPdf` (rótulo "Gerando…") e `toast.error` se algo falhar.
- Import dinâmico do `relatorio-pdf.ts` no clique (mantém jsPDF fora do bundle inicial).
- Rótulo do botão desktop e do item no `MenuAcoes`: **"Baixar / Compartilhar PDF"**.
- Remover o `window.print()`; o CSS `@media print` e o bloco `somente-impressao` do
  Dashboard ficam órfãos — **limpeza opcional** nesta rodada (não bloqueia).

## Fluxo de dados

```
clique → montarDadosRelatorio(dados em memória) → gerarRelatorioPdf() : Blob
       → baixarOuCompartilhar(blob) → share (celular) OU download (desktop)
```

## Tratamento de erro / bordas
- **jsPDF falha ao carregar/gerar:** `toast.error('Não consegui gerar o PDF.')`; botão volta ao normal.
- **Usuário cancela a folha de share (`AbortError`):** silencioso, sem toast.
- **`navigator.share` ausente (desktop):** cai no download — caminho normal, não erro.
- **Sem transações no período:** o botão já só aparece com `txs.length > 0` (mantido).
- **`saldos` vazio:** a seção de saldo não é desenhada.

## Testes
- **`montarDadosRelatorio`** (puro): totais, % por categoria somando ~100, ordenação, saldos repassados.
- **`baixarOuCompartilhar`**: mock de `navigator.canShare/share` → caminho compartilhado;
  sem `canShare` → caminho download (mock de `URL.createObjectURL` + clique do `<a>`);
  `AbortError` no share → resolve sem lançar.
- **`gerarRelatorioPdf`** (smoke): retorna Blob cujo início é `%PDF`. Se o jsPDF não
  rodar no jsdom, o teste recai só sobre `montarDadosRelatorio` (decidir na implementação).
- Meta: suíte verde (hoje 342) + os novos.

## Dependências novas
- `jspdf` e `jspdf-autotable` (só via import dinâmico). Confirmar tamanho e que saem em
  chunk próprio no build.

## Ordem de implementação (para o plano)
1. `montarDadosRelatorio` puro + testes.
2. `gerarRelatorioPdf` com jsPDF (import dinâmico) + smoke.
3. `baixarOuCompartilhar` + testes (mock de navigator).
4. Ligar no Dashboard/MenuAcoes (rótulo novo, estado "gerando", import dinâmico).
5. Limpeza opcional do `window.print()`/`@media print`.
6. Verificação (`npm test && npm run build && npm run lint && tsc -b`); README/ESTADO-ATUAL
   (remover o passo 3/e-mail do roadmap); push.
