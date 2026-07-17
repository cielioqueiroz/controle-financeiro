/** Gera fixtures JSON anonimizados a partir dos PDFs reais.
 *
 *  Os PDFs contêm CPF, agência, conta e nomes de terceiros, e o histórico
 *  do git é permanente. Mas o parser consome TextItem[], não o PDF — então
 *  o fixture é um dump desses items com as coordenadas intactas e os dados
 *  pessoais trocados. Testa exatamente a mesma coisa, sem expor nada.
 *
 *  Uso: npm run fixtures -- <pasta-com-os-pdfs>
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { extractFromDocument } from '../src/pdf/extract'
import type { TextItem } from '../src/pdf/types'

const require = createRequire(import.meta.url)

const ENTRADAS = [
  { arquivo: 'BradescoCartoes14-07-2026-17-40-28.pdf', saida: 'bradesco-fatura' },
  { arquivo: 'extratoBradescoJunho.pdf', saida: 'bradesco-extrato' },
  { arquivo: 'NuBank_extratoConta.pdf', saida: 'nubank-extrato' },
  { arquivo: 'Nubank_faturaCartao.pdf', saida: 'nubank-fatura' },
]

/** Substituições literais, aplicadas na ordem. As mais longas vêm antes
 *  para não deixar sobra: "JACIELIO DA SILVA QUEIROZ" precisa casar antes
 *  de "Jacielio". Preservam o comprimento sempre que possível, já que o
 *  Bradesco trunca nomes em ~26 chars e o parser depende disso. */
const SUBSTITUICOES: Array<[RegExp, string]> = [
  [/JACIELIO DA SILVA QUEIROZ/g, 'MARIA APARECIDA SANTOSS'],
  [/JACIELIO DA SILVA QUE/g, 'MARIA APARECIDA SANTO'],
  [/JACIELIO DA SILVA QU/g, 'MARIA APARECIDA SANT'],
  [/Jacielio da Silva Queiroz/g, 'Maria Aparecida Santoss'],
  [/Jacielio S Queiroz/g, 'Maria A Santoss'],
  [/Jacielio/g, 'Mariaxxx'],
  [/JACIELIO/g, 'MARIAXXX'],
  [/Jacilene Queiroz de Carvalho/g, 'Joaninha Ferreira de Souza'],
  [/DOUGLAS LEITE CAVALCA/g, 'ROBERTO ALVES PEREIR'],
  [/ISRAEL LEITE CAVALCAN/g, 'FERNANDO ALVES PEREL'],
  [/Solange Silva Nunes d/g, 'Beatriz Costa Lima da'],
  [/JUSCELINO PEREIRA DA/g, 'ANTONIO MACHADO SOU'],
  [/SUSLEY B RIBEIRO AIRE/g, 'CARLA M TEIXEIRA NUNE'],
  [/DEIVIDY CARDOSO FERRE/g, 'RICARDO MENDES BARBO'],
  [/Maria Juliana Andrade Chagas/g, 'Luciana Ramos Pinto Silvaxx'],
  [/Educandario Meninopol/g, 'Instituto Aprendermai'],
  [/JCJR ORTOPEDIA E SAUD/g, 'ABCD ORTOPEDIA E CLIN'],
  [/Tathiana Braz/g, 'Cristiane Melo'],
  [/TATHIANA BRAZ/g, 'CRISTIANE MELO'],
  [/•••\.127\.464-••/g, '•••.999.888-••'],
  [/127\.464/g, '999.888'],
  [/•••\.007\.828-••/g, '•••.111.222-••'],
  [/4066 XXXX XXXX 5164/g, '4111 XXXX XXXX 9999'],
  [/74217157-1/g, '99887766-5'],
  [/60811175-4/g, '11122233-4'],
  [/4750-3/g, '1234-5'],
  [/4750-/g, '1234-'],
  [/168011852160/g, '999000111222'],
  [/168 01185 2160/g, '999 00011 1222'],
  [/8304/g, '7777'],
  [/\b698\b/g, '111'],
  [/00200000406655999845516420260617202606280000/g, '00200000411155999999999920260617202606280000'],
  [/1FP005VPC103PF/g, '1XX000XXX000XX'],
]

/** Substituições por item INTEIRO. O Bradesco fatia o nome do titular em
 *  items separados no bloco de endereço ("MARIAXXX" / "DA" / "SILVA" /
 *  "QUEIROZ"), que as regexes acima não pegam.
 *
 *  Precisa ser match exato: trocar "SILVA" por conteúdo destruiria o
 *  estabelecimento "A M DA SILVA COMERCIO", que é dado legítimo do teste. */
const EXATOS: Record<string, string> = {
  QUEIROZ: 'SANTOSS',
  SILVA: 'APARECIDA',
  Queiroz: 'Santoss',
}

function anonimizar(items: TextItem[]): TextItem[] {
  return items.map((item) => {
    const exato = EXATOS[item.text.trim()]
    if (exato !== undefined) return { ...item, text: exato }

    let texto = item.text
    for (const [padrao, troca] of SUBSTITUICOES) {
      texto = texto.replace(padrao, troca)
    }
    return { ...item, text: texto }
  })
}

/** Termos que não podem sobrar em nenhum fixture. */
const PROIBIDOS = [
  /jacielio/i,
  /jacilene/i,
  /queiroz/i,
  /127\.464/,
  /74217157/,
  /4750-3/,
  /douglas/i,
  /israel/i,
  /solange/i,
  /juscelino/i,
  /susley/i,
  /deividy/i,
  /tathiana/i,
  /8304/,
  /5164/,
]

function auditar(nome: string, items: TextItem[]): string[] {
  const texto = items.map((i) => i.text).join(' ')
  return PROIBIDOS.filter((re) => re.test(texto)).map(
    (re) => `${nome}: ainda contém ${re}`,
  )
}

async function main() {
  const pasta = process.argv[2]
  if (!pasta) {
    console.error('Uso: npm run fixtures -- <pasta-com-os-pdfs>')
    process.exit(1)
  }

  const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs')
  await mkdir('tests/fixtures', { recursive: true })

  const problemas: string[] = []

  for (const { arquivo, saida } of ENTRADAS) {
    const buffer = await readFile(join(pasta, arquivo))
    const data = new Uint8Array(buffer)

    const doc = await pdfjs.getDocument({ data, useSystemFonts: false }).promise
    const items = await extractFromDocument(doc)
    const anonimos = anonimizar(items)

    problemas.push(...auditar(saida, anonimos))

    const destino = `tests/fixtures/${saida}.items.json`
    await writeFile(destino, JSON.stringify(anonimos, null, 2))
    console.log(`${destino}: ${anonimos.length} items, ${doc.numPages} páginas`)
  }

  if (problemas.length > 0) {
    console.error('\nAUDITORIA FALHOU — dados pessoais sobraram:')
    for (const p of problemas) console.error(`  ${p}`)
    process.exit(1)
  }

  console.log('\nAuditoria OK: nenhum dado pessoal nos fixtures.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
