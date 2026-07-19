# Estado atual do projeto — retomada

> Documento de continuidade. Última atualização: **2026-07-18**.
> Leia isto antes de continuar o trabalho. O README explica o projeto; aqui está **onde paramos**.

## Onde o código está

- **Branch de trabalho:** `main`. A `feat/ingestao-documentos` foi mesclada (PR #1) e **não se trabalha mais nela** — desde 2026-07-18 o trabalho é direto na `main`.
- **Remoto:** `git@github.com:cielioqueiroz/controle-financeiro.git`
- Árvore limpa, tudo commitado. `npm test` = **211 testes verdes**, `npm run build` e `npm run lint` OK.

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

### 0. Fila de features pedidas em 2026-07-18

Nesta ordem, cada uma com seu próprio spec e plano:

1. ~~Toast do cadastro + olho da senha~~ — **feito** (spec e plano em `docs/superpowers/`).
2. ~~Fundo animado (three.js) + mais animações.~~ — **feito** (canvas `#bg-animation` fixo, `z-index: 0`, three.js, import dinâmico, pausa em aba oculta).
3. ~~Renomear o sistema.~~ — **feito**: **Capital Financeiro**, com logotipo de duas cores (`src/ui/Marca.tsx`) e salto em onda no hover.
4. ~~Card de compartilhamento (meta tags OG).~~ — **feito** (meta tags em `index.html`, imagem `og.png` 1200x630, validação com teste).
5. **i18n pt/en/es.** Botão de idioma trocando *todo* o texto. Decisão pendente: a moeda deve apenas **formatar** conforme a locale (mantendo R$) — **não** converter, o que exigiria cotação e faria os números mentirem.
6. **PDF de verdade.** Hoje `Baixar PDF` é `window.print()`, que não gera arquivo algum — o app nunca vê um PDF. Precisa de geração real (jsPDF/pdfmake) antes de qualquer coisa depender do arquivo.
7. **Enviar o relatório por e-mail.** Depende de (6) e do deploy. O app é um SPA sem servidor: a chave do serviço de e-mail não pode ficar no navegador, então exige uma serverless function na Vercel.

### 1. Saldo bancário por conta (feature pedida, ainda não iniciada)

Objetivo: pegar o saldo da conta e ir acumulando, mostrando o saldo atual de cada banco conforme novos extratos entram.

Investigação já feita — **os parsers não extraem o saldo hoje**:
- `domain/parsers/bradesco-extrato.ts` **lê a coluna de saldo** (`COL.saldoRight`, marcador `SALDO_INICIAL`), mas só usa para ancorar datas; não expõe o valor.
- `domain/parsers/nubank-extrato.ts` não captura o "Saldo final do período".

Três partes:
1. **Parser** — extrair o saldo final (e a data) de cada extrato para o `ParseResult`. *Puro e testável offline com os PDFs locais.*
2. **Guardar** — a tabela `accounts` **não tem coluna de saldo**; precisa de migração no Neon (mostrar o SQL e aplicar em branch antes da produção, conforme combinado).
3. **Exibir** — card de saldo por conta, usando o extrato mais recente como base.

### 2. Deploy na Vercel — no ar, faltam as liberações de origem

Necessário para as ~6 pessoas usarem. Passos encadeados:
1. ~~Criar/conectar o projeto na Vercel~~ — **feito**: projeto `capital-financeiro`,
   no ar em **https://capital-financeiro.vercel.app**, conectado ao GitHub (todo
   push na `main` publica sozinho).
2. ~~Configurar as env vars~~ — **feito** (confirmado: o endpoint do Neon está no bundle publicado).
3. Adicionar o domínio da Vercel aos **trusted domains do Neon Auth** (senão o login é rejeitado por origem).
4. Adicionar o domínio aos **redirect URIs do Google OAuth**.
5. ~~Conferir a URL das meta tags OG~~ — **feito**: `og:image` aponta para
   `https://capital-financeiro.vercel.app/og.png`, que responde 200. Vale validar
   uma vez no [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/).

### 3. Verificações pendentes

Na última sessão a rede do ambiente de desenvolvimento **perdeu o DNS para o Neon** (`ERR_NAME_NOT_RESOLVED`), então estas duas features ficaram **verificadas só por typecheck**, sem teste ao vivo contra o banco:
- **Filtro por banco** (Total geral / Nubank / Bradesco)
- **Categorias personalizadas** (criar categoria no editor de compra)

Ao retomar: rodar `npm run dev`, logar e conferir as duas na prática.

---

## ⚠️ Notas de armadilha

- **Vite não recarrega bem quando arquivos mudam de lugar.** Depois de qualquer refatoração de pastas, **pare e reinicie o `npm run dev`** e dê `Ctrl+Shift+R` no navegador — senão parece que "nada mudou".
- **Build verde ≠ runtime verde.** Já aconteceu de o build passar e o app quebrar (duplicação de React com o sonner, resolvida com `resolve.dedupe` no `vite.config.ts`).
- **Decoração nunca pode entrar no layout de rolagem.** O brilho da tela de
  login escalava até 1,25 sem ser recortado por ninguém e entrava no
  `scrollWidth`, criando uma barra que aparecia e sumia no ritmo da animação.
  Todo efeito de fundo vai na camada `#bg-animation` (`position: fixed`).
  Depois de mexer em qualquer decoração, rodar `python scripts/medir-overflow.py`.
- **Sempre conferir se o subdomínio `.vercel.app` está livre ANTES de adotar um
  nome.** `paypulse.vercel.app` pertencia a outro produto homônimo; as meta tags
  OG apontaram para o site alheio até isso ser percebido. Checagem rápida:
  `curl -s -o /dev/null -w "%{http_code}" https://NOME.vercel.app/` — 404 é livre.
- **Renomear o projeto na Vercel NÃO renomeia os domínios.** Ao trocar o nome do
  projeto, os domínios antigos permanecem e o novo não é criado sozinho: é
  preciso ir em *Settings → Domains → Edit*. Enquanto isso o `og:image` aponta
  para um endereço que dá 404 e o card sai sem imagem.
- **Deployment Protection deixa o site só para quem está logado na Vercel.** Vem
  ligada por padrão, e o toggle **só vale depois de clicar em `Save`**. O sintoma
  engana: o dono do projeto, já logado, vê tudo normal enquanto ninguém mais
  consegue entrar — e o WhatsApp não busca a `og:image`.
- **Nunca commitar PDFs reais** (`*.pdf` está no `.gitignore`) — contêm CPF, conta e nomes de terceiros.
- `scripts/diagnostico.ts` é ferramenta local e está no `.gitignore`.

---

## Melhorias futuras já mapeadas (não urgentes)

- Refinar as policies de RLS para `auth.uid()`.
- Chaves próprias do Google OAuth (hoje usa as compartilhadas do Neon; a UI beta do Neon não tem campo para as customizadas).
- Code-splitting do bundle (o pdf.js deixa o chunk > 500 kB).
