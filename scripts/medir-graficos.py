"""Prova a geometria e os tokens efetivamente renderizados, além do JSX.

Uso: uv run --with playwright python scripts/medir-graficos.py http://127.0.0.1:5173
"""
import sys
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'http://127.0.0.1:5173'

with sync_playwright() as p:
    browser = p.chromium.launch()
    for tema in ('claro', 'escuro'):
        for largura in (1280, 390):
            page = browser.new_page(viewport={'width': largura, 'height': 844}, locale='pt-BR', reduced_motion='reduce')
            page.goto(f'{BASE}/demo.html?tela=relatorios&janela=3&tema={tema}')
            expect(page.get_by_text('Fluxo financeiro', exact=True)).to_be_visible()
            grafico = page.locator('[data-grafico="fluxo"]')
            page.get_by_role('button', name='Resultado do período', exact=True).click()
            erros = grafico.evaluate('''el => {
                const svg = el.querySelector('svg');
                const line = svg.querySelector('path[data-serie="resultado"]');
                const ctm = svg.getScreenCTM();
                const buttons = [...el.querySelectorAll('button[aria-label*="entradas"]')];
                return [...line.getAttribute('d').matchAll(/[ML] ([\\d.]+) ([\\d.]+)/g)].map((m, i) => {
                    const point = new DOMPoint(+m[1], +m[2]).matrixTransform(ctm);
                    const rect = buttons[i].getBoundingClientRect();
                    return Math.abs(point.x - (rect.left + rect.width / 2));
                });
            }''')
            assert len(erros) >= 2 and max(erros) < 1, erros
            barras = grafico.locator('rect[data-serie]')
            assert barras.count() > 0, 'O fluxo mensal deve mostrar barras de entradas e saídas'
            cores = grafico.locator('svg circle').evaluate_all("els => els.map(el => getComputedStyle(el).fill)")
            assert len(cores) > 0 and all(c != 'none' for c in cores), cores
            acumulado = page.get_by_role('group', name='Leitura').get_by_role(
                'button', name='Resultado acumulado', exact=True
            )
            acumulado.click()
            expect(acumulado).to_have_attribute('aria-pressed', 'true')
            expect(grafico.locator('path[data-serie="acumulado"]')).to_be_visible()
            expect(page.get_by_text('Soma dos resultados dos meses com transações importadas', exact=False)).to_be_visible()
            for janela in ('6 meses', '12 meses'):
                page.get_by_role('button', name=janela, exact=True).click()
                rotulos = page.locator('[data-grafico="fluxo"] button > span:last-child').evaluate_all('''els =>
                    els.filter(el => getComputedStyle(el).display !== 'none').map(el => {
                        const r = el.getBoundingClientRect(); return {left:r.left, right:r.right};
                    })''')
                assert all(a['right'] <= b['left'] for a, b in zip(rotulos, rotulos[1:])), rotulos
            page.get_by_role('button', name='3 meses', exact=True).click()
            page.get_by_role('button', name='Resultado do período', exact=True).click()
            entrada = page.get_by_role('button', name='Entradas', exact=True)
            entrada.click()
            expect(entrada).to_have_attribute('aria-pressed', 'true')
            gatilho = page.get_by_role('button').filter(has_text='Supermercado').first
            gatilho.click()
            detalhe = page.locator('[data-prova="detalhe-relatorio"]')
            expect(detalhe.get_by_role('heading')).to_be_focused()
            detalhe.locator('summary').first.click()
            expect(detalhe.locator('details').first.locator('li').first).to_be_visible()
            detalhe.get_by_role('button', name='Voltar ao gráfico').click()
            expect(gatilho).to_be_focused()
            print(f'OK {tema} {largura}px: geometria, cores, rótulos 3/6/12 meses, seleção e procedência')
            page.close()
    browser.close()
