import { describe, expect, it } from 'vitest'
import { ArquivoVazioError, pareceMesmoPdf, PdfGrandeError, validarArquivoPdf } from './load'

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

describe('reconhecer PDF pelo conteúdo, não pelo nome', () => {
  const bytesDe = (texto: string) => new TextEncoder().encode(texto).buffer as ArrayBuffer

  it('aceita o cabeçalho no começo', () => {
    expect(pareceMesmoPdf(bytesDe('%PDF-1.7\n...'))).toBe(true)
  })

  // O pdf.js tolera lixo antes do cabeçalho (assinatura, cabeçalho de
  // e-mail). Recusar aqui o que o leitor abriria seria trocar um documento
  // bom por uma mensagem de erro.
  it('aceita cabeçalho depois de algum lixo, como o pdf.js faz', () => {
    expect(pareceMesmoPdf(bytesDe('\n\n   lixo qualquer\n%PDF-1.4'))).toBe(true)
  })

  it('recusa o que não tem cabeçalho nenhum', () => {
    expect(pareceMesmoPdf(bytesDe('isto e um texto puro salvo como .pdf'))).toBe(false)
  })

  // Um arquivo enorme que só tenha "%PDF-" no fim não é um PDF: o
  // cabeçalho vive no começo, e varrer o arquivo inteiro custaria caro em
  // celular sem ganhar um único documento verdadeiro.
  it('só olha os primeiros 1024 bytes', () => {
    expect(pareceMesmoPdf(bytesDe('x'.repeat(2000) + '%PDF-1.7'))).toBe(false)
  })

  it('não quebra com arquivo menor que a janela', () => {
    expect(pareceMesmoPdf(bytesDe('%PD'))).toBe(false)
  })
})

describe('arquivo vazio é recusado antes de chegar ao pdf.js', () => {
  it('zero byte não é PDF danificado, é arquivo que não veio', () => {
    expect(() => validarArquivoPdf(new File([], 'extrato.pdf', { type: 'application/pdf' }))).toThrow(
      ArquivoVazioError,
    )
  })
})
