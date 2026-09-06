"""Prova que o motor de PDF abre um arquivo NUM NAVEGADOR DE VERDADE.

    npm run build -- --mode semlogin
    python scripts/medir-pdf.py

POR QUE ESTE SCRIPT EXISTE. A suite tem 9 fixtures de parser, e nenhum deles
toca no pdf.js: sao JSON JA EXTRAIDO, e `domain/pdf/load.ts` e mockado no jsdom
(que nem tem `DOMMatrix`). Ou seja, a suite fica verde com o motor quebrado — e
foi exatamente o que aconteceu em 2026-09-04, quando o pdf.js v6 passou a usar
`Promise.withResolvers` (Chrome 119 / Safari 17.4) e a importacao morreu num
celular enquanto o desktop abria o mesmo arquivo sem um arranhao.

O QUE ELE MEDE, e a distincao e o ponto todo:

  - `falha.ilegivel`  = o motor NAO abriu o arquivo. E o defeito de 04/09.
  - `falha.semParser` = o motor abriu, extraiu texto, e o detector nao
                        reconheceu o banco. E o resultado ESPERADO aqui.

Um PDF sintetico nao imita layout de banco nenhum, e nao precisa: o que quebrou
foi o MOTOR, e qualquer PDF do mundo teria pego. Os 9 fixtures continuam sendo
o que prova os parsers; este script prova a unica coisa que eles nao podem
provar, que e que o arquivo abre.

DUAS PASSADAS. A segunda apaga `Promise.withResolvers` antes de qualquer script
rodar, simulando o aparelho antigo. Sem ela o polyfill de `load.ts` poderia
sumir num refactor e ninguem notaria ate outro celular reclamar. O polyfill
precisa valer em DOIS lugares — nesta thread e dentro do WORKER, que tem outro
`globalThis` —, e so a segunda passada cobre o worker.

NADA DE PDF REAL AQUI. O arquivo e gerado neste script, tem quatro linhas de
texto inventado e morre no fim. PDF de banco tem CPF, agencia, conta e nomes de
terceiros, e o historico do git e permanente (.gitignore: `*.pdf`). Para medir
contra um documento seu, use `medir-csp.py --pdf caminho.pdf`, que e local.
"""

from __future__ import annotations

import http.server
import socket
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
DIST = RAIZ / 'frontend' / 'dist'

TEXTO = [
    'DEMONSTRATIVO SINTETICO',
    'Documento gerado por medir-pdf.py',
    '01/06/2026  PADARIA INVENTADA        5,00',
    '02/06/2026  FARMACIA INVENTADA      32,00',
]


def pdf_sintetico() -> bytes:
    """Um PDF valido, minimo, com texto extraivel. Sem dependencia nenhuma.

    O xref precisa dos deslocamentos REAIS em bytes, entao os objetos sao
    montados em sequencia e as posicoes anotadas no caminho."""
    linhas = ' '.join(
        '1 0 0 1 72 %d Tm (%s) Tj' % (720 - i * 18, t) for i, t in enumerate(TEXTO)
    )
    fluxo = ('BT /F1 12 Tf %s ET' % linhas).encode('latin-1')

    objetos = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
        b'/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Length %d >>\nstream\n' % len(fluxo) + fluxo + b'\nendstream',
    ]

    saida = bytearray(b'%PDF-1.4\n')
    posicoes = []
    for i, corpo in enumerate(objetos, start=1):
        posicoes.append(len(saida))
        saida += b'%d 0 obj\n' % i + corpo + b'\nendobj\n'

    inicio_xref = len(saida)
    saida += b'xref\n0 %d\n' % (len(objetos) + 1)
    saida += b'0000000000 65535 f \n'
    for p in posicoes:
        saida += b'%010d 00000 n \n' % p
    saida += b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (
        len(objetos) + 1,
        inicio_xref,
    )
    return bytes(saida)


def porta_livre() -> int:
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def servidor(raiz: Path) -> tuple[http.server.ThreadingHTTPServer, int]:
    porta = porta_livre()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(raiz), **kw)

        def do_GET(self):  # noqa: N802 (nome da stdlib)
            # SPA: rota sem arquivo cai no index.html, como a Vercel faz.
            alvo = raiz / self.path.lstrip('/').split('?')[0]
            if not alvo.is_file() and '.' not in Path(self.path).name:
                self.path = '/index.html'
            return super().do_GET()

        def log_message(self, *a):
            pass

    srv = http.server.ThreadingHTTPServer(('127.0.0.1', porta), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, porta


def medir(page, base: str, arquivo: Path, rotulo: str) -> tuple[bool, str]:
    page.goto('%s/importar' % base, wait_until='networkidle')
    page.set_input_files('input[type=file]', str(arquivo))

    # Tres desfechos possiveis, e so o primeiro presta. Os outros dois sao
    # controles negativos: sem eles declarados, um app que nunca sai da tela
    # de carregamento passaria por timeout e ninguem saberia de nada.
    #
    # O terceiro (`falha.navegador`) foi descoberto medindo: com o polyfill
    # removido de proposito, e ELE que aparece — o app detecta o motor velho
    # e explica. E o desfecho certo do ponto de vista de quem usa, e o errado
    # do ponto de vista desta sonda, que existe para o polyfill funcionar.
    ESPERADO = 'Ainda não sei ler este documento'
    ILEGIVEL = 'Não consegui abrir este arquivo'
    ANTIGO = 'antigo demais para abrir PDF'

    try:
        page.wait_for_function(
            """(ts) => ts.some((t) => document.body.innerText.includes(t))""",
            arg=[ESPERADO, ILEGIVEL, ANTIGO],
            timeout=25000,
        )
    except Exception:
        texto = page.inner_text('body')[:200].replace('\n', ' | ')
        return False, '%s: nenhum desfecho conhecido em 25s. Tela: %s' % (rotulo, texto)

    corpo = page.inner_text('body')
    if ANTIGO in corpo:
        return False, (
            '%s: o app caiu no aviso de navegador antigo — o POLYFILL nao pegou '
            '(confira que ele e aplicado nesta thread E dentro do worker)' % rotulo
        )
    if ILEGIVEL in corpo:
        return False, '%s: o motor NAO abriu o PDF (falha.ilegivel)' % rotulo
    return True, '%s: motor abriu, texto extraido, banco nao reconhecido' % rotulo


def main() -> int:
    if not (DIST / 'index.html').is_file():
        print('dist/ ausente. Rode:  npm run build -- --mode semlogin')
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        arquivo = Path(tmp) / 'sintetico.pdf'
        arquivo.write_bytes(pdf_sintetico())
        print('PDF sintetico: %d bytes\n' % arquivo.stat().st_size)

        srv, porta = servidor(DIST)
        base = 'http://127.0.0.1:%d' % porta
        resultados = []
        try:
            with sync_playwright() as p:
                nav = p.chromium.launch()

                ctx = nav.new_context()
                resultados.append(medir(ctx.new_page(), base, arquivo, 'motor atual'))
                ctx.close()

                # Aparelho anterior ao Chrome 119 / Safari 17.4.
                ctx = nav.new_context()
                ctx.add_init_script('delete Promise.withResolvers')
                resultados.append(
                    medir(ctx.new_page(), base, arquivo, 'sem Promise.withResolvers')
                )
                ctx.close()

                nav.close()
        finally:
            srv.shutdown()

    for ok, msg in resultados:
        print('  [%s] %s' % ('  OK  ' if ok else 'FALHOU', msg))

    if all(ok for ok, _ in resultados):
        print('\nRESULTADO: OK - o motor abre PDF nos dois cenarios.')
        return 0
    print('\nRESULTADO: FALHOU.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
