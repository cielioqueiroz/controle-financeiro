"""Prova que o LOGIN funciona, NUM NAVEGADOR DE VERDADE.

    npm run build:login
    python scripts/medir-login.py

POR QUE ESTE SCRIPT EXISTE. A ADR-0008 abre dizendo que a suite mocka o
`@neondatabase/neon-js` INTEIRO, e que por isso "uma regressao de login passa
verde do comeco ao fim, e so o usuario, entrando com conta real, descobre".
Isso decidia o que se podia mexer: qualquer toque em autenticacao — SDK,
provedor OAuth, fluxo de senha — caia no roteiro manual do
`docs/VALIDACAO-MANUAL.md`, que exige o dono presente.

Este medidor e a rede que faltava. Ele NAO fala com o Neon: sobe um Auth de
mentira em `127.0.0.1:4599` que responde o que o Neon Auth responderia, serve o
`dist` no mesmo endereco e dirige a tela num Chromium. O SDK de verdade roda —
com o `better-auth` e o `zod` que ele arrasta —, e e o dialogo dele que esta
sendo medido, endpoint por endpoint.

O QUE ELE COBRE, e e o essencial da classe de regressao que preocupava:

  - a tela de acesso aparece quando NAO ha sessao;
  - o formulario chama `POST /sign-in/email` com o que foi digitado;
  - sessao boa leva a tela LOGADA, com a navegacao no lugar;
  - credencial recusada mantem na tela de acesso e MOSTRA o erro;
  - sessao ja existente entra direto, sem passar pelo formulario;
  - sair derruba a sessao e volta para a tela de acesso.

O QUE ELE NAO COBRE, e continua valendo o roteiro manual: o Neon de verdade
(formato de resposta que mude do lado deles), a entrega de e-mail, o OAuth do
Google e o RLS. Isto aqui prova que o APP faz a sua parte — nao que o servidor
faz a dele.

⚠️ A PORTA E FIXA (4599) porque as `VITE_*` sao ASSADAS NO BUILD: nao da para
sortear porta e avisar o bundle depois. Por isso existe o `.env.login`,
VERSIONADO, com dois enderecos de localhost e nenhum segredo — ao contrario do
`.env.semlogin.local`, que e gitignored e so existe na maquina do dono.
"""

from __future__ import annotations

import http.server
import json
import socket
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
DIST = RAIZ / 'frontend' / 'dist'
PORTA = 4599

EMAIL = 'ana@exemplo.com'
SENHA = 'senha-de-mentira-12345'

SESSAO = {
    'session': {
        'id': 'sessao-de-mentira',
        'userId': 'usuario-de-mentira',
        'token': 'jwt-de-mentira',
        'expiresAt': '2099-01-01T00:00:00.000Z',
    },
    'user': {
        'id': 'usuario-de-mentira',
        'email': EMAIL,
        'name': 'Ana',
        'emailVerified': True,
    },
}


# ⚠️ A conta NAO pode estar vazia. O `AberturaTutorial` abre sozinho quando
# `todas.length === 0` — e nao so quando o tutorial nunca foi visto —, e o
# modal cobre a tela: todo clique depois do login estoura o tempo contra o
# overlay. Este histórico é explicitamente fictício e só existe no servidor
# local de teste. Ele cobre um ano inteiro para que todas as páginas e todos
# os gráficos possam ser avaliados sem usar o extrato de ninguém.
def tx(
    id_, competencia, dia, description, amount, kind, category,
    bank='nubank', doc_type='fatura', installment=None, label=None,
):
    return {
        'id': id_,
        'date': '%s-%02d' % (competencia, dia),
        'description': description,
        'label': label,
        'amount_cents': amount,
        'kind': kind,
        'category_slug': category,
        'installment': installment,
        'document_id': 'doc-%s-%s-%s' % (bank, doc_type, competencia),
        'accounts': {'bank': bank},
        'documents': {'doc_type': doc_type, 'period_end': competencia + '-28'},
    }


COMPETENCIAS = [
    '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
    '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
]

LUZ = [16840, 17520, 19280, 22140, 20760, 18490, 17920, 17100, 18830, 19640, 21350, 20580]
MERCADO = [36900, 40500, 38700, 42100, 39600, 43800, 41200, 44700, 42900, 46100, 45200, 47800]
TRANSACOES = []

for i, comp in enumerate(COMPETENCIAS):
    salario = 510000 + i * 5000
    aluguel = 165000 if comp == '2026-09' else 145000
    TRANSACOES.extend([
        tx('%s-salario' % comp, comp, 5, 'SALARIO EMPRESA EXEMPLO', -salario, 'income', 'rendimentos', 'sicoob', 'extrato'),
        tx('%s-aluguel' % comp, comp, 6, 'ALUGUEL RESIDENCIAL', aluguel, 'expense', 'aluguel', 'sicoob', 'extrato'),
        tx('%s-internet' % comp, comp, 8, 'INTERNET FIBRA CASA', 10990, 'expense', 'telecom', 'sicoob', 'extrato'),
        tx('%s-luz' % comp, comp, 11, 'COMPANHIA DE ENERGIA', LUZ[i], 'expense', 'luz', 'sicoob', 'extrato'),
        tx('%s-academia' % comp, comp, 12, 'ACADEMIA MOVIMENTO', 8990, 'expense', 'academia'),
        tx('%s-seguro' % comp, comp, 14, 'SEGURO RESIDENCIAL', 4990, 'expense', 'servicos', 'bradesco'),
        tx('%s-mercado-a' % comp, comp, 3, 'MERCADO MODELO', MERCADO[i], 'expense', 'supermercado'),
        tx('%s-mercado-b' % comp, comp, 16, 'MERCADO MODELO', MERCADO[i] - 4700, 'expense', 'supermercado'),
        tx('%s-mercado-c' % comp, comp, 25, 'MERCADO MODELO', MERCADO[i] + 6300, 'expense', 'supermercado'),
        tx('%s-restaurante-a' % comp, comp, 9, 'RESTAURANTE JARDIM', 12800 + i * 250, 'expense', 'restaurante'),
        tx('%s-restaurante-b' % comp, comp, 22, 'RESTAURANTE JARDIM', 15600 + i * 190, 'expense', 'restaurante'),
        tx('%s-combustivel' % comp, comp, 18, 'POSTO CENTRAL', 23900 + i * 530, 'expense', 'combustivel'),
        tx('%s-cafe' % comp, comp, 20, 'CAFETERIA AURORA', 4850 + i * 80, 'expense', 'u-cafe-especial', label='Café do mês'),
    ])

    # Uma assinatura que some no último mês produz um alerta útil na tela de
    # recorrências; a conta de luz oscila e aparece como recorrência variável.
    if comp != '2026-09':
        TRANSACOES.append(
            tx('%s-streaming' % comp, comp, 15, 'STREAMING CINEPLAY', 3990, 'expense', 'assinaturas')
        )
    if i % 3 == 0:
        TRANSACOES.append(
            tx('%s-farmacia' % comp, comp, 17, 'FARMACIA VIDA', 17800 + i * 310, 'expense', 'farmacia')
        )
    if i % 4 == 1:
        TRANSACOES.append(
            tx('%s-livros' % comp, comp, 23, 'LIVRARIA HORIZONTE', 21500 + i * 240, 'expense', 'educacao')
        )

# Compras parceladas ficam fora das recorrências e alimentam a projeção de
# compromissos futuros, inclusive dividida por banco.
for parcela, comp in enumerate(COMPETENCIAS[-4:], start=1):
    TRANSACOES.append(
        tx(
            '%s-notebook' % comp, comp, 13, 'NOTEBOOK CRIATIVO', 45900,
            'expense', 'marketplace', installment={'current': parcela, 'total': 10},
        )
    )
for parcela, comp in enumerate(COMPETENCIAS[-2:], start=1):
    TRANSACOES.append(
        tx(
            '%s-curso' % comp, comp, 21, 'CURSO DE DESIGN', 18900,
            'expense', 'educacao', bank='bradesco',
            installment={'current': parcela, 'total': 6},
        )
    )

TRANSACOES.sort(key=lambda item: item['date'], reverse=True)


def total_documento(comp, bank, doc_type):
    return sum(
        item['amount_cents'] for item in TRANSACOES
        if item['documents']['period_end'].startswith(comp)
        and item['accounts']['bank'] == bank
        and item['documents']['doc_type'] == doc_type
        and item['kind'] == 'expense'
    )


DOCUMENTOS = []
for i, comp in enumerate(COMPETENCIAS):
    for bank, doc_type in [('sicoob', 'extrato'), ('nubank', 'fatura'), ('bradesco', 'fatura')]:
        total = total_documento(comp, bank, doc_type)
        DOCUMENTOS.append({
            'id': 'doc-%s-%s-%s' % (bank, doc_type, comp),
            'bank': bank,
            'doc_type': doc_type,
            'period_start': comp + '-01',
            'period_end': comp + '-28',
            'filename': '%s-%s-%s-demo.pdf' % (bank, doc_type, comp),
            'imported_at': comp + '-28T12:00:00.000Z',
            'declared_total': total if doc_type == 'fatura' else None,
            'account_id': 'conta-' + bank,
            'end_balance_cents': 780000 + i * 28000 if doc_type == 'extrato' else None,
            'total_open_balance': total if comp == '2026-09' and doc_type == 'fatura' else None,
            'next_invoice_balance': 124900 if comp == '2026-09' and bank == 'nubank' else None,
            'next_close_date': '2026-10-18' if comp == '2026-09' and doc_type == 'fatura' else None,
            'future_installments_total': 351000 if comp == '2026-09' and bank == 'nubank' else None,
        })

DOCUMENTOS.sort(key=lambda item: item['imported_at'], reverse=True)

CATEGORIAS_USUARIO = [
    {'id': 'cat-cafe', 'slug': 'u-cafe-especial', 'nome': 'Cafés especiais', 'icone': '☕', 'cor': '#b7794b'},
    {'id': 'cat-familia', 'slug': 'u-familia', 'nome': 'Família', 'icone': '👨‍👩‍👧', 'cor': '#5b8def'},
    {'id': 'cat-hobbies', 'slug': 'u-hobbies', 'nome': 'Hobbies', 'icone': '🎨', 'cor': '#a05bd6'},
]

REGRAS = [
    {'padrao': 'CAFETERIA AURORA', 'match_type': 'contains', 'categoria': 'u-cafe-especial', 'prioridade': 100},
    {'padrao': 'MERCADO MODELO', 'match_type': 'contains', 'categoria': 'supermercado', 'prioridade': 90},
    {'padrao': 'POSTO CENTRAL', 'match_type': 'contains', 'categoria': 'combustivel', 'prioridade': 80},
    {'padrao': 'RESTAURANTE JARDIM', 'match_type': 'contains', 'categoria': 'restaurante', 'prioridade': 70},
]


class Auth:
    """O estado do Auth de mentira. Um objeto por cenario."""

    def __init__(self, *, logado: bool, aceita_login: bool = True):
        self.logado = logado
        self.aceita_login = aceita_login
        self.pedidos: list[str] = []
        self.credenciais: dict | None = None


def servidor(auth: Auth) -> http.server.ThreadingHTTPServer:
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(DIST), **kw)

        def _cabecalhos(self, code=200, tipo='application/json', extra=None):
            self.send_response(code)
            # O app fala com o Auth de outro caminho, mas mesma origem aqui;
            # o CORS liberal e so para o caso de o SDK usar `include`.
            self.send_header('Access-Control-Allow-Origin', self.headers.get('Origin', '*'))
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.send_header('Access-Control-Allow-Headers', '*')
            self.send_header('Access-Control-Expose-Headers', '*')
            self.send_header('Content-Type', tipo)
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()

        def _responder(self, corpo, code=200, extra=None):
            dados = json.dumps(corpo).encode() if not isinstance(corpo, bytes) else corpo
            self._cabecalhos(code, extra=extra)
            self.wfile.write(dados)

        def do_OPTIONS(self):  # noqa: N802
            self._cabecalhos(204, tipo='text/plain')

        def do_POST(self):  # noqa: N802
            n = int(self.headers.get('Content-Length') or 0)
            bruto = self.rfile.read(n).decode('utf-8', 'replace') if n else '{}'
            auth.pedidos.append('POST %s' % self.path)

            if self.path.startswith('/auth/sign-in'):
                try:
                    auth.credenciais = json.loads(bruto)
                except ValueError:
                    auth.credenciais = None
                if not auth.aceita_login:
                    # É o que o better-auth devolve para senha errada.
                    self._responder(
                        {'code': 'INVALID_EMAIL_OR_PASSWORD',
                         'message': 'Invalid email or password'},
                        401,
                    )
                    return
                auth.logado = True
                self._responder({'redirect': False, **SESSAO})
                return

            if self.path.startswith('/auth/sign-out'):
                auth.logado = False
                self._responder({'success': True})
                return

            self._responder({})

        def do_GET(self):  # noqa: N802
            if self.path.startswith('/auth/get-session'):
                auth.pedidos.append('GET /auth/get-session')
                self._responder(SESSAO if auth.logado else b'null')
                return

            if self.path.startswith('/data/'):
                auth.pedidos.append('GET (data)')
                # PostgREST, e o `Content-Range` importa: o `puxarTudo` pede
                # `{ count: 'exact' }` e CONFERE o total contra o que veio
                # (ver `RecorteIncompletoError`). Numero errado aqui faria o
                # app avisar que o recorte esta incompleto.
                if '/data/transactions' in self.path:
                    linhas = TRANSACOES
                elif '/data/documents' in self.path:
                    linhas = DOCUMENTOS
                elif '/data/categories' in self.path:
                    linhas = CATEGORIAS_USUARIO
                elif '/data/merchant_rules' in self.path:
                    linhas = REGRAS
                else:
                    linhas = []
                self._responder(
                    linhas, 200, extra={'Content-Range': '0-%d/%d' % (
                        max(len(linhas) - 1, 0), len(linhas))}
                )
                return

            nome = Path(self.path.split('?')[0]).name
            if '.' not in nome:
                self.path = '/index.html'
            return super().do_GET()

        def log_message(self, *a):
            pass

        def handle_error(self, *a):
            # O Chromium fecha conexoes ociosas quando a pagina troca, e o
            # ThreadingHTTPServer despeja o traceback do WinError 10053 no
            # meio do relatorio. Nao e falha do medidor nem do app.
            pass

    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORTA), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


BASE = 'http://127.0.0.1:%d' % PORTA

# A tela de acesso e a tela logada nao compartilham nada: o texto abaixo so
# existe num dos dois lados, e e assim que o medidor sabe onde esta.
NA_ENTRADA = 'Seu extrato vira'
LOGADO = 'Painel'


def entrar(page, email=EMAIL, senha=SENHA):
    page.fill('input[type=email]', email)
    page.fill('input[type=password]', senha)
    page.click('button:has-text("Entrar")')


# ⚠️ Sem isto o TUTORIAL DE ABERTURA cobre a tela logada, e todo clique
# depois do login estoura o tempo contra um overlay — foi assim que o cenario
# de "sair" reprovou na primeira execucao. Quem esta saindo da conta ja viu o
# tutorial, entao marca-lo como visto e o estado FIEL, e nao um atalho: o
# medidor mediria uma tela que o usuario do cenario nao ve.
TUTORIAL_VISTO = "try { localStorage.setItem('cf:tutorial-visto', '1') } catch (e) {}"


def cenario(nome, auth, roteiro) -> tuple[bool, str]:
    srv = servidor(auth)
    try:
        with sync_playwright() as p:
            nav = p.chromium.launch()
            # ⚠️ `locale` FIXO, e nao o do ambiente. O app detecta o idioma
            # por `navigator.language`, e o cenario de recusa exige a FRASE
            # ("E-mail ou senha incorretos"): num Chromium que se apresente
            # como en-US — o caso do runner do CI — a frase seria outra, e o
            # medidor reprovaria no CI depois de passar na maquina de quem o
            # escreveu. E a mesma armadilha que os casos do polyfill deram em
            # 08/09: nao presumir o ambiente, estabelece-lo.
            ctx = nav.new_context(locale='pt-BR')
            ctx.add_init_script(TUTORIAL_VISTO)
            page = ctx.new_page()
            erros: list[str] = []
            page.on('pageerror', lambda e: erros.append(str(e)))
            page.goto(BASE, wait_until='networkidle')
            try:
                ok, msg = roteiro(page, auth)
            except Exception as e:  # noqa: BLE001
                ok, msg = False, '%s' % str(e).split('\n')[0][:160]
            if ok and erros:
                ok, msg = False, 'erro de pagina: %s' % erros[0][:140]
            nav.close()
    finally:
        srv.shutdown()
        srv.server_close()
    return ok, '%s: %s' % (nome, msg)


def sem_sessao(page, auth):
    page.wait_for_selector('input[type=email]', timeout=10000)
    assert NA_ENTRADA in page.inner_text('body'), 'nao mostrou a tela de acesso'
    assert 'GET /auth/get-session' in auth.pedidos, 'nem perguntou se havia sessao'
    return True, 'sem sessao, mostra a tela de acesso e pergunta ao servidor'


def login_bom(page, auth):
    page.wait_for_selector('input[type=email]', timeout=10000)
    entrar(page)
    page.wait_for_function(
        "() => document.body.innerText.includes('%s')" % LOGADO, timeout=15000
    )
    assert auth.credenciais == {'email': EMAIL, 'password': SENHA}, (
        'mandou outra coisa: %r' % (auth.credenciais,)
    )
    assert 'POST /auth/sign-in/email' in auth.pedidos, 'nao chamou o sign-in'
    return True, 'entra com credencial boa e chega na tela logada'


# A frase exata, e nao "algum toast": com o `if (error) throw` removido do
# `Auth.tsx` de proposito, a tela AINDA ficava na entrada (o `get-session`
# seguinte responde "sem sessao") e AINDA havia um toast de outra origem. O
# medidor passava verde com o app engolindo a recusa do servidor. Exigir o
# TEXTO e o que faz este cenario medir alguma coisa.
RECUSA = 'E-mail ou senha incorretos'


def login_recusado(page, auth):
    page.wait_for_selector('input[type=email]', timeout=10000)
    entrar(page)
    page.wait_for_function(
        "() => document.body.innerText.includes('%s')" % RECUSA, timeout=10000
    )
    corpo = page.inner_text('body')
    assert NA_ENTRADA in corpo, 'saiu da tela de acesso com login recusado'
    assert LOGADO not in corpo, 'entrou com credencial recusada'
    return True, 'credencial recusada: fica na tela e diz o porque'


def ja_logado(page, auth):
    page.wait_for_function(
        "() => document.body.innerText.includes('%s')" % LOGADO, timeout=15000
    )
    assert page.query_selector('input[type=password]') is None, (
        'pediu senha para quem ja tinha sessao'
    )
    return True, 'sessao existente entra direto, sem passar pelo formulario'


def sair(page, auth):
    """Sair sao TRES cliques, e o terceiro e o que importa.

    O menu de conta esconde a opcao, e a opcao abre uma `Confirmacao` — sair
    por engano custa reimportar tudo. Um roteiro que parasse no segundo clique
    passaria verde sem nunca ter deslogado ninguem.

    ⚠️ `:visible` nao e capricho: o botao de conta existe DUAS vezes na
    arvore, na `NavLateral` (lg+) e no `Cabecalho` (abaixo de lg), e um deles
    esta sempre escondido por CSS. Clicar no escondido estoura o tempo."""
    page.wait_for_function(
        "() => document.body.innerText.includes('%s')" % LOGADO, timeout=15000
    )

    page.locator('button[aria-label="Conta"]:visible').first.click()
    page.locator('button:has-text("Sair da conta"):visible').first.click()

    confirmar = page.locator('button:text-is("Sair"):visible').first
    confirmar.wait_for(timeout=5000)
    confirmar.click()

    page.wait_for_selector('input[type=email]', timeout=10000)
    assert 'POST /auth/sign-out' in auth.pedidos, 'nao avisou o servidor'
    return True, 'sair pede confirmacao, derruba a sessao e volta para a entrada'


CENARIOS = [
    ('sem sessao', lambda: Auth(logado=False), sem_sessao),
    ('login aceito', lambda: Auth(logado=False), login_bom),
    ('login recusado', lambda: Auth(logado=False, aceita_login=False), login_recusado),
    ('sessao existente', lambda: Auth(logado=True), ja_logado),
    ('sair', lambda: Auth(logado=True), sair),
]


def porta_ocupada() -> bool:
    with socket.socket() as s:
        return s.connect_ex(('127.0.0.1', PORTA)) == 0


def main() -> int:
    if not (DIST / 'index.html').is_file():
        print('dist/ ausente. Rode:  npm run build:login')
        return 1
    if not any('127.0.0.1:%d' % PORTA in p.read_text(encoding='utf-8', errors='ignore')
               for p in (DIST / 'assets').glob('index-*.js')):
        print('o dist nao aponta para o Auth de mentira. Rode:  npm run build:login')
        return 1
    if porta_ocupada():
        print('a porta %d esta ocupada — feche o que estiver nela.' % PORTA)
        return 1

    resultados = [cenario(nome, faz(), roteiro) for nome, faz, roteiro in CENARIOS]

    for ok, msg in resultados:
        print('  [%s] %s' % ('  OK  ' if ok else 'FALHOU', msg))

    if all(ok for ok, _ in resultados):
        print('\nRESULTADO: OK - o login funciona nos %d cenarios.' % len(CENARIOS))
        return 0
    print('\nRESULTADO: FALHOU.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
