# i18n — mecanismo + fatia da tela de acesso — design

> Spec da rodada. Data: **2026-07-24**. Aprovado em brainstorming.
> Primeira fatia do i18n (roadmap item 3). Mecanismo leve feito à mão + tradução da
> tela de acesso; demais telas vêm em fatias seguintes.

## Objetivo

Dar ao app um seletor de idioma (pt/en/es) que troca o texto, começando por um
**mecanismo leve** e pela **tela de acesso** como primeira superfície traduzida ponta a
ponta. As demais telas seguem em rodadas curtas.

## Decisões (brainstorming 2026-07-24)
- **Mecanismo leve, sem dependência** (dicionários TS + contexto + hook). Nada de
  react-i18next.
- **Faseado:** mecanismo + fatia do login primeiro; resto depois.
- **Seletor:** segmentado em texto **"PT / EN / ES"** (sem bandeiras).
- **pt é a fonte da verdade** dos textos; en/es são traduções a revisar.
- **Moeda/datas por locale ficam fora desta fatia** (login não mostra dinheiro) — vêm
  com a fatia do dashboard. Decisão travada registrada: **BRL sempre**, só formata pela
  locale (`Intl.NumberFormat(locale, { style:'currency', currency:'BRL' })`), **não
  converte**.

## Componentes

### 1. `src/i18n/idioma.ts` — núcleo (puro)
```ts
export type Idioma = 'pt' | 'en' | 'es'
export const IDIOMAS: Idioma[] = ['pt', 'en', 'es']
const CHAVE = 'cf:idioma'
export function detectarIdioma(): Idioma          // navigator.language → 'pt'|'en'|'es', senão 'pt'
export function lerIdioma(): Idioma               // localStorage → detectarIdioma()
export function salvarIdioma(id: Idioma): void    // localStorage
```
- Nunca lança; valor inválido no storage cai em `detectarIdioma()`.

### 2. `src/i18n/dicionarios/{pt,en,es}.ts`
- `pt.ts` exporta um objeto **plano de chaves em ponto** (ex.: `'auth.entrar': 'Entrar'`)
  e define o **tipo** `Dicionario = typeof pt`. `en.ts` e `es.ts` são `Dicionario`
  (o compilador cobra as mesmas chaves — chave faltando quebra o build, não silencioso).
- Escopo inicial: só as chaves da tela de acesso (ver seção "Chaves da fatia").
- Interpolação: valores podem ter `{param}` (ex.: `'tutorial.ola': 'Olá, {nome}!'`).

### 3. `src/i18n/IdiomaProvider.tsx` + `useT`
```ts
type Ctx = { idioma: Idioma; setIdioma: (i: Idioma) => void; t: (chave: keyof Dicionario, params?: Record<string, string | number>) => string }
export function IdiomaProvider({ children }: { children: ReactNode }): JSX.Element
export function useT(): Ctx
```
- Estado inicial = `lerIdioma()`. `setIdioma` persiste (`salvarIdioma`) e re-renderiza.
- `t(chave, params)` pega no dicionário do idioma ativo; se faltar, cai no `pt[chave]`;
  interpola `{param}` por regex. Nunca devolve `undefined`.
- `main.tsx` envolve `<App/>` em `<IdiomaProvider>`.

### 4. `src/ui/SeletorIdioma.tsx`
- Segmentado "PT / EN / ES" (estilo das pílulas de período), usa `useT` para `idioma`/`setIdioma`.
- Colocado ao lado do `ThemeToggle` no cabeçalho da `TelaAcesso` (e, nas fatias seguintes,
  no header logado). Nesta fatia, só na `TelaAcesso`.
- `aria-label` traduzido; botão ativo marcado com `aria-pressed`.

### 5. Fatia traduzida — tela de acesso
Trocar strings literais por `t(...)` em:
- `TelaAcesso.tsx` — `FraseDeslogado` (a frase-hero) e "já lê os extratos de".
- `Auth.tsx` — "Entrar"/"Criar conta", subtítulo "Seus dados financeiros, só seus.",
  placeholders (nome, apelido + ajuda, e-mail, senha), botão, "Esqueceu a senha?", "ou",
  "Continuar com o Google", "Não tem conta? Criar uma"/"Já tem conta? Entrar", e os toasts
  de erro (`traduzErro` + validação).
- `RecuperarSenha.tsx` — títulos, ajudas, botões, toasts.
- `auth-validacao.ts` — `mensagemCamposFaltando`, mensagens de e-mail/senha. **Atenção:**
  hoje é função pura sem contexto; passará a **receber `t`** (ou devolver chaves) para não
  acoplar o domínio ao React. Decidir no plano: a opção limpa é `camposFaltando` continuar
  puro (devolve os campos) e a **mensagem** ser montada na UI com `t`.
- `IconeOlho`/`CampoSenha` — aria-labels "Mostrar/Ocultar senha".
- `Rodape.tsx` — linha de privacidade e "Criado por".

## Chaves da fatia (fonte pt, resumo)
`auth.*` (entrar, criar, subtitulo, esqueceu, ou, google, trocar…), `campo.*`
(placeholders + aria de senha), `acesso.frase1/frase2`, `acesso.bancos`,
`recuperar.*`, `validacao.*`, `rodape.*`. A lista exata sai no plano, extraída dos
literais atuais (o pt reproduz **exatamente** o texto de hoje, para os testes atuais
não mudarem).

## Tratamento de erro / bordas
- Chave ausente em en/es: o **build quebra** (tipo `Dicionario`) — nunca vaza em runtime.
- `localStorage` indisponível/valor inválido: cai em `detectarIdioma()`; nunca lança.
- Frase-hero travada (testes/OG/README): `pt['acesso.frase1/2']` = texto atual **idêntico**;
  o `index.html` (OG) permanece estático em pt.

## Testes
- `idioma.ts`: `detectarIdioma` (mock `navigator.language` pt/en/es/fr→pt), `lerIdioma`
  (storage vazio → detecta; valor inválido → detecta), `salvarIdioma`.
- `t()`: lookup no idioma ativo; interpolação `{nome}`; fallback ao pt quando a chave só
  existe no pt (cenário de teste com dict parcial).
- **Regressão:** os testes atuais de `Auth`, `TelaAcesso`, `RecuperarSenha`,
  `auth-validacao` **continuam verdes em pt** — provam que o embrulho não mudou o texto.
  Esses testes rodam dentro do `IdiomaProvider` (default pt).
- Um teste novo: renderiza `Auth` com idioma `en` e afirma um texto traduzido (ex.: "Sign in").

## Fora de escopo
- Moeda/datas por locale (fatia do dashboard).
- Nomes das 30 categorias embutidas (decidir na fatia do dashboard).
- Demais telas (Dashboard, Documentos, EditarCompra, EditarPerfil, Tutorial, etc.).
- Tradução do conteúdo do usuário (descrições de transação, apelidos) — nunca se traduz.

## Ordem de implementação (para o plano)
1. `idioma.ts` (núcleo) + testes.
2. Dicionários pt/en/es (chaves da fatia) + tipo `Dicionario`.
3. `IdiomaProvider` + `useT` + testes; envolver `main.tsx`.
4. `SeletorIdioma` + colocar na `TelaAcesso`.
5. Trocar literais por `t(...)` na fatia do acesso (mantendo pt idêntico); manter os
   testes atuais verdes (ajustar só o wrapper de render p/ IdiomaProvider onde faltar).
6. Teste de troca de idioma (en).
7. Verificação (`npm test && build && lint && tsc`) + README/ESTADO (registrar a 1ª fatia) + push.
