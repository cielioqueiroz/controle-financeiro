import { describe, it, expect, vi, afterEach } from 'vitest'
import { baixarOuCompartilhar } from './compartilhar'

const blob = new Blob(['x'], { type: 'application/pdf' })
const meta = { title: 'T', text: 'texto' }

afterEach(() => {
  vi.restoreAllMocks()
  delete (navigator as unknown as { canShare?: unknown }).canShare
  delete (navigator as unknown as { share?: unknown }).share
})

function definir(nome: 'canShare' | 'share', valor: unknown) {
  Object.defineProperty(navigator, nome, { value: valor, configurable: true })
}

describe('baixarOuCompartilhar', () => {
  it('compartilha quando o aparelho suporta arquivos', async () => {
    definir('canShare', () => true)
    const share = vi.fn().mockResolvedValue(undefined)
    definir('share', share)
    const r = await baixarOuCompartilhar(blob, 'relatorio.pdf', meta)
    expect(r).toBe('compartilhado')
    expect(share).toHaveBeenCalled()
  })

  it('cancelar (AbortError) não vira erro', async () => {
    definir('canShare', () => true)
    definir('share', vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')))
    await expect(baixarOuCompartilhar(blob, 'relatorio.pdf', meta)).resolves.toBe('compartilhado')
  })

  it('sem suporte a share, baixa o arquivo', async () => {
    const criar = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revogar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const r = await baixarOuCompartilhar(blob, 'relatorio.pdf', meta)
    expect(r).toBe('baixado')
    expect(criar).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalled()
    expect(revogar).toHaveBeenCalled()
  })
})
