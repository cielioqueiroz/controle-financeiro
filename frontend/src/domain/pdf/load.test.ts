import { afterEach, describe, expect, it } from 'vitest'
import {
  ArquivoVazioError,
  faltaApiDePromise,
  faltaPromiseTry,
  faltaWithResolvers,
  pareceMesmoPdf,
  PdfGrandeError,
  POLYFILL_PROMISE,
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
 *  O `pdfjs-dist` 6 usa DUAS APIs recentes de `Promise`, com pisos
 *  diferentes: `withResolvers` (Chrome 119 / Safari 17.4) e `try`
 *  (Chrome 128 / Safari 18.2). Medido em 2026-09-08: a segunda é chamada 4
 *  vezes por importação, TODAS dentro do worker, e sem ela a tela fica em
 *  "Lendo o documento…" para sempre — o TypeError estoura numa thread que
 *  ninguém escuta.
 *
 *  ⚠️ **Nenhum caso aqui presume o que o runtime tem.** A primeira versão
 *  destes testes abria com `expect(faltaPromiseTry()).toBe(false)`, e isso é
 *  medir o ambiente, não o código: o ambiente de teste do CI **não tinha**
 *  `Promise.try`, e dois casos reprovaram lá depois de passarem aqui — a
 *  mesma armadilha do `.env.test` de 06/09, com outra roupa. Cada caso
 *  ESTABELECE o estado que vai medir; quando precisa de "a API já existe",
 *  instala uma sentinela reconhecível, que serve melhor que a nativa porque
 *  dá para afirmar identidade sobre ela. */
describe('navegador antigo: o polyfill do leitor de PDF', () => {
  type Api = 'withResolvers' | 'try'

  type PromiseMutavel = Record<Api, unknown>
  const promise = () => Promise as unknown as PromiseMutavel

  const originais: [Api, PropertyDescriptor | undefined][] = [
    ['withResolvers', Object.getOwnPropertyDescriptor(Promise, 'withResolvers')],
    ['try', Object.getOwnPropertyDescriptor(Promise, 'try')],
  ]

  const apagar = (nome: Api) => {
    delete promise()[nome]
  }

  /** Uma implementação qualquer, só para o estado ser "existe". */
  const instalar = (nome: Api, fn: unknown) => {
    promise()[nome] = fn
  }

  afterEach(() => {
    // Restaura o que havia — e APAGA o que não havia. Sem o segundo ramo, um
    // ambiente sem a API nativa herdaria o polyfill de um caso para o outro.
    for (const [nome, d] of originais) {
      if (d) Object.defineProperty(Promise, nome, d)
      else apagar(nome)
    }
  })

  it('reconhece o navegador que não tem a withResolvers', () => {
    instalar('withResolvers', () => {})
    expect(faltaWithResolvers()).toBe(false)

    apagar('withResolvers')
    expect(faltaWithResolvers()).toBe(true)
  })

  it('reconhece o navegador que não tem a Promise.try', () => {
    instalar('try', () => {})
    expect(faltaPromiseTry()).toBe(false)

    apagar('try')
    expect(faltaPromiseTry()).toBe(true)
  })

  /** O gate do desvio inteiro — inclusive do Blob que embrulha o worker, que
   *  é o único lugar onde a `Promise.try` é chamada. Um Chrome entre 119 e
   *  127 TEM a `withResolvers` e NÃO tem a `try`: perguntar só pela primeira
   *  mandava esse aparelho seguir sem polyfill nenhum, e a importação
   *  travava sem mensagem nenhuma na tela. */
  it('falta uma das duas já obriga o desvio', () => {
    instalar('withResolvers', () => {})
    instalar('try', () => {})
    expect(faltaApiDePromise()).toBe(false)

    apagar('try')
    expect(faltaWithResolvers()).toBe(false)
    expect(faltaApiDePromise()).toBe(true)
  })

  // O que o pdf.js espera receber: as três peças, e um `resolve` que de fato
  // resolve a promise devolvida. Um polyfill que devolvesse o objeto sem
  // ligar os fios passaria num teste de forma e travaria a leitura para
  // sempre — o pdf.js espera nessa promise.
  it('o polyfill devolve promise, resolve e reject ligados entre si', async () => {
    apagar('withResolvers')
    new Function(POLYFILL_PROMISE)()

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

  /** Como o pdf.js chama: `Promise.try(handler, dados)` e
   *  `Promise.try(handler, dados, sink)` — a função vem primeiro e os
   *  argumentos depois, e o retorno tem que ser a promise do resultado. */
  describe('o polyfill da Promise.try', () => {
    const tryDaVez = () =>
      (Promise as unknown as {
        try: <T>(fn: (...a: never[]) => T, ...args: unknown[]) => Promise<Awaited<T>>
      }).try

    it('repassa os argumentos e resolve com o retorno', async () => {
      apagar('try')
      new Function(POLYFILL_PROMISE)()

      const recebidos: unknown[] = []
      const p = tryDaVez()((...a: never[]) => {
        recebidos.push(...a)
        return 'resultado'
      }, 'dados', 'sink')

      expect(recebidos).toEqual(['dados', 'sink'])
      await expect(p).resolves.toBe('resultado')
    })

    // O `MessageHandler` conta com isto: o handler que estoura vira uma
    // promise REJEITADA, e é o `.then(ok, erro)` dele que devolve o erro ao
    // outro lado. Um polyfill que deixasse a exceção subir síncrona derrubaria
    // o despacho inteiro em vez de responder à mensagem.
    it('transforma exceção síncrona em promise rejeitada', async () => {
      apagar('try')
      new Function(POLYFILL_PROMISE)()

      const p = tryDaVez()(() => {
        throw new Error('estourou')
      })

      expect(p).toBeInstanceOf(Promise)
      await expect(p).rejects.toThrow('estourou')
    })

    it('adota a promise devolvida pelo handler', async () => {
      apagar('try')
      new Function(POLYFILL_PROMISE)()

      await expect(tryDaVez()(() => Promise.resolve('de dentro'))).resolves.toBe('de dentro')
    })
  })

  // O texto é injetado num Blob e roda dentro do worker, que é outra thread
  // com outro globalThis. Se ele sobrescrevesse uma implementação existente,
  // trocaria a do navegador por esta em todo aparelho moderno.
  it('não sobrescreve as implementações que já existem', () => {
    const sentinelas = { withResolvers: () => {}, try: () => {} }
    instalar('withResolvers', sentinelas.withResolvers)
    instalar('try', sentinelas.try)

    new Function(POLYFILL_PROMISE)()

    expect(promise().withResolvers).toBe(sentinelas.withResolvers)
    expect(promise().try).toBe(sentinelas.try)
  })

  /** Um Chrome 126 tem a `withResolvers` e não tem a `try`. O polyfill
   *  precisa acrescentar só o que falta — cobrir "as duas ou nenhuma" trocaria
   *  a implementação do navegador pela nossa em milhões de aparelhos que não
   *  pediram nada. */
  it('acrescenta só a que falta', () => {
    const sentinela = () => {}
    instalar('withResolvers', sentinela)
    apagar('try')

    new Function(POLYFILL_PROMISE)()

    expect(promise().withResolvers).toBe(sentinela)
    expect(typeof promise().try).toBe('function')
  })
})
