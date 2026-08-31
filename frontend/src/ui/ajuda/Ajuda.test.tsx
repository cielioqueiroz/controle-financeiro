import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Ajuda } from './Ajuda'
import { TOPICOS } from './topicos'

function montar(over: { onFechar?: () => void; onVerTutorial?: () => void } = {}) {
  return render(
    <MemoryRouter>
      <Ajuda onFechar={over.onFechar ?? vi.fn()} onVerTutorial={over.onVerTutorial ?? vi.fn()} />
    </MemoryRouter>,
  )
}

const campo = () => screen.getByRole('searchbox')

describe('Ajuda', () => {
  // Quem clica no "?" costuma não saber o nome do que procura. Uma caixa de
  // busca vazia devolveria a pergunta para a pessoa; a lista inteira responde
  // "existe isto, isto e isto" antes de qualquer digitação.
  it('abre com o índice inteiro, não vazio', () => {
    montar()
    expect(screen.getByText('Como importo um documento')).toBeInTheDocument()
    expect(screen.getByText('Idioma e tema')).toBeInTheDocument()
    expect(screen.getByText(`${TOPICOS.length} assuntos`)).toBeInTheDocument()
  })

  it('digitar filtra a lista', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(campo(), 'parcela')

    expect(screen.getByText('Parcelas que ainda vão cair')).toBeInTheDocument()
    expect(screen.queryByText('Idioma e tema')).toBeNull()
  })

  it('acha por pedaço de palavra', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(campo(), 'recorr')
    expect(screen.getByText('O que se repete todo mês')).toBeInTheDocument()
  })

  it('sem resultado, explica em vez de mostrar lista vazia', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(campo(), 'zzzznadaaqui')
    expect(screen.getByText(/Não achei nada/i)).toBeInTheDocument()
  })

  it('o assunto abre e mostra a explicação', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: /Como importo um documento/ }))
    expect(screen.getByText(/a leitura acontece dentro do seu navegador/i)).toBeInTheDocument()
  })

  // Assunto de conceito não tem tela para onde ir, e um botão que não leva a
  // lugar nenhum ensina a não clicar.
  it('só oferece "ir para a tela" quando o assunto tem uma', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(screen.getByRole('button', { name: /Como importo um documento/ }))
    expect(screen.getByRole('button', { name: /ir para a tela/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Por que a compra aparece em outro mês/ }))
    expect(screen.queryByRole('button', { name: /ir para a tela/i })).toBeNull()
  })

  it('ir para a tela fecha o painel', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    montar({ onFechar })

    await user.click(screen.getByRole('button', { name: /Como importo um documento/ }))
    await user.click(screen.getByRole('button', { name: /ir para a tela/i }))
    expect(onFechar).toHaveBeenCalled()
  })

  // Quem abriu a ajuda perdido é exatamente quem pode querer o passeio
  // inteiro — e o tutorial só abre depois de a ajuda sair da frente.
  it('oferece rever o tutorial, e fecha a ajuda ao fazê-lo', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    const onVerTutorial = vi.fn()
    montar({ onFechar, onVerTutorial })

    await user.click(screen.getByRole('button', { name: /ver o tutorial de novo/i }))
    expect(onFechar).toHaveBeenCalled()
    expect(onVerTutorial).toHaveBeenCalled()
  })

  it('é um diálogo com nome acessível', () => {
    montar()
    expect(screen.getByRole('dialog', { name: /como posso ajudar/i })).toBeInTheDocument()
  })
})
