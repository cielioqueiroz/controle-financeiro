// @vitest-environment node
// (Sem isso, o ambiente global jsdom faz o Vite reescrever
// `new URL('./index.html', import.meta.url)` para uma URL http://
// do servidor de dev, em vez de manter o caminho de arquivo real,
// e o readFileSync abaixo falha com "URL must be of scheme file".)
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf-8')

/** Lê o content de uma meta tag por property (OG) ou name (Twitter). */
function meta(chave: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${chave}["'][^>]*content=["']([^"']+)["']`,
    'i',
  )
  return html.match(re)?.[1] ?? null
}

describe('meta tags de compartilhamento', () => {
  it('declara as tags Open Graph obrigatórias', () => {
    for (const chave of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type']) {
      expect(meta(chave), `faltou ${chave}`).toBeTruthy()
    }
  })

  it('usa URL absoluta na og:image — WhatsApp e Telegram buscam de fora e não alcançam caminho relativo', () => {
    expect(meta('og:image')).toMatch(/^https:\/\//)
  })

  it('declara as dimensões da imagem, para o card não piscar enquanto carrega', () => {
    expect(meta('og:image:width')).toBe('1200')
    expect(meta('og:image:height')).toBe('630')
  })

  it('usa summary_large_image no card do Twitter', () => {
    expect(meta('twitter:card')).toBe('summary_large_image')
  })

  it('leva o nome novo no título', () => {
    expect(meta('og:title')).toContain('Capital Financeiro')
  })
})

// ---------------------------------------------------------------------------
// A CSP mora no vercel.json, que NÃO vale no dev nem no `vite preview`: só a
// Vercel a aplica. Quem a exercita de verdade é `scripts/medir-csp.py`, que
// sobe o build com estes headers e dirige o Chromium. O que estes testes
// guardam é o que aquele script não pode ver: o acoplamento entre um arquivo
// e outro. Errar o hash quebra o tema ANTES da primeira pintura, e a página
// nasce escura e pisca — sem erro de build, sem erro de teste, sem console.
// ---------------------------------------------------------------------------

const vercel = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf-8'),
) as {
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

const csp =
  vercel.headers
    .find((b) => b.source === '/(.*)')
    ?.headers.find((h) => h.key === 'Content-Security-Policy')?.value ?? ''

/** O conteúdo de cada `<script>` sem `src` do index.html. */
function scriptsInline(): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
}

function sha256(texto: string): string {
  // CRLF -> LF antes de somar. No Windows o git entrega o index.html com CRLF,
  // mas o parser de HTML normaliza as quebras para LF ANTES de o navegador
  // calcular o hash do script (HTML Standard, "preprocessing the input
  // stream"). Sem esta linha o teste calcula um hash que nenhum navegador
  // produz — ele reprovaria a política que está correta e mandaria trocar o
  // hash bom por um que quebraria o tema em produção.
  const normalizado = texto.replace(/\r\n?/g, '\n')
  return `'sha256-${createHash('sha256').update(normalizado, 'utf8').digest('base64')}'`
}

/** O valor de uma diretiva da CSP, como lista de fontes. */
function diretiva(nome: string): string[] {
  const achada = csp.split(';').find((d) => d.trim().startsWith(`${nome} `))
  return achada ? achada.trim().split(/\s+/).slice(1) : []
}

describe('CSP — o que amarra o vercel.json ao index.html', () => {
  it('tem um hash na script-src para CADA script inline do index.html', () => {
    const inline = scriptsInline()
    expect(inline.length).toBeGreaterThan(0) // o script de tema, no mínimo
    for (const codigo of inline) {
      expect(
        diretiva('script-src'),
        'script inline sem hash correspondente — ele vai ser BARRADO em produção. ' +
          `Ponha ${sha256(codigo)} na script-src do vercel.json.`,
      ).toContain(sha256(codigo))
    }
  })

  it('não compra a paz com unsafe-inline nem unsafe-eval no script-src', () => {
    // O hash acima só tem valor enquanto estas duas palavras não estiverem
    // aqui: qualquer uma delas devolve ao atacante exatamente a primitiva que
    // a política existe para tirar, e faria o teste de cima passar à toa.
    // O `eval` que o zod tenta (via neon-js) é sonda de capacidade em
    // try/catch — negá-lo só o faz validar pelo caminho interpretado.
    expect(diretiva('script-src')).not.toContain("'unsafe-inline'")
    expect(diretiva('script-src')).not.toContain("'unsafe-eval'")
  })

  it('mantém as travas que não dependem de medição', () => {
    expect(diretiva('default-src')).toEqual(["'self'"])
    expect(diretiva('base-uri')).toEqual(["'none'"])
    expect(diretiva('object-src')).toEqual(["'none'"])
    expect(diretiva('frame-ancestors')).toEqual(["'none'"])
    expect(diretiva('form-action')).toEqual(["'self'"])
  })

  // O style-src precisa de 'unsafe-inline' e isso é decisão, não descuido:
  // o React escreve `style=""` em atributo (o motion, em cada quadro), e o
  // sonner injeta a folha dele por <style>. Hash não cobre atributo — só
  // 'unsafe-hashes' cobriria, que é pior. Estilo não executa código.
  it('deixa o style-src explícito, para a exceção ser lida como escolha', () => {
    expect(diretiva('style-src')).toEqual(["'self'", "'unsafe-inline'"])
  })
})

describe('CSP — connect-src contra as URLs que o build assa no bundle', () => {
  // As VITE_* viram texto dentro do JS no build. Se o projeto Neon mudar de
  // endpoint e só o .env.local for atualizado, o app sobe apontando para um
  // host que a CSP não conhece — e o sintoma é login morto em produção, com
  // tudo verde aqui. Este teste é o alarme. Pula quando não há .env.local
  // (clone novo, CI): o arquivo é gitignored por conter o endpoint real.
  const env = new URL('../.env.local', import.meta.url)
  const temEnv = existsSync(env)

  it.skipIf(!temEnv)('lista toda origem VITE_ do .env.local na connect-src', () => {
    const texto = readFileSync(env, 'utf-8')
    const origens = [...texto.matchAll(/^VITE_\w+=\s*(https:\/\/[^\s/]+)/gm)].map((m) => m[1])
    expect(origens.length).toBeGreaterThan(0)
    for (const o of origens) {
      expect(
        diretiva('connect-src'),
        `${o} está no .env.local mas não na connect-src: o login morre em produção`,
      ).toContain(o)
    }
  })

  it('não abre a connect-src para curinga de subdomínio', () => {
    // `https://*.neon.tech` pareceria conveniente e seria um canal de
    // exfiltração pronto: qualquer pessoa cria um projeto Neon e ganha um
    // endpoint sob esse curinga para receber o dado.
    for (const fonte of diretiva('connect-src')) {
      expect(fonte).not.toContain('*')
    }
  })
})

describe('rewrite de SPA — o que NÃO deve virar index.html', () => {
  const fonte = vercel.rewrites[0].source
  const re = new RegExp(`^${fonte}$`)

  it('manda as rotas do app para o index.html', () => {
    for (const rota of [
      '/',
      '/lancamentos',
      '/faturas',
      '/categorias',
      '/recorrencias',
      '/datas',
      '/importar',
      '/qualquer-coisa',
    ]) {
      expect(re.test(rota), `${rota} deveria abrir o app`).toBe(true)
    }
  })

  it('deixa caminhos de infraestrutura caírem em 404, não em página 200', () => {
    // A Vercel não serve nada disso de qualquer jeito — o que se corrige aqui
    // é o catch-all responder 200 com o HTML do app para `/.env`, que faz um
    // scanner registrar o caminho como existente.
    for (const caminho of [
      '/.git/config',
      '/.env',
      '/.env.local',
      '/backend/db/migrations/0001_schema_inicial.sql',
      '/scripts/diagnostico.ts',
      '/api/documentos',
    ]) {
      expect(re.test(caminho), `${caminho} não deveria virar index.html`).toBe(false)
    }
  })
})
