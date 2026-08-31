"""Mede se a pagina rola HORIZONTALMENTE ao longo do tempo.

Uso:  python scripts/medir-overflow.py [url]      # precisa do `npm run dev`

Existe porque o brilho decorativo da tela de login escalava ate 1.25 sem ser
recortado por ninguem, entrando no scrollWidth da pagina e criando uma barra
de rolagem lateral que aparecia e sumia no ritmo da animacao. Rode apos mexer
em qualquer decoracao de fundo, ou em layout.

POR QUE SO O EIXO HORIZONTAL CONTA COMO FALHA: rolagem vertical e o
comportamento normal de qualquer pagina com conteudo mais alto que a janela
(no app, o rodape fica abaixo da dobra em telas de 800px). Ja rolagem
horizontal nunca deveria acontecer neste layout — e o sintoma exato do bug
que esta ferramenta vigia. A altura e reportada apenas como informacao.

POR QUE JORNADAS, E NAO UM `goto` SO: ate 2026-08-31 este medidor fazia
`pagina.goto(URL)` e mais nada, entao media a tela de acesso e ACHAVA que
tinha medido o app. Quatro pecas — a faixa de diagnosticos, o interruptor do
modo discreto, a dica de sintaxe da busca e o editor de compra — so existem
depois de um clique ou de um foco, e por isso atravessaram TRES rodadas sem
medicao nenhuma, sempre reaparecendo na lista do "falta abrir no navegador".
Agora cada uma tem uma jornada aqui.

O alvo das jornadas e `/demo.html`, a folha de provas: os mesmos componentes
com dados ficticios, sem login e sem extrato de ninguem. So a jornada de
acesso usa `/`, que e o que existe deslogado.
"""
import sys
from playwright.sync_api import sync_playwright, expect, Page

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5173").rstrip("/")
VIEWPORTS = [(1280, 800), (390, 844)]
INTERVALO_MS = 500

# (nome, rota, passos, PROVAS, amostras)
#
# Passos e provas usam o mesmo vocabulario (acao, alvo), e o alvo e o NOME
# ACESSIVEL do elemento — o mesmo que um leitor de tela anuncia. Se um botao
# perde o rotulo, a jornada quebra alto em vez de medir a tela errada em
# silencio.
#
# POR QUE TODA JORNADA TEM PROVA: medir depois de um clique que nao aconteceu
# devolve OK — o mesmo OK de uma tela sem defeito. Seria a versao em Playwright
# do "teste que passa dos dois jeitos" que este projeto ja registrou. A prova e
# a assercao de que a peca esta mesmo na tela ANTES de medi-la.
#
# A contagem de amostras nao e uniforme de proposito: a tela de acesso tem o
# fundo animado que motivou esta ferramenta e precisa dos 8 segundos; as
# demais so precisam da animacao de entrada assentar.
JORNADAS = [
    ("acesso", "/", [], [("ver-botao", "Entrar")], 16),
    ("folha-de-provas", "/demo.html", [], [("ver-secao", "compromissos")], 6),
    ("busca-operadores", "/demo.html",
     [("focar", "Procurar lançamento")], [("focado", "Procurar lançamento")], 6),
    # O rotulo do botao INVERTE quando o modo liga: e a prova mais barata de
    # que o clique surtiu efeito, e nao so de que o botao existia.
    ("modo-discreto", "/demo.html",
     [("clicar", "Esconder os valores")], [("ver-botao", "Mostrar os valores")], 6),
    ("editor-compra", "/demo.html",
     [("clicar", "Abrir editor de compra")], [("ver-texto", "Editar compra")], 8),
]

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
  // scrollWidth do BODY tambem: um modal em <Portal> vive fora do fluxo do
  // documento, e quando ele estoura e o body que cresce.
  return {vw, vh, scrollW: Math.max(de.scrollWidth, document.body.scrollWidth),
          scrollH: de.scrollHeight, culpados: out};
}
"""


def executar(pagina: Page, passos: list[tuple[str, str]]) -> None:
    """Leva a pagina ao estado que se quer medir.

    Falha alto: `get_by_*` sem match estoura o timeout do Playwright, e e
    isso que se quer. Jornada que nao encontra seu gatilho e peca que voltou
    a ficar sem medicao — o defeito que este arquivo existe para nao repetir.
    """
    for acao, alvo in passos:
        if acao == "clicar":
            pagina.get_by_role("button", name=alvo, exact=True).first.click()
        elif acao == "focar":
            pagina.get_by_label(alvo, exact=True).first.focus()
        else:
            raise ValueError(f"acao desconhecida: {acao}")
        pagina.wait_for_timeout(400)  # a peca entra com mola; espera assentar


def conferir(pagina: Page, provas: list[tuple[str, str]]) -> None:
    """Prova que a peca esta na tela. Lanca se nao estiver."""
    for acao, alvo in provas:
        if acao == "ver-botao":
            expect(pagina.get_by_role("button", name=alvo, exact=True).first).to_be_visible()
        elif acao == "ver-texto":
            expect(pagina.get_by_text(alvo, exact=True).first).to_be_visible()
        elif acao == "ver-secao":
            expect(pagina.locator(f'[data-prova="{alvo}"]')).to_be_visible()
        elif acao == "focado":
            # `sr-only` tem caixa de 1px e o Playwright a considera visivel:
            # perguntar pelo foco e o unico jeito honesto de provar que a dica
            # de sintaxe saiu do estado escondido.
            rotulo = pagina.evaluate("() => document.activeElement?.getAttribute('aria-label')")
            if rotulo != alvo:
                raise AssertionError(f"foco em {rotulo!r}, esperado {alvo!r}")
        else:
            raise ValueError(f"prova desconhecida: {acao}")


def medir(pagina: Page, amostras: int) -> tuple[bool, dict]:
    falhou = False
    d = {}
    for i in range(amostras):
        pagina.wait_for_timeout(INTERVALO_MS)
        d = pagina.evaluate(SONDA)
        if d["scrollW"] > d["vw"]:
            falhou = True
            print(f"    t={i * INTERVALO_MS / 1000:4.1f}s  ESTOURO LATERAL  "
                  f"scrollW={d['scrollW']}/{d['vw']}")
            for c in d["culpados"]:
                print(f"        <{c['tag']}> {c['rect']}  class={c['cls']}")
    return falhou, d


def main() -> int:
    falhou = False
    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=True)
        for largura, altura in VIEWPORTS:
            print(f"\n=== viewport {largura}x{altura} ===")
            for nome, rota, passos, provas, amostras in JORNADAS:
                # Flag POR JORNADA. Se usassemos so a global, uma jornada
                # limpa depois de uma suja nao imprimiria nada — nem ESTOURO
                # nem OK — e pareceria que ela nem foi medida.
                pagina = navegador.new_page(viewport={"width": largura, "height": altura})
                pagina.goto(BASE + rota)
                pagina.wait_for_load_state("networkidle")
                try:
                    executar(pagina, passos)
                    conferir(pagina, provas)
                except Exception as e:  # noqa: BLE001 — o motivo importa mais que o tipo
                    print(f"  [{nome}] GATILHO PERDIDO: {type(e).__name__}: "
                          f"{str(e).splitlines()[0]}")
                    print("      A peca voltou a ficar SEM MEDICAO. Conserte o "
                          "rotulo ou a jornada — nao ignore.")
                    falhou = True
                    pagina.close()
                    continue
                falhou_aqui, d = medir(pagina, amostras)
                if not falhou_aqui:
                    # A altura vai junto so como informacao: ver o rodape
                    # abaixo da dobra e esperado, nao e defeito.
                    print(f"  [{nome}] OK — sem rolagem lateral "
                          f"(altura da pagina {d['scrollH']}px)")
                falhou = falhou or falhou_aqui
                pagina.close()
        navegador.close()
    print("\nRESULTADO:", "ESTOUROU" if falhou else "OK — nenhum estouro")
    return 1 if falhou else 0


if __name__ == "__main__":
    raise SystemExit(main())
