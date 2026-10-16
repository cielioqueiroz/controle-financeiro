import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { MemoryRouter } from 'react-router-dom'
import { IdiomaProvider } from './i18n/IdiomaProvider'
import { SaldoConta } from './ui/SaldoConta'
import { SaldoAberto } from './ui/SaldoAberto'
import { GraficoCategorias } from './ui/graficos/GraficoCategorias'
import { GraficoDiario } from './ui/graficos/GraficoDiario'
import { GraficoFluxo } from './ui/graficos/GraficoFluxo'
import { GraficoCompromissos } from './ui/graficos/GraficoCompromissos'
import { CompromissosFuturos } from './ui/CompromissosFuturos'
import { AvisoConfirmarEmail } from './ui/acesso/AvisoConfirmarEmail'
import { FalhaImportacao } from './ui/FalhaImportacao'
import { MaioresSaidas } from './ui/listas/MaioresSaidas'
import { ListaTodos } from './ui/listas/ListaTodos'
import { Diagnosticos } from './ui/Diagnosticos'
import { DiscretoToggle } from './ui/DiscretoToggle'
import { EditarCompra } from './ui/EditarCompra'
import { DadosProvider } from './dados/DadosProvider'
import { DiscretoProvider } from './dados/DiscretoProvider'
import { diagnosticar } from './domain/diagnosticos'
import { NavLateral } from './navegacao/NavLateral'
import { CarimboConferencia } from './ui/CarimboConferencia'
import { Procedencia } from './ui/Procedencia'
import { Painel } from './paginas/Painel'
import { Relatorios } from './paginas/Relatorios'
import { SituacaoFinanceira } from './paginas/SituacaoFinanceira'
import { CarregandoPainel } from './ui/CarregandoPainel'
import { EstadoVazio } from './ui/EstadoVazio'
import { ErroCarregar } from './ui/ErroCarregar'
import { Cartao } from './ui/Cartao'
import { ResultadoImport } from './ui/ResultadoImport'
import { DocumentoImportado } from './ui/DocumentoImportado'
import type { ParseResult } from './domain/parsers/types'
import type { DocumentoSalvo } from './aplicacao/consultas/documentos'
import { TopEstabelecimentos } from './ui/listas/TopEstabelecimentos'
import {
  agregar,
  porDia,
  projecaoFutura,
  maioresSaidas,
  porEstabelecimento,
  type PontoMes,
} from './domain/agrupar'
import type { TransacaoSalva } from './aplicacao/consultas/historico'

/** Folha de provas: os componentes visuais com dados FICTÍCIOS.
 *
 *  Os testes rodam em jsdom, que não tem layout — altura de barra aplicada
 *  pelo `motion` não chega sequer ao DOM. Gráfico é exatamente a peça que
 *  passa no teste e sai torta na tela, e foi assim que o achatamento das
 *  barras por um valor discrepante sobreviveu a uma suíte verde. Esta página
 *  é onde se olha antes de publicar, e é a fonte dos prints do README
 *  (`scripts/gerar-prints.py`) — sem expor extrato de ninguém.
 *
 *  Fora do build de produção: o `vite build` só tem `index.html` como
 *  entrada. */

let seq = 0
function tx(over: Partial<TransacaoSalva>): TransacaoSalva {
  seq += 1
  return {
    id: `demo-${seq}`,
    date: '2026-07-10',
    competencia: '2026-07',
    description: 'COMPRA',
    label: null,
    amount_cents: 1000,
    kind: 'expense',
    category_slug: 'outros',
    bank: 'nubank',
    doc_type: 'fatura',
    document_id: 'doc-demo',
    installment: null,
    ...over,
  }
}

/** Um mês plausível: compras miúdas quase todo dia e UM pagamento de
 *  empréstimo de R$ 41.653 — o caso real que achatava o gráfico inteiro. */
const DIA_A_DIA: TransacaoSalva[] = [
  ['2026-07-01', 8990, 'supermercado', 'SUPERMERCADO SAO LUIZ'],
  ['2026-07-02', 3450, 'padaria', 'PADARIA CENTRAL'],
  ['2026-07-03', 12780, 'farmacia', 'DROGARIA SAO PAULO'],
  ['2026-07-04', 2990, 'transporte', 'UBER TRIP'],
  ['2026-07-05', 45600, 'supermercado', 'ATACADAO'],
  ['2026-07-06', 1890, 'padaria', 'CAFETERIA GRAO'],
  ['2026-07-08', 21990, 'servicos', 'OFICINA DO CARRO'],
  ['2026-07-09', 5670, 'transporte', 'POSTO IPIRANGA'],
  ['2026-07-10', 15990, 'marketplace', 'MERCADO LIVRE'],
  ['2026-07-11', 7830, 'supermercado', 'HORTIFRUTI'],
  ['2026-07-12', 3200, 'padaria', 'LANCHONETE'],
  ['2026-07-14', 51600, 'educacao', 'MENSALIDADE CURSO'],
  ['2026-07-15', 9990, 'assinaturas', 'NETFLIX'],
  ['2026-07-16', 4165385, 'taxas', 'PAGAMENTO EMPRESTIMO'],
  ['2026-07-17', 6540, 'supermercado', 'MERCADINHO'],
  ['2026-07-18', 2870, 'transporte', 'UBER TRIP'],
  ['2026-07-20', 18900, 'farmacia', 'FARMACIA POPULAR'],
  ['2026-07-21', 3990, 'padaria', 'PADARIA CENTRAL'],
  ['2026-07-22', 27650, 'marketplace', 'AMAZON BR'],
  ['2026-07-23', 8120, 'supermercado', 'SUPERMERCADO SAO LUIZ'],
  ['2026-07-25', 13400, 'servicos', 'INTERNET FIBRA'],
  ['2026-07-26', 4560, 'transporte', 'POSTO SHELL'],
  ['2026-07-28', 32100, 'supermercado', 'ATACADAO'],
  ['2026-07-29', 5990, 'padaria', 'CAFETERIA GRAO'],
].map(([date, cents, cat, desc]) =>
  tx({
    date: date as string,
    amount_cents: cents as number,
    category_slug: cat as string,
    description: desc as string,
    bank: (cents as number) > 100000 ? 'bradesco' : 'nubank',
  }),
)

const ENTRADAS: TransacaoSalva[] = [
  tx({ date: '2026-07-05', amount_cents: -890000, kind: 'income', description: 'SALARIO' }),
  tx({ date: '2026-07-20', amount_cents: -120000, kind: 'income', description: 'FREELA' }),
]

const PARCELAS: TransacaoSalva[] = [
  tx({
    date: '2026-07-14',
    amount_cents: 30000,
    bank: 'bradesco',
    description: 'GELADEIRA FROST FREE',
    installment: { current: 2, total: 5 },
  }),
  tx({
    date: '2026-07-19',
    amount_cents: 21990,
    bank: 'nubank',
    description: 'CELULAR 128GB',
    installment: { current: 1, total: 4 },
  }),
  tx({
    date: '2026-07-22',
    amount_cents: 8500,
    bank: 'nubank',
    description: 'TENIS CORRIDA',
    installment: { current: 3, total: 6 },
  }),
  tx({
    date: '2026-07-27',
    amount_cents: 45000,
    bank: 'bradesco',
    description: 'NOTEBOOK',
    installment: { current: 1, total: 10 },
  }),
]

const TUDO = [...DIA_A_DIA, ...ENTRADAS, ...PARCELAS]

const SERIE: PontoMes[] = [
  { competencia: '2026-02', gastoCents: 318000, entradasCents: 890000 },
  { competencia: '2026-03', gastoCents: 402000, entradasCents: 890000 },
  { competencia: '2026-04', gastoCents: 356000, entradasCents: 910000 },
  { competencia: '2026-05', gastoCents: 289000, entradasCents: 890000 },
  { competencia: '2026-06', gastoCents: 433000, entradasCents: 1010000 },
  { competencia: '2026-07', gastoCents: 4515385, entradasCents: 1010000 },
]

export function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section data-prova={titulo} className="mb-10">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.25em] text-tinta-tenue">
        {titulo}
      </p>
      {children}
    </section>
  )
}

export function Folha() {
  const [mesAberto, setMesAberto] = useState<string | null>(null)
  const resumo = agregar(TUDO)
  const dias = porDia(TUDO)
  const futuros = projecaoFutura(TUDO)

  return (
    <main className="mx-auto w-full max-w-[104rem] px-6 py-8">
      <h1 className="mb-8 font-display text-2xl text-tinta">
        Capital Financeiro · folha de provas <span className="text-tinta-tenue">(dados fictícios)</span>
      </h1>

      {/* O casco vem primeiro: é a moldura de tudo o mais. A calha é
          `hidden lg:flex` — abaixo de 1024px ela não existe, e é por isso
          que o medidor a vê em 1280 e não em 390. A moldura de altura fixa
          é só da folha; na tela real ela ocupa a janela. */}
      <Secao titulo="nav-lateral">
        {/* `h-dvh` porque a calha tambem e `h-dvh`: numa moldura mais
            baixa o rodape dela (o bloco da conta) ficaria cortado, e era
            justamente ele que se queria ver. */}
        {/* Sem `overflow-hidden`: a calha e `sticky`, e um pai que corta
            o overflow recortava justamente o rodape dela (o bloco da
            conta) — a peca que se queria ver. */}
        <div className="relative h-dvh border border-carvao-700">
          <NavLateral
            usuario={{ nome: 'Célio Queiroz', email: 'celio@exemplo.com' }}
            onSair={() => {}}
            onVerTutorial={() => {}}
            onEditarPerfil={() => {}}
          />
        </div>
      </Secao>

      {/* Os tres estados lado a lado: e a unica tela onde da para comparar
          o peso visual deles, e o carimbo so aparece depois de ler um PDF. */}
      <Secao titulo="carimbo-conferencia">
        <div className="flex flex-wrap items-center gap-10 bg-cartao px-6 py-8">
          <CarimboConferencia
            conf={{ status: 'confere', contagem: 21, somaExtraida: 4101225, diferenca: 0 }}
            data={new Date(2026, 5, 30)}
          />
          <CarimboConferencia
            conf={{ status: 'diverge', contagem: 18, somaExtraida: 4098385, diferenca: -12840 }}
            data={new Date(2026, 5, 30)}
          />
          <CarimboConferencia
            conf={{ status: 'sem-gabarito', contagem: 9, somaExtraida: 62134, diferenca: null }}
            data={null}
          />
        </div>
      </Secao>

      <Secao titulo="aviso-email">
        <AvisoConfirmarEmail email="voce@exemplo.com" onConfirmado={() => {}} />
      </Secao>

      {/* O bloco de falha da importação. Está aqui porque na tela real ele
          só existe depois de um PDF dar errado — e era justamente a peça sem
          medição nenhuma quando a mensagem de erro era um toast que sumia.
          Dois casos: um com saída do lado do usuário (o arquivo que o
          celular não entregou) e um sem (banco que ainda não sei ler). */}
      <Secao titulo="falha-importacao">
        <div className="grid gap-4 lg:grid-cols-2">
          <FalhaImportacao
            falha={{
              titulo: 'falha.ilegivel',
              saida: 'falha.ilegivelSaida',
              arquivo: 'NU_742171571_01AGO2026_31AGO2026.pdf',
              detalhe: 'ArquivoIlegivelError: O navegador não conseguiu ler os bytes do arquivo',
            }}
            restantes={0}
            onTentarOutro={() => {}}
          />
          <FalhaImportacao
            falha={{
              titulo: 'falha.semParser',
              saida: 'falha.semParserSaida',
              arquivo: 'extrato-banco-novo.pdf',
              detalhe: 'ParserNaoImplementadoError: Não reconheci este documento',
            }}
            restantes={2}
            onTentarOutro={() => {}}
          />
        </div>
      </Secao>

      {/* Amostra propria, e nao TUDO: aquele e um documento so, e a linha
          existe justamente para mostrar a mistura. O rotulo tem a forma que
          `rotuloPeriodo` devolve ("jul 2026") — passar outra coisa aqui faria
          a folha provar um caso que a tela nao produz. */}
      <Secao titulo="procedencia">
        <Procedencia
          txs={[
            tx({ document_id: 'nu-fat', doc_type: 'fatura', bank: 'nubank' }),
            tx({ document_id: 'nu-ext', doc_type: 'extrato', bank: 'nubank' }),
            tx({ document_id: 'bra-fat', doc_type: 'fatura', bank: 'bradesco' }),
            tx({ document_id: 'mp-ext', doc_type: 'extrato', bank: 'mercadopago' }),
          ]}
          periodo="jul 2026"
        />
      </Secao>

      <Secao titulo="saldos">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <SaldoConta bank="bradesco" balanceCents={3424298} date="2026-07-31" />
          <SaldoConta bank="nubank" balanceCents={607} date="2026-07-31" />
          <SaldoAberto
            bank="nubank"
            abertoCents={271775}
            futurasCents={null}
            proximoFechamento="2026-08-20"
          />
          <SaldoAberto
            bank="bradesco"
            abertoCents={null}
            futurasCents={328813}
            proximoFechamento="2026-08-16"
          />
        </div>
      </Secao>

      <Secao titulo="graficos-painel">
        <div className="grid gap-4 lg:grid-cols-2">
          <Cartao as="div">
            <GraficoCategorias
              categorias={resumo.porCategoria}
              totalCents={resumo.gastoCents}
            />
          </Cartao>
          <Cartao as="div">
            <GraficoDiario dias={dias} onSelecionar={() => {}} />
          </Cartao>
        </div>
        <Cartao as="div" className="mt-4">
          <GraficoFluxo serie={SERIE} ativo="2026-07" onSelecionar={() => {}} />
        </Cartao>
      </Secao>

      {/* Os dois rankings juntos, que é como o painel os mostra. A amostra
          tem ATACADAO, UBER TRIP e CAFETERIA GRAO repetidos de propósito: é
          neles que a diferença entre as duas listas aparece. */}
      <Secao titulo="rankings">
        {/* A MESMA caixa do painel, régua do meio inclusive. A folha de
            provas existe para provar o que vai ao ar: quando ela desenha os
            dois rankings soltos num `gap-6` e o painel os desenha com uma
            borda entre as colunas, o print deixa de ser prova de nada. */}
        <div className="grid gap-8 rounded-2xl border border-carvao-700 bg-carvao-900 p-5 lg:grid-cols-2 lg:gap-0">
          <div className="lg:pr-8">
            <MaioresSaidas itens={maioresSaidas(TUDO, 5)} onEditar={() => {}} />
          </div>
          <div className="lg:border-l lg:border-carvao-800 lg:pl-8">
            <TopEstabelecimentos itens={porEstabelecimento(TUDO, 5)} onAbrir={() => {}} />
          </div>
        </div>
      </Secao>

      <Secao titulo="compromissos">
        <div className="grid gap-6 lg:grid-cols-2">
          <CompromissosFuturos meses={futuros} aberto={mesAberto} onAlternar={setMesAberto} />
          <GraficoCompromissos meses={futuros} onSelecionar={setMesAberto} />
        </div>
      </Secao>

      <Interativas />
    </main>
  )
}

/** As peças que só existem depois de um clique ou de um foco.
 *
 *  Elas ficaram TRÊS RODADAS sem medição nenhuma, e sempre pela mesma razão:
 *  `medir-overflow.py` fazia `goto(URL)` e nada mais, então media a tela de
 *  acesso e nada além dela. Estão aqui, cada uma com um gatilho estável, e a
 *  jornada que as abre é a lista `JORNADAS` de `scripts/medir-overflow.py`.
 *
 *  **Gatilho é contrato:** mudar o texto de um botão daqui quebra a jornada
 *  lá — de propósito. Uma peça que perde o gatilho tem que ficar vermelha,
 *  não voltar em silêncio para a lista das não medidas. */
function Interativas() {
  const [editando, setEditando] = useState<TransacaoSalva | null>(null)
  const [termo, setTermo] = useState('')
  const [cat, setCat] = useState<string | null>(null)

  return (
    <>
      {/* A faixa some quando não há achado — a amostra é escolhida para ter:
          TUDO concentra R$ 41.653 num estabelecimento só. */}
      <Secao titulo="diagnosticos">
        <Diagnosticos itens={diagnosticar(TUDO)} onVerSemCategoria={() => {}} />
      </Secao>

      <Secao titulo="controles-cabecalho">
        <div className="flex items-center gap-2">
          <DiscretoToggle />
          <span className="text-xs text-tinta-tenue">
            clique para mascarar todo dinheiro da folha
          </span>
        </div>
      </Secao>

      {/* A dica de sintaxe é `sr-only` até o campo receber foco: sem focar,
          o medidor mede uma linha invisível de altura zero. */}
      <Secao titulo="busca-operadores">
        <ListaTodos
          txs={TUDO}
          onEditar={setEditando}
          termo={termo}
          cat={cat}
          onTermo={setTermo}
          onCat={setCat}
        />
      </Secao>

      <Secao titulo="editor-compra">
        <button
          onClick={() => setEditando(TUDO[0])}
          className="min-h-11 rounded-lg border border-carvao-700 px-4 text-sm text-tinta"
        >
          Abrir editor de compra
        </button>
        {editando && (
          <EditarCompra
            tx={editando}
            onFechar={() => setEditando(null)}
            onSalvo={() => setEditando(null)}
          />
        )}
      </Secao>
    </>
  )
}

function Previa() {
  const tela = new URLSearchParams(window.location.search).get('tela')
  if (!tela) return <Folha />
  return (
    <main className="mx-auto w-full max-w-[104rem] px-6 py-8">
      <h1 className="mb-8 font-display text-2xl text-tinta">Capital Financeiro · dados fictícios</h1>
      {tela === 'painel' ? <Painel /> : tela === 'relatorios' ? <Relatorios />
        : tela === 'situacao' ? <SituacaoFinanceira />
        : tela === 'conferencia' ? <PreviaConferencia />
        : tela === 'documentos' ? <PreviaDocumento /> : (
        <div data-prova="estados-painel" className="pilha-paineis">
          <CarregandoPainel />
          <EstadoVazio titulo="Nada por aqui ainda" descricao="Importe uma fatura ou extrato para começar."
            acao={<a className="acao-painel" href="/importar">Importar documento</a>} />
          <ErroCarregar mensagem="Falha ao carregar." onTentar={() => {}} />
        </div>
      )}
    </main>
  )
}

function PreviaConferencia() {
  const amostra = new URLSearchParams(window.location.search).get('amostra')
  const result: ParseResult = {
    transactions: [
      { date: new Date(2026, 5, 10), description: 'MERCADO EXEMPLO', amountCents: 9000, kind: 'compra', raw: '', installment: null, card: null, fx: null },
      { date: new Date(2026, 5, 12), description: 'TRANSFERENCIA RECEBIDA EXEMPLO', amountCents: -11000, kind: 'entrada', raw: '', installment: null, card: null, fx: null },
    ],
    declaredTotal: null,
    declaredIncome: amostra === 'sem-gabarito' ? null : amostra === 'confere' ? 11000 : 10000,
    declaredExpense: amostra === 'sem-gabarito' ? null : amostra === 'confere' ? 9000 : 10000,
    period: { start: new Date(2026, 5, 1), end: new Date(2026, 5, 30) },
    account: { bank: 'nubank', type: 'checking', last4: null, agency: null, number: null, holderName: null },
    forward: { nextCloseDate: null, nextInvoiceBalance: null, totalOpenBalance: null, futureInstallmentsTotal: null },
  }
  return <ResultadoImport kind={{ bank: 'nubank', docType: 'extrato' }} result={result}
    regras={[]} podeSalvar={false} salvando={false} onSalvar={() => {}} onLimpar={() => {}} />
}

function PreviaDocumento() {
  const semTransacoes = new URLSearchParams(window.location.search).get('amostra') === 'sem-transacoes'
  const documento: DocumentoSalvo = {
    id: 'documento-ficticio', bank: 'nubank', doc_type: 'extrato',
    filename: 'extrato-exemplo-com-nome-longo-para-conferir-no-celular-junho-2026.pdf',
    period_start: '2026-06-01', period_end: '2026-06-30', imported_at: '2026-07-01T12:00:00Z',
    declared_total: null, declared_income: semTransacoes ? null : 10000,
    declared_expense: semTransacoes ? null : 10000,
  }
  return (
    <ul className="mx-auto max-w-3xl">
      <DocumentoImportado documento={documento}
        contagem={semTransacoes ? { qtd: 0, totalCents: 0 } : { qtd: 2, totalCents: 9000 }} onApagar={() => {}} />
    </ul>
  )
}

const telaPrevia = new URLSearchParams(window.location.search).get('tela')
const amostraPrevia = new URLSearchParams(window.location.search).get('amostra')
const competenciasPrevia = amostraPrevia === 'lacunas' ? ['2026-05']
  : amostraPrevia === 'comparavel' ? ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06']
  : ['2026-05', '2026-06']
const historicoPrevia = telaPrevia ? [
  ...TUDO,
  ...competenciasPrevia.flatMap((competencia) => [
    tx({ date: `${competencia}-10`, competencia, document_id: `demo-${competencia}`, doc_type: 'extrato', amount_cents: 185000 }),
    tx({ date: `${competencia}-05`, competencia, document_id: `demo-${competencia}`, doc_type: 'extrato', description: 'SALARIO', kind: 'income', amount_cents: -300000 }),
  ]),
] : TUDO

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IdiomaProvider>
      {/* O donut navega para /lancamentos no clique: sem Router ele derruba
          a folha inteira na montagem. */}
      <MemoryRouter initialEntries={[`/${window.location.search}`]}>
        {/* `EditarCompra` chama `useDados`, que lança fora do provider. As
            sementes existem para isto: o provider de verdade, sem banco. */}
        <DadosProvider sementes={historicoPrevia}>
          <DiscretoProvider>
            <Previa />
          </DiscretoProvider>
        </DadosProvider>
      </MemoryRouter>
    </IdiomaProvider>
  </StrictMode>,
)
