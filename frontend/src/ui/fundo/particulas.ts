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
