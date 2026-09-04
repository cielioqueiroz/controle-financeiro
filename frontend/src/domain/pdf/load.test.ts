import { afterEach, describe, expect, it } from 'vitest'
import {
  ArquivoVazioError,
  faltaWithResolvers,
  pareceMesmoPdf,
  PdfGrandeError,
  POLYFILL_WITH_RESOLVERS,
  validarArquivoPdf,
} from './load'

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

/** O defeito de 2026-09-04: um extrato não importava num celular, e o mesmo
 *  arquivo abria no desktop. Não era o documento — era o navegador.
 *
 *  O `pdfjs-dist` 6 usa `Promise.withResolvers` (Chrome 119+, Safari 17.4+,
 *  ou seja iOS 17.4+). Num aparelho anterior o app inteiro funciona e SÓ a
 *  importação quebra, com um TypeError que virava "não consegui ler". */
describe('navegador antigo: o polyfill do leitor de PDF', () => {
  const original = Object.getOwnPropertyDescriptor(Promise, 'withResolvers')

  afterEach(() => {
    if (original) Object.defineProperty(Promise, 'withResolvers', original)
  })

  it('reconhece o navegador que não tem a API', () => {
    expect(faltaWithResolvers()).toBe(false)
    // @ts-expect-error — simulando o motor antigo
    delete Promise.withResolvers
    expect(faltaWithResolvers()).toBe(true)
  })

  // O que o pdf.js espera receber: as três peças, e um `resolve` que de fato
  // resolve a promise devolvida. Um polyfill que devolvesse o objeto sem
  // ligar os fios passaria num teste de forma e travaria a leitura para
  // sempre — o pdf.js espera nessa promise.
  it('o polyfill devolve promise, resolve e reject ligados entre si', async () => {
    const fonte = POLYFILL_WITH_RESOLVERS
    // @ts-expect-error — simulando o motor antigo
    delete Promise.withResolvers
    new Function(fonte)()

    const w = (Promise as unknown as { withResolvers: <T>() => {
      promise: Promise<T>
      resolve: (v: T) => void
      reject: (e: unknown) => void
    } }).withResolvers<string>()

    expect(typeof w.resolve).toBe('function')
    expect(typeof w.reject).toBe('function')
    w.resolve('pronto')
    await expect(w.promise).resolves.toBe('pronto')

    const r = (Promise as unknown as { withResolvers: <T>() => {
      promise: Promise<T>
      reject: (e: unknown) => void
    } }).withResolvers<string>()
    r.promise.catch(() => {}) // sem isto o Node reclama de rejeição não tratada
    r.reject(new Error('não'))
    await expect(r.promise).rejects.toThrow('não')
  })

  // O texto é injetado num Blob e roda dentro do worker, que é outra thread
  // com outro globalThis. Se ele sobrescrevesse uma implementação nativa,
  // trocaria a do navegador por esta em todo aparelho moderno.
  it('não sobrescreve a implementação nativa quando ela existe', () => {
    const nativa = (Promise as unknown as { withResolvers: unknown }).withResolvers
    new Function(POLYFILL_WITH_RESOLVERS)()
    expect((Promise as unknown as { withResolvers: unknown }).withResolvers).toBe(nativa)
  })
})
