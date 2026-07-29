import { describe, it, expect, vi, afterEach } from 'vitest'
import { baixarArquivo, compartilharArquivo, podeCompartilharArquivo } from './compartilhar'

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

describe('podeCompartilharArquivo', () => {
  it('true quando o navegador aceita compartilhar arquivos', () => {
    definir('canShare', () => true)
    definir('share', vi.fn())
    expect(podeCompartilharArquivo()).toBe(true)
  })

  it('false sem canShare (jsdom puro / desktop antigo)', () => {
    expect(podeCompartilharArquivo()).toBe(false)
  })
})

describe('baixarArquivo', () => {
  it('baixa via âncora com o nome pedido', () => {
    const criar = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const revogar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    baixarArquivo(blob, 'relatorio.pdf')
    expect(criar).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalled()
    expect(revogar).toHaveBeenCalled()
  })
})

describe('compartilharArquivo', () => {
  it('compartilha quando o aparelho suporta', async () => {
    definir('canShare', () => true)
    const share = vi.fn().mockResolvedValue(undefined)
    definir('share', share)
    await expect(compartilharArquivo(blob, 'r.pdf', meta)).resolves.toBe('compartilhado')
    expect(share).toHaveBeenCalled()
  })

  it('cancelar a folha (AbortError) devolve "cancelado", não erro', async () => {
    definir('canShare', () => true)
    definir('share', vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')))
    await expect(compartilharArquivo(blob, 'r.pdf', meta)).resolves.toBe('cancelado')
  })

  // O caso real do bug: user activation expirada → NotAllowedError. Tem que
  // LANÇAR para o chamador poder cair no download, nunca sumir num catch.
  it('falha real (NotAllowedError) propaga para o chamador', async () => {
    definir('canShare', () => true)
    definir('share', vi.fn().mockRejectedValue(new DOMException('gesture', 'NotAllowedError')))
    await expect(compartilharArquivo(blob, 'r.pdf', meta)).rejects.toThrow()
  })

  it('sem suporte, lança (o chamador decide o fallback)', async () => {
    await expect(compartilharArquivo(blob, 'r.pdf', meta)).rejects.toThrow()
  })
})
