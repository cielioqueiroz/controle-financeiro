# PayPulse: fundo animado, rename e card de compartilhamento — design

> Data: 2026-07-18 · Branch: `main`
> Quatro entregas encadeadas: consertar a barra de rolagem fantasma, trocar a
> decoração por um fundo em three.js, renomear o sistema para **PayPulse**, e
> criar o card de compartilhamento (Open Graph).

## 1. Bug: barra de rolagem fantasma

### Diagnóstico (medido, não suposto)

O culpado é o brilho decorativo em `src/ui/Auth.tsx:83-92`:

```
class="pointer-events-none absolute -inset-12 -z-10 rounded-full blur-3xl"
animate={{ scale: [0.9, 1.25, 0.9], rotate: [0, 40, -15, 0] }}
```

Instrumentei a página com Playwright, amostrando a cada 500 ms ao longo do
ciclo de 7 s da animação e listando todo elemento cujo `getBoundingClientRect`
ultrapassa o viewport:

| momento | `scrollWidth` | `clientWidth` | barra horizontal? |
|---|---|---|---|
| 0,0 s | 1280 | 1280 | não |
| 1,0 s | 1379 | 1280 | sim |
| **1,5 s** | **1437** | 1280 | **sim** |
| 3,5 s | 1280 | 1280 | não |
| 7,5 s | 1318 | 1280 | sim |

Um único elemento aparece na lista de estouro, nos dois viewports testados
(1280×800 e 390×844): o `div` do brilho.

**Causa raiz:** o elemento já nasce 48 px maior que o pai em cada lado
(`-inset-12`), recebe `blur-3xl`, e a animação o escala até **1,25**. Nenhum
ancestral o recorta, então o navegador soma esse tamanho ao conteúdo rolável.
A barra pulsa junto com a animação — daí a impressão de intermitência.

O erro conceitual: **um elemento puramente decorativo está participando do
cálculo de rolagem.** Decoração nunca deve fazer isso.

### Correção

Remover o `motion.div` do brilho de `Auth.tsx`. O fundo novo (seção 2) cumpre o
mesmo papel decorativo a partir de uma camada que não afeta a rolagem.

**Não** usar `overflow-x: hidden` no `body`. Isso esconderia o sintoma mantendo
a causa: o elemento continuaria estourando, e qualquer decoração futura
repetiria o problema.

### Verificação

O script de medição roda de novo após a mudança e deve mostrar
`scrollWidth == clientWidth` em **todas** as amostras, nos dois viewports.
Ele fica versionado em `scripts/medir-overflow.py` para servir a regressões
futuras.

## 2. Fundo animado (three.js)

### A camada

Um `<canvas id="bg-animation">` montado **uma vez** no `App`, fora da árvore de
telas, com:

```css
#bg-animation {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}
```

`position: fixed` é o que resolve o bug na raiz: elemento fixo é retirado do
fluxo e não entra no `scrollWidth`/`scrollHeight` da página, por maior que fique.

### O visual

`THREE.Points` com ~600 partículas distribuídas em profundidade:

- **Deriva** lenta e contínua, sem direção óbvia.
- **Paralaxe** pelo movimento do mouse, amortecida (interpolação suave em
  direção ao alvo, nunca seguindo o cursor de forma rígida).
- **Pulso** — a opacidade respira num ciclo longo, com **fase própria por
  partícula**. Se todas pulsarem juntas o efeito vira pisca-pisca. O nome
  PayPulse vem daqui.
- **Cor** lida das variáveis CSS do tema (`--color-confere`, `--color-tinta-tenue`),
  então o fundo acompanha claro/escuro em vez de ficar chapado num deles.

### Restrições não negociáveis

| Restrição | Por quê |
|---|---|
| `prefers-reduced-motion: reduce` → renderiza **um quadro estático**, sem loop | Movimento de fundo contínuo provoca enjoo em pessoas com sensibilidade vestibular |
| Pausar o `requestAnimationFrame` quando `document.hidden` | Sem isso o app consome bateria em aba de fundo |
| `devicePixelRatio` limitado a 2 | Em telas 3x o custo de fragmento triplica sem ganho perceptível |
| `dispose()` de geometria, material e renderer no unmount | Contexto WebGL não é coletado pelo GC; sem isso vaza |
| `three` carregado por `import()` dinâmico | O bundle já passa de 500 kB por causa do pdf.js; três não pode entrar no carregamento inicial |
| Falha de WebGL não pode quebrar a tela | Em máquina sem aceleração, o app continua funcionando sem fundo |

### Dependências

```bash
npm install three
npm install --save-dev @types/three
```

## 3. Rename para PayPulse

Ocorrências a trocar:

| Arquivo | O quê |
|---|---|
| `index.html:18` | `<title>` |
| `index.html:8` | `<meta name="description">` |
| `src/App.tsx:134` | wordmark do cabeçalho |
| `src/ui/Dashboard.tsx:261` | cabeçalho do relatório impresso |
| `README.md:1` | título |

**Não trocar:** `src/ui/Tutorial.tsx:89` — "Bem-vindo(a) ao seu controle
financeiro" é frase comum, não marca. "Bem-vindo(a) ao seu PayPulse" soaria
estranho e obrigaria a pessoa a decifrar o nome logo na primeira tela.

O nome do pacote e o diretório do repositório continuam `controle-financeiro`.
Renomeá-los quebraria caminhos e não traz benefício.

## 4. Card de compartilhamento (Open Graph)

### Restrição que define o resultado

`og:image` **exige URL absoluta**. WhatsApp, Telegram e Discord buscam a imagem
a partir dos servidores deles e não têm acesso a `localhost`. Logo, **o card só
funciona de fato depois do deploy**. Construímos tudo agora e ele passa a
funcionar sozinho quando o domínio existir.

Enquanto o domínio não estiver definido, usar o placeholder
`https://paypulse.vercel.app` e registrar em `docs/ESTADO-ATUAL.md` que a URL
precisa ser conferida no deploy.

### Meta tags (`index.html`)

`og:title`, `og:description`, `og:image`, `og:image:width` (1200),
`og:image:height` (630), `og:url`, `og:type` (`website`), `og:locale`
(`pt_BR`), mais `twitter:card` (`summary_large_image`), `twitter:title`,
`twitter:description` e `twitter:image` — alguns clientes preferem o par do
Twitter ao OG.

Texto: **PayPulse — Importe o PDF. Veja para onde o dinheiro foi.**

### A imagem

`public/og.png`, 1200×630. Desenhada em HTML com a identidade já existente
(fundo `--color-carvao-950`, a moeda R$ do favicon, fonte display) e capturada
com Playwright, para ficar idêntica à marca em vez de um visual paralelo
inventado. O HTML de origem fica versionado em `scripts/og-card.html`, de modo
que a imagem possa ser regerada quando a marca mudar.

## Fora de escopo

- **Compartilhar o relatório e enviá-lo por e-mail.** Verificado nesta sessão:
  não existe `navigator.share` no código; o botão "Baixar PDF" só chama
  `window.print()`, e o `title` dele ("Baixar ou compartilhar em PDF") promete
  o que não entrega. A raiz é que o app nunca produz um arquivo. Gerar PDF de
  verdade → `navigator.share` → e-mail é a corrente inteira, e ficou definida
  como a **próxima rodada**, com spec próprio.
- i18n, saldo bancário por conta, deploy.

## Testes

O jsdom não tem WebGL, então o render não é testável na suíte. É testável:

- **Geração das partículas** — função pura: quantidade correta, posições dentro
  dos limites, fases de pulso distintas entre partículas.
- **Decisão de animar** — função pura que recebe o resultado de
  `prefers-reduced-motion` e devolve se o loop deve rodar.
- **Meta tags** — teste que lê `index.html` e confirma a presença das tags OG
  obrigatórias e que `og:image` é uma URL absoluta (`^https://`).

A ausência da barra de rolagem é verificada pelo `scripts/medir-overflow.py`
nos dois viewports, e o resultado registrado no relatório da task.

Critério de aceite: `npm test`, `npm run build` e `npm run lint` verdes; script
de overflow sem nenhuma amostra com estouro; card conferido no validador de
OG após o deploy.
