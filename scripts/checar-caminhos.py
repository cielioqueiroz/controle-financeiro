"""Acha caminho relativo em STRING que nao resolve para arquivo nenhum.

    python scripts/checar-caminhos.py

Por que existe: `import` e `from` sao conferidos pelo TypeScript, mas um monte
de caminho neste projeto vive em string comum, e string ninguem confere:

  - `vi.mock('../lib/neon')` -- se nao resolve, o modulo REAL entra no lugar do
    dublê e o teste passa a exercitar outra coisa. Pode continuar verde.
  - `readFileSync('tests/fixtures/x.json')` -- relativo ao CWD do Vitest.
  - `await import('./modulo')` com caminho montado.

Foi assim que a reorganizacao de pastas de 2026-08-17 quebrou 18 testes com
`tsc` limpo e build verde: sete `vi.mock('../lib/...')` viraram letra morta ao
descer um nivel de pasta.

Sai com codigo 1 se achar algo, para poder entrar em CI.
"""
from pathlib import Path
import re
import sys

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / 'frontend' / 'src'
EXTS = ['', '.ts', '.tsx', '.css', '.json', '/index.ts', '/index.tsx']

# Caminho relativo dentro de string, em chamada que NAO e import/from.
ALVO = re.compile(
    r"""(?:vi\.mock|vi\.doMock|importOriginal|importActual|original)\s*"""
    r"""(?:<[^>]*>)?\s*\(\s*['"](\.[^'"]+)['"]"""
)
# readFileSync relativo ao CWD (frontend/), nao ao arquivo.
CWD = re.compile(r"""readFileSync\(\s*[`'"]([^`'"$]+)[`'"]""")

falhas = []
for arq in sorted(SRC.rglob('*')):
    if arq.suffix not in ('.ts', '.tsx') or not arq.is_file():
        continue
    texto = arq.read_text(encoding='utf-8')

    for spec in ALVO.findall(texto):
        base = (arq.parent / spec).resolve()
        if not any(Path(str(base) + e).is_file() for e in EXTS):
            falhas.append((arq.relative_to(RAIZ), spec, 'mock nao resolve'))

    for spec in CWD.findall(texto):
        if (RAIZ / 'frontend' / spec).exists():
            continue
        falhas.append((arq.relative_to(RAIZ), spec, 'caminho de CWD nao existe'))

if falhas:
    print('CAMINHOS EM STRING QUE NAO RESOLVEM: %d\n' % len(falhas))
    for arq, spec, motivo in falhas:
        print('  %s' % arq)
        print('      %-44s %s' % (spec, motivo))
    sys.exit(1)

print('OK - todo caminho em string resolve.')
