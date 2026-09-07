import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dropzone } from './Dropzone'

/** A porta de entrada do app: é aqui que o documento do banco vira dado.
 *
 *  Três decisões desta peça vieram de defeitos reais no celular de outra
 *  pessoa (2026-09-04), e nenhuma tinha teste. */

const pdf = (nome: string) => new File([new Uint8Array([37, 80, 68, 70])], nome, { type: 'application/pdf' })

const inputDe = (container: HTMLElement) =>
  container.querySelector('input[type=file]') as HTMLInputElement

describe('escolher arquivo', () => {
  it('entrega todos os arquivos de uma vez — quem enfileira é o provider', async () => {
    const onArquivos = vi.fn()
    const { container } = render(<Dropzone onArquivos={onArquivos} ocupado={false} />)

    await userEvent.upload(inputDe(container), [pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')])

    expect(onArquivos).toHaveBeenCalledTimes(1)
    expect(onArquivos.mock.calls[0][0].map((f: File) => f.name)).toEqual([
      'a.pdf',
      'b.pdf',
      'c.pdf',
    ])
  })

  /** REGRESSÃO (2026-09-04). O `<input type=file>` não dispara `change` quando
   *  o valor não muda — ou seja, exatamente o gesto de quem viu a falha,
   *  baixou o arquivo de novo e tentou outra vez. O input se zera a cada
   *  escolha para o mesmo arquivo poder entrar duas vezes. */
  it('o input se zera, para o MESMO arquivo poder ser escolhido de novo', async () => {
    const onArquivos = vi.fn()
    const { container } = render(<Dropzone onArquivos={onArquivos} ocupado={false} />)
    const input = inputDe(container)

    await userEvent.upload(input, pdf('extrato.pdf'))
    expect(input.value).toBe('')

    await userEvent.upload(input, pdf('extrato.pdf'))
    expect(onArquivos).toHaveBeenCalledTimes(2)
  })

  it('escolha vazia não chama ninguém', () => {
    const onArquivos = vi.fn()
    const { container } = render(<Dropzone onArquivos={onArquivos} ocupado={false} />)

    fireEvent.change(inputDe(container), { target: { files: [] } })

    expect(onArquivos).not.toHaveBeenCalled()
  })

  /** O `accept` põe `application/pdf` E a extensão: no Android alguns
   *  gerenciadores filtram só por MIME e outros só por extensão, e um PDF
   *  vindo do WhatsApp pode não ter nenhum dos dois. */
  it('aceita por tipo E por extensão, e aceita vários', () => {
    const { container } = render(<Dropzone onArquivos={() => {}} ocupado={false} />)
    const input = inputDe(container)

    expect(input.accept).toContain('application/pdf')
    expect(input.accept).toContain('.pdf')
    expect(input.multiple).toBe(true)
  })
})

describe('arrastar', () => {
  it('soltar arquivos entrega igual ao escolher', () => {
    const onArquivos = vi.fn()
    const { container } = render(<Dropzone onArquivos={onArquivos} ocupado={false} />)

    fireEvent.drop(container.firstChild as HTMLElement, {
      dataTransfer: { files: [pdf('solto.pdf')] },
    })

    expect(onArquivos).toHaveBeenCalledTimes(1)
    expect(onArquivos.mock.calls[0][0][0].name).toBe('solto.pdf')
  })

  it('soltar nada não chama ninguém', () => {
    const onArquivos = vi.fn()
    const { container } = render(<Dropzone onArquivos={onArquivos} ocupado={false} />)

    fireEvent.drop(container.firstChild as HTMLElement, { dataTransfer: { files: [] } })

    expect(onArquivos).not.toHaveBeenCalled()
  })
})

describe('o cartão inteiro é UM alvo', () => {
  /** No celular não existe arrastar. A tela era escrita para o mouse, e o
   *  "ou clique para escolher" ficava minúsculo no canto — descrevendo a
   *  ação impossível e escondendo a única que funciona. */
  it('há um único controle, não dois empilhados', () => {
    render(<Dropzone onArquivos={() => {}} ocupado={false} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('clicar no cartão abre o seletor de arquivos', async () => {
    const { container } = render(<Dropzone onArquivos={() => {}} ocupado={false} />)
    const abrir = vi.spyOn(inputDe(container), 'click')

    await userEvent.click(screen.getByRole('button'))

    expect(abrir).toHaveBeenCalled()
  })
})

describe('enquanto lê um documento', () => {
  it('o cartão fica desabilitado', () => {
    render(<Dropzone onArquivos={() => {}} ocupado />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('o texto muda para dizer que está lendo', () => {
    const { rerender } = render(<Dropzone onArquivos={() => {}} ocupado={false} />)
    const parado = screen.getByRole('button').textContent

    rerender(<Dropzone onArquivos={() => {}} ocupado />)
    expect(screen.getByRole('button').textContent).not.toBe(parado)
  })

  it('clicar não abre o seletor', async () => {
    const { container } = render(<Dropzone onArquivos={() => {}} ocupado />)
    const abrir = vi.spyOn(inputDe(container), 'click')

    await userEvent.click(screen.getByRole('button'))

    expect(abrir).not.toHaveBeenCalled()
  })
})
