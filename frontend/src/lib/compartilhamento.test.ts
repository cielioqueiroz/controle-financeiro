import { describe, expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'

/** As metas de compartilhamento do `index.html`, vigiadas pela forma.
 *
 *  ## O defeito que originou este arquivo (2026-09-04)
 *
 *  O card do WhatsApp parou de aparecer. A imagem estava perfeita — 1200×630,
 *  RGB sem canal alfa, 61 kB, servida com `image/png` e 200 —, as metas
 *  estavam todas lá, e mesmo assim nada subia. O problema era a FORMA do
 *  HTML, e ela passa despercebida porque o HTML estava **correto**:
 *
 *  1. O formatador quebrou `og:description` em três linhas. Válido para
 *     qualquer navegador; invisível para quem varre o texto com expressão
 *     regular, que é o que o robô do WhatsApp faz.
 *  2. Um comentário explicativo ACIMA do bloco escrevia `og:image` por
 *     extenso, para dizer que a URL precisa ser absoluta. Um robô que pega a
 *     primeira ocorrência do nome achava o comentário mil caracteres antes
 *     da tag verdadeira.
 *
 *  Nenhum dos dois quebra typecheck, lint, teste ou build — e nenhum aparece
 *  no navegador. Só aparece quando alguém manda o link para outra pessoa e o
 *  card vem vazio, que é tarde. Daí este arquivo. */

const HTML = readFileSync('index.html', 'utf-8')

/** Todas as metas de compartilhamento, com a linha em que cada uma está. */
function metasDeCompartilhamento(): Array<{ chave: string; linha: number; texto: string }> {
  const achadas: Array<{ chave: string; linha: number; texto: string }> = []
  HTML.split('\n').forEach((texto, i) => {
    const m = texto.match(/<meta[^>]*?(?:property|name)="((?:og|twitter):[a-z:]+)"[^>]*>/i)
    if (m) achadas.push({ chave: m[1], linha: i + 1, texto })
  })
  return achadas
}

/** O HTML sem comentários — o que um leitor correto enxerga. */
const SEM_COMENTARIOS = HTML.replace(/<!--[\s\S]*?-->/g, '')

const OBRIGATORIAS = [
  'og:type',
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'og:image:width',
  'og:image:height',
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
]

describe('metas de compartilhamento (o card do WhatsApp)', () => {
  it('todas as obrigatórias existem', () => {
    const presentes = metasDeCompartilhamento().map((m) => m.chave)
    for (const chave of OBRIGATORIAS) {
      expect(presentes, `falta ${chave}`).toContain(chave)
    }
  })

  // A regra 1. Uma meta partida em várias linhas continua sendo HTML válido
  // e continua sumindo do robô que lê por regex.
  it('cada meta cabe em UMA linha', () => {
    for (const chave of OBRIGATORIAS) {
      const emUmaLinha = new RegExp(
        `<meta[^>\\n]*"${chave.replace(/:/g, ':')}"[^>\\n]*content="[^"\\n]*"[^>\\n]*/?>`,
        'i',
      )
      expect(
        emUmaLinha.test(SEM_COMENTARIOS),
        `${chave} está quebrada em mais de uma linha — o robô do WhatsApp não a encontra`,
      ).toBe(true)
    }
  })

  // A regra 2. O comentário que explica as metas não pode citar o nome
  // delas: quem pega a primeira ocorrência acha o comentário.
  it('nenhum comentário do HTML cita og: ou twitter:', () => {
    const comentarios = HTML.match(/<!--[\s\S]*?-->/g) ?? []
    for (const c of comentarios) {
      const citacao = c.match(/\b(?:og|twitter):[a-z]+/i)
      expect(
        citacao?.[0],
        `um comentário escreve "${citacao?.[0]}" — um robô que procura a primeira ocorrência acha ISTO em vez da tag`,
      ).toBeUndefined()
    }
  })

  // Não é preciosismo: esses servidores buscam a imagem de fora, e caminho
  // relativo simplesmente não resolve para eles.
  it('a imagem é URL absoluta e https', () => {
    const m = SEM_COMENTARIOS.match(/property="og:image"[^>]*content="([^"]+)"/i)
    expect(m?.[1]).toMatch(/^https:\/\//)
  })

  // Dimensão declarada diferente da real faz o card ser recusado ou cortado,
  // e é o tipo de coisa que se desalinha ao trocar a arte sem olhar as metas.
  it('as dimensões declaradas são as do arquivo, e o formato serve', () => {
    const largura = Number(SEM_COMENTARIOS.match(/"og:image:width"[^>]*content="(\d+)"/i)?.[1])
    const altura = Number(SEM_COMENTARIOS.match(/"og:image:height"[^>]*content="(\d+)"/i)?.[1])

    const png = readFileSync('public/og.png')
    expect(png.subarray(0, 8).toString('binary')).toBe('\x89PNG\r\n\x1a\n')
    expect(png.readUInt32BE(16), 'largura real do PNG').toBe(largura)
    expect(png.readUInt32BE(20), 'altura real do PNG').toBe(altura)

    // Canal alfa: o card é composto sobre fundo desconhecido, e transparência
    // vira mancha preta em parte dos clientes.
    const tipoDeCor = png[25]
    expect([0, 2, 3], 'PNG com canal alfa — achate o fundo').toContain(tipoDeCor)

    // O WhatsApp descarta imagem grande em rede ruim; 300 kB é o teto seguro.
    expect(statSync('public/og.png').size).toBeLessThan(300 * 1024)
  })
})
