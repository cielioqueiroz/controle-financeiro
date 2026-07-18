# PayPulse: Fundo Animado, Rename e Card de Compartilhamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar a barra de rolagem fantasma trocando o brilho decorativo solto por um fundo de partículas em three.js numa camada fixa, renomear o sistema para PayPulse e criar o card de compartilhamento Open Graph.

**Architecture:** A decoração sai da árvore de layout e vai para um `<canvas>` `position: fixed`, que por definição não entra no `scrollWidth` da página — é a correção do bug na raiz. A lógica pura (geração de partículas, decisão de animar) fica num módulo testável sem WebGL; o componente React só orquestra three.js e a limpeza de recursos.

**Tech Stack:** React 19 + TypeScript, three.js (import dinâmico), Vite, Vitest (jsdom), Tailwind v4, Playwright (via Python, para medição e geração da imagem OG).

## Global Constraints

- Tudo em **português do Brasil**: comentários, nomes de teste, mensagens.
- Testes ao lado do arquivo testado (`x.ts` → `x.test.ts`); imports do vitest explícitos.
- **`three` só por `import()` dinâmico.** O bundle já passa de 500 kB por causa do pdf.js.
- **`prefers-reduced-motion: reduce` → um quadro estático, sem loop.** Não negociável.
- **Pausar o loop quando `document.hidden`.**
- **`devicePixelRatio` limitado a 2**: `Math.min(window.devicePixelRatio, 2)`.
- **`dispose()` em geometria, material e renderer no unmount.** WebGL não é coletado pelo GC.
- **Falha de WebGL ou do import não pode quebrar a tela** — o app segue funcionando sem fundo.
- O canvas usa **`z-index: 0`**, não `-1`: `main` já é `relative z-10`, e z-index negativo desaparece atrás do fundo de qualquer ancestral opaco.
- O canvas **não aparece na impressão** (`@media print`), senão o relatório em PDF sai com partículas.
- Nome novo: **PayPulse**. Não trocar `src/ui/Tutorial.tsx:89` (frase comum, não marca), nem o nome do pacote/repositório.
- `og:image` precisa ser **URL absoluta**; usar `https://paypulse.vercel.app/og.png` como placeholder.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `scripts/medir-overflow.py` | **Criar.** Mede, via Playwright, quem estoura o viewport ao longo do tempo. Ferramenta de regressão. |
| `src/ui/fundo/particulas.ts` | **Criar.** Lógica pura: gerar posições/fases e decidir se anima. Zero three.js, zero DOM. |
| `src/ui/fundo/particulas.test.ts` | **Criar.** Testes do módulo puro. |
| `src/ui/FundoAnimado.tsx` | **Criar.** Componente React que orquestra three.js, o loop e a limpeza. |
| `src/index.css` | **Modificar.** Estilo de `#bg-animation` e a regra de impressão. |
| `src/App.tsx` | **Modificar.** Monta `<FundoAnimado />`; wordmark renomeado. |
| `src/ui/Auth.tsx` | **Modificar.** Remove o brilho que causa o bug. |
| `src/ui/Dashboard.tsx` | **Modificar.** Cabeçalho do relatório renomeado. |
| `index.html` | **Modificar.** Título, descrição e meta tags OG. |
| `index.test.ts` | **Criar.** Valida as meta tags OG do `index.html`. |
| `scripts/og-card.html` | **Criar.** Fonte da imagem de compartilhamento. |
| `scripts/gerar-og.py` | **Criar.** Captura o HTML acima em `public/og.png`. |
| `README.md` | **Modificar.** Título. |

---

### Task 1: Ferramenta de medição e remoção do brilho

**Files:**
- Create: `scripts/medir-overflow.py`
- Modify: `src/ui/Auth.tsx` (remover o `motion.div` do brilho)

**Interfaces:**
- Consumes: nada.
- Produces: `scripts/medir-overflow.py`, usado de novo na Task 3 para confirmar que o canvas não reintroduz o estouro.

- [ ] **Step 1: Criar o script de medição**

Criar `scripts/medir-overflow.py`:

```python
"""Mede se algum elemento estoura o viewport ao longo do tempo.

Uso:  python scripts/medir-overflow.py [url]

Existe porque o brilho decorativo da tela de login escalava ate 1.25 sem ser
recortado por ninguem, entrando no scrollWidth da pagina e criando uma barra
de rolagem que aparecia e sumia no ritmo da animacao. Rode apos mexer em
qualquer decoracao de fundo.
"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
VIEWPORTS = [(1280, 800), (390, 844)]
AMOSTRAS = 16
INTERVALO_MS = 500

SONDA = """
() => {
  const de = document.documentElement;
  const vw = de.clientWidth, vh = de.clientHeight;
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 70),
        rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
      });
    }
  }
  return {vw, vh, scrollW: de.scrollWidth, scrollH: de.scrollHeight, culpados: out};
}
"""


def main() -> int:
    falhou = False
    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=True)
        for largura, altura in VIEWPORTS:
            pagina = navegador.new_page(viewport={"width": largura, "height": altura})
            pagina.goto(URL)
            pagina.wait_for_load_state("networkidle")
            print(f"\n=== viewport {largura}x{altura} ===")
            for i in range(AMOSTRAS):
                pagina.wait_for_timeout(INTERVALO_MS)
                d = pagina.evaluate(SONDA)
                estoura = d["scrollW"] > d["vw"] or d["scrollH"] > d["vh"]
                if estoura:
                    falhou = True
                    print(f"  t={i * INTERVALO_MS / 1000:4.1f}s  ESTOURO  "
                          f"scrollW={d['scrollW']}/{d['vw']}  scrollH={d['scrollH']}/{d['vh']}")
                    for c in d["culpados"]:
                        print(f"      <{c['tag']}> {c['rect']}  class={c['cls']}")
            if not falhou:
                print("  todas as amostras OK (scroll == viewport)")
            pagina.close()
        navegador.close()
    print("\nRESULTADO:", "ESTOUROU" if falhou else "OK — nenhum estouro")
    return 1 if falhou else 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Rodar e confirmar que o bug aparece**

Com `npm run dev` rodando em outro terminal:

Run: `python scripts/medir-overflow.py`
Expected: `RESULTADO: ESTOUROU`, apontando o `div` com class `pointer-events-none absolute -inset-12 -z-10 rounded-full blur-3xl`. Este é o teste que falha antes da correção.

- [ ] **Step 3: Remover o brilho**

Em `src/ui/Auth.tsx`, apagar o bloco inteiro do brilho — o comentário `{/* Brilho animado atrás do cartão (contido, não é o fundo todo) */}` e o `<motion.div aria-hidden className="pointer-events-none absolute -inset-12 -z-10 rounded-full blur-3xl" ... />` que vem logo depois (o elemento com `style` de `radial-gradient` e `animate` de `scale`/`rotate`/`opacity`).

Manter tudo o mais do arquivo intacto, inclusive o `<div className="relative mx-auto mt-6 max-w-sm sm:mt-12">` que o envolvia e o `motion.div` do cartão.

Se o import de `motion` ficar sem uso, o `oxlint` acusa — mas ele continua sendo usado pelo cartão e pela moeda, então o import permanece.

- [ ] **Step 4: Rodar e confirmar que o estouro sumiu**

Run: `python scripts/medir-overflow.py`
Expected: `RESULTADO: OK — nenhum estouro`, nos dois viewports.

- [ ] **Step 5: Suíte, build e lint**

Run: `npm test && npm run build && npm run lint`
Expected: 197 testes verdes, build e lint OK.

- [ ] **Step 6: Commit**

```bash
git add scripts/medir-overflow.py src/ui/Auth.tsx
git commit -m "fix: remove brilho solto que criava barra de rolagem fantasma"
```

---

### Task 2: Módulo puro das partículas

**Files:**
- Create: `src/ui/fundo/particulas.ts`
- Test: `src/ui/fundo/particulas.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Particula = { x: number; y: number; z: number; fase: number }`
  - `gerarParticulas(quantidade: number, raio: number, aleatorio?: () => number): Particula[]`
  - `deveAnimar(consulta: { matches: boolean } | null): boolean`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/ui/fundo/particulas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { gerarParticulas, deveAnimar } from './particulas'

/** Gerador determinístico: devolve a sequência dada, ciclando. */
function aleatorioFalso(valores: number[]): () => number {
  let i = 0
  return () => valores[i++ % valores.length]
}

describe('gerarParticulas', () => {
  it('gera exatamente a quantidade pedida', () => {
    expect(gerarParticulas(600, 80)).toHaveLength(600)
  })

  it('mantém x, y e z dentro do raio', () => {
    for (const p of gerarParticulas(300, 80)) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(80)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(80)
      expect(Math.abs(p.z)).toBeLessThanOrEqual(80)
    }
  })

  it('dá fase entre 0 e 2π a cada partícula', () => {
    for (const p of gerarParticulas(100, 50)) {
      expect(p.fase).toBeGreaterThanOrEqual(0)
      expect(p.fase).toBeLessThan(Math.PI * 2)
    }
  })

  it('NÃO dá a mesma fase a todas — senão o pulso vira pisca-pisca sincronizado', () => {
    const fases = new Set(gerarParticulas(200, 50).map((p) => p.fase))
    expect(fases.size).toBeGreaterThan(50)
  })

  it('é determinístico quando recebe um gerador determinístico', () => {
    const a = gerarParticulas(5, 10, aleatorioFalso([0.1, 0.9, 0.5, 0.25]))
    const b = gerarParticulas(5, 10, aleatorioFalso([0.1, 0.9, 0.5, 0.25]))
    expect(a).toEqual(b)
  })

  it('devolve lista vazia quando a quantidade é zero', () => {
    expect(gerarParticulas(0, 80)).toEqual([])
  })
})

describe('deveAnimar', () => {
  it('não anima quando o sistema pede movimento reduzido', () => {
    expect(deveAnimar({ matches: true })).toBe(false)
  })

  it('anima quando o sistema não pede movimento reduzido', () => {
    expect(deveAnimar({ matches: false })).toBe(true)
  })

  it('anima quando o navegador não suporta a consulta (null)', () => {
    expect(deveAnimar(null)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/ui/fundo/particulas.test.ts`
Expected: FAIL — `Failed to resolve import "./particulas"`.

- [ ] **Step 3: Implementar**

Criar `src/ui/fundo/particulas.ts`:

```ts
/** Lógica pura do fundo animado — sem three.js e sem DOM, para ser testável
 *  na suíte (o jsdom não tem WebGL). */

export type Particula = {
  x: number
  y: number
  z: number
  /** Deslocamento do pulso desta partícula, em radianos. Cada uma tem o seu
   *  para que o brilho não pisque todo junto. */
  fase: number
}

/** Distribui `quantidade` partículas num cubo de lado 2×`raio`.
 *  `aleatorio` é injetável para o teste ser determinístico. */
export function gerarParticulas(
  quantidade: number,
  raio: number,
  aleatorio: () => number = Math.random,
): Particula[] {
  const particulas: Particula[] = []
  for (let i = 0; i < quantidade; i++) {
    particulas.push({
      x: (aleatorio() * 2 - 1) * raio,
      y: (aleatorio() * 2 - 1) * raio,
      z: (aleatorio() * 2 - 1) * raio,
      fase: aleatorio() * Math.PI * 2,
    })
  }
  return particulas
}

/** Movimento contínuo de fundo causa enjoo em quem tem sensibilidade
 *  vestibular. Quando o sistema pede movimento reduzido, desenhamos um
 *  quadro estático em vez de rodar o loop. */
export function deveAnimar(consulta: { matches: boolean } | null): boolean {
  return !consulta?.matches
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/ui/fundo/particulas.test.ts`
Expected: PASS — 9 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/ui/fundo/particulas.ts src/ui/fundo/particulas.test.ts
git commit -m "feat: logica pura das particulas do fundo animado"
```

---

### Task 3: Componente do fundo em three.js

**Files:**
- Create: `src/ui/FundoAnimado.tsx`
- Modify: `src/index.css` (estilo de `#bg-animation` e regra de impressão), `src/App.tsx` (montar o componente)
- Dependência: `three` e `@types/three`

**Interfaces:**
- Consumes: `gerarParticulas`, `deveAnimar`, `type Particula` de `./fundo/particulas` (Task 2).
- Produces: `<FundoAnimado />`, sem props, montado uma única vez no `App`.

- [ ] **Step 1: Instalar as dependências**

```bash
npm install three
npm install --save-dev @types/three
```

- [ ] **Step 2: Adicionar o estilo da camada**

Em `src/index.css`, acrescentar (junto das outras regras de componente, antes do bloco `@media print`):

```css
/* Camada do fundo animado. `fixed` é o ponto central: elemento fixo sai do
   fluxo e não entra no scrollWidth/scrollHeight da página. Foi exatamente
   isso que faltava no brilho antigo, que criava barra de rolagem ao animar.
   z-index 0 (e não -1) porque `main` já é `relative z-10`; z-index negativo
   sumiria atrás do fundo de qualquer ancestral opaco. */
#bg-animation {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: block;
  pointer-events: none;
}
```

E dentro do bloco `@media print` existente, acrescentar `#bg-animation` à lista de seletores escondidos, que hoje começa com `.grao::after,`:

```css
  .grao::after,
  #bg-animation,
  button,
  select,
  .screen-only {
    display: none !important;
  }
```

Sem isso o relatório impresso sai com as partículas por cima.

- [ ] **Step 3: Escrever o componente**

Criar `src/ui/FundoAnimado.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { gerarParticulas, deveAnimar } from './fundo/particulas'

const QUANTIDADE = 600
const RAIO = 80

/** Fundo de partículas em three.js, numa camada fixa que não afeta a rolagem.
 *
 *  O three entra por import dinâmico: o bundle já passa de 500 kB por causa do
 *  pdf.js e não pode carregar mais 150 kB antes da primeira tela. Se o import
 *  ou o WebGL falharem, o app segue funcionando — só fica sem fundo. */
export function FundoAnimado() {
  const refCanvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = refCanvas.current
    if (!canvas) return

    // O StrictMode monta, desmonta e remonta em desenvolvimento. Sem esta
    // trava, o import assíncrono do efeito já descartado ainda criaria um
    // contexto WebGL órfão.
    let cancelado = false
    let limpar: (() => void) | undefined

    import('three')
      .then((THREE) => {
        if (cancelado) return

        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setSize(window.innerWidth, window.innerHeight, false)

        const cena = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(
          60,
          window.innerWidth / window.innerHeight,
          0.1,
          1000,
        )
        camera.position.z = 120

        const particulas = gerarParticulas(QUANTIDADE, RAIO)
        const posicoes = new Float32Array(QUANTIDADE * 3)
        const fases = new Float32Array(QUANTIDADE)
        particulas.forEach((p, i) => {
          posicoes[i * 3] = p.x
          posicoes[i * 3 + 1] = p.y
          posicoes[i * 3 + 2] = p.z
          fases[i] = p.fase
        })

        const geometria = new THREE.BufferGeometry()
        geometria.setAttribute('position', new THREE.BufferAttribute(posicoes, 3))
        geometria.setAttribute('fase', new THREE.BufferAttribute(fases, 1))

        /** Cor lida do tema, para o fundo acompanhar claro/escuro. */
        function corDoTema() {
          const valor = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-confere')
            .trim()
          return new THREE.Color(valor || '#00c974')
        }

        const material = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: {
            tempo: { value: 0 },
            cor: { value: corDoTema() },
          },
          vertexShader: `
            attribute float fase;
            uniform float tempo;
            varying float vAlfa;
            void main() {
              // Cada partícula respira na sua própria fase; juntas viram
              // pisca-pisca.
              vAlfa = 0.15 + 0.45 * (0.5 + 0.5 * sin(tempo + fase));
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = 2.2 * (300.0 / -mv.z);
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: `
            uniform vec3 cor;
            varying float vAlfa;
            void main() {
              float d = length(gl_PointCoord - vec2(0.5));
              if (d > 0.5) discard;
              gl_FragColor = vec4(cor, vAlfa * smoothstep(0.5, 0.1, d));
            }
          `,
        })

        const pontos = new THREE.Points(geometria, material)
        cena.add(pontos)

        // Paralaxe amortecida: o alvo segue o mouse, a câmera persegue o alvo.
        const alvo = { x: 0, y: 0 }
        function aoMoverMouse(e: MouseEvent) {
          alvo.x = (e.clientX / window.innerWidth - 0.5) * 12
          alvo.y = -(e.clientY / window.innerHeight - 0.5) * 12
        }
        window.addEventListener('mousemove', aoMoverMouse)

        function aoRedimensionar() {
          camera.aspect = window.innerWidth / window.innerHeight
          camera.updateProjectionMatrix()
          renderer.setSize(window.innerWidth, window.innerHeight, false)
        }
        window.addEventListener('resize', aoRedimensionar)

        // Repinta quando o tema muda (o botão de tema escreve data-theme).
        const observador = new MutationObserver(() => {
          material.uniforms.cor.value = corDoTema()
        })
        observador.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme'],
        })

        const consulta =
          typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-reduced-motion: reduce)')
            : null
        const animar = deveAnimar(consulta)

        let quadro = 0
        const inicio = performance.now()

        function desenhar(agora: number) {
          const t = (agora - inicio) / 1000
          material.uniforms.tempo.value = t
          pontos.rotation.y = t * 0.02
          camera.position.x += (alvo.x - camera.position.x) * 0.02
          camera.position.y += (alvo.y - camera.position.y) * 0.02
          camera.lookAt(0, 0, 0)
          renderer.render(cena, camera)
        }

        function laco(agora: number) {
          // Aba em segundo plano não precisa de animação — só gasta bateria.
          if (!document.hidden) desenhar(agora)
          quadro = requestAnimationFrame(laco)
        }

        if (animar) {
          quadro = requestAnimationFrame(laco)
        } else {
          desenhar(performance.now())
        }

        limpar = () => {
          cancelAnimationFrame(quadro)
          window.removeEventListener('mousemove', aoMoverMouse)
          window.removeEventListener('resize', aoRedimensionar)
          observador.disconnect()
          // WebGL não é coletado pelo GC: sem isto o contexto vaza.
          geometria.dispose()
          material.dispose()
          renderer.dispose()
        }
      })
      .catch(() => {
        // Sem three ou sem WebGL o app continua inteiro, apenas sem fundo.
      })

    return () => {
      cancelado = true
      limpar?.()
    }
  }, [])

  return <canvas ref={refCanvas} id="bg-animation" aria-hidden />
}
```

- [ ] **Step 4: Montar no App**

Em `src/App.tsx`, importar o componente junto dos outros imports de `./ui/...`:

```tsx
import { FundoAnimado } from './ui/FundoAnimado'
```

E montá-lo como primeiro filho do `div` raiz, imediatamente antes de `<Notificacoes />`:

```tsx
    <div className="grao min-h-dvh">
      <FundoAnimado />
      <Notificacoes />
```

- [ ] **Step 5: Verificar tipos, suíte, build e lint**

Run: `npx tsc -b --noEmit && npm test && npm run build && npm run lint`
Expected: sem erros de tipo; 206 testes verdes (197 + 9 da Task 2); build e lint OK.

- [ ] **Step 6: Confirmar que o fundo não reintroduziu o estouro**

Reiniciar o `npm run dev` (arquivo novo não é captado bem pelo HMR do Vite) e rodar:

Run: `python scripts/medir-overflow.py`
Expected: `RESULTADO: OK — nenhum estouro` nos dois viewports. Este é o ponto do plano em que a correção do bug e a feature nova se provam compatíveis.

- [ ] **Step 7: Confirmar que o canvas existe e desenha**

Criar um script temporário e rodá-lo (não versionar):

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    erros = []
    pg.on("pageerror", lambda e: erros.append(str(e)))
    pg.goto("http://localhost:5173")
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(2500)
    print("canvas presente:", pg.locator("#bg-animation").count() == 1)
    print("contexto webgl:", pg.evaluate(
        "() => !!document.getElementById('bg-animation')?.getContext('webgl2')"))
    print("erros de pagina:", erros or "nenhum")
    pg.screenshot(path="fundo.png")
    b.close()
```

Expected: `canvas presente: True`, `contexto webgl: True`, `erros de pagina: nenhum`. Abrir `fundo.png` e confirmar visualmente que as partículas aparecem.

- [ ] **Step 8: Commit**

```bash
git add src/ui/FundoAnimado.tsx src/index.css src/App.tsx package.json package-lock.json
git commit -m "feat: fundo animado de particulas em three.js"
```

---

### Task 4: Rename para PayPulse

**Files:**
- Modify: `index.html` (título e descrição), `src/App.tsx` (wordmark), `src/ui/Dashboard.tsx` (cabeçalho do relatório), `README.md` (título)

**Interfaces:**
- Consumes: nada.
- Produces: o nome **PayPulse**, usado pela Task 5 nas meta tags e na imagem.

- [ ] **Step 1: Trocar as ocorrências**

Em `index.html`, o `<title>`:

```html
    <title>PayPulse</title>
```

E a descrição:

```html
    <meta
      name="description"
      content="PayPulse — importe faturas e extratos em PDF e veja para onde seu dinheiro foi."
    />
```

Em `src/App.tsx`, o wordmark do cabeçalho — trocar o texto `Controle Financeiro` por `PayPulse` (é o texto solto logo após o `motion.span` do ponto verde piscante).

Em `src/ui/Dashboard.tsx`, no cabeçalho do relatório impresso, trocar o texto `Controle Financeiro` por `PayPulse`.

Em `README.md`, a primeira linha:

```markdown
# 💰 PayPulse
```

- [ ] **Step 2: Confirmar que não sobrou nenhuma ocorrência de marca**

Run: `grep -rn "Controle Financeiro" src/ index.html README.md`
Expected: nenhum resultado.

Run: `grep -rn "controle financeiro" src/`
Expected: apenas `src/ui/Tutorial.tsx:89` — é frase comum ("Bem-vindo(a) ao seu controle financeiro"), e deve permanecer.

- [ ] **Step 3: Suíte, build e lint**

Run: `npm test && npm run build && npm run lint`
Expected: 206 testes verdes, build e lint OK.

- [ ] **Step 4: Commit**

```bash
git add index.html src/App.tsx src/ui/Dashboard.tsx README.md
git commit -m "feat: renomeia o sistema para PayPulse"
```

---

### Task 5: Card de compartilhamento (Open Graph)

**Files:**
- Create: `scripts/og-card.html`, `scripts/gerar-og.py`, `public/og.png` (gerado), `index.test.ts`
- Modify: `index.html` (meta tags)

**Interfaces:**
- Consumes: o nome **PayPulse** (Task 4).
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Escrever o teste que falha**

Criar `index.test.ts` na raiz do projeto:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf-8')

/** Lê o content de uma meta tag por property (OG) ou name (Twitter). */
function meta(chave: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${chave}["'][^>]*content=["']([^"']+)["']`,
    'i',
  )
  return html.match(re)?.[1] ?? null
}

describe('meta tags de compartilhamento', () => {
  it('declara as tags Open Graph obrigatórias', () => {
    for (const chave of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
      expect(meta(chave), `faltou ${chave}`).toBeTruthy()
    }
  })

  it('usa URL absoluta na og:image — WhatsApp e Telegram buscam de fora e não alcançam caminho relativo', () => {
    expect(meta('og:image')).toMatch(/^https:\/\//)
  })

  it('declara as dimensões da imagem, para o card não piscar enquanto carrega', () => {
    expect(meta('og:image:width')).toBe('1200')
    expect(meta('og:image:height')).toBe('630')
  })

  it('usa summary_large_image no card do Twitter', () => {
    expect(meta('twitter:card')).toBe('summary_large_image')
  })

  it('leva o nome novo no título', () => {
    expect(meta('og:title')).toContain('PayPulse')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run index.test.ts`
Expected: FAIL — `faltou og:title`.

Se o vitest não incluir arquivos da raiz, acrescentar `include` ao bloco `test` do `vite.config.ts`:

```ts
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'index.test.ts'],
  },
```

- [ ] **Step 3: Adicionar as meta tags**

Em `index.html`, dentro do `<head>`, logo após a `<meta name="author" ...>`:

```html
    <!-- Card de compartilhamento (WhatsApp, Telegram, Discord).
         og:image PRECISA ser URL absoluta: os servidores desses apps buscam a
         imagem de fora e não alcançam caminho relativo nem localhost. Trocar
         o domínio abaixo quando o deploy definir a URL real. -->
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:site_name" content="PayPulse" />
    <meta property="og:title" content="PayPulse — Importe o PDF. Veja para onde o dinheiro foi." />
    <meta
      property="og:description"
      content="Importe faturas e extratos em PDF e enxergue seus gastos por categoria, dia, mês e ano."
    />
    <meta property="og:url" content="https://paypulse.vercel.app/" />
    <meta property="og:image" content="https://paypulse.vercel.app/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="PayPulse — importe o PDF e veja para onde o dinheiro foi." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="PayPulse — Importe o PDF. Veja para onde o dinheiro foi." />
    <meta
      name="twitter:description"
      content="Importe faturas e extratos em PDF e enxergue seus gastos por categoria, dia, mês e ano."
    />
    <meta name="twitter:image" content="https://paypulse.vercel.app/og.png" />
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run index.test.ts`
Expected: PASS — 5 testes verdes.

- [ ] **Step 5: Criar o HTML da imagem**

Criar `scripts/og-card.html`. Usa as mesmas cores do tema escuro (`--color-carvao-950: #0d0c0b`, `--color-confere: #00c974`) e a mesma moeda R$ do favicon:

```html
<!doctype html>
<html lang="pt-br">
  <head>
    <meta charset="UTF-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;800&family=JetBrains+Mono:wght@600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1200px; height: 630px;
        background: #0d0c0b;
        font-family: 'Archivo', sans-serif;
        color: #f5f3ef;
        position: relative;
        overflow: hidden;
        display: flex; flex-direction: column;
        justify-content: center;
        padding: 0 88px;
      }
      /* Eco do fundo de particulas, em versao estatica. */
      .brilho {
        position: absolute; inset: -20%;
        background:
          radial-gradient(38% 38% at 78% 28%, rgba(0, 201, 116, 0.30), transparent 70%),
          radial-gradient(34% 34% at 88% 74%, rgba(124, 92, 255, 0.22), transparent 70%);
        filter: blur(40px);
      }
      .conteudo { position: relative; z-index: 1; }
      .marca {
        display: flex; align-items: center; gap: 18px;
        margin-bottom: 34px;
      }
      .marca span {
        font-family: 'JetBrains Mono', monospace;
        font-size: 20px; font-weight: 600;
        letter-spacing: 0.35em; text-transform: uppercase;
        color: #a8a29a;
      }
      h1 {
        font-size: 82px; font-weight: 800;
        line-height: 1.04; letter-spacing: -0.02em;
      }
      h1 .fraca { color: #a8a29a; }
      p {
        margin-top: 30px; font-size: 27px; color: #a8a29a; max-width: 800px;
      }
      .rodape {
        position: absolute; bottom: 54px; left: 88px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 17px; letter-spacing: 0.22em;
        text-transform: uppercase; color: #6f6a62;
      }
    </style>
  </head>
  <body>
    <div class="brilho"></div>
    <div class="conteudo">
      <div class="marca">
        <svg width="62" height="62" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="23" fill="#00c974" />
          <circle cx="32" cy="32" r="23" fill="none" stroke="#065f37" stroke-width="2.5" opacity="0.55" />
          <circle cx="32" cy="32" r="18.5" fill="none" stroke="#065f37" stroke-width="1.6" opacity="0.4" />
          <text x="32" y="41.5" text-anchor="middle" font-family="'JetBrains Mono', monospace"
                font-weight="800" font-size="24" fill="#0d0c0b">R$</text>
        </svg>
        <span>PayPulse</span>
      </div>
      <h1>Importe o PDF.<br /><span class="fraca">Veja para onde o dinheiro foi.</span></h1>
      <p>Faturas e extratos viram gastos por categoria, dia, mês e ano.</p>
    </div>
    <div class="rodape">Lido no navegador · só a transação é salva, nunca o PDF</div>
  </body>
</html>
```

- [ ] **Step 6: Criar o gerador da imagem**

Criar `scripts/gerar-og.py`:

```python
"""Gera public/og.png (1200x630) a partir de scripts/og-card.html.

Uso:  python scripts/gerar-og.py

Rode de novo sempre que a marca mudar. A imagem e versionada porque o build
da Vercel nao roda Playwright.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "scripts" / "og-card.html"
DESTINO = RAIZ / "public" / "og.png"

with sync_playwright() as p:
    navegador = p.chromium.launch(headless=True)
    pagina = navegador.new_page(viewport={"width": 1200, "height": 630})
    pagina.goto(ORIGEM.as_uri())
    pagina.wait_for_load_state("networkidle")
    # As fontes do Google chegam depois do networkidle em alguns casos.
    pagina.wait_for_timeout(1200)
    pagina.screenshot(path=str(DESTINO))
    navegador.close()

print(f"gerado: {DESTINO} ({DESTINO.stat().st_size // 1024} kB)")
```

- [ ] **Step 7: Gerar a imagem e conferir**

Run: `python scripts/gerar-og.py`
Expected: `gerado: .../public/og.png (NN kB)`.

Abrir `public/og.png` e confirmar: 1200×630, texto legível, moeda R$ visível, nada cortado nas bordas. Se as fontes saírem como serifada padrão, aumentar o `wait_for_timeout` para 2500 e gerar de novo.

- [ ] **Step 8: Suíte, build e lint**

Run: `npm test && npm run build && npm run lint`
Expected: 211 testes verdes (206 + 5), build e lint OK. Confirmar que `dist/og.png` existe após o build — arquivos de `public/` são copiados para a raiz do `dist`.

- [ ] **Step 9: Commit**

```bash
git add index.html index.test.ts vite.config.ts scripts/og-card.html scripts/gerar-og.py public/og.png
git commit -m "feat: card de compartilhamento com meta tags Open Graph"
```

---

### Task 6: Atualizar a documentação de retomada

**Files:**
- Modify: `docs/ESTADO-ATUAL.md`

**Interfaces:**
- Consumes: o estado final das Tasks 1-5.
- Produces: nada.

- [ ] **Step 1: Atualizar o documento**

Em `docs/ESTADO-ATUAL.md`:

1. Na seção "Onde o código está", atualizar a contagem de testes para o número real ao final da Task 5.
2. Na "Fila de features pedidas em 2026-07-18", marcar como feitos os itens 2 (fundo animado) e 3 (rename), e acrescentar o card OG como feito.
3. Acrescentar à seção "Notas de armadilha":

```markdown
- **Decoração nunca pode entrar no layout de rolagem.** O brilho da tela de
  login escalava até 1,25 sem ser recortado por ninguém e entrava no
  `scrollWidth`, criando uma barra que aparecia e sumia no ritmo da animação.
  Todo efeito de fundo vai na camada `#bg-animation` (`position: fixed`).
  Depois de mexer em qualquer decoração, rodar `python scripts/medir-overflow.py`.
- **O card de compartilhamento só funciona depois do deploy.** `og:image` exige
  URL absoluta; hoje aponta para o placeholder `https://paypulse.vercel.app/og.png`.
  Conferir e trocar quando o domínio real existir, e validar no
  [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/).
```

4. Na seção de deploy, acrescentar o passo: conferir a URL das meta tags OG.

- [ ] **Step 2: Commit**

```bash
git add docs/ESTADO-ATUAL.md
git commit -m "docs: atualiza ESTADO-ATUAL apos fundo animado, rename e card OG"
```

---

## Notas

- **A ordem importa.** A Task 1 remove o brilho e prova, com medição, que a barra some; a Task 3 prova que o canvas não a traz de volta. Inverter as duas perderia a evidência de que a correção funcionou isoladamente.
- **`z-index: 0` em vez do `-1`** que o pedido original trazia: `main` já é `relative z-10`, então 0 basta, e evita o caso clássico de z-index negativo sumir atrás do fundo de um ancestral opaco.
- **O canvas escondido na impressão** não estava explícito no spec; veio da leitura do `@media print`, que já esconde `.grao::after` pelo mesmo motivo.
- **O teste das meta tags lê o `index.html` como texto**, não pelo DOM: o arquivo não passa pelo bundler nem é renderizado na suíte, e o que importa é o que vai para o disco.
