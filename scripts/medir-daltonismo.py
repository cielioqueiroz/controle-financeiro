"""Mede a separação perceptual da paleta funcional dos gráficos.

As simulações usam as matrizes de Machado, Oliveira e Fernandes (2009) para
deficiência total de visão de cor. A distância é Delta E 1976 em CIELAB: abaixo
de 10 duas cores funcionais ficam proximas demais para sustentarem significado
sozinhas. Categorias são apenas relatadas, porque a interface sempre repete
ícone, nome, valor e percentual; já entrada, saída, alerta, acumulado e neutro
carregam papéis diferentes e por isso precisam passar.

Uso:  python scripts/medir-daltonismo.py
"""

from itertools import combinations
from math import pow, sqrt
from pathlib import Path
import re


MATRIZES = {
    "protanopia": (
        (0.152286, 1.052583, -0.204868),
        (0.114503, 0.786281, 0.099216),
        (-0.003882, -0.048116, 1.051998),
    ),
    "deuteranopia": (
        (0.367322, 0.860646, -0.227968),
        (0.280085, 0.672501, 0.047413),
        (-0.011820, 0.042940, 0.968881),
    ),
    "tritanopia": (
        (1.255528, -0.076749, -0.178779),
        (-0.078411, 0.930809, 0.147602),
        (0.004733, 0.691367, 0.303900),
    ),
}

MINIMO_DELTA_E = 10.0


def srgb_para_linear(canal: float) -> float:
    return canal / 12.92 if canal <= 0.04045 else pow((canal + 0.055) / 1.055, 2.4)


def linear_para_srgb(canal: float) -> float:
    canal = min(1.0, max(0.0, canal))
    return 12.92 * canal if canal <= 0.0031308 else 1.055 * pow(canal, 1 / 2.4) - 0.055


def hex_para_rgb(cor: str) -> tuple[float, float, float]:
    valor = cor.lstrip("#")
    return tuple(int(valor[i:i + 2], 16) / 255 for i in (0, 2, 4))


def simular(cor: str, matriz: tuple[tuple[float, ...], ...]) -> tuple[float, float, float]:
    linear = tuple(srgb_para_linear(c) for c in hex_para_rgb(cor))
    transformada = tuple(sum(linha[i] * linear[i] for i in range(3)) for linha in matriz)
    return tuple(linear_para_srgb(c) for c in transformada)


def rgb_para_lab(rgb: tuple[float, float, float]) -> tuple[float, float, float]:
    r, g, b = (srgb_para_linear(c) for c in rgb)
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b)
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883

    def f(valor: float) -> float:
        return pow(valor, 1 / 3) if valor > 216 / 24389 else (24389 / 27 * valor + 16) / 116

    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def delta_e(a: str, b: str, matriz: tuple[tuple[float, ...], ...]) -> float:
    lab_a = rgb_para_lab(simular(a, matriz))
    lab_b = rgb_para_lab(simular(b, matriz))
    return sqrt(sum((x - y) ** 2 for x, y in zip(lab_a, lab_b)))


def tokens(trecho: str, prefixo: str) -> dict[str, str]:
    return dict(re.findall(rf"--color-{prefixo}-([\w-]+):\s*(#[\da-fA-F]{{6}})", trecho))


def medir(tema: str, graficos: dict[str, str], categorias: dict[str, str]) -> list[tuple[str, str, str, float]]:
    falhas = []
    print(f"\n{'=' * 68}\n  TEMA {tema}\n{'=' * 68}")
    for deficiencia, matriz in MATRIZES.items():
        pares = sorted(
            ((delta_e(cor_a, cor_b, matriz), nome_a, nome_b)
             for (nome_a, cor_a), (nome_b, cor_b) in combinations(graficos.items(), 2)),
        )
        pior, nome_a, nome_b = pares[0]
        ok = pior >= MINIMO_DELTA_E
        print(f"  [{'OK  ' if ok else 'FALHA'}] {deficiencia:<13} delta E {pior:5.1f}  ({nome_a} x {nome_b})")
        if not ok:
            falhas.append((tema, deficiencia, f"{nome_a} x {nome_b}", pior))

        categorias_pares = sorted(
            ((delta_e(cor_a, cor_b, matriz), nome_a, nome_b)
             for (nome_a, cor_a), (nome_b, cor_b) in combinations(categorias.items(), 2)),
        )
        cat_pior, cat_a, cat_b = categorias_pares[0]
        print(f"         categorias     delta E {cat_pior:5.1f}  ({cat_a} x {cat_b}; rotulos redundantes)")
    return falhas


if __name__ == "__main__":
    css = (Path(__file__).resolve().parents[1] / "frontend/src/index.css").read_text(encoding="utf-8")
    claro, escuro = css.split(':root[data-theme="dark"]', 1)
    falhas = []
    for nome, trecho in (("CLARO", claro), ("ESCURO", escuro)):
        graficos = tokens(trecho, "grafico")
        categorias = tokens(trecho, "categoria")
        if len(graficos) < 5 or len(categorias) < 10:
            raise ValueError(f"Paleta incompleta no tema {nome}")
        falhas.extend(medir(nome, graficos, categorias))

    print(f"\n{'=' * 68}")
    if falhas:
        print(f"  {len(falhas)} PAR(ES) FUNCIONAIS REPROVAM (minimo delta E {MINIMO_DELTA_E:.0f})")
        for tema, deficiencia, par, distancia in falhas:
            print(f"    {tema} - {deficiencia} - {par}: delta E {distancia:.1f}")
        raise SystemExit(1)
    print("  RESULTADO: OK - papeis funcionais permanecem distinguiveis")
