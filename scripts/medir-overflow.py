"""Mede se a pagina rola HORIZONTALMENTE ao longo do tempo.

Uso:  python scripts/medir-overflow.py [url]

Existe porque o brilho decorativo da tela de login escalava ate 1.25 sem ser
recortado por ninguem, entrando no scrollWidth da pagina e criando uma barra
de rolagem lateral que aparecia e sumia no ritmo da animacao. Rode apos mexer
em qualquer decoracao de fundo.

POR QUE SO O EIXO HORIZONTAL CONTA COMO FALHA: rolagem vertical e o
comportamento normal de qualquer pagina com conteudo mais alto que a janela
(no app, o rodape fica abaixo da dobra em telas de 800px). Ja rolagem
horizontal nunca deveria acontecer neste layout — e o sintoma exato do bug
que esta ferramenta vigia. A altura e reportada apenas como informacao.
"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173"
VIEWPORTS = [(1280, 800), (390, 844)]
AMOSTRAS = 16
INTERVALO_MS = 500

SONDA = """
() => {
  const de = document.documentElement;
  const vw = de.clientWidth, vh = de.clientHeight;
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    // So o eixo horizontal: elemento abaixo da dobra e normal, ao lado nao.
    if (r.right > vw + 1 || r.left < -1) {
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 70),
        rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
      });
    }
  }
  return {vw, vh, scrollW: de.scrollWidth, scrollH: de.scrollHeight, culpados: out};
}
"""


def main() -> int:
    falhou = False
    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=True)
        for largura, altura in VIEWPORTS:
            # Flag POR VIEWPORT. Se usassemos so a global, um viewport limpo
            # depois de um sujo nao imprimiria nada — nem ESTOURO nem OK — e
            # pareceria que ele nem foi testado.
            falhou_aqui = False
            pagina = navegador.new_page(viewport={"width": largura, "height": altura})
            pagina.goto(URL)
            pagina.wait_for_load_state("networkidle")
            print(f"\n=== viewport {largura}x{altura} ===")
            for i in range(AMOSTRAS):
                pagina.wait_for_timeout(INTERVALO_MS)
                d = pagina.evaluate(SONDA)
                estoura = d["scrollW"] > d["vw"]
                if estoura:
                    falhou_aqui = True
                    print(f"  t={i * INTERVALO_MS / 1000:4.1f}s  ESTOURO LATERAL  "
                          f"scrollW={d['scrollW']}/{d['vw']}")
                    for c in d["culpados"]:
                        print(f"      <{c['tag']}> {c['rect']}  class={c['cls']}")
            if not falhou_aqui:
                # A altura vai junto so como informacao: ver o rodape abaixo da
                # dobra e esperado, nao e defeito.
                print(f"  todas as amostras OK (sem rolagem lateral; "
                      f"altura da pagina {d['scrollH']}px)")
            falhou = falhou or falhou_aqui
            pagina.close()
        navegador.close()
    print("\nRESULTADO:", "ESTOUROU" if falhou else "OK — nenhum estouro")
    return 1 if falhou else 0


if __name__ == "__main__":
    raise SystemExit(main())
