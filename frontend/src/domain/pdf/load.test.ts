import { describe, expect, it } from 'vitest'
import { PdfGrandeError, validarArquivoPdf } from './load'

describe('limite de documento PDF', () => {
  it('rejeita documento maior que o limite antes da leitura', () => {
    const arquivo = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'fatura.pdf', {
      type: 'application/pdf',
    })

    expect(() => validarArquivoPdf(arquivo)).toThrow(PdfGrandeError)
  })

  it('aceita documento no limite', () => {
    const arquivo = new File([new Uint8Array(25 * 1024 * 1024)], 'fatura.pdf', {
      type: 'application/pdf',
    })

    expect(() => validarArquivoPdf(arquivo)).not.toThrow()
  })
})
