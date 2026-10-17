"""Valida Auth, SDK, RPC e interface reais na branch Neon desta rodada.

Branch FIXA br-billowing-mud-ac8q493y, expira em 23/10/2026. A rede do
navegador só alcança localhost e os dois hosts desta branch; produção é
bloqueada. Cria usuários/dados sintéticos, que expiram junto com a branch.
Não imprime nem grava senhas ou tokens.

Pré-requisitos: migração 0008, Auth e Data API ativos nessa branch;
verify_email_on_sign_up e verify_email_on_sign_in false (conferir pelo Neon);
http://127.0.0.1:5178 autorizado SOMENTE no Auth da branch de teste.
Iniciar Vite na porta 5178 com VITE_NEON_AUTH_URL/VITE_NEON_DATA_API_URL
apontando para os hosts abaixo. Não altera .env.local.

Da raiz: uv run --with playwright python scripts/validar-rpc-real.py
Resultado sanitizado em node_modules/.cache/validacao-rpc-real-resultado.json.
O PDF é gerado em memória; não contém dados reais.
"""
import json
import re
import secrets
import uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:5178"
AUTH_HOST = "ep-sparkling-hill-acpltupk.neonauth.sa-east-1.aws.neon.tech"
DATA_HOST = "ep-sparkling-hill-acpltupk.apirest.sa-east-1.aws.neon.tech"
MARCA = "rpc-real-" + uuid.uuid4().hex
CLIENTE = "const { obterNeon } = await import('/src/lib/neon.ts'); const neon = await obterNeon();"
RESULTADO = """const { salvarDocumento } = await import('/src/persist/salvar.ts');
const tx = {date:new Date('2026-10-01T00:00:00Z'),description:'TESTE SINTETICO RPC',amountCents:1234,installment:null,card:null,fx:null,kind:'compra',raw:'TESTE SINTETICO'};
const documento = {transactions:[tx,{...tx}],declaredTotal:2468,declaredIncome:null,declaredExpense:null,
period:{start:new Date('2026-10-01T00:00:00Z'),end:new Date('2026-10-31T00:00:00Z')},
account:{bank:'nubank',type:'credit_card',last4:'t017',agency:null,number:null,holderName:'TESTE SINTETICO'},
forward:{nextCloseDate:null,nextInvoiceBalance:null,totalOpenBalance:null,futureInstallmentsTotal:null}};
const kind={bank:'nubank',docType:'fatura'};
const bytes=new TextEncoder().encode('%PDF-1.4 '+marca).buffer;
const salvar=()=>salvarDocumento(documento,kind,bytes,marca+'.pdf',[]);
"""

def verificar(condicao, nome):
    if not condicao:
        raise AssertionError(nome)
    print("OK:", nome, flush=True)

def pdf_ui():
    # Coordenadas do layout já suportado; texto e números inteiramente fictícios.
    campos = [(72,740,'Esta e a sua fatura de'),(72,720,'FATURA 31 OUT 2026'),
        (72,700,'DE 01 OUT A 31 OUT'),(72,660,'RESUMO DA FATURA ATUAL'),
        (72,640,'Total a pagar'),(503.482,640,'R$ 7,89'),
        (123,600,'01 OUT'),(214,600,'TESTEUIRPC'),(503.482,600,'R$ 7,89')]
    texto = ' '.join('1 0 0 1 %s %s Tm (%s) Tj' % (x,y,t) for x,y,t in campos)
    fluxo = ('BT /F1 9 Tf '+texto+' ET').encode('ascii')
    objetos = [b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Length %d >>\nstream\n' % len(fluxo)+fluxo+b'\nendstream']
    saida = bytearray(b'%PDF-1.4\n')
    posicoes = []
    for i, corpo in enumerate(objetos,1):
        posicoes.append(len(saida))
        saida += b'%d 0 obj\n' % i + corpo + b'\nendobj\n'
    inicio = len(saida)
    saida += b'xref\n0 6\n0000000000 65535 f \n'
    for posicao in posicoes:
        saida += b'%010d 00000 n \n' % posicao
    saida += b'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % inicio
    return bytes(saida)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(locale="pt-BR", reduced_motion="reduce")
    ctx.add_init_script("localStorage.setItem('cf:tutorial-visto','1')")
    bloqueados = []
    http = []
    def restringir(route):
        host = urlparse(route.request.url).hostname
        if host in ("127.0.0.1", AUTH_HOST, DATA_HOST):
            route.continue_()
        else:
            if host and "neon.tech" in host:
                bloqueados.append(host)
            route.abort()
    ctx.route("**/*", restringir)
    page = ctx.new_page()
    page.set_default_timeout(30000)
    page.on("response", lambda response: http.append({"status":response.status,"path":urlparse(response.url).path}) if "/rpc/salvar_documento_atomico" in response.url else None)
    page.goto(BASE, wait_until="networkidle")
    verificar(not bloqueados, "frontend restrito aos hosts da branch de teste")

    # Sign-up não manda mensagem: verify_email_on_sign_up/sign_in são false,
    # conferidos pelo conector Neon antes desta execução. .invalid não é destinatário real.
    for indice in range(2):
        credenciais = {"email":f"{MARCA}-{indice}@example.invalid","password":secrets.token_urlsafe(32),"name":"Teste RPC"}
        user_id = page.evaluate("""async (credenciais) => {""" + CLIENTE + """
            const cadastro=await neon.auth.signUp.email(credenciais);
            if(cadastro.error) throw new Error('cadastro: '+cadastro.error.code);
            await neon.auth.signOut();
            const login=await neon.auth.signIn.email({email:credenciais.email,password:credenciais.password});
            if(login.error) throw new Error('login: '+login.error.code);
            const sess=await neon.auth.getSession();
            if(!sess.data?.session || !sess.data?.user?.id) throw new Error('sessão ausente');
            return sess.data.user.id;
        }""", credenciais)
        verificar(bool(user_id), f"Auth real: cadastro, saída, entrada e sessão do usuário sintético {indice+1}")

        if indice == 0:
            dono = user_id
            rollback = page.evaluate("""async (marca) => {""" + CLIENTE + """
                const payload={p_conta:{bank:'nubank',type:'credit_card',last4:'r017'},p_documento:{file_hash:marca+'-invalido',content_hash:marca+'-invalido',doc_type:'fatura',declared_total:100,conferencia:{versao:1,status:'confere',contagem:1,comparacoes:[{criterio:'total-fatura',gabaritoCents:100,extraidoCents:100,diferencaCents:0}]}},p_transacoes:[{date:'2026-10-01',description:'TESTE INVALIDO',amount_cents:100,direction:'out',kind:'invalido',hash:marca+'-invalido'}]};
                const r=await neon.rpc('salvar_documento_atomico',payload);
                const d=await neon.from('documents').select('id').eq('file_hash',marca+'-invalido');
                const a=await neon.from('accounts').select('id').eq('last4','r017');
                return {codigo:r.error?.code,status:r.status,documentos:d.data?.length,contas:a.data?.length,erroLeitura:!!(d.error||a.error)};
            }""", MARCA)
            verificar(rollback["codigo"] == "23514" and rollback["documentos"] == 0 and rollback["contas"] == 0 and not rollback["erroLeitura"], "RPC HTTP: erro na última tabela desfaz documento e conta")
            concorrencia = page.evaluate("async (marca) => {" + RESULTADO + "return await Promise.all([salvar(),salvar()]);}", MARCA)
            verificar(sorted(r["status"] for r in concorrencia) == ["documento-duplicado","salvo"], "duas chamadas HTTP simultâneas: uma gravação, uma duplicata")
            salvo = next(r for r in concorrencia if r["status"] == "salvo")
            verificar(salvo["inseridas"] == 2 and salvo["jaExistiam"] == 0, "duas ocorrências idênticas preservadas")
            doc_id = salvo["documentId"]
        else:
            visibilidade = page.evaluate("""async (docId) => {""" + CLIENTE + """
                const d=await neon.from('documents').select('id').eq('id',docId);
                const t=await neon.from('transactions').select('id').eq('document_id',docId);
                return {documentos:d.data?.length,transacoes:t.data?.length,erro:!!(d.error||t.error)};
            }""", doc_id)
            verificar(user_id != dono and visibilidade == {"documentos":0,"transacoes":0,"erro":False}, "JWT de outro usuário não lê documento nem transações do primeiro")
            salvo = page.evaluate("async (marca) => {" + RESULTADO + "return await salvar();}", MARCA)
            verificar(salvo["status"] == "salvo" and salvo["inseridas"] == 2, "mesmo conteúdo em outro usuário não vira duplicata")

        leitura = page.evaluate("""async () => {
            const { puxarTudo }=await import('/src/persist/puxar.ts');
            const { puxarDocumentos }=await import('/src/persist/documentos.ts');
            const txs=await puxarTudo(); const docs=await puxarDocumentos();
            return {qtd:txs.length,soma:txs.reduce((s,t)=>s+t.amount_cents,0),docs:docs.length,conferencia:docs[0]?.conferencia};
        }""")
        verificar(leitura["qtd"] == 2 and leitura["soma"] == 2468 and leitura["docs"] == 1, "adaptadores reais: contagem exata, centavos e documentos")
        verificar(leitura["conferencia"] == {"versao":1,"status":"confere","contagem":2,"comparacoes":[{"criterio":"total-fatura","gabaritoCents":2468,"extraidoCents":2468,"diferencaCents":0}]}, "conferência original preservada pelo transporte HTTP")
        retry = page.evaluate("async (marca) => {" + RESULTADO + "return await salvar();}", MARCA)
        verificar(retry["status"] == "documento-duplicado", "repetir documento via SDK reconhece duplicata")
        page.goto(BASE + "/faturas", wait_until="networkidle")
        page.get_by_text("Ver dados do documento", exact=True).click()
        expect(page.get_by_text("Conferência original", exact=True)).to_be_visible()
        expect(page.get_by_text(MARCA + ".pdf", exact=True)).to_be_visible()
        expect(page.get_by_text("Confere", exact=True)).to_be_visible()
        verificar(True, "sessão restaurada após reload e conferência renderizada na tela real")
        if indice == 0:
            navegacoes = []
            page.on('request', lambda request: navegacoes.append(request.url) if request.is_navigation_request() and request.frame == page.main_frame else None)
            page.get_by_role('link', name='Importação', exact=True).click()
            page.locator('input[type=file]').set_input_files({'name':MARCA+'-ui.pdf','mimeType':'application/pdf','buffer':pdf_ui()})
            expect(page.get_by_text('Confere com o banco', exact=True)).to_be_visible()
            expect(page.get_by_role('button', name='Salvar no histórico', exact=True)).to_be_enabled()
            perda = []
            def perder_resposta(route):
                resposta = route.fetch()
                perda.append(resposta.status)
                route.abort('failed')
            alvo = 'https://' + DATA_HOST + '/neondb/rest/v1/rpc/salvar_documento_atomico'
            page.route(alvo, perder_resposta, times=1)
            page.get_by_role('button', name='Salvar no histórico', exact=True).click()
            expect(page.get_by_text('Sem conexão com o servidor. Tente de novo em instantes.', exact=True)).to_be_visible()
            verificar(perda == [200], 'PDF real: motor, parser, conferência e commit, com resposta HTTP perdida')
            page.get_by_role('link', name='Painel', exact=True).click()
            expect(page.get_by_text('R$ 24,68', exact=True).first).to_be_visible()
            page.get_by_role('link', name='Importação', exact=True).click()
            page.get_by_role('button', name='Salvar no histórico', exact=True).click()
            expect(page).to_have_url(re.compile(re.escape(BASE)+r'/(\?.*)?$'))
            expect(page.get_by_text('R$ 32,57', exact=True).first).to_be_visible()
            verificar(not navegacoes, 'nova tentativa duplicada atualiza o Painel sem F5 nem nova navegação de documento')
            page.get_by_role('link', name='Faturas', exact=True).click()
            resumo = page.get_by_text('Ver dados do documento', exact=True)
            expect(resumo).to_have_count(2)
            for i in range(resumo.count()):
                resumo.nth(i).click()
            expect(page.get_by_text(MARCA+'-ui.pdf', exact=True)).to_be_visible()
            expect(page.get_by_text('Conferência original', exact=True)).to_have_count(2)
            verificar(True, 'documento importado pela UI mostra sua conferência original salva')
        page.evaluate("async () => {" + CLIENTE + "await neon.auth.signOut();}")

    ctx.close()
    ctx = browser.new_context(locale="pt-BR")
    ctx.route("**/*", restringir)
    page = ctx.new_page()
    page.goto(BASE, wait_until="networkidle")
    anonimo = page.evaluate("""async () => {""" + CLIENTE + """
        const sess=await neon.auth.getSession();
        const r=await neon.rpc('salvar_documento_atomico',{p_conta:{},p_documento:{},p_transacoes:[]});
        return {status:r.status,codigo:r.error?.code,sessao:!!sess.data?.session,erro:!!r.error};
    }""")
    sem_jwt = ctx.request.post('https://' + DATA_HOST + '/neondb/rest/v1/rpc/salvar_documento_atomico',
        data={"p_conta":{},"p_documento":{},"p_transacoes":[]})
    anonimo['httpSemJwt'] = sem_jwt.status
    mensagem = sem_jwt.json().get('message','')
    verificar(not anonimo['sessao'] and anonimo['erro'] and sem_jwt.status == 400 and mensagem.startswith('missing authentication credentials:'), "chamada sem sessão/JWT é recusada pelo SDK e pelo servidor HTTP")
    verificar(not bloqueados, "nenhuma chamada a Neon de produção")
    Path("node_modules/.cache/validacao-rpc-real-resultado.json").write_text(json.dumps({"ok":True,"branch":"br-billowing-mud-ac8q493y","usuariosSinteticos":2,"http":http,"anonimo":anonimo},ensure_ascii=False,indent=2),encoding="utf-8")
    browser.close()
    print("RESULTADO: OK - Auth, SDK, HTTP, RPC, RLS e tela reais na branch de teste.", flush=True)
