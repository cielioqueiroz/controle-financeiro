import { describe, expect, it } from 'vitest'
import { corTextoSobreFundo } from './cor-texto-sobre-fundo'

const CORES_CATEGORIA = ['#a05bd6', '#e8637a', '#4ade80', '#38bdf8', '#facc15', '#fb923c', '#f472b6', '#94a3b8']

function contraste(a: string, b: string): number {
  const luminancia = (cor: string) => {
    const canais = cor.slice(1).match(/../g)!.map((canal) => Number.parseInt(canal, 16) / 255)
    const linearizados = canais.map((valor) => valor <= 0.04045 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4)
    return 0.2126 * linearizados[0] + 0.7152 * linearizados[1] + 0.0722 * linearizados[2]
  }
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (escuro + 0.05)
}

describe('corTextoSobreFundo', () => {
  it('mantém contraste AA nas cores disponíveis para categorias', () => {
    for (const fundo of CORES_CATEGORIA) {
      expect(contraste(corTextoSobreFundo(fundo), fundo)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
