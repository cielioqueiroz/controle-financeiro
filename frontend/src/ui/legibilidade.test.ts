import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Rótulo em caixa-alta, cor tênue e espaçamento largo não desce de 12px.
 *
 *  A auditoria de 30/10 (U2) achou PROCEDÊNCIA, SALDOS e COMPROMISSOS em 9 e
 *  10px: a `.rotulo` tinha 11px, e 18 usos ainda a empurravam para baixo com
 *  `!text-[10px]` e `!text-[9px]`. Caixa-alta já custa leitura; somada a
 *  corpo miúdo e à tinta mais clara do sistema, vira textura. Cada tela nova
 *  copiava o tamanho da vizinha, então o piso precisa de quem o cobre. */
function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.tsx$/.test(entrada.name) && !entrada.name.includes('.test.')) achados.push(caminho)
  }
  return achados
}

const PISO_PX = 12

function infratores(): string[] {
  const fontes = [...arquivos('src/ui'), ...arquivos('src/paginas'), ...arquivos('src/navegacao')]
  const achados: string[] = []
  for (const f of fontes) {
    readFileSync(f, 'utf-8').split(/\r?\n/).forEach((linha, i) => {
      const local = `${f}:${i + 1}`
      if (/\brotulo\b[^"'`]*!text-\[/.test(linha)) achados.push(`${local} (.rotulo encolhida)`)
      if (!/\buppercase\b/.test(linha)) return
      for (const [, px] of linha.matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (Number(px) < PISO_PX) achados.push(`${local} (${px}px em caixa-alta)`)
      }
    })
  }
  return achados
}

describe('rótulos em caixa-alta têm pelo menos 12px', () => {
  it('a classe .rotulo nasce com 12px', () => {
    const css = readFileSync('src/index.css', 'utf-8')
    const bloco = css.match(/\n\s*\.rotulo\s*\{([^}]*)\}/)![1]
    expect(bloco).toMatch(/font-size:\s*0\.75rem/)
  })

  it('nenhum componente encolhe a .rotulo nem escreve caixa-alta abaixo do piso', () => {
    expect(infratores(), 'Use `text-xs` (12px): abaixo disso, caixa-alta tênue vira textura.').toEqual([])
  })
})
