import { useEffect, useRef } from 'react'
import { gerarParticulas, deveAnimar } from './fundo/particulas'

const QUANTIDADE = 600
const RAIO = 80

/** Fundo de partículas em three.js, numa camada fixa que não afeta a rolagem.
 *
 *  O three entra por import dinâmico: o bundle já passa de 500 kB por causa do
 *  pdf.js e não pode carregar mais 515 kB cru (129 kB gzip) antes da primeira
 *  tela. Se o import ou o WebGL falharem, o app segue funcionando — só fica
 *  sem fundo. */
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
        // gl_PointSize é medido em pixels do framebuffer: o shader usa este
        // mesmo valor (uniform `pixelRatio`, adiante) para compensar o
        // setPixelRatio, senão os pontos saem com metade do tamanho em DPR 2.
        let pixelRatio = Math.min(window.devicePixelRatio, 2)
        renderer.setPixelRatio(pixelRatio)
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

        /** Opacidade máxima das partículas, calibrada por tema em
         *  `--particula-alfa`. */
        function alfaDoTema() {
          const valor = getComputedStyle(document.documentElement)
            .getPropertyValue('--particula-alfa')
            .trim()
          const n = Number.parseFloat(valor)
          return Number.isFinite(n) ? n : 0.5
        }

        /** Cor lida de `--color-particula`, que cada tema define com o seu
         *  tom. Antes vinha de `--color-confere`, que vale o mesmo verde nos
         *  dois temas — a cor nunca mudava de fato entre claro e escuro. */
        function corDoTema() {
          const valor = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-particula')
            .trim()
          return new THREE.Color(valor || '#6b5138')
        }

        const material = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.NormalBlending,
          uniforms: {
            tempo: { value: 0 },
            cor: { value: corDoTema() },
            alfaMax: { value: alfaDoTema() },
            pixelRatio: { value: pixelRatio },
          },
          vertexShader: `
            attribute float fase;
            uniform float tempo;
            uniform float pixelRatio;
            varying float vAlfa;
            void main() {
              // Cada partícula respira na sua própria fase; juntas viram
              // pisca-pisca.
              vAlfa = 0.15 + 0.45 * (0.5 + 0.5 * sin(tempo + fase));
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              // pixelRatio compensa o setPixelRatio do renderer: sem ele, em
              // DPR 2 os pontos saem com metade do tamanho pretendido.
              gl_PointSize = 2.2 * (300.0 / -mv.z) * pixelRatio;
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: `
            uniform vec3 cor;
            uniform float alfaMax;
            varying float vAlfa;
            void main() {
              float d = length(gl_PointCoord - vec2(0.5));
              if (d > 0.5) discard;
              gl_FragColor = vec4(cor, vAlfa * alfaMax * smoothstep(0.5, 0.1, d));
            }
          `,
        })

        /** Blending normal nos dois temas: as partículas agora são mais
         *  escuras que o fundo, e blending aditivo só clareia — com ele, cor
         *  escura simplesmente não aparece. A opacidade vem de
         *  `--particula-alfa`, que cada tema calibra. */
        function ajustarAoTema() {
          material.uniforms.cor.value = corDoTema()
          material.uniforms.alfaMax.value = alfaDoTema()
          material.blending = THREE.NormalBlending
          material.needsUpdate = true
        }

        const pontos = new THREE.Points(geometria, material)
        cena.add(pontos)

        // Paralaxe amortecida: o alvo segue o mouse, a câmera persegue o alvo.
        const alvo = { x: 0, y: 0 }
        function aoMoverMouse(e: MouseEvent) {
          alvo.x = (e.clientX / window.innerWidth - 0.5) * 12
          alvo.y = -(e.clientY / window.innerHeight - 0.5) * 12
        }
        window.addEventListener('mousemove', aoMoverMouse)

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

        // `desenhar` e `animar` já estão definidos acima: os dois handlers
        // abaixo dependem deles para repintar quando o movimento reduzido
        // está ativo (sem loop, ninguém mais chamaria `desenhar`).
        function aoRedimensionar() {
          camera.aspect = window.innerWidth / window.innerHeight
          camera.updateProjectionMatrix()
          renderer.setSize(window.innerWidth, window.innerHeight, false)
          // O DPR pode mudar ao arrastar a janela entre monitores.
          pixelRatio = Math.min(window.devicePixelRatio, 2)
          renderer.setPixelRatio(pixelRatio)
          material.uniforms.pixelRatio.value = pixelRatio
          // Com prefers-reduced-motion não há loop: o setSize acima limpa o
          // buffer e, sem repintar aqui, o canvas ficaria em branco depois
          // de qualquer redimensionamento de janela.
          if (!animar) desenhar(performance.now())
        }
        window.addEventListener('resize', aoRedimensionar)

        // Repinta quando o tema muda (o botão de tema escreve data-theme).
        const observador = new MutationObserver(() => {
          ajustarAoTema()
          // Idem: sem loop rodando, a cor/opacidade novas só apareceriam no
          // próximo quadro — que sem animação nunca vem.
          if (!animar) desenhar(performance.now())
        })
        observador.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme'],
        })

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
      .catch((erro: unknown) => {
        // Sem three ou sem WebGL o app continua inteiro, apenas sem fundo —
        // mas o erro fica registrado para não mascarar um bug de shader ou
        // de setup do WebGL.
        console.warn('Fundo animado desativado: falha ao carregar/inicializar o three.js.', erro)
      })

    return () => {
      cancelado = true
      limpar?.()
    }
  }, [])

  return <canvas ref={refCanvas} id="bg-animation" aria-hidden />
}
