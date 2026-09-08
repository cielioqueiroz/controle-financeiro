"""Quanto tempo quem JA ESTA LOGADO ve a tela de entrar antes do Painel.

    npm run build:login
    python scripts/medir-piscada.py

POR QUE ESTE SCRIPT EXISTE. Em 2026-09-08 o SDK do Neon saiu do chunk
principal e passou a entrar por import dinamico — 242 kB, quase todos `zod`,
que a primeira pintura nao precisa. A objecao contra isso NAO era tecnica: se o
app esperasse o SDK para saber que ha sessao, quem ja esta logado veria a tela
de entrar por MAIS tempo, e piscada e o que o script inline do `index.html` ja
existe para evitar no tema. Trocar bytes por piscada seria mau negocio.

Este medidor e o que transformou a objecao em numero. A saida e `usuarioDaSessao()`
(`lib/sessao-remota.ts`): a pergunta "ha sessao?" e um `fetch` puro, mais rapido
que baixar o SDK, entao a decisao da tela chega ANTES — e a piscada encolhe em
vez de crescer.

Medido na epoca da mudanca, 3G emulado, sessao existente, mediana de 5:

    | medida            | antes    | depois   | ganho    |
    |-------------------|----------|----------|----------|
    | a tela aparece    | 13840 ms |  9867 ms | -3973 ms |
    | o Painel aparece  | 14214 ms | 10234 ms | -3980 ms |
    | A PISCADA         |   382 ms |   366 ms |   -16 ms |

⚠️ RODE COM A REDE ESTRANGULADA, e e o que o script faz. Numa rede de
escritorio os dois cenarios empatam e a medicao nao diz nada — o download de
340 kB some no ruido. E o 3G que separa os dois.

⚠️ OS NUMEROS ABSOLUTOS NAO SAO COMPARAVEIS ENTRE MAQUINAS, e nem precisam
ser: o que importa e a diferenca entre dois builds medidos na MESMA maquina, na
mesma sessao. Para comparar com outro commit: `git stash`, `npm run
build:login`, rode, volte com `git stash pop`.

Usa o Auth de mentira do `medir-login.py`, entao nao fala com o Neon.
"""

from __future__ import annotations

import importlib.util
import statistics
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location('ml', Path('scripts/medir-login.py'))
ml = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ml)

from playwright.sync_api import sync_playwright  # noqa: E402

# 3G decente: e onde a diferenca aparece. Numa rede de escritorio os dois
# cenarios empatam e a medicao nao diria nada.
REDE = {'offline': False, 'downloadThroughput': 700 * 1024 / 8,
        'uploadThroughput': 300 * 1024 / 8, 'latency': 150}

REPETICOES = 5


def uma_medida(nav, base):
    ctx = nav.new_context(locale='pt-BR')
    ctx.add_init_script(ml.TUTORIAL_VISTO)
    page = ctx.new_page()
    cdp = ctx.new_cdp_session(page)
    cdp.send('Network.enable')
    cdp.send('Network.emulateNetworkConditions', REDE)

    page.goto(base, wait_until='commit')
    # Quando a tela de ENTRAR aparece (a piscada comeca).
    entrada = page.evaluate("""async () => {
      const t0 = performance.now()
      while (!(document.body?.innerText || '').includes('Seu extrato vira')) {
        await new Promise((r) => requestAnimationFrame(r))
        if (performance.now() - t0 > 30000) return null
      }
      return performance.now()
    }""")
    # Quando o Painel aparece (a piscada termina).
    painel = page.evaluate("""async () => {
      const t0 = performance.now()
      while (!(document.body?.innerText || '').includes('Painel')) {
        await new Promise((r) => requestAnimationFrame(r))
        if (performance.now() - t0 > 40000) return null
      }
      return performance.now()
    }""")
    ctx.close()
    if entrada is None or painel is None:
        return None
    return {'entrada': entrada, 'painel': painel, 'piscada': painel - entrada}


def main():
    auth = ml.Auth(logado=True)
    srv = ml.servidor(auth)
    try:
        with sync_playwright() as p:
            nav = p.chromium.launch()
            medidas = []
            for i in range(REPETICOES):
                m = uma_medida(nav, ml.BASE)
                if m is None:
                    print('  medida %d: sem desfecho' % (i + 1))
                    continue
                medidas.append(m)
                print('  medida %d: entrada %.0f ms · painel %.0f ms · piscada %.0f ms'
                      % (i + 1, m['entrada'], m['painel'], m['piscada']))
            nav.close()
    finally:
        srv.shutdown()
        srv.server_close()

    if not medidas:
        print('nenhuma medida')
        return 1
    for chave in ('entrada', 'painel', 'piscada'):
        vals = [m[chave] for m in medidas]
        print('%-10s mediana %.0f ms  (min %.0f, max %.0f)'
              % (chave, statistics.median(vals), min(vals), max(vals)))
    return 0


sys.exit(main())
