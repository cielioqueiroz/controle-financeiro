# Estado atual do projeto — retomada

> Documento de continuidade. Última atualização: **2026-07-18**.
> Leia isto antes de continuar o trabalho. O README explica o projeto; aqui está **onde paramos**.

## Onde o código está

- **Branch de trabalho:** `feat/ingestao-documentos` (ainda **não** foi mesclada na `main`).
- **Remoto:** `git@github.com:cielioqueiroz/controle-financeiro.git`
- Árvore limpa, tudo commitado. `npm test` = **183 testes verdes**, `npm run build` e `npm run lint` OK.

## Como validar rapidamente que nada quebrou

Rode o diagnóstico com os PDFs reais (ficam fora do repositório, em `D:\extratos\junho2026\`):

```bash
npx tsx scripts/diagnostico.ts "D:/extratos/junho2026"
```

**Números de referência** (se algum destes mudar sem motivo, algo regrediu):

| Medida | Valor esperado |
|---|---|
| Gasto real total (junho, competência) | **R$ 41.012,25** |
| Supermercado (junho) | **R$ 918,46** (27 lançamentos) |
| Fatura Nubank — total declarado | R$ 8.324,24 |
| Fatura Bradesco — total declarado | R$ 5.529,44 |
| Compromissos futuros | 34 parcelas · R$ 5.265,30 |
| Entradas (junho) | R$ 41.853,57 |

Existe uma conta de teste no Neon (`teste.migracao@exemplo.com`) usada nas verificações de navegador. A senha **não** fica versionada.

---

## ✅ O que já está pronto (e verificado)

**Ingestão e cálculo**
- 4 parsers (fatura + extrato × Nubank + Bradesco), cada um conferindo o total contra o gabarito do PDF.
- Categorização por regras (30 categorias) + aprendizado; dedupe por hash de documento e de transação.
- Vínculos entre documentos removem a dupla contagem (fatura × extrato).
- **Competência**: Mês/Ano agrupam pela fatura (`documents.period_end`); Dia/Semana pela data real.

**Persistência (Neon)**
- Data API + Neon Auth + RLS. Schema em `neon/migrations/0001_schema_inicial.sql`.
- Salvar, puxar tudo de uma vez, apagar documento (cascade) ou tudo, editar transação, categorias do usuário.

**Interface**
- Dashboard por Dia/Semana/Mês/Ano com tiles (números com count-up), donut por categoria, evolução mês a mês e compromissos futuros.
- Lançamentos em duas visões: **por categoria** (drill-down) e **por dia** (com subtotais), estilo planilha com zebra.
- Filtro por banco (Total geral / Nubank / Bradesco).
- Editar compra (renomear + trocar categoria) e criar categorias personalizadas.
- Painel de Documentos (apagar fatura ou tudo).
- Login com nome + apelido, saudação "Olá, {nome}!", tutorial guiado.
- Tema claro/escuro, responsivo (menu hambúrguer no mobile), toasts estilo alerta no topo-centro.
- Export/compartilhar relatório em PDF (`window.print()` + `@media print`).

---

## 🚧 O que falta

### 1. Saldo bancário por conta (feature pedida, ainda não iniciada)

Objetivo: pegar o saldo da conta e ir acumulando, mostrando o saldo atual de cada banco conforme novos extratos entram.

Investigação já feita — **os parsers não extraem o saldo hoje**:
- `domain/parsers/bradesco-extrato.ts` **lê a coluna de saldo** (`COL.saldoRight`, marcador `SALDO_INICIAL`), mas só usa para ancorar datas; não expõe o valor.
- `domain/parsers/nubank-extrato.ts` não captura o "Saldo final do período".

Três partes:
1. **Parser** — extrair o saldo final (e a data) de cada extrato para o `ParseResult`. *Puro e testável offline com os PDFs locais.*
2. **Guardar** — a tabela `accounts` **não tem coluna de saldo**; precisa de migração no Neon (mostrar o SQL e aplicar em branch antes da produção, conforme combinado).
3. **Exibir** — card de saldo por conta, usando o extrato mais recente como base.

### 2. Deploy na Vercel (pendente, precisa do usuário presente)

Necessário para as ~6 pessoas usarem. Passos encadeados:
1. Criar/conectar o projeto na Vercel (time: `cielio-queiroz`, id `team_mPYNczjFxkNFlE22FDIM8g0V`).
2. Configurar as env vars `VITE_NEON_DATA_API_URL` e `VITE_NEON_AUTH_URL` (senão o build sai sem banco).
3. Adicionar o domínio da Vercel aos **trusted domains do Neon Auth** (senão o login é rejeitado por origem).
4. Adicionar o domínio aos **redirect URIs do Google OAuth**.

### 3. Verificações pendentes

Na última sessão a rede do ambiente de desenvolvimento **perdeu o DNS para o Neon** (`ERR_NAME_NOT_RESOLVED`), então estas duas features ficaram **verificadas só por typecheck**, sem teste ao vivo contra o banco:
- **Filtro por banco** (Total geral / Nubank / Bradesco)
- **Categorias personalizadas** (criar categoria no editor de compra)

Ao retomar: rodar `npm run dev`, logar e conferir as duas na prática.

---

## ⚠️ Notas de armadilha

- **Vite não recarrega bem quando arquivos mudam de lugar.** Depois de qualquer refatoração de pastas, **pare e reinicie o `npm run dev`** e dê `Ctrl+Shift+R` no navegador — senão parece que "nada mudou".
- **Build verde ≠ runtime verde.** Já aconteceu de o build passar e o app quebrar (duplicação de React com o sonner, resolvida com `resolve.dedupe` no `vite.config.ts`).
- **Nunca commitar PDFs reais** (`*.pdf` está no `.gitignore`) — contêm CPF, conta e nomes de terceiros.
- `scripts/diagnostico.ts` é ferramenta local e está no `.gitignore`.

---

## Melhorias futuras já mapeadas (não urgentes)

- Refinar as policies de RLS para `auth.uid()`.
- Chaves próprias do Google OAuth (hoje usa as compartilhadas do Neon; a UI beta do Neon não tem campo para as customizadas).
- Code-splitting do bundle (o pdf.js deixa o chunk > 500 kB).
