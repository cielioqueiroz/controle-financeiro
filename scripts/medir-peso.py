"""Atribui os bytes do chunk principal a cada origem, pelo sourcemap.

Uso:  cd frontend && npx vite build --sourcemap
      python scripts/medir-peso.py

POR QUE ESTE SCRIPT EXISTE. O ADR-0007 recusou o code-splitting por rota com
medicao (2,6% de gzip) e apontou o SDK do Neon como "39% da primeira pintura",
que precisa carregar no boot para decidir se ha sessao e "importa zod
estaticamente". A conclusao estava certa e o alvo, mal nomeado — e como aquele
ADR diz que so se reabre o assunto COM NUMERO NOVO, era preciso um jeito
repetivel de obter o numero.

Medido em 2026-09-06, chunk de 1033 kB minificado:

    CODIGO DO APP   29,8%      motion-dom       9,0%
    zod             23,4%      framer-motion    3,6%
    react-dom       17,4%      sonner           3,2%

O SDK do Neon SOZINHO (better-auth + @neondatabase/* + @better-fetch +
better-call + postgrest-js) da ~7%. O `zod` que ele arrasta da 23,4% —
tres vezes e meia todo o resto do SDK junto. O alvo, portanto, nao e
"reduzir o SDK": e tirar o zod da primeira pintura.

⚠️ SAO BYTES MINIFICADOS, NAO GZIP. Bibliotecas comprimem em taxas
diferentes, entao a fatia de cada uma no gzip nao e a mesma. Serve para
ordenar candidatos, nao para prometer economia.

⚠️ O Tailwind avisa que nao gera sourcemap na transformacao dele; a fatia de
CSS fica de fora desta conta, que e so do JS.

Sem dependencia nova: le o .map e soma os segmentos VLQ do mapping.
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

DIST = Path(r'D:\Projetos_Programacao\controle-financeiro\frontend\dist\assets')

B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
IDX = {c: i for i, c in enumerate(B64)}


def decodificar(seg: str) -> list[int]:
    valores, shift, atual = [], 0, 0
    for ch in seg:
        d = IDX[ch]
        atual += (d & 31) << shift
        if d & 32:
            shift += 5
            continue
        sinal = atual & 1
        v = atual >> 1
        valores.append(-v if sinal else v)
        shift, atual = 0, 0
    return valores


def rotulo(fonte: str) -> str:
    if 'node_modules/' not in fonte.replace('\\', '/'):
        return 'CÓDIGO DO APP'
    p = fonte.replace('\\', '/').split('node_modules/')[-1]
    partes = p.split('/')
    return '/'.join(partes[:2]) if partes[0].startswith('@') else partes[0]


def main() -> int:
    mapas = sorted(DIST.glob('index-*.js.map'), key=lambda f: f.stat().st_size, reverse=True)
    if not mapas:
        print('sem sourcemap — rode: npx vite build --sourcemap')
        return 1
    mapa = json.loads(mapas[0].read_text(encoding='utf-8'))
    js = mapas[0].with_suffix('')
    total_js = js.stat().st_size

    fontes = mapa['sources']
    por_fonte: dict[int, int] = defaultdict(int)

    # Percorre os mappings: cada segmento diz "a partir desta coluna da saida,
    # o codigo vem desta fonte". O tamanho e a distancia ate o proximo.
    fonte_atual = 0
    for linha in mapa['mappings'].split(';'):
        if not linha:
            continue
        col_saida = 0
        segs = [s for s in linha.split(',') if s]
        decodificados = []
        for s in segs:
            v = decodificar(s)
            col_saida += v[0]
            if len(v) >= 4:
                fonte_atual += v[1]
            decodificados.append((col_saida, fonte_atual if len(v) >= 4 else None))
        for i, (col, fnt) in enumerate(decodificados):
            fim = decodificados[i + 1][0] if i + 1 < len(decodificados) else col
            if fnt is not None and 0 <= fnt < len(fontes):
                por_fonte[fnt] += max(0, fim - col)

    agregado: dict[str, int] = defaultdict(int)
    for i, bytes_ in por_fonte.items():
        agregado[rotulo(fontes[i])] += bytes_

    atribuido = sum(agregado.values())
    print('CHUNK PRINCIPAL: %s (%.0f kB minificado)\n' % (js.name, total_js / 1024))
    print('  %-34s %9s %7s' % ('origem', 'bytes', '% atrib.'))
    print('  ' + '-' * 52)
    for nome, b in sorted(agregado.items(), key=lambda kv: -kv[1])[:16]:
        print('  %-34s %9d %6.1f%%' % (nome, b, 100 * b / atribuido))
    print('\n  atribuido: %d bytes de %d do arquivo' % (atribuido, total_js))
    return 0


if __name__ == '__main__':
    sys.exit(main())
