// @vitest-environment node
// (Sem isso, o ambiente global jsdom faz o Vite reescrever
// `new URL('./index.html', import.meta.url)` para uma URL http://
// do servidor de dev, em vez de manter o caminho de arquivo real,
// e o readFileSync abaixo falha com "URL must be of scheme file".)
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

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
    expect(meta('og:title')).toContain('PayPulse')
  })
})
