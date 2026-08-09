"""Mede a Content-Security-Policy do vercel.json contra o app de verdade.

Uso:
    npm run build
    python scripts/medir-csp.py                      # jornada da tela de acesso
    python scripts/medir-csp.py --pdf caminho.pdf    # + importa um PDF de verdade

POR QUE ESTE SCRIPT EXISTE. A CSP completa ficou de fora em 2026-07-29 por um
motivo registrado: `vercel.json` NAO vale no `vite preview` nem no dev server,
entao a politica so seria exercida depois de publicada — e o jeito de descobrir
que ela quebrou algo seria o app quebrado no ar. Este script fecha esse buraco:
sobe um servidor estatico que devolve os headers LIDOS DO PROPRIO vercel.json
(nao uma copia — copia diverge) e dirige o Chromium contra o build de producao.

DUAS METADES, e a segunda e a que importa:

1. JORNADA — usa o app e coleta `securitypolicyviolation`. Prova que a politica
   nao quebra o que existe.
2. SONDAS — cada classe de recurso e tentada de proposito, com o resultado
   ESPERADO declarado. Metade delas espera BLOQUEIO: script inline injetado,
   eval, origem estranha, <base> externa. Sem esses controles negativos, uma
   politica escrita errado (um `default-src *` perdido, um header que nem
   chegou) passaria com zero violacoes e nota maxima — e o verde nao significaria
   nada. Sonda que passa dos dois jeitos e pior que nenhuma.

O QUE ELE NAO ALCANCA: a jornada logada (o painel, os graficos, o relatorio)
depende de sessao no Neon, e a senha da conta de teste nao e versionada. As
superficies dessas telas, porem, sao as mesmas medidas aqui — chunk dinamico,
blob:, canvas, estilo inline — e a sonda do relatorio (`gerarRelatorioPdf`)
exercita o caminho do jsPDF importando o chunk construido direto do /assets.
"""

from __future__ import annotations

import argparse
import http.server
import json
import mimetypes
import re
import socket
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent

# Origem inexistente de proposito: `.invalid` e reservada por RFC 2606 e nunca
# resolve. A CSP e avaliada ANTES do DNS, entao a sonda negativa registra a
# violacao sem que nada saia da maquina. Se um dia deixar de registrar, o
# pedido morre no DNS em vez de vazar para um host de terceiro.
ESTRANHA = 'https://csp-nao-deve-alcancar.invalid'

# A UNICA violacao esperada no uso normal, e o motivo pelo qual ela nao vira
# `'unsafe-eval'` na politica.
#
# Quem dispara e o zod (node_modules/zod/v4/core/util.js:142, `allowsEval`),
# que chega ate aqui por @neondatabase/neon-js -> better-auth. E uma SONDA DE
# CAPACIDADE: `try { new Function('') } catch { return false }`, memoizada. Sob
# CSP ela responde "nao posso" e o zod passa a validar pelo caminho
# interpretado em vez do compilado — que e exatamente o mesmo caminho que ele
# usa em Cloudflare Workers, testado pelo proprio zod (a linha acima do try
# checa o userAgent da Cloudflare).
#
# Liberar `'unsafe-eval'` por causa disto seria devolver ao atacante a primitiva
# mais valiosa da lista para comprar de volta uma otimizacao de validacao que
# ninguem mede. A trava que impede este perdao de virar um cheque em branco e a
# jornada: ela exige que o fluxo de login RESPONDA depois do bloqueio.
ESPERADAS = [
    {
        'd': 'script-src',
        'uri': 'eval',
        'por que': 'zod allowsEval (via neon-js/better-auth): sonda de capacidade em try/catch',
    }
]

# Coleta de violacoes. Roda antes de qualquer script da pagina (add_init_script)
# porque a primeira violacao possivel — o <script> inline do tema, no <head> —
# acontece antes de o React existir.
SONDA_INICIAL = """
window.__csp = [];
const anota = (e) => {
  const v = {
    d: e.effectiveDirective || e.violatedDirective,
    uri: e.blockedURI,
    src: e.sourceFile,
    linha: e.lineNumber,
    col: e.columnNumber,
    // `sample` traz os primeiros caracteres do codigo recusado. E o unico
    // jeito de identificar um eval indireto: o minificador nao deixa a
    // palavra "eval" no bundle, entao procurar por ela no arquivo nao acha
    // nada (foi o que aconteceu na primeira medicao).
    amostra: e.sample,
  };
  // O mesmo evento chega aqui duas vezes (window e document, ambos em
  // captura). Sem esta dedupe cada violacao apareceria dobrada no relatorio
  // e a contagem mentiria.
  const chave = JSON.stringify(v);
  if (!window.__csp.some((x) => JSON.stringify(x) === chave)) window.__csp.push(v);
};
window.addEventListener('securitypolicyviolation', anota, true);
document.addEventListener('securitypolicyviolation', anota, true);
"""


def porta_livre() -> int:
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def headers_do_vercel() -> list[tuple[str, str]]:
    """Os headers que o vercel.json aplica a TODO caminho.

    Ler do arquivo real e o ponto do exercicio: uma copia da politica dentro
    deste script mediria uma politica que nao vai ao ar.
    """
    cfg = json.loads((RAIZ / 'vercel.json').read_text(encoding='utf-8'))
    saida: list[tuple[str, str]] = []
    for bloco in cfg.get('headers', []):
        if bloco.get('source') == '/(.*)':
            for h in bloco['headers']:
                saida.append((h['key'], h['value']))
    if not saida:
        sys.exit('vercel.json: nenhum bloco de headers com source "/(.*)".')
    return saida


def headers_publicados(base: str) -> str:
    """A CSP que o site no ar realmente manda."""
    from urllib.request import urlopen

    with urlopen(base + '/', timeout=30) as r:
        csp = r.headers.get('Content-Security-Policy')
    if not csp:
        sys.exit(f'{base} nao manda Content-Security-Policy — a Vercel nao aplicou o header.')
    return csp


def caminhos_de_infra(base: str) -> list[str]:
    """Os caminhos que o rewrite de SPA nao pode transformar em 200.

    Devolve a lista dos que responderam 200: um `/.env` que devolve o HTML do
    app faz um scanner registrar o caminho como existente.
    """
    from urllib.error import HTTPError
    from urllib.request import urlopen

    ruins = []
    for caminho in ['/.env', '/.env.local', '/.git/config', '/scripts/diagnostico.ts']:
        try:
            with urlopen(base + caminho, timeout=30) as r:
                if r.status == 200:
                    ruins.append(caminho)
        except HTTPError:
            pass
        except OSError:
            pass
    return ruins


def servidor(dist: Path, extras: list[tuple[str, str]]) -> tuple[http.server.ThreadingHTTPServer, int]:
    # O .mjs do worker do pdf.js sai como application/octet-stream no mapa
    # padrao do Python em Windows, e ai o navegador recusa o modulo por tipo
    # MIME — falha que se disfarcaria de violacao de CSP no relatorio.
    mimetypes.add_type('text/javascript', '.mjs')
    mimetypes.add_type('text/javascript', '.js')
    mimetypes.add_type('font/woff2', '.woff2')

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(dist), **kw)

        def end_headers(self):
            for chave, valor in extras:
                self.send_header(chave, valor)
            super().end_headers()

        def do_GET(self):  # noqa: N802 (nome da stdlib)
            # Mesmo rewrite de SPA do vercel.json: caminho sem extensao que nao
            # existe em disco cai no index.html. Sem isto, /faturas daria 404 e
            # a jornada mediria a pagina de erro.
            caminho = self.path.split('?')[0]
            if not (dist / caminho.lstrip('/')).exists() and '.' not in Path(caminho).name:
                self.path = '/index.html'
            super().do_GET()

        def log_message(self, *a):
            pass

    porta = porta_livre()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', porta), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, porta


def caminho_worker(dist: Path) -> str | None:
    achados = sorted((dist / 'assets').glob('pdf.worker.min-*.mjs'))
    return f'/assets/{achados[-1].name}' if achados else None


def caminho_relatorio(dist: Path) -> str | None:
    achados = sorted((dist / 'assets').glob('relatorio-pdf-*.js'))
    return f'/assets/{achados[-1].name}' if achados else None


def origens_neon(dist: Path) -> list[str]:
    """As origens do Neon assadas no bundle (as VITE_* viram texto no build).

    Ler do bundle, e nao do .env.local, e de proposito: o que o navegador vai
    chamar e o que esta no arquivo servido. Se o build foi feito sem as
    variaveis, nao ha o que sondar — e a jornada tambem cai na tela de
    importacao em vez da de acesso, coerentemente.
    """
    achadas: list[str] = []
    for js in sorted((dist / 'assets').glob('*.js')):
        texto = js.read_text(encoding='utf-8', errors='ignore')
        for o in re.findall(r'https://[a-z0-9.-]+\.neon\.tech(?:/[a-z0-9/_-]*)?', texto):
            if o not in achadas:
                achadas.append(o)
    return achadas


SONDAS_JS = """
async ({ estranha, worker, relatorio, dataApi, auth }) => {
  const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
  const saida = [];

  async function sonda(nome, esperado, fn) {
    const antes = window.__csp.length;
    let erro = null;
    try { await fn(); } catch (e) { erro = String((e && e.message) || e); }
    await dorme(200);
    const novas = window.__csp.slice(antes);
    saida.push({
      nome,
      esperado,
      bloqueado: novas.length > 0,
      diretivas: novas.map((v) => v.d + ' <- ' + v.uri),
      erro,
    });
  }

  const buscar = (url) => fetch(url, { mode: 'no-cors' }).catch(() => {});

  // --- positivas: o app precisa que passem ---
  if (dataApi) await sonda('connect: Data API do Neon', 'passa', () => buscar(dataApi + '/documents'));
  if (auth) await sonda('connect: Auth do Neon', 'passa', () => buscar(auth + '/get-session'));
  await sonda('connect: mesma origem (o backend da fatia 1b)', 'passa', () => buscar('/api/ping'));

  await sonda('img: data: (o jsPDF desenha em canvas)', 'passa', () =>
    new Promise((r) => {
      const i = new Image();
      i.onload = i.onerror = r;
      i.src =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }),
  );

  await sonda('style: tag <style> injetada (o sonner injeta a dele)', 'passa', () => {
    const s = document.createElement('style');
    s.textContent = '.csp-sonda-estilo{color:rgb(1,2,3)}';
    document.head.append(s);
  });

  await sonda('style: atributo style="" (React e motion escrevem assim)', 'passa', () => {
    const d = document.createElement('div');
    d.setAttribute('style', 'color:rgb(1,2,3)');
    document.body.append(d);
    if (getComputedStyle(d).color !== 'rgb(1, 2, 3)') throw new Error('atributo style nao aplicou');
    d.remove();
  });

  if (worker) {
    await sonda('worker: mesma origem (o pdf.js roda o parsing em worker)', 'passa', () => {
      const w = new Worker(worker, { type: 'module' });
      w.terminate();
    });
    await sonda('worker: blob: (fallback do pdf.js)', 'passa', () => {
      const url = URL.createObjectURL(new Blob(['self.close()'], { type: 'text/javascript' }));
      const w = new Worker(url);
      w.terminate();
      URL.revokeObjectURL(url);
    });
  }

  if (relatorio) {
    await sonda('chunk dinamico + jsPDF: gera o relatorio de verdade', 'passa', async () => {
      const m = await import(relatorio);
      const blob = await m.gerarRelatorioPdf({
        periodoLabel: 'junho de 2026',
        agrupamento: 'Mes',
        geradoEm: new Date(),
        entradasCents: 5028118,
        saidasCents: 4101225,
        saldoPeriodoCents: 926893,
        saldos: [{ bank: 'nubank', balanceCents: 123456, date: '2026-06-30' }],
        categorias: [{ nome: 'Supermercado', valorCents: 91846, pct: 2.2 }],
      });
      if (!(blob instanceof Blob) || blob.size < 500) throw new Error('PDF vazio');
      // O download real: ancora com href blob:. E o passo que a CSP poderia
      // barrar sem ninguem notar ate alguem clicar em "Baixar PDF".
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sonda.pdf';
      document.body.append(a);
      URL.revokeObjectURL(a.href);
      a.remove();
    });
  }

  // --- negativas: se QUALQUER uma passar, a politica nao esta valendo ---
  await sonda('connect: origem estranha', 'bloqueia', () => buscar(estranha + '/x'));

  await sonda('script: inline injetado (o vetor de XSS)', 'bloqueia', () => {
    delete window.__cspInline;
    const s = document.createElement('script');
    s.text = 'window.__cspInline = true';
    document.head.append(s);
    s.remove();
    if (window.__cspInline) throw new Error('o script inline EXECUTOU');
  });

  await sonda('script: externo de origem estranha', 'bloqueia', () => {
    const s = document.createElement('script');
    s.src = estranha + '/x.js';
    document.head.append(s);
  });

  await sonda('script: eval', 'bloqueia', () => {
    const r = (0, eval)('1+1');
    if (r === 2) throw new Error('o eval EXECUTOU');
  });

  await sonda('img: origem estranha (canal de exfiltracao)', 'bloqueia', () => {
    const i = new Image();
    i.src = estranha + '/pixel.png';
  });

  await sonda('base-uri: <base> externa (sequestra todo caminho relativo)', 'bloqueia', () => {
    const b = document.createElement('base');
    b.href = estranha + '/';
    document.head.append(b);
    const sequestrou = document.baseURI.startsWith(estranha);
    b.remove();
    if (sequestrou) throw new Error('a <base> externa VALEU');
  });

  return saida;
}
"""

# form-action sai das sondas de cima porque, se NAO for bloqueado, o navegador
# navega para fora e leva a pagina junto — o resultado das sondas seguintes
# morreria com ela. Roda em aba propria, e o proprio "a URL mudou?" e a medida.
SONDA_FORM_JS = """
(estranha) => {
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = estranha + '/roubo';
  document.body.append(f);
  f.submit();
}
"""


def fontes_carregadas(page) -> list[str]:
    return page.evaluate("""
      () => Array.from(document.fonts)
        .filter((f) => f.status === 'loaded')
        .map((f) => f.family + ' ' + f.weight)
    """)


def jornada(page, base: str, pdf: Path | None) -> str:
    """Usa o app como um usuario usaria. Devolve qual tela foi exercida."""
    page.goto(base + '/', wait_until='networkidle')
    page.wait_for_timeout(700)

    # As fontes sao servidas do proprio dominio desde 2026-08-07 justamente
    # para caberem em `font-src 'self'`. Se a diretiva estiver errada elas nao
    # carregam e a pagina cai na fonte do sistema — degradacao silenciosa, que
    # nenhuma contagem de violacao denunciaria sozinha.
    page.wait_for_function('document.fonts.status === "loaded"', timeout=15000)

    tema = page.locator('button[aria-label^="Mudar para tema"]')
    if tema.count():
        tema.first.click()
        page.wait_for_timeout(300)
        tema.first.click()
        page.wait_for_timeout(300)

    email = page.locator('input[aria-label="E-mail"]')
    arquivo = page.locator('input[type="file"]')

    if email.count():
        # Uma tentativa de login com credencial errada: e o unico jeito de
        # provar o connect-src contra o Auth do Neon no caminho real (a sonda
        # prova a diretiva; isto prova a chamada que o SDK de fato faz).
        #
        # E e tambem a trava do perdao dado ao eval do zod (ver ESPERADAS): o
        # SDK inteiro valida resposta com zod, entao um toast de volta prova
        # que o caminho interpretado — o que sobra quando a CSP nega o
        # compilado — funciona ponta a ponta.
        email.first.fill('csp-sonda@exemplo.com')
        page.locator('input[aria-label="Senha"]').first.fill('senha-errada-de-proposito')
        page.get_by_role('button', name='Entrar', exact=True).last.click()
        page.wait_for_selector('[data-sonner-toast]', timeout=15000)
        resposta = page.locator('[data-sonner-toast]').first.inner_text().replace('\n', ' | ')
        return f'tela de acesso — login recusado, e o app respondeu: "{resposta}"'

    if arquivo.count() and pdf:
        arquivo.first.set_input_files(str(pdf))
        # O pdf.js sobe o worker, baixa o chunk de ~400 kB e le o documento.
        # Esperar o toast — e nao um timeout cego — e o que separa "a CSP nao
        # quebrou nada" de "nada aconteceu". Com o worker barrado a leitura
        # falha, e sem esta asseveracao a medicao passaria igual, com zero
        # violacao registrada, porque o erro moraria no console e nao na CSP.
        page.wait_for_selector('[data-sonner-toast]', timeout=45000)
        resposta = page.locator('[data-sonner-toast]').first.inner_text().replace('\n', ' | ')
        if re.search(r'[Nn]ão consegui|falha|erro', resposta):
            raise RuntimeError(f'a importacao falhou sob a CSP: "{resposta}"')
        return f'importacao de {pdf.name} — o app leu: "{resposta}"'

    return 'carga inicial'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dist', default=str(RAIZ / 'frontend' / 'dist'))
    ap.add_argument('--pdf', help='PDF real para exercitar o worker do pdf.js')
    ap.add_argument(
        '--url',
        help='mede um site JA PUBLICADO em vez do dist local. E a unica forma '
        'de provar que a Vercel entrega os headers — o vercel.json e uma '
        'intencao ate a borda dela aplicar.',
    )
    args = ap.parse_args()

    dist = Path(args.dist)
    srv = None

    if args.url:
        base = args.url.rstrip('/')
        # A CSP medida aqui e a que o servidor manda, nao a que o repositorio
        # pede. Se as duas divergirem, e exatamente isso que se quer descobrir.
        csp = headers_publicados(base)
        print(f'Medindo o site publicado em {base}\n')
    else:
        if not (dist / 'index.html').exists():
            sys.exit(f'{dist} nao tem index.html — rode `npm run build` antes.')
        extras = headers_do_vercel()
        csp = next((v for k, v in extras if k.lower() == 'content-security-policy'), None)
        if not csp:
            sys.exit('vercel.json nao declara Content-Security-Policy.')
        srv, porta = servidor(dist, extras)
        base = f'http://127.0.0.1:{porta}'
        print(f'Servindo {dist} em {base} com os headers do vercel.json\n')

    print('CSP medida:')
    for parte in csp.split(';'):
        if parte.strip():
            print(f'  {parte.strip()}')
    print()

    pdf = Path(args.pdf) if args.pdf else None
    if pdf and not pdf.exists():
        sys.exit(f'PDF nao encontrado: {pdf}')

    origens = origens_neon(dist)
    data_api = next((o for o in origens if 'apirest' in o), None)
    auth_url = next((o for o in origens if 'neonauth' in o), None)

    falhas: list[str] = []
    console: list[str] = []

    with sync_playwright() as p:
        navegador = p.chromium.launch()
        ctx = navegador.new_context(viewport={'width': 1280, 'height': 800})
        ctx.add_init_script(SONDA_INICIAL)
        page = ctx.new_page()
        page.on(
            'console',
            lambda m: console.append(m.text)
            if re.search(r'Content Security Policy|Refused to', m.text)
            else None,
        )

        tela = jornada(page, base, pdf)
        violacoes_jornada = page.evaluate('window.__csp')

        print(f'JORNADA — {tela}')
        print(f'  fontes carregadas: {len(fontes_carregadas(page))}')
        inesperadas = []
        for v in violacoes_jornada:
            conhecida = next(
                (e for e in ESPERADAS if e['d'] == v['d'] and e['uri'] == v['uri']), None
            )
            if conhecida:
                print(f'  esperada  {v["d"]} <- {v["uri"]}  ({conhecida["por que"]})')
            else:
                print(f'  VIOLACAO  {v["d"]} <- {v["uri"]}  ({v.get("src")}:{v.get("linha")}:{v.get("col")})')
                if v.get('amostra'):
                    print(f'            amostra: {v["amostra"]}')
                inesperadas.append(v)
        if inesperadas:
            falhas.append(f'{len(inesperadas)} violacao(oes) inesperada(s) durante o uso normal')
        elif not violacoes_jornada:
            print('  nenhuma violacao')
        if not fontes_carregadas(page):
            falhas.append('nenhuma fonte carregou — font-src esta barrando o proprio dominio')
        print()

        # Os nomes dos chunks levam hash do conteudo, entao os do dist local
        # so valem contra o site publicado se for o MESMO build. Conferir a
        # existencia evita transformar "chunk de outro deploy" em falha de CSP.
        def existe(caminho: str | None) -> str | None:
            if not caminho or not args.url:
                return caminho
            return caminho if page.request.head(base + caminho).ok else None

        resultados = page.evaluate(
            SONDAS_JS,
            {
                'estranha': ESTRANHA,
                'worker': existe(caminho_worker(dist)),
                'relatorio': existe(caminho_relatorio(dist)),
                'dataApi': data_api,
                'auth': auth_url,
            },
        )

        # form-action, em aba propria (ver comentario da constante).
        page2 = ctx.new_page()
        page2.goto(base + '/', wait_until='domcontentloaded')
        page2.evaluate(SONDA_FORM_JS, ESTRANHA)
        page2.wait_for_timeout(1200)
        fugiu = not page2.url.startswith(base)
        resultados.append({
            'nome': 'form-action: POST para origem estranha',
            'esperado': 'bloqueia',
            'bloqueado': not fugiu,
            'diretivas': [] if fugiu else ['form-action'],
            'erro': None,
        })

        print('SONDAS')
        for r in resultados:
            ok = r['bloqueado'] == (r['esperado'] == 'bloqueia')
            # Erro que nao seja de rede, numa sonda positiva, e falha de verdade:
            # e a sonda dizendo "executei e o resultado saiu errado".
            grito = r['erro'] and 'Failed to fetch' not in (r['erro'] or '')
            if r['esperado'] == 'passa' and grito:
                ok = False
            marca = 'ok  ' if ok else 'FALHA'
            print(f'  [{marca}] {r["nome"]}  (esperado: {r["esperado"]})')
            if r['diretivas']:
                print(f'          {"; ".join(r["diretivas"])}')
            if not ok:
                if r['erro']:
                    print(f'          erro: {r["erro"]}')
                falhas.append(f'sonda: {r["nome"]}')

        navegador.close()

    # So faz sentido contra o site publicado: o servidor local imita o rewrite
    # da Vercel, e imitacao nao prova nada sobre a borda dela.
    if args.url:
        ruins = caminhos_de_infra(base)
        print('\nCAMINHOS DE INFRAESTRUTURA')
        if ruins:
            for c in ruins:
                print(f'  [FALHA] {c} respondeu 200')
            falhas.append('o rewrite de SPA esta servindo caminho de infraestrutura')
        else:
            print('  [ok  ] /.env, /.env.local, /.git/config e /scripts/* nao respondem 200')

    if srv:
        srv.shutdown()

    if console:
        print('\nCONSOLE (mensagens de CSP, inclui contexto de worker)')
        for c in dict.fromkeys(console):
            print(f'  {c[:200]}')

    print()
    if falhas:
        print('REPROVADO:')
        for f in falhas:
            print(f'  - {f}')
        return 1
    print('APROVADO — a politica nao quebra o app e bloqueia o que deve bloquear.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
