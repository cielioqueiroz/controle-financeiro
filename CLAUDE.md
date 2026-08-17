# Capital Financeiro — instruções do repositório

App de finanças pessoais **retrospectivo**: o usuário importa PDF de fatura e
extrato, e o app diz para onde o dinheiro foi. React 19 + TS + Vite + Tailwind v4 +
Neon. No ar em https://capital-financeiro.vercel.app — **todo push na `main`
publica sozinho** em ~1 min. Trabalha-se direto na `main`, sem branch de feature.

| Onde | O quê |
|---|---|
| [`CONTEXT.md`](./CONTEXT.md) | Glossário do domínio. **Leia antes de nomear qualquer coisa.** |
| [`docs/adr/`](./docs/adr/) | As nove decisões que um leitor acharia erradas sem contexto. |
| [`docs/ESTADO-ATUAL.md`](./docs/ESTADO-ATUAL.md) | Diário de rodadas: o que foi feito, quando e por quê. |

**Monorepo npm:** `frontend/` (o app, os testes e o `index.html`), `backend/` (hoje
só `db/migrations/`), `scripts/` na raiz.

## Antes de dizer que algo está pronto

```bash
npm test && npm run build && npm run lint      # os três, SEMPRE
python scripts/medir-csp.py                    # DEPOIS de npm run build
python scripts/medir-overflow.py               # se mexeu em layout (com npm run dev de pé)
python scripts/medir-contraste.py              # se mexeu em cor
```

- **`npm test` NÃO checa tipos.** Essa armadilha já mordeu quatro vezes. Só
  `npm run build` reprova erro de tipo.
- **`medir-csp.py` mede o `dist/`, não o código.** Rodar sem `npm run build` antes
  aprova o build anterior, e não reclama — um `dist` velho é um `dist` válido.
- Números de referência do diagnóstico (gasto real de junho = R$ 41.012,25 sobre os
  4 PDFs de `D:/extratos/junho2026`) estão em `docs/ESTADO-ATUAL.md`. Mudou sem
  motivo? Regrediu.

## Armadilhas

### Testes e tipos

- **`vi.stubEnv` NÃO alcança `import.meta.env`** neste setup, só `process.env`. Um
  teste que tente fixar `VITE_*` falha em silêncio, lendo o valor real do
  `.env.local`. Por isso `recuperar-senha.test.ts` assevera a **forma** da URL, não
  o valor da base. `neon.ts` tem o mesmo padrão e baterá na mesma parede.
- **Suíte verde não é suíte determinística.** Três execuções do mesmo commit já
  deram 4 → 1 → 0 falhas: os testes que sobem o `<App/>` com `userEvent` estouravam
  o `testTimeout` sob disputa de CPU (hoje 15000ms). **Se um teste falhar sem você
  ter mudado nada, rode de novo antes de investigar o código** — e verifique sob
  carga, porque passar numa máquina ociosa não prova nada.
- **`git stash` sem `-u` não guarda arquivo novo não rastreado**, e um diagnóstico
  já concluiu "erro pré-existente" por causa disso. Para bissecar: `git stash -u` e
  `tsc -b --force` (o `tsc -b` é incremental e mente com cache quente).
- **Nada que exercite o pdf.js de verdade está na suíte.** Os fixtures são JSON já
  extraído e `domain/pdf/load.ts` é mockado em jsdom (que não tem `DOMMatrix`): a
  suíte passa verde com o parser quebrado. Upgrade de pdf.js exige prova à parte.
- **A suíte mocka o SDK do Neon inteiro.** Regressão de login não é pega por teste
  nenhum — ver [ADR-0008](./docs/adr/0008-sdk-do-neon-nao-atualizado.md).

### Estrutura e ambiente

- **`vite.config.ts` tem `envDir: '..'`** — o `.env.local` fica na RAIZ, não em
  `frontend/`. Sem isso as `VITE_*` viram `undefined` **em silêncio**, o app cai no
  modo "importa e vê" e nenhum build reclama.
- **`frontend/tests/fixtures/` é onde os fixtures moram**, de propósito: 13 testes
  fazem `readFileSync('tests/fixtures/…')` relativo ao CWD e o Vitest roda de
  `frontend/`. Os scripts da raiz apontam para `frontend/tests/fixtures/`.
- **Vite não recarrega bem quando arquivos nascem ou mudam de lugar.** Depois de
  criar arquivo ou refatorar pastas: reinicie `npm run dev` e dê `Ctrl+Shift+R`.
- **Build verde ≠ runtime verde.** Já quebrou com React duplicado pelo sonner
  (resolvido com `resolve.dedupe`).
- **Editar arquivo versionado com `io.open(..., 'w')` no Python, no Windows,
  converte todo `\n` em `\r\n` em silêncio.** O README inteiro já virou CRLF assim,
  e o validador passou a achar zero blocos mermaid. Use `newline=''`.
- **Nunca commitar PDF real** (`*.pdf` no `.gitignore`): contém CPF, conta e nomes
  de terceiros. `scripts/diagnostico.ts` também é local e git-ignored.

### Segurança e cabeçalhos

- **Nada do `vercel.json` vale localmente** — nem em `npm run dev`, nem em `vite
  preview`. Headers e rewrites são da Vercel. Foi por isso que a CSP ficou dois
  meses de fora. `scripts/medir-csp.py` serve o `dist` com os headers lidos do
  próprio `vercel.json`.
- **O hash de script inline é sobre o texto em LF.** No Windows o git entrega o
  `index.html` em CRLF, e o parser de HTML normaliza para LF **antes** de o
  navegador somar o hash. Quem calcular sobre os bytes do disco acha um hash que
  navegador nenhum produz — e "corrige" a política que estava certa.
- **Violação de CSP nem sempre é defeito.** O `eval` da carga é a sonda de
  capacidade do zod (via neon-js), em `try/catch`: negada, o zod só valida pelo
  caminho interpretado. Antes de afrouxar diretiva, procure o `catch` — e não ache
  o culpado com `grep eval`, porque o minificador deixa `Function('')`. O caminho é
  o `SecurityPolicyViolationEvent` (`sourceFile` + `lineNumber` + `columnNumber`).

### Layout e efeitos

- **Decoração nunca pode entrar no layout de rolagem.** Todo efeito de fundo vai na
  camada `#bg-animation` (`position: fixed`); o brilho da tela de login já criou
  barra lateral pulsante por escalar dentro do `scrollWidth`.
- **O medidor só reprova rolagem LATERAL** — vertical é normal.
- **Canvas precisa de `width/height` no CSS.** `renderer.setSize(w, h, false)` não
  escreve o style, e canvas sem dimensão CSS cai no tamanho intrínseco: em HiDPI
  fica com o dobro do viewport, borrado. **Invisível em navegador headless, que
  roda em DPR 1.**
- **Utilitário do Tailwind vence regra do `@layer base`.** `focus:shadow-*` e
  `focus:ring-*` apagam o anel de foco do `index.css`. Estilize foco tudo por
  utilitário **ou** tudo pela regra base, nunca misturado.
- **`prefers-reduced-motion` desliga o loop**, então redimensionar a janela ou
  trocar o tema exige repintura manual — senão o canvas fica branco.

### Nomes e deploy

- **Confira se o subdomínio `.vercel.app` está livre ANTES de adotar um nome.**
  `paypulse.vercel.app` era de outro produto, e as meta tags OG apontaram para o
  site alheio. `curl -s -o /dev/null -w "%{http_code}" https://NOME.vercel.app/` —
  **404 é livre**.
- **Renomear o projeto na Vercel NÃO renomeia os domínios**: *Settings → Domains →
  Edit*.
- **Deployment Protection deixa o site só para quem está logado na Vercel**, e o
  toggle só vale depois de `Save`. O dono, já logado, vê tudo normal enquanto
  ninguém mais entra. **Não religue** — quem protege dado é o login + RLS + JWT.
- **Variáveis `VITE_*` são assadas no build.** Mudar o valor no painel da Vercel
  não altera o site no ar até o próximo *Redeploy*.
- **Login rejeitado por origem** dá `403 {"code":"INVALID_CALLBACKURL"}` em
  `sign-in/social`. A lista fica em *Neon → Auth → Configuration → Domains*.
- **GitHub Pages não serve para este app** (publicava a raiz, cujo `index.html` é o
  arquivo-fonte do Vite → 404). A hospedagem é a Vercel.

## Ao escrever código aqui

- **Plano detalhado não substitui review.** Os dois bugs mais graves de uma rodada
  vieram do código de exemplo do próprio plano, transcrito fielmente.
- **Ler o arquivo que nomeia a função não basta; leia quem a chama.** O
  discriminador de transações idênticas não está em `dedupe/hash.ts`, e sim em
  `persist/salvar.ts`, que conta ocorrências e sufixa `#2`.
- Sem `any`. Comentário só onde a regra de negócio não é dedutível do código — as
  armadilhas acima merecem, o resto não.
- Nada de dado mockado silencioso: número que não pode ser calculado vira estado
  vazio, nunca zero.
