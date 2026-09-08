import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { IdiomaProvider, useT } from '../../i18n/IdiomaProvider'
import { ListaPorDia } from './ListaPorDia'
import { ListaPorCategoria } from './ListaPorCategoria'
import { categoria } from '../../domain/categorize/categorias'
import type { GrupoCategoria, GrupoDia } from '../../domain/agrupar'
import type { TransacaoSalva } from '../../aplicacao/consultas/historico'

/** As listas eram a última dívida de i18n do app, e ela era invisível: o
 *  `ESTADO-ATUAL.md` afirmava "i18n 100%" desde 13/08 porque a varredura
 *  procurou `t('chave')` faltando — e aqui não faltava chave, faltava a
 *  tradução existir. Dois arrays de dias e meses em português estavam cravados
 *  no `cabecalhoDia`, e as três frases de coluna e as duas de estado vazio
 *  eram literais no JSX.
 *
 *  Trocar o idioma **com a tela montada** é o que estes casos exercitam,
 *  porque o defeito tem duas metades: a frase pode estar traduzida e mesmo
 *  assim não repintar. `cabecalhoDia` lê a locale de um estado de MÓDULO, e
 *  estado de módulo não inscreve componente nenhum — quem inscreve é o
 *  `useT()`. É a mesma armadilha que deixou 74 valores na tela sem o modo
 *  discreto em 31/08. */

const tx = (over: Partial<TransacaoSalva> = {}): TransacaoSalva => ({
  id: 'x',
  date: '2026-06-05',
  competencia: '2026-06',
  description: 'PADARIA DO ZE',
  label: null,
  amount_cents: 1250,
  kind: 'expense',
  category_slug: 'alimentacao',
  bank: 'nubank',
  doc_type: 'extrato',
  document_id: 'd1',
  installment: null,
  ...over,
})

const dia: GrupoDia<TransacaoSalva> = {
  dia: '2026-06-05',
  gastoCents: 1250,
  entradasCents: 0,
  itens: [tx()],
}

const grupoCat: GrupoCategoria<TransacaoSalva> = {
  slug: 'supermercado',
  cat: categoria('supermercado'),
  totalCents: 18000,
  contagem: 1,
  itens: [tx({ category_slug: 'supermercado' })],
}

/** O seletor de idioma mora fora destas telas (ver a fatia 4a), então o teste
 *  traz botões próprios — o que importa é o provider trocar o idioma com a
 *  lista já montada, e não por onde a pessoa clica. */
function Trocar({ idioma, rotulo }: { idioma: 'pt' | 'en' | 'es'; rotulo: string }) {
  const { setIdioma } = useT()
  return <button onClick={() => setIdioma(idioma)}>{rotulo}</button>
}

describe('as listas seguem o idioma', () => {
  /** ⚠️ **O idioma inicial NÃO é `pt` aqui.** Sem provider o `useT` cai no
   *  padrão português, mas com ele o `lerIdioma()` consulta o
   *  `localStorage` e, na falta, **detecta pelo navegador** — e o jsdom se
   *  apresenta como `en-US`. Um teste que presumisse "começa em português"
   *  estaria medindo o ambiente, e não o código: é a mesma armadilha que o
   *  CI apontou em 08/09 nos casos do polyfill. Por isso cada caso
   *  ESTABELECE o idioma de partida em vez de supô-lo. */
  beforeEach(() => {
    localStorage.clear()
  })

  it('ListaPorDia: o dia da semana e o mês acompanham a troca', async () => {
    const usuario = userEvent.setup()
    render(
      <IdiomaProvider>
        <Trocar idioma="pt" rotulo="para pt" />
        <Trocar idioma="en" rotulo="para en" />
        <ListaPorDia grupos={[dia]} onEditar={() => {}} />
      </IdiomaProvider>,
    )

    await usuario.click(screen.getByRole('button', { name: 'para pt' }))
    expect(await screen.findByText('sex, 5 jun')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'para en' }))

    // 2026-06-05 é uma sexta-feira: "Fri, 5 Jun".
    expect(await screen.findByText(/Fri, 5 Jun/)).toBeInTheDocument()
    expect(screen.queryByText('sex, 5 jun')).not.toBeInTheDocument()
  })

  it('ListaPorDia: o estado vazio acompanha a troca', async () => {
    const usuario = userEvent.setup()
    render(
      <IdiomaProvider>
        <Trocar idioma="pt" rotulo="para pt" />
        <Trocar idioma="es" rotulo="para es" />
        <ListaPorDia grupos={[]} onEditar={() => {}} />
      </IdiomaProvider>,
    )

    await usuario.click(screen.getByRole('button', { name: 'para pt' }))
    expect(await screen.findByText('Sem lançamentos neste período.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'para es' }))

    expect(await screen.findByText('Sin movimientos en este período.')).toBeInTheDocument()
  })

  it('ListaPorCategoria: o estado vazio acompanha a troca', async () => {
    const usuario = userEvent.setup()
    render(
      <IdiomaProvider>
        <Trocar idioma="pt" rotulo="para pt" />
        <Trocar idioma="en" rotulo="para en" />
        <ListaPorCategoria grupos={[]} totalCents={0} onEditar={() => {}} />
      </IdiomaProvider>,
    )

    await usuario.click(screen.getByRole('button', { name: 'para pt' }))
    expect(await screen.findByText('Sem despesas neste período.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'para en' }))

    expect(await screen.findByText('No expenses in this period.')).toBeInTheDocument()
  })

  it('o cabeçalho de colunas acompanha a troca', async () => {
    const usuario = userEvent.setup()
    render(
      <IdiomaProvider>
        <Trocar idioma="pt" rotulo="para pt" />
        <Trocar idioma="en" rotulo="para en" />
        <ListaPorDia grupos={[dia]} onEditar={() => {}} />
      </IdiomaProvider>,
    )

    await usuario.click(screen.getByRole('button', { name: 'para pt' }))
    expect(await screen.findByText('Descrição')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'para en' }))

    expect(await screen.findByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.queryByText('Descrição')).not.toBeInTheDocument()
  })

  // A lista por categoria não desenha o cabeçalho de colunas, mas desenha o
  // nome da categoria — que vem do catálogo e já era traduzido. Fica aqui
  // para o dia em que alguém cravar uma string nova ao lado dele.
  it('ListaPorCategoria: o nome da categoria acompanha a troca', async () => {
    const usuario = userEvent.setup()
    render(
      <IdiomaProvider>
        <Trocar idioma="pt" rotulo="para pt" />
        <Trocar idioma="en" rotulo="para en" />
        <ListaPorCategoria grupos={[grupoCat]} totalCents={18000} onEditar={() => {}} />
      </IdiomaProvider>,
    )

    await usuario.click(screen.getByRole('button', { name: 'para pt' }))
    expect(await screen.findByText('Supermercado')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'para en' }))

    expect(await screen.findByText('Groceries')).toBeInTheDocument()
  })
})
