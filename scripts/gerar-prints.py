"""Gera os prints do README a partir da folha de provas e da tela de acesso.

    npm run dev --workspace frontend      # em outro terminal
    python scripts/gerar-prints.py

Por que uma folha de provas e nao o app logado: os prints precisam ser
regeraveis por qualquer pessoa que clone o repositorio, e o app logado mostra
extrato de verdade. `frontend/demo.html` monta os mesmos componentes com dados
ficticios — inclusive o caso que motivou a escala robusta dos graficos (um
pagamento de emprestimo de R$ 41.653 no meio de compras de dezenas).

As imagens sao versionadas porque o build da Vercel nao roda Playwright, e o
GitHub precisa delas para renderizar o README.
"""
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "docs" / "img"
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173"

DESTINO.mkdir(parents=True, exist_ok=True)

# (arquivo, url, seletor do recorte ou None para a pagina inteira, largura,
#  texto de um botao a clicar antes do print ou None)
#
# O tema sai do `prefers-color-scheme` do contexto (o index.html estampa
# data-theme antes da primeira pintura, lendo essa preferencia): por isso o
# alvo escuro roda num contexto proprio, definido em ESQUEMA_ESCURO.
ESQUEMA_ESCURO = {"print-acesso-escuro.png"}

ALVOS = [
    ("print-acesso.png", "/", None, 1280, None),
    ("print-acesso-escuro.png", "/", None, 1280, None),
    ("print-graficos.png", "/demo.html", '[data-prova="graficos-painel"]', 1440, None),
    ("print-saldos.png", "/demo.html", '[data-prova="saldos"]', 1280, None),
    # O carimbo e a tese do produto virando desenho: o app existe para bater
    # o total ao centavo, e este e o unico lugar onde os tres vereditos
    # aparecem lado a lado.
    ("print-carimbo.png", "/demo.html", '[data-prova="carimbo-conferencia"]', 1100, None),
    ("print-compromissos.png", "/demo.html", '[data-prova="compromissos"]', 1280, None),
    # Os dois rankings lado a lado. A largura importa aqui: abaixo de 1024 o
    # grid empilha, e o print perderia justamente a comparacao entre eles.
    ("print-rankings.png", "/demo.html", '[data-prova="rankings"]', 1440, None),
    # Aberto: o print precisa mostrar o CAMPO do codigo, que e a razao de a
    # faixa existir. Fechada, ela nao conta a historia toda.
    ("print-aviso-email.png", "/demo.html", '[data-prova="aviso-email"]', 1100, "Confirmar agora"),
]

with sync_playwright() as p:
    nav = p.chromium.launch(headless=True)
    for nome, rota, seletor, largura, clique in ALVOS:
        pag = nav.new_page(
            viewport={"width": largura, "height": 900},
            device_scale_factor=2,
            color_scheme="dark" if nome in ESQUEMA_ESCURO else "light",
        )
        pag.goto(BASE + rota)
        pag.wait_for_load_state("networkidle")
        # As fontes proprias chegam depois do networkidle em borda fria, e um
        # print com fonte de fallback nao representa o produto.
        pag.wait_for_function(
            "document.fonts.status === 'loaded' && document.fonts.size > 0", timeout=15000
        )
        pag.wait_for_timeout(900)  # as barras entram com mola; espera assentar
        if clique:
            pag.get_by_role("button", name=clique).click()
            pag.wait_for_timeout(250)
        alvo = pag.locator(seletor) if seletor else pag
        alvo.screenshot(path=str(DESTINO / nome))
        print("ok:", nome)
        pag.close()
    nav.close()
