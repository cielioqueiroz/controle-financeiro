import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportacaoProvider, useImportacao } from './ImportacaoProvider'
import { DadosProvider, useDados } from './DadosProvider'

/** O documento importado tem que aparecer SEM F5.
 *
 *  O `ImportacaoProvider` dizia, num comentário, que voltar ao histórico
 *  "recarrega e mostra o que acabou de entrar". Não recarregava: voltar é
 *  navegar, e o `DadosProvider` fica ACIMA das `<Routes>` — trocar de rota
 *  não o remonta, então ele continuava servindo a lista que buscou no
 *  login. Só o F5 remontava tudo.
 *
 *  Nenhum teste cobria o fluxo de importação, e é por isso que a promessa
 *  do comentário pôde ficar falsa sem ninguém notar. Este cobre. */

// Todo o caminho do PDF é dublê: o que se testa aqui é a FIAÇÃO entre gravar
// e reler, não a leitura do arquivo (essa tem os fixtures).
//
// ⚠️ `importOriginal` e não um objeto do zero. As classes de erro do
// `load.ts` são usadas com `instanceof` pelo classificador de falhas, e um
// dublê que esquece uma delas faz `instanceof undefined` LANÇAR — o teste
// morre num TypeError que não tem relação nenhuma com o que ele mede. Só as
// duas funções que tocam o pdf.js precisam de dublê; as classes são inertes.
vi.mock('../domain/pdf/load', async (original) => ({
  ...(await original<typeof import('../domain/pdf/load')>()),
  lerBytes: vi.fn(() => Promise.resolve(new ArrayBuffer(8))),
  loadTextItems: vi.fn(() => Promise.resolve([])),
  validarArquivoPdf: vi.fn(),
}))
vi.mock('../domain/pdf/lines', () => ({ buildLines: vi.fn(() => []) }))
vi.mock('../domain/pdf/extract', () => ({ pareceDigitalizado: vi.fn(() => false) }))
vi.mock('../domain/parsers', () => ({
  parse: vi.fn(() => ({
    kind: { bank: 'mercadopago', docType: 'extrato' },
    result: { transactions: [], account: {}, forward: {} },
  })),
  ParserNaoImplementadoError: class ParserNaoImplementadoError extends Error {},
}))
vi.mock('../domain/validate/checksum', () => ({
  validar: vi.fn(() => ({ status: 'confere', contagem: 21, somaExtraida: 0, diferenca: 0 })),
}))
vi.mock('../aplicacao/comandos/importacao', () => ({
  salvarDocumento: vi.fn(() => Promise.resolve({ status: 'salvo', inseridas: 21, jaExistiam: 0 })),
}))

vi.mock('../persist/puxar', () => ({ puxarTudo: vi.fn(() => Promise.resolve([])) }))
vi.mock('../persist/categoriasUsuario', () => ({
  puxarCategoriasUsuario: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../persist/documentos', () => ({ puxarSaldos: vi.fn(() => Promise.resolve([])) }))

import { puxarTudo } from '../persist/puxar'
import { salvarDocumento } from '../aplicacao/comandos/importacao'

/** A superfície mínima: importa e grava, como a página de importação faz. */
const pdf = (nome: string) => new File(['x'], nome, { type: 'application/pdf' })

function Gatilho() {
  const { importar, salvar, limpar, cancelarFila, estado, progresso } = useImportacao()
  const { carregando } = useDados()
  return (
    <div>
      <button onClick={() => importar(pdf('extrato.pdf'))}>importar</button>
      <button onClick={() => importar([pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')])}>
        importar tres
      </button>
      <button
        onClick={() =>
          importar([pdf('a.pdf'), new File(['x'], 'foto.jpg', { type: 'image/jpeg' })])
        }
      >
        importar com lixo
      </button>
      <button onClick={() => salvar()}>gravar</button>
      <button onClick={() => limpar()}>descartar</button>
      <button onClick={() => cancelarFila()}>cancelar fila</button>
      <span data-testid="fase">{estado.fase}</span>
      <span data-testid="progresso">{progresso ? `${progresso.atual}/${progresso.total}` : '-'}</span>
      <span data-testid="carregando">{String(carregando)}</span>
    </div>
  )
}

function montar() {
  return render(
    <ImportacaoProvider regras={[]} logado>
      <DadosProvider>
        <Gatilho />
      </DadosProvider>
    </ImportacaoProvider>,
  )
}

describe('importar → gravar → o histórico se atualiza sozinho', () => {
  beforeEach(() => {
    vi.mocked(puxarTudo).mockClear()
    vi.mocked(salvarDocumento).mockClear()
  })

  it('relê o histórico depois de gravar, sem F5', async () => {
    const user = userEvent.setup()
    montar()

    // A busca da montagem: é ela que o login já fazia, e é contra ela que a
    // segunda tem que se somar.
    await waitFor(() => expect(puxarTudo).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'importar' }))
    await waitFor(() => expect(screen.getByTestId('fase')).toHaveTextContent('pronto'))

    await user.click(screen.getByRole('button', { name: 'gravar' }))
    await waitFor(() => expect(salvarDocumento).toHaveBeenCalledTimes(1))

    // O defeito: aqui parava em 1, e o painel seguia mostrando o histórico
    // de antes da importação até alguém recarregar a página.
    await waitFor(() => expect(puxarTudo).toHaveBeenCalledTimes(2))
  })

  // Recarregar por engano custa uma ida ao banco e um piscar de "carregando"
  // em quem só estava olhando a prévia — e a prévia é justamente o momento
  // de conferir antes de confiar.
  it('não relê o histórico só por ler o PDF', async () => {
    const user = userEvent.setup()
    montar()
    await waitFor(() => expect(puxarTudo).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'importar' }))
    await waitFor(() => expect(screen.getByTestId('fase')).toHaveTextContent('pronto'))

    expect(puxarTudo).toHaveBeenCalledTimes(1)
  })

  it('relê de novo a cada documento gravado', async () => {
    const user = userEvent.setup()
    montar()
    await waitFor(() => expect(puxarTudo).toHaveBeenCalledTimes(1))

    for (const vez of [2, 3]) {
      await user.click(screen.getByRole('button', { name: 'importar' }))
      await waitFor(() => expect(screen.getByTestId('fase')).toHaveTextContent('pronto'))
      await user.click(screen.getByRole('button', { name: 'gravar' }))
      await waitFor(() => expect(puxarTudo).toHaveBeenCalledTimes(vez))
    }
  })

  // O `DadosProvider` também é montado na folha de provas e em testes de
  // página, os dois SEM o ImportacaoProvider em volta. Se ele passasse a
  // exigir o outro, quebraria os dois de uma vez.
  it('o DadosProvider continua de pé sem o ImportacaoProvider em volta', async () => {
    render(
      <DadosProvider>
        <SoDados />
      </DadosProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('sozinho')).toHaveTextContent('ok'))
  })
})

function SoDados() {
  const { carregando } = useDados()
  return <span data-testid="sozinho">{carregando ? 'carregando' : 'ok'}</span>
}

describe('a fila: varios arquivos de uma vez', () => {
  beforeEach(() => {
    vi.mocked(puxarTudo).mockClear()
    vi.mocked(salvarDocumento).mockClear()
  })

  it('le o primeiro e SEGURA os outros na fila', async () => {
    const user = userEvent.setup()
    montar()
    await waitFor(() => expect(puxarTudo).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'importar tres' }))

    // Um de cada vez, e a previa do primeiro na tela: e a conferencia antes
    // de confiar que impede isto de virar "salva os cinco e avisa depois".
    await waitFor(() => expect(screen.getByTestId('fase')).toHaveTextContent('pronto'))
    expect(screen.getByTestId('progresso')).toHaveTextContent('1/3')
    expect(salvarDocumento).not.toHaveBeenCalled()
  })

  it('gravar puxa o proximo sozinho, ate a fila acabar', async () => {
    const user = userEvent.setup()
    montar()
    await waitFor(() => expect(puxarTudo).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'importar tres' }))
    await waitFor(() => expect(screen.getByTestId('progresso')).toHaveTextContent('1/3'))

    await user.click(screen.getByRole('button', { name: 'gravar' }))
    await waitFor(() => expect(screen.getByTestId('progresso')).toHaveTextContent('2/3'))
    await user.click(screen.getByRole('button', { name: 'gravar' }))
    await waitFor(() => expect(screen.getByTestId('progresso')).toHaveTextContent('3/3'))

    await user.click(screen.getByRole('button', { name: 'gravar' }))
    // Fila vazia: volta ao estado inicial, e o Painel rele os TRES.
    await waitFor(() => expect(screen.getByTestId('progresso')).toHaveTextContent('-'))
    expect(salvarDocumento).toHaveBeenCalledTimes(3)
    await waitFor(() => expect(puxarTudo).toHaveBeenCalledTimes(4))
  })

  // Descartar nao e abandonar: quem viu que o terceiro documento estava
  // errado ainda quer os outros dois.
  it('descartar tambem avanca a fila', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'importar tres' }))
    await waitFor(() => expect(screen.getByTestId('progresso')).toHaveTextContent('1/3'))

    await user.click(screen.getByRole('button', { name: 'descartar' }))
    await waitFor(() => expect(screen.getByTestId('progresso')).toHaveTextContent('2/3'))
    expect(salvarDocumento).not.toHaveBeenCalled()
  })

  it('cancelar a fila larga tudo de uma vez', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'importar tres' }))
    await waitFor(() => expect(screen.getByTestId('progresso')).toHaveTextContent('1/3'))

    await user.click(screen.getByRole('button', { name: 'cancelar fila' }))
    await waitFor(() => expect(screen.getByTestId('progresso')).toHaveTextContent('-'))
    expect(screen.getByTestId('fase')).toHaveTextContent('vazio')
    expect(salvarDocumento).not.toHaveBeenCalled()
  })

  // Quem arrasta uma pasta inteira precisa saber que o .jpg nao entrou —
  // ignorar em silencio faria a contagem da fila mentir.
  it('descarta o que nao e PDF e segue com o resto', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'importar com lixo' }))
    await waitFor(() => expect(screen.getByTestId('fase')).toHaveTextContent('pronto'))
    expect(screen.getByTestId('progresso')).toHaveTextContent('1/1')
  })

  it('um arquivo so continua funcionando, sem fila na tela', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'importar' }))
    await waitFor(() => expect(screen.getByTestId('fase')).toHaveTextContent('pronto'))
    expect(screen.getByTestId('progresso')).toHaveTextContent('1/1')
  })
})
