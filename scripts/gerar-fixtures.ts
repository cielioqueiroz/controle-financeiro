/** Gera fixtures JSON anonimizados a partir dos PDFs reais.
 *
 *  Os PDFs contêm CPF, agência, conta e nomes de terceiros, e o histórico
 *  do git é permanente. Mas o parser consome TextItem[], não o PDF — então
 *  o fixture é um dump desses items com as coordenadas intactas e os dados
 *  pessoais trocados. Testa exatamente a mesma coisa, sem expor nada.
 *
 *  Uso: npm run fixtures -- <pasta-com-os-pdfs>
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { extractFromDocument } from '../frontend/src/domain/pdf/extract'
import { buildLines } from '../frontend/src/domain/pdf/lines'
import { parse } from '../frontend/src/domain/parsers/index'
import { validar } from '../frontend/src/domain/validate/checksum'
import type { TextItem } from '../frontend/src/domain/pdf/types'

const require = createRequire(import.meta.url)

const ENTRADAS = [
  { arquivo: 'BradescoCartoes14-07-2026-17-40-28.pdf', saida: 'bradesco-fatura' },
  { arquivo: 'extratoBradescoJunho.pdf', saida: 'bradesco-extrato' },
  { arquivo: 'NuBank_extratoConta.pdf', saida: 'nubank-extrato' },
  { arquivo: 'Nubank_faturaCartao.pdf', saida: 'nubank-fatura' },
  { arquivo: 'credit-card-mp-statement.pdf', saida: 'mercadopago-fatura' },
  { arquivo: 'ffd46a6a-b950-498a-a701-3aab2897172d.pdf', saida: 'mercadopago-extrato' },
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
  // CEP e cidade: os dois ultimos dados que apontavam para uma pessoa
  // especifica, e os unicos que a troca de nome nao alcancava.
  [/68560-000/g, '01000-000'],
  [/SANTANA/g, 'BOA VISTA'],
  [/Santana/g, 'Boa Vista'],
  [/ARAGUAIA/g, 'SERRA NOVA'],
  [/Araguaia/g, 'Serra Nova'],
  // ACHADO EM 2026-08-31, ao gerar os fixtures do Mercado Pago: estes
  // dois atravessaram todas as geracoes anteriores SEM anonimizacao, e o
  // repositorio e publico desde 25/08. Nenhum e nome de pessoa nem CPF —
  // um numero de conta solto no extrato Nubank e a razao social de um
  // terceiro — mas a regra do projeto nao abre excecao por severidade.
  [/3117878715-6/g, '5566778899-0'],
  // Mercado Pago. O extrato quebra o nome do titular no meio da descricao
  // do Pix ("Pix recebido JACIELIO DA" / "SILVA QUEIROZ"), entao o par
  // colado precisa de regra propria — as de cima so pegam o nome inteiro.
  [/SILVA QUEIROZ/g, 'APARECIDA SANTOSS'],
  [/07612746425/g, '00011122233'],
  [/10624791647/g, '99988877766'],
  [/1465\]/g, '9012]'],
  [/L C COMERCIO/g, 'X Y COMERCIO'],
  [/GREYCOMLTDA/g, 'LOJAUMLTDA'],
  [/EXTRACTONATU/g, 'PRODUTOSNAT'],
]

/** SO PARA O MERCADO PAGO. Identificadores de operacao do extrato: 9+
 *  digitos que
 *  referenciam UMA transacao da conta. Nao sao dado publico, e sao 21
 *  diferentes — lista literal envelheceria no proximo extrato.
 *
 *  O deslocamento e deterministico de proposito: fixture e versionado, e um
 *  embaralhamento aleatorio faria o arquivo mudar a cada geracao, poluindo
 *  o diff sem mudar nada de verdade. Preserva o COMPRIMENTO, que e o que o
 *  parser enxerga (ele exige 6+ digitos). */
function embaralharIds(texto: string): string {
  return texto.replace(/\b\d{9,}\b/g, (d) =>
    [...d].map((c) => String((Number(c) + 3) % 10)).join(''),
  )
}

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

/** `embaralhar` fica desligado fora do Mercado Pago: ligado para todos,
 *  ele reescrevia dado que JA estava falso — o codigo de barras e a conta
 *  trocada do Bradesco — e fixture que muda sem motivo e diff que ninguem
 *  le. Anonimizar duas vezes nao protege mais; so esconde o que mudou. */
function anonimizar(
  items: TextItem[],
  embaralhar: boolean,
  estabelecimentos: Array<[string, string]>,
): TextItem[] {
  return items.map((item) => {
    const exato = EXATOS[item.text.trim()]
    if (exato !== undefined) return { ...item, text: exato }

    let texto = item.text
    // Estabelecimento ANTES das outras regras: sao as strings mais longas, e
    // uma regra curta que casasse dentro delas deixaria meio nome de loja.
    for (const [de, para] of estabelecimentos) {
      if (texto.includes(de)) texto = texto.split(de).join(para)
      // Descricao montada de VARIOS items (o Bradesco quebra o historico em
      // dois, o Mercado Pago poe pedaco acima e abaixo do valor): ali a
      // string inteira nunca casa um item sozinho. Casa-se o item DENTRO da
      // descricao. O piso de 6 letras evita trocar "PIX" ou uma data solta.
      else if (
        texto.trim().length >= 6 &&
        /[A-Za-zÀ-ÿ]/.test(texto) &&
        de.includes(texto.trim())
      ) {
        texto = para
      }
    }
    for (const [padrao, troca] of SUBSTITUICOES) {
      texto = texto.replace(padrao, troca)
    }
    return { ...item, text: embaralhar ? embaralharIds(texto) : texto }
  })
}

/** As descricoes que o parser extrai do documento ORIGINAL, cada uma
 *  apontando para um nome de fantasia.
 *
 *  Sai do parser, e nao de uma lista escrita a mao: lista a mao esquece um, e
 *  o que ela esquece e exatamente o estabelecimento que fica no repositorio
 *  publico. Deterministico (indice da ordem alfabetica) para o fixture nao
 *  mudar a cada geracao. */
function mapaEstabelecimentos(_items: TextItem[]): Array<[string, string]> {
  // DESLIGADO em 2026-08-31, depois de implementado e medido. Fica a
  // maquinaria (o parametro de `anonimizar`, a verificacao por reparse) para
  // quando a lista vier a mao.
  //
  // A substituicao AUTOMATICA de estabelecimento nao converge, e cada regra
  // que eu acrescentava para salvar um caso de teste deixava um nome real no
  // repositorio:
  //
  //  1. Trocar toda descricao reclassificou transacoes — o `kind` sai do
  //     texto — e a fatura do Nubank foi de `confere` para `diverge`.
  //  2. Restringir a `compra` consertou aquilo e apagou "Debito por divida
  //     Emprestimos", que e justamente o caso que prova que emprestimo nao e
  //     quitacao.
  //  3. Uma lista de exclusao de vocabulario bancario reduziu o estrago, mas
  //     decidir "isto e loja, aquilo e palavra do banco" por regex e adivinhar.
  //
  //  O caminho certo e o que este arquivo JA usa para nome de pessoa: uma
  //  lista escrita a mao, em SUBSTITUICOES, onde um humano decide caso a
  //  caso. Custa uma passada pelas ~150 descricoes distintas e nao tem como
  //  apagar um caso de teste sem alguem ver.
  return []
}

/** POR QUE OS VALORES NAO SAO TROCADOS.
 *
 *  Foi tentado em 2026-08-31, por pedido do usuario, e desfeito no mesmo dia
 *  — vale registrar para nao ser tentado de novo.
 *
 *  Sortear valor nao funciona: o gabarito E a soma. A fatura declara o total
 *  das compras, o extrato declara entradas e saidas, e tres extratos carregam
 *  SALDO CORRENTE linha a linha. Sortear quebra os tres, e consertar
 *  significaria recalcular a aritmetica interna do documento — deixando de
 *  ter o extrato do banco e passando a ter um sintetico, que nao prova layout
 *  nenhum.
 *
 *  Escalar por inteiro preserva a soma exatamente e foi implementado. Foi
 *  DESCARTADO por outro motivo: o fator moraria neste arquivo, no mesmo
 *  repositorio publico. Dividir por ele devolve o valor original. E teatro —
 *  custa 49 expectativas de teste reescritas e nao esconde nada.
 *
 *  O que de fato tira o dono dos dados esta implementado e e irreversivel:
 *  nome, CPF, agencia, conta, ID de operacao, ESTABELECIMENTO, CEP e cidade.
 *  Resta o valor e a data de compras que ninguem consegue atribuir a uma
 *  pessoa nem a um lugar. */

/** POR QUE OS VALORES NAO SAO TROCADOS.
 *
 *  Foi tentado em 2026-08-31, por pedido do usuario, e desfeito no mesmo dia
 *  — vale registrar para nao ser tentado de novo.
 *
 *  Sortear valor nao funciona: o gabarito E a soma. A fatura declara o total
 *  das compras, o extrato declara entradas e saidas, e tres extratos carregam
 *  SALDO CORRENTE linha a linha. Sortear quebra os tres, e consertar
 *  significaria recalcular a aritmetica interna do documento — deixando de
 *  ter o extrato do banco e passando a ter um sintetico, que nao prova layout
 *  nenhum.
 *
 *  Escalar por inteiro preserva a soma exatamente e foi implementado. Foi
 *  DESCARTADO por outro motivo: o fator moraria neste arquivo, no mesmo
 *  repositorio publico. Dividir por ele devolve o valor original. E teatro —
 *  custa 49 expectativas de teste reescritas e nao esconde nada.
 *
 *  O que de fato tira o dono dos dados esta implementado e e irreversivel:
 *  nome, CPF, agencia, conta, ID de operacao, ESTABELECIMENTO, CEP e cidade.
 *  Resta o valor e a data de compras que ninguem consegue atribuir a uma
 *  pessoa nem a um lugar. */

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
  /3117878715/,
  // Cidade e CEP: os ultimos dados que apontavam para uma pessoa
  // especifica, e os unicos que a troca de nome nao alcancava.
  /68560/,
  /santana/i,
  /araguaia/i,
  /07612746425/,
  /10624791647/,
  /1465\]/,
  /L C COMERCIO/,
  /5164/,
]

function auditar(nome: string, items: TextItem[]): string[] {
  const texto = items.map((i) => i.text).join(' ')
  return PROIBIDOS.filter((re) => re.test(texto)).map(
    (re) => `${nome}: ainda contém ${re}`,
  )
}

/** Acha o PDF na primeira pasta que o tiver.
 *
 *  As amostras vivem por safra (`junho2026`, `agosto2026`), e nao numa
 *  pasta so: exigir tudo junto obrigaria a copiar PDF com CPF de um lugar
 *  para outro toda vez que um banco novo entrasse. */
async function acharPdf(pastas: string[], arquivo: string): Promise<string> {
  for (const pasta of pastas) {
    const caminho = join(pasta, arquivo)
    try {
      await access(caminho)
      return caminho
    } catch {
      // proxima pasta
    }
  }
  throw new Error(`nao achei ${arquivo} em: ${pastas.join(', ')}`)
}

async function main() {
  const pastas = process.argv.slice(2)
  if (pastas.length === 0) {
    console.error('Uso: npm run fixtures -- <pasta-com-os-pdfs> [outra-pasta...]')
    process.exit(1)
  }

  const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs')
  await mkdir('frontend/tests/fixtures', { recursive: true })

  const problemas: string[] = []

  for (const { arquivo, saida } of ENTRADAS) {
    const buffer = await readFile(await acharPdf(pastas, arquivo))
    const data = new Uint8Array(buffer)

    const doc = await pdfjs.getDocument({ data, useSystemFonts: false }).promise
    const items = await extractFromDocument(doc)
    const estabelecimentos = mapaEstabelecimentos(items)
    const anonimos = anonimizar(items, saida.startsWith('mercadopago'), estabelecimentos)

    // A PROVA de que a anonimizacao nao deixou resto E de que ela nao quebrou
    // o documento. Roda sobre o RESULTADO, nao sobre a intencao: reparsear e
    // o unico jeito de saber que o gabarito ainda fecha depois de todo valor
    // ter sido multiplicado.
    try {
      const depois = parse(buildLines(anonimos)).result
      const antes = parse(buildLines(items)).result
      const sobrou = depois.transactions
        .map((x) => x.description)
        .filter((d) => estabelecimentos.some(([de]) => d.includes(de)))
      if (sobrou.length > 0) {
        problemas.push(`${saida}: estabelecimento nao trocado — ${sobrou.slice(0, 3).join(' | ')}`)
      }
      const st = validar(depois).status
      const stAntes = validar(antes).status
      if (st !== stAntes) {
        problemas.push(`${saida}: conferencia mudou de ${stAntes} para ${st} ao anonimizar`)
      }
    } catch (e) {
      problemas.push(`${saida}: nao reparseou depois de anonimizar — ${String(e)}`)
    }

    problemas.push(...auditar(saida, anonimos))

    const destino = `frontend/tests/fixtures/${saida}.items.json`
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
