import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { MemoryRouter } from 'react-router-dom'
import { IdiomaProvider } from './i18n/IdiomaProvider'
import { SaldoConta } from './ui/SaldoConta'
import { SaldoAberto } from './ui/SaldoAberto'
import { GraficoCategorias } from './ui/GraficoCategorias'
import { GraficoDiario } from './ui/GraficoDiario'
import { GraficoEvolucao } from './ui/GraficoEvolucao'
import { GraficoCompromissos } from './ui/GraficoCompromissos'
import { CompromissosFuturos } from './ui/CompromissosFuturos'
import { AvisoConfirmarEmail } from './ui/AvisoConfirmarEmail'
import { MaioresSaidas } from './ui/MaioresSaidas'
import { TopEstabelecimentos } from './ui/TopEstabelecimentos'
import {
  agregar,
  porDia,
  projecaoFutura,
  maioresSaidas,
  porEstabelecimento,
  type PontoMes,
} from './persist/agrupar'
import type { TransacaoSalva } from './persist/puxar'

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

      <Secao titulo="aviso-email">
        <AvisoConfirmarEmail email="voce@exemplo.com" onConfirmado={() => {}} />
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
        <div className="grid gap-px overflow-hidden rounded-2xl border border-carvao-700 bg-carvao-800 lg:grid-cols-2">
          <div className="bg-carvao-900 p-5">
            <GraficoCategorias
              categorias={resumo.porCategoria}
              totalCents={resumo.gastoCents}
            />
          </div>
          <div className="space-y-6 bg-carvao-900 p-5">
            <GraficoDiario dias={dias} onSelecionar={() => {}} />
            <GraficoEvolucao serie={SERIE} ativo="2026-07" onSelecionar={() => {}} />
          </div>
        </div>
      </Secao>

      {/* Os dois rankings juntos, que é como o painel os mostra. A amostra
          tem ATACADAO, UBER TRIP e CAFETERIA GRAO repetidos de propósito: é
          neles que a diferença entre as duas listas aparece. */}
      <Secao titulo="rankings">
        <div className="grid gap-6 rounded-2xl border border-carvao-700 bg-carvao-900 p-5 lg:grid-cols-2">
          <MaioresSaidas itens={maioresSaidas(TUDO, 5)} onEditar={() => {}} />
          <TopEstabelecimentos itens={porEstabelecimento(TUDO, 5)} onAbrir={() => {}} />
        </div>
      </Secao>

      <Secao titulo="compromissos">
        <div className="grid gap-6 lg:grid-cols-2">
          <CompromissosFuturos meses={futuros} aberto={mesAberto} onAlternar={setMesAberto} />
          <GraficoCompromissos meses={futuros} onSelecionar={setMesAberto} />
        </div>
      </Secao>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IdiomaProvider>
      {/* O donut navega para /lancamentos no clique: sem Router ele derruba
          a folha inteira na montagem. */}
      <MemoryRouter>
        <Folha />
      </MemoryRouter>
    </IdiomaProvider>
  </StrictMode>,
)
