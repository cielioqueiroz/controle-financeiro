"""Mede ACESSIBILIDADE nas mesmas jornadas do medidor de overflow.

Uso:  npm run dev            # e entao, noutro terminal:
      python scripts/medir-a11y.py [url]

POR QUE ESTE SCRIPT EXISTE. O projeto mede cor (`medir-contraste.py`),
rolagem lateral (`medir-overflow.py`), politica de seguranca (`medir-csp.py`)
e agora o motor de PDF (`medir-pdf.py`) — e nao media semantica. O codigo usa
oito atributos `aria-*`, `role="alert"`, `role="dialog"` e `role="status"`,
`lang="pt-br"`: esta acima da media SEM NUNCA TER SIDO CONFERIDO, ou seja,
por disciplina de quem escreveu e nao por rede. Disciplina nao sobrevive a
pressa; medidor sobrevive.

REAPROVEITA AS JORNADAS, e isso e o ponto. Rodar axe so na primeira tela
mediria a tela de acesso e ACHARIA que mediu o app — o mesmo engano que o
medidor de overflow cometeu ate 31/08. A faixa de diagnosticos, o interruptor
do modo discreto, a dica de busca e o editor de compra so existem depois de um
clique ou de um foco. Importando `JORNADAS` de `medir-overflow.py`, jornada
nova entra nos dois medidores de uma vez — e nao existe a chance de as duas
listas divergirem.

O QUE E FALHA AQUI. Só violacoes `critical` e `serious` derrubam. `moderate` e
`minor` sao impressos e nao reprovam: axe marca como `moderate` coisas que
dependem de intencao de design (ordem de cabecalho, regiao de marco), e
transformar isso em erro treinaria qualquer um a ignorar a saida — o mesmo
raciocinio do `--deny-warnings` do lint, pelo avesso.

axe-core vem do `node_modules` (devDependency da raiz), injetado como script
na pagina. Sem rede em tempo de medicao, e a versao fica presa no
package-lock junto com o resto.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright, Page

RAIZ = Path(__file__).resolve().parent.parent
AXE = RAIZ / 'node_modules' / 'axe-core' / 'axe.min.js'

# `medir-overflow.py` tem hifen no nome e nao e importavel pelo `import`
# normal. Carregamos pelo caminho, que e explicito e nao exige renomear um
# arquivo que ja esta na rotina de ninguem.
import importlib.util

_spec = importlib.util.spec_from_file_location('medir_overflow', RAIZ / 'scripts' / 'medir-overflow.py')
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)  # type: ignore[union-attr]

JORNADAS = _mod.JORNADAS
executar = _mod.executar
conferir = _mod.conferir

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173').rstrip('/')
VIEWPORTS = [(1280, 800), (390, 844)]
GRAVES = ('critical', 'serious')


def rodar_axe(pagina: Page) -> list[dict]:
    """Injeta o axe e devolve as violacoes da tela ja ASSENTADA.

    ⚠️ MEDIR DURANTE A ANIMACAO DE ENTRADA DA FALSO POSITIVO. A legenda do
    donut entra em cascata (`delay: 0.2 + i * 0.04`, 0.35s de duracao), e na
    primeira versao deste script o axe rodava antes: do 5o item em diante as
    linhas ainda estavam a meio fade, com `opacity` fracionaria, e o
    `color-contrast` reprovava seis elementos que no estado final passam.

    Contraste de elemento em transicao nao e defeito — a WCAG fala do estado
    percebido, nao de cada quadro. E um medidor que grita sobre o que esta
    certo e um medidor que todo mundo aprende a ignorar.

    O contexto ja roda com `reduced_motion='reduce'` (ver `main`), o que faz
    os componentes pularem o estado inicial. O `finish()` abaixo cobre o que
    escapar disso: motion/react usa WAAPI quando pode, e animacao WAAPI
    aparece em `getAnimations()`."""
    pagina.evaluate("() => document.getAnimations().forEach((a) => { try { a.finish() } catch {} })")
    pagina.wait_for_timeout(150)
    pagina.add_script_tag(path=str(AXE))
    # `exclude` de nada: queremos a pagina inteira, inclusive o que so
    # aparece depois dos passos da jornada.
    resultado = pagina.evaluate(
        """async () => {
            const r = await window.axe.run(document, {
              resultTypes: ['violations'],
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
            });
            return r.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              help: v.help,
              nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
            }));
        }"""
    )
    return json.loads(json.dumps(resultado))


def main() -> int:
    if not AXE.is_file():
        print('axe-core ausente. Rode:  npm install')
        return 1

    achados: list[tuple[str, str, dict]] = []
    print('ACESSIBILIDADE  (axe-core, WCAG 2.1 A/AA)\n')

    with sync_playwright() as p:
        nav = p.chromium.launch()
        for largura, altura in VIEWPORTS:
            # `reduce` faz os componentes pularem a animacao de entrada (eles
            # ja consultam `prefers-reduced-motion`), o que torna a medicao
            # deterministica — e e o estado em que quem usa leitor de tela
            # costuma navegar, entao nao e so conveniencia de teste.
            ctx = nav.new_context(
                viewport={'width': largura, 'height': altura}, reduced_motion='reduce'
            )
            pagina = ctx.new_page()
            print('  %dx%d' % (largura, altura))

            for nome, rota, passos, provas, _amostras in JORNADAS:
                pagina.goto(BASE + rota)
                pagina.wait_for_load_state('networkidle')
                executar(pagina, passos)
                # A PROVA vem antes da medicao: sem ela, medir depois de um
                # clique que nao aconteceu devolve o mesmo OK de uma tela sa.
                conferir(pagina, provas)

                violacoes = rodar_axe(pagina)
                graves = [v for v in violacoes if v['impact'] in GRAVES]
                leves = [v for v in violacoes if v['impact'] not in GRAVES]

                marca = 'FALHOU' if graves else '  OK  '
                extra = ''
                if leves:
                    extra = '  (%d leve%s)' % (len(leves), 's' if len(leves) > 1 else '')
                print('    [%s] %-22s %d grave(s)%s' % (marca, nome, len(graves), extra))

                for v in graves:
                    achados.append(('%dx%d' % (largura, altura), nome, v))
                for v in leves:
                    print('             · %s [%s] %s' % (v['id'], v['impact'], v['help']))

            ctx.close()
        nav.close()

    if achados:
        print('\nREPROVADO: %d violacao(oes) grave(s)\n' % len(achados))
        for viewport, jornada, v in achados:
            print('  %s · %s' % (viewport, jornada))
            print('    %s [%s] %s' % (v['id'], v['impact'], v['help']))
            for alvo in v['nodes']:
                print('      %s' % alvo)
        return 1

    print('\nRESULTADO: OK - nenhuma violacao critical/serious nas jornadas.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
