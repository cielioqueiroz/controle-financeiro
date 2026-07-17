import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { Dropzone } from './ui/Dropzone'
import { ResultadoImport } from './ui/ResultadoImport'
import { Auth } from './ui/Auth'
import { loadTextItems, PdfProtegidoError } from './pdf/load'
import { buildLines } from './pdf/lines'
import { pareceDigitalizado } from './pdf/extract'
import { parse, ParserNaoImplementadoError } from './parsers'
import { validar } from './validate/checksum'
import { neon, neonConfigurado } from './lib/neon'
import { salvarDocumento } from './persist/salvar'
import type { DocKind } from './pdf/detect'
import type { ParseResult } from './parsers/types'

type Estado =
  | { fase: 'vazio' }
  | { fase: 'lendo' }
  | { fase: 'pronto'; kind: DocKind; result: ParseResult; bytes: ArrayBuffer; nome: string }

export default function App() {
  const [estado, setEstado] = useState<Estado>({ fase: 'vazio' })
  const [logado, setLogado] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function checarSessao() {
    if (!neon) return
    const { data } = await neon.auth.getSession()
    setLogado(Boolean(data?.session))
  }

  useEffect(() => {
    checarSessao()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function importar(file: File) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      toast.error('Isso não parece um PDF.')
      return
    }
    setEstado({ fase: 'lendo' })
    try {
      const bytes = await file.arrayBuffer()
      const items = await loadTextItems(new File([bytes], file.name, { type: file.type }))
      if (pareceDigitalizado(items)) {
        toast.error('PDF digitalizado — ainda não sei ler imagem, só texto.')
        setEstado({ fase: 'vazio' })
        return
      }
      const lines = buildLines(items)
      const { kind, result } = parse(lines)
      const v = validar(result)
      setEstado({ fase: 'pronto', kind, result, bytes, nome: file.name })

      if (v.status === 'confere') {
        toast.success(`${v.contagem} lançamentos — bate com o banco ao centavo.`)
      } else if (v.status === 'sem-gabarito') {
        toast.warning(`${v.contagem} lançamentos lidos, sem total para conferir.`)
      } else {
        toast.error('O total lido não fechou com o do banco. Confira antes de salvar.')
      }
    } catch (err) {
      setEstado({ fase: 'vazio' })
      if (err instanceof PdfProtegidoError) toast.error('PDF protegido por senha.')
      else if (err instanceof ParserNaoImplementadoError) toast.warning(err.message + '. Em breve.')
      else toast.error('Não consegui ler este arquivo.')
    }
  }

  async function salvar() {
    if (estado.fase !== 'pronto') return
    setSalvando(true)
    try {
      const r = await salvarDocumento(estado.result, estado.kind, estado.bytes, estado.nome)
      if (r.status === 'salvo') {
        toast.success(
          `Salvo: ${r.inseridas} novos lançamentos` +
            (r.jaExistiam > 0 ? `, ${r.jaExistiam} já existiam.` : '.'),
        )
      } else if (r.status === 'documento-duplicado') {
        toast.warning(
          `Este documento já foi importado em ${new Date(r.importadoEm).toLocaleDateString('pt-BR')}.`,
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  // Com Neon configurado e sem login → tela de entrar.
  const precisaLogin = neonConfigurado && !logado

  return (
    <div className="grao min-h-dvh">
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-carvao-800)',
            border: '1px solid var(--color-carvao-700)',
            color: 'var(--color-tinta)',
          },
        }}
      />

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <header className="mb-12 flex items-start justify-between gap-4">
          <div>
            <p className="tabular text-[11px] uppercase tracking-[0.35em] text-tinta-tenue">
              Controle Financeiro
            </p>
            <h1 className="mt-4 font-display text-4xl leading-[1.05] text-tinta sm:text-5xl">
              Importe o PDF.
              <br />
              <span className="text-tinta-fraca">Veja para onde o dinheiro foi.</span>
            </h1>
          </div>
          {logado && neon && (
            <button
              onClick={async () => {
                await neon?.auth.signOut()
                setLogado(false)
              }}
              className="tabular shrink-0 text-[11px] uppercase tracking-widest text-tinta-tenue hover:text-tinta"
            >
              Sair
            </button>
          )}
        </header>

        {precisaLogin ? (
          <Auth onAutenticado={checarSessao} />
        ) : estado.fase !== 'pronto' ? (
          <Dropzone onArquivo={importar} ocupado={estado.fase === 'lendo'} />
        ) : (
          <ResultadoImport
            kind={estado.kind}
            result={estado.result}
            podeSalvar={logado}
            salvando={salvando}
            onSalvar={salvar}
            onLimpar={() => setEstado({ fase: 'vazio' })}
          />
        )}

        <footer className="mt-16 flex items-center gap-3">
          <span className="h-px flex-1 bg-carvao-800" />
          <p className="tabular text-[10px] uppercase tracking-widest text-tinta-tenue">
            {neonConfigurado
              ? 'Lido no navegador · só a transação é salva, nunca o PDF'
              : 'Lido no navegador · nada sai deste computador'}
          </p>
          <span className="h-px flex-1 bg-carvao-800" />
        </footer>
      </main>
    </div>
  )
}
