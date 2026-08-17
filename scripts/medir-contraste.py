"""Mede o contraste WCAG dos pares que o app realmente usa.

Não é enfeite: em 2026-08-05 seis pares reprovaram AA e foram corrigidos por
BUSCA, preservando matiz e saturação — não escolhidos a olho. Este script é o
que torna isso repetível quando a paleta muda.

Uso:  python scripts/medir-contraste.py
"""

# ---------------------------------------------------------------- tokens
# Direção "livro-razão": papel frio de formulário bancário, tinta azul-ferro.
# Deliberadamente NÃO é creme (#F4F1EA e vizinhos): aquilo, somado a serifada
# de alto contraste e acento terracota, é hoje o visual padrão de página
# gerada por IA — e era exatamente o que o app tinha.
CLARO = {
    "pagina": "#f6f7f9",
    "cartao": "#ffffff",
    "afundado": "#eef1f5",
    "borda": "#d7dde5",
    "borda-campo": "#7f8c9d",
    "tinta": "#0f1a24",
    "tinta-fraca": "#42525f",
    "tinta-tenue": "#5d6b78",
    "marca": "#1b5e8f",
    "credito": "#1c6b4a",
    "debito": "#b3261e",
    "ressalva": "#8a5a00",
    "barra": "#7f8c9d",
}

ESCURO = {
    "pagina": "#0d1319",
    "cartao": "#161d25",
    "afundado": "#1d252e",
    "borda": "#2b3641",
    "borda-campo": "#6b7887",
    "tinta": "#e9eef3",
    "tinta-fraca": "#a8b5c1",
    "tinta-tenue": "#8b98a5",
    "marca": "#6bb3e8",
    "credito": "#5fbf8f",
    "debito": "#f0817a",
    "ressalva": "#d9a441",
    "barra": "#6b7887",
}

SUPERFICIES = ["pagina", "cartao", "afundado"]
# Cores que carregam TEXTO — precisam de 4.5:1 (AA para texto normal).
TEXTO = ["tinta", "tinta-fraca", "tinta-tenue", "marca", "credito", "debito", "ressalva"]
# Cores que só desenham CONTORNO de controle, ou uma FORMA cheia que carrega
# informação sem texto dentro (a barra do gráfico) — a WCAG pede 3:1.
CONTORNO = ["borda-campo", "barra"]


def _lin(c: float) -> float:
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminancia(hexcor: str) -> float:
    h = hexcor.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def contraste(a: str, b: str) -> float:
    la, lb = luminancia(a), luminancia(b)
    claro, escuro = max(la, lb), min(la, lb)
    return (claro + 0.05) / (escuro + 0.05)


def medir(nome: str, tokens: dict) -> list:
    falhas = []
    print(f"\n{'=' * 62}\n  TEMA {nome}\n{'=' * 62}")
    for grupo, minimo in ((TEXTO, 4.5), (CONTORNO, 3.0)):
        for cor in grupo:
            piores = []
            for sup in SUPERFICIES:
                r = contraste(tokens[cor], tokens[sup])
                piores.append((r, sup))
            piores.sort()
            pior, onde = piores[0]
            ok = pior >= minimo
            marca = "OK  " if ok else "FALHA"
            print(f"  [{marca}] {cor:<14} {pior:5.2f}:1  (pior: sobre {onde}, minimo {minimo})")
            if not ok:
                falhas.append((nome, cor, pior, onde, minimo))
    return falhas


if __name__ == "__main__":
    falhas = medir("CLARO", CLARO) + medir("ESCURO", ESCURO)
    print(f"\n{'=' * 62}")
    if falhas:
        print(f"  {len(falhas)} PAR(ES) REPROVAM — corrigir antes de aplicar:")
        for tema, cor, r, onde, minimo in falhas:
            print(f"    {tema} · {cor}: {r:.2f}:1 sobre {onde} (precisa {minimo})")
        raise SystemExit(1)
    print("  RESULTADO: OK — todos os pares passam")
