import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Texto sobre o fundo cheio de perigo (`bg-falha`) não pode ser branco.
 *
 *  `--color-falha` INVERTE por tema: vinho no claro (#b3261e), coral no
 *  escuro (#f0817a). O branco (`text-tinta-viva`) passa no vinho e dá 2,6:1
 *  no coral. O botão de confirmar do `Confirmacao` — o do "Sair" — ficou
 *  assim até 2026-11-02, e nenhum medidor via, porque o `medir-contraste.py`
 *  mede pares de token, não a classe que o componente escolheu. O par certo
 *  é `text-carvao-950`, que inverte junto (6,1:1 e 7,2:1).
 *
 *  `bg-falha/15` e afins (fundo translúcido) ficam de fora: ali o texto é a
 *  própria `text-falha`, sobre a superfície. */
function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.tsx$/.test(entrada.name) && !entrada.name.includes('.test.')) achados.push(caminho)
  }
  return achados
}

function infratores(): string[] {
  const fontes = [...arquivos('src/ui'), ...arquivos('src/paginas'), ...arquivos('src/navegacao')]
  const achados: string[] = []
  for (const f of fontes) {
    readFileSync(f, 'utf-8').split(/\r?\n/).forEach((linha, i) => {
      if (/\bbg-falha(?![/\w-])/.test(linha) && /\btext-tinta-viva\b/.test(linha)) achados.push(`${f}:${i + 1}`)
    })
  }
  return achados
}

describe('texto sobre o fundo de perigo', () => {
  it('nenhum componente põe texto branco sobre bg-falha', () => {
    expect(infratores(), 'Use `text-carvao-950`: o branco sobre o coral do tema escuro dá 2,6:1.').toEqual([])
  })
})
