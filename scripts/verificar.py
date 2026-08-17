"""Roda a verificacao inteira, na ORDEM certa, e falha alto.

    python scripts/verificar.py           # tudo que roda sozinho
    python scripts/verificar.py --rapido  # pula o build e o que depende dele

Por que existe: a rotina eram cinco comandos soltos numa tabela de documento,
e a ordem entre eles nao e opcional --

  - `npm test` NAO checa tipos. Quem roda so ele acha que esta verde. Ja mordeu
    quatro vezes.
  - `medir-csp.py` mede o `dist/`, nao o codigo. Rodar antes do build aprova o
    build ANTERIOR, e nao reclama: um `dist` velho e um `dist` valido.
  - `checar-caminhos.py` e novo (17/08) e nasceu de um defeito que passou por
    `tsc` limpo e build verde.

Fora daqui, de proposito: `medir-overflow.py` e `gerar-prints.py` precisam de
`npm run dev` de pe, e `medir-contraste.py` so importa quando se mexe em cor.
Esses ficam na mao, e o CLAUDE.md diz quando.
"""
from pathlib import Path
import subprocess
import sys
import time

RAIZ = Path(__file__).resolve().parent.parent
RAPIDO = '--rapido' in sys.argv

# O console do Windows e cp1252, e a saida do vitest tem caixa de desenho
# (U+2502 e amigos). Sem isto, o script MORRE ao imprimir a falha que ele
# acabou de detectar -- e some justamente a informacao que se foi buscar.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except (AttributeError, OSError):
    pass

# (rotulo, comando, cwd, so_no_completo)
PASSOS = [
    ('typecheck', ['npx', 'tsc', '-b', '--force'], RAIZ / 'frontend', False),
    ('testes', ['npm', 'test'], RAIZ, False),
    ('lint', ['npm', 'run', 'lint'], RAIZ, False),
    ('caminhos em string', [sys.executable, 'scripts/checar-caminhos.py'], RAIZ, False),
    ('build', ['npm', 'run', 'build'], RAIZ, True),
    ('CSP (contra o build acima)', [sys.executable, 'scripts/medir-csp.py'], RAIZ, True),
]

print('VERIFICACAO%s\n' % ('  (rapido: sem build)' if RAPIDO else ''))
falhas = []
for rotulo, cmd, cwd, so_completo in PASSOS:
    if RAPIDO and so_completo:
        print('  [  --  ] %-28s pulado' % rotulo)
        continue
    inicio = time.time()
    r = subprocess.run(cmd, cwd=cwd, shell=(sys.platform == 'win32'),
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    seg = time.time() - inicio
    ok = r.returncode == 0
    print('  [%s] %-28s %5.1fs' % ('  OK  ' if ok else 'FALHOU', rotulo, seg))
    if not ok:
        falhas.append((rotulo, (r.stdout or '') + (r.stderr or '')))

if falhas:
    for rotulo, saida in falhas:
        print('\n' + '=' * 62)
        print('FALHOU: %s' % rotulo)
        print('=' * 62)
        print('\n'.join(saida.strip().splitlines()[-25:]))
    print('\nRESULTADO: %d passo(s) falharam.' % len(falhas))
    sys.exit(1)

print('\nRESULTADO: OK - tudo passou.')
if RAPIDO:
    print('Faltam o build e a CSP. Rode sem --rapido antes de publicar.')
else:
    print('Se mexeu em COR: python scripts/medir-contraste.py')
    print('Se mexeu em LAYOUT: npm run dev + python scripts/medir-overflow.py')
