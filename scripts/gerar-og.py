"""Gera public/og.png (1200x630) a partir de scripts/og-card.html.

Uso:  python scripts/gerar-og.py

Rode de novo sempre que a marca mudar. A imagem e versionada porque o build
da Vercel nao roda Playwright.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / "scripts" / "og-card.html"
# `frontend/public/`, não `public/`: a pasta mudou de lugar na reforma de
# 2026-08-07 e este caminho ficou para trás — o script criava um `public/` na
# raiz que ninguém servia, e o og.png publicado continuava sendo o antigo.
DESTINO = RAIZ / "frontend" / "public" / "og.png"

with sync_playwright() as p:
    navegador = p.chromium.launch(headless=True)
    pagina = navegador.new_page(viewport={"width": 1200, "height": 630})
    pagina.goto(ORIGEM.as_uri())
    pagina.wait_for_load_state("networkidle")
    # As fontes do Google chegam depois do networkidle em alguns casos.
    pagina.wait_for_timeout(1200)
    pagina.screenshot(path=str(DESTINO))
    navegador.close()

print(f"gerado: {DESTINO} ({DESTINO.stat().st_size // 1024} kB)")
