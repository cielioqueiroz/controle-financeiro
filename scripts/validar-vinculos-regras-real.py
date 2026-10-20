"""Ensaia 0009–0011 com SDK, Auth/JWT e Data API reais na branch de teste.

Usa exclusivamente br-billowing-mud-ac8q493y (expira em 23/10/2026).
Iniciar Vite em 127.0.0.1:5178 com os hosts documentados no ensaio da RPC.
Requer as três migrações e a configuração de Auth desse ensaio, sem envio
de e-mail no cadastro. Não altera .env.local nem imprime senhas/tokens.
Cria somente identidades example.invalid e documentos sintéticos/anonimizados.
Exclusões atingem apenas documentos criados nesta execução.
"""
import json
import re
import secrets
import uuid
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

BASE = "http://127.0.0.1:5178"
BRANCH = "br-billowing-mud-ac8q493y"
AUTH_HOST = "ep-sparkling-hill-acpltupk.neonauth.sa-east-1.aws.neon.tech"
DATA_HOST = "ep-sparkling-hill-acpltupk.apirest.sa-east-1.aws.neon.tech"
RAIZ = Path(__file__).resolve().parent.parent
CLIENTE = "const { obterNeon } = await import('/src/lib/neon.ts'); const neon = await obterNeon();"

ENSAIO = r"""async ({marca, fixtures}) => {
  const { obterNeon } = await import('/src/lib/neon.ts');
  const neon = await obterNeon();
  const { editarTransacao } = await import('/src/persist/editar.ts');
  const { apagarDocumento, puxarDocumentos } = await import('/src/persist/documentos.ts');
  const { salvarRegra, puxarRegras, apagarRegra } = await import('/src/persist/regras.ts');
  const { criarRegraConsulta } = await import('/src/domain/categorize/regras.ts');
  const { salvarDocumento } = await import('/src/persist/salvar.ts');
  const { puxarTudo } = await import('/src/persist/puxar.ts');
  const provas = [];
  const documentos = [];
  const conferir = (condicao, nome) => {
    if (!condicao) throw new Error('Prova falhou: ' + nome);
    provas.push(nome);
  };
  const ler = (resposta) => {
    if (resposta.error) throw new Error('Data API: ' + resposta.error.code);
    return resposta.data;
  };
  const transacao = async (id) => {
    const linhas = ler(await neon.from('transactions').select('*').eq('document_id',id));
    if (linhas.length !== 1) throw new Error('Documento sintético sem transação única');
    return linhas[0];
  };
  const documento = async (chave, tipo, valor, conta, data, descricao='TESTE SINTETICO') => {
    const resposta = ler(await neon.rpc('salvar_documento_atomico',{
      p_conta:{bank:'nubank',type:tipo==='fatura'?'credit_card':'checking',number:conta},
      p_documento:{file_hash:marca+chave,content_hash:marca+chave,doc_type:tipo,
        period_start:data,period_end:data,declared_total:tipo==='fatura'?valor:null,
        filename:chave+'.pdf',
        conferencia:{versao:1,status:'sem-gabarito',contagem:1,comparacoes:[]}},
      p_transacoes:[{date:data,description:descricao,amount_cents:valor,
        direction:valor<0?'in':'out',kind:valor<0?'income':'expense',hash:marca+chave}]
    }));
    conferir(resposta.status==='salvo','RPC grava '+chave);
    documentos.push(resposta.documentId);
    return resposta.documentId;
  };

  const extrato = await documento('extrato-anterior','extrato',10101,'conta-a','2026-10-10','Pagamento de fatura');
  conferir((await transacao(extrato)).vinculo_criterio===null,'sem contraparte não inventa evidência');
  const conferencia = ler(await neon.from('documents').select('conferencia').eq('id',extrato))[0].conferencia;
  const fatura = await documento('fatura-posterior','fatura',10101,'cartao-a','2026-10-11');
  let ponta = await transacao(extrato);
  conferir(ponta.kind==='card_payment' && ponta.vinculo_document_id===fatura &&
    ponta.vinculo_criterio==='quitacao-fatura','fatura posterior reconcilia extrato anterior via HTTP');
  conferir(JSON.stringify(ler(await neon.from('documents').select('conferencia').eq('id',extrato))[0].conferencia)
    ===JSON.stringify(conferencia),'reconciliação preserva conferência original');
  const faturaAntes = await documento('fatura-anterior','fatura',10202,'cartao-a','2026-10-10');
  const extratoDepois = await documento('extrato-posterior','extrato',10202,'conta-a','2026-10-17','GASTOS CARTAO DE CREDITO');
  conferir((await transacao(extratoDepois)).vinculo_document_id===faturaAntes,'ordem inversa e limite de sete dias');
  const ambigua = await documento('fatura-ambigua','fatura',10202,'cartao-b','2026-10-10');
  conferir((await transacao(extratoDepois)).vinculo_criterio===null,'segunda fatura desfaz escolha ambígua');
  await apagarDocumento(ambigua);
  conferir((await transacao(extratoDepois)).vinculo_document_id===faturaAntes,'excluir ambiguidade recompõe vínculo');

  const saida = await documento('pix-saida','extrato',20101,'conta-a','2026-10-10','PIX ENVIADO TESTE');
  const entrada = await documento('pix-entrada','extrato',-20101,'conta-b','2026-10-12','TRANSFERENCIA RECEBIDA TESTE');
  const a = await transacao(saida), b = await transacao(entrada);
  conferir(a.kind==='internal_transfer' && b.kind==='internal_transfer' &&
    a.vinculo_transacao_id===b.id && b.vinculo_transacao_id===a.id,'transferência tem evidência recíproca via HTTP');
  const terceira = await documento('pix-ambiguo','extrato',-20101,'conta-c','2026-10-11','PIX RECEBIDO TESTE');
  conferir((await transacao(saida)).vinculo_criterio===null &&
    (await transacao(entrada)).vinculo_criterio===null,'terceira ponta desfaz transferência ambígua');
  await apagarDocumento(terceira);
  conferir((await transacao(saida)).kind==='internal_transfer','exclusão de terceira ponta recompõe transferência');
  await editarTransacao(a.id,{kind:'expense'});
  conferir((await transacao(saida)).vinculo_manual && (await transacao(entrada)).kind==='income' &&
    (await transacao(entrada)).vinculo_criterio===null,'edição manual desfaz as duas pontas');
  await documento('apos-edicao','extrato',999,'conta-d','2026-10-10');
  conferir((await transacao(saida)).kind==='expense' && (await transacao(saida)).vinculo_manual,
    'nova importação respeita correção manual');
  const excluirSaida = await documento('ted-saida','extrato',20202,'conta-a','2026-10-10','TED ENVIADA TESTE');
  const excluirEntrada = await documento('ted-entrada','extrato',-20202,'conta-b','2026-10-10','TED RECEBIDA TESTE');
  await apagarDocumento(excluirEntrada);
  conferir((await transacao(excluirSaida)).kind==='expense' &&
    (await transacao(excluirSaida)).vinculo_transacao_id===null,'excluir contraparte restaura natureza sem evidência órfã');
  const falsificar = await neon.from('transactions').update({vinculo_document_id:fatura}).eq('id',a.id);
  conferir(falsificar.error?.code==='42501','JWT não pode forjar evidência protegida');
  const interna = await neon.rpc('reconciliar_vinculos_usuario',{p_usuario:'00000000-0000-4000-8000-000000000091'});
  conferir(interna.error?.code==='42501' || interna.error?.code==='PGRST202',
    'função interna não está disponível ao JWT (HTTP '+interna.status+', '+interna.error?.code+')');

  async function compra(chave, bank='caixa', valor=15000, descricao='COMPRA SINTETICA REGRA') {
    const raw = {date:new Date('2026-10-20T12:00:00Z'),description:descricao+' '+chave,
      amountCents:valor,installment:null,card:null,fx:null,kind:'compra',raw:descricao};
    const result = {transactions:[raw],declaredTotal:null,declaredIncome:null,declaredExpense:valor,
      period:{start:raw.date,end:raw.date},
      account:{bank,type:'checking',last4:null,agency:'9999',number:'regra-'+bank,holderName:null},
      forward:{nextCloseDate:null,nextInvoiceBalance:null,totalOpenBalance:null,futureInstallmentsTotal:null}};
    const salvo = await salvarDocumento(result,{bank,docType:'extrato'},
      new TextEncoder().encode(marca+chave).buffer,chave+'.pdf',await puxarRegras());
    conferir(salvo.status==='salvo','adaptador grava '+chave);
    documentos.push(salvo.documentId);
    return salvo.documentId;
  }
  const anterior = await compra('regra-antes');
  conferir((await transacao(anterior)).category_slug==='outros','documento anterior mantém categoria global');
  const regra = criarRegraConsulta('banco:caixa >100','servicos');
  await salvarRegra(regra);
  conferir((await puxarRegras()).some(r=>r.tipo==='consulta' && r.padrao===regra.padrao),'regra consulta atravessa RPC e leitura reais');
  const depois = await compra('regra-depois');
  conferir((await transacao(depois)).category_slug==='servicos' &&
    (await transacao(anterior)).category_slug==='outros','consulta só categoriza documentos futuros');
  const outroBanco = await compra('regra-banco','bb');
  const limite = await compra('regra-limite','caixa',10000);
  conferir((await transacao(outroBanco)).category_slug==='outros' &&
    (await transacao(limite)).category_slug==='outros','operadores respeitam banco e limite estrito em centavos');
  const falha = await neon.rpc('salvar_regra_atomica',{p_regra:{padrao:regra.padrao,match_type:'consulta',
    categoria:'taxas',prioridade:1e30}});
  conferir(falha.error?.code==='22003' &&
    (await puxarRegras()).find(r=>r.padrao===regra.padrao)?.categoria==='servicos',
    'falha no INSERT da regra faz rollback do DELETE pela Data API');
  let recusou = false;
  try { await salvarRegra({...regra,padrao:'>100 <100'}); } catch { recusou=true; }
  conferir(recusou,'adaptador recusa consulta contraditória');
  await salvarRegra(criarRegraConsulta('cat:combustivel posto','viagem'));
  const categoria = await compra('regra-categoria','bb',15000,'AUTO POSTO TESTE');
  conferir((await transacao(categoria)).category_slug==='viagem','consulta usa categoria global e texto do documento');
  await salvarRegra(criarRegraConsulta('sem:categoria <500','taxas'));
  const semCategoria = await compra('regra-sem-categoria','nubank',12345);
  conferir((await transacao(semCategoria)).category_slug==='taxas','sem categoria e magnitude operam na gravação real');
  await apagarRegra(regra);
  conferir(!(await puxarRegras()).some(r=>r.padrao===regra.padrao),'remoção de regra atravessa Data API');

  const { buildLines } = await import('/src/domain/pdf/lines.ts');
  const { parse } = await import('/src/domain/parsers/index.ts');
  const { validar } = await import('/src/domain/validate/checksum.ts');
  for (const [nome,items] of Object.entries(fixtures)) {
    const {kind,result} = parse(buildLines(items));
    conferir(validar(result).status==='confere','fixture anonimizado confere: '+nome);
    const salvo = await salvarDocumento(result,kind,new TextEncoder().encode(marca+nome).buffer,nome+'.pdf',[]);
    conferir(salvo.status==='salvo','parser e adaptador gravam '+nome);
    documentos.push(salvo.documentId);
    const txs = ler(await neon.from('transactions').select('amount_cents').eq('document_id',salvo.documentId));
    const doc = (await puxarDocumentos()).find(d=>d.id===salvo.documentId);
    conferir(txs.length===result.transactions.length &&
      txs.reduce((s,t)=>s+t.amount_cents,0)===result.transactions.reduce((s,t)=>s+t.amountCents,0) &&
      doc.bank===kind.bank && doc.conferencia.status==='confere','HTTP preserva banco, contagem, centavos e conferência: '+nome);
  }
  const txs = await puxarTudo();
  const docs = await puxarDocumentos();
  const { conferirVinculos } = await import('/src/domain/link/conferencia-vinculos.ts');
  const pares = conferirVinculos(txs,docs);
  conferir(pares.some(p=>p.criterio==='quitacao-fatura' && p.origem?.documento.id===extrato &&
    p.destino?.documento.id===fatura),'leitura e domínio apresentam par salvo com documentos reais');
  return {provas,documentos,fatura,extrato,transacao:a.id,regras:(await puxarRegras()).length};
}"""


def main():
    marca = "vinculos-reais-" + uuid.uuid4().hex
    nomes = ["caixa-extrato", "caixa-extrato-transferencias", "bb-extrato-antigo"]
    fixtures = {nome: json.loads((RAIZ / "frontend/tests/fixtures" / (nome + ".items.json")).read_text(encoding="utf-8"))
                for nome in nomes}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        contexto = browser.new_context(locale="pt-BR", reduced_motion="reduce")
        contexto.add_init_script("localStorage.setItem('cf:tutorial-visto','1')")
        bloqueados = []

        def restringir(route):
            host = urlparse(route.request.url).hostname
            if host in ("127.0.0.1", AUTH_HOST, DATA_HOST):
                route.continue_()
            else:
                if host and "neon.tech" in host:
                    bloqueados.append(host)
                route.abort()

        contexto.route("**/*", restringir)
        page = contexto.new_page()
        page.set_default_timeout(30000)
        page.goto(BASE, wait_until="networkidle")

        def entrar(indice):
            credenciais = {"email": marca + "-" + str(indice) + "@example.invalid",
                           "password": secrets.token_urlsafe(32), "name": "Teste de vínculos"}
            page.evaluate("""async (credenciais) => {""" + CLIENTE + """
                await neon.auth.signOut();
                const r=await neon.auth.signUp.email(credenciais);
                if(r.error) throw new Error('cadastro: '+r.error.code);
                const sess=await neon.auth.getSession();
                if(!sess.data?.session) throw new Error('Sessão de teste ausente');
            }""", credenciais)

        entrar(0)
        resultado = page.evaluate(ENSAIO, {"marca": marca, "fixtures": fixtures})
        for prova in resultado["provas"]:
            print("OK:", prova, flush=True)
        page.goto(BASE + "/faturas", wait_until="networkidle")
        page.get_by_text("Conferir vínculos entre documentos", exact=True).click()
        painel = page.locator("details").filter(
            has=page.get_by_text("Conferir vínculos entre documentos", exact=True))
        expect(painel.get_by_role("heading", name="Quitação de fatura", exact=True).first).to_be_visible()
        expect(painel.get_by_text("fatura-posterior.pdf", exact=True)).to_be_visible()
        painel.get_by_role("button", name="Ver documento importado", exact=True).first.click()
        expect(page).to_have_url(re.compile(r"[?&]documento=[0-9a-f-]+"))
        print("OK: tela real apresenta par e abre documento de origem", flush=True)

        entrar(1)
        isolamento = page.evaluate("""async ({fatura,extrato,transacao}) => {""" + CLIENTE + """
            const docs=await neon.from('documents').select('id').in('id',[fatura,extrato]);
            const txs=await neon.from('transactions').select('id').eq('id',transacao);
            const regras=await neon.from('merchant_rules').select('id');
            const atualizar=await neon.from('transactions').update({kind:'income'}).eq('id',transacao).select('id');
            const apagar=await neon.from('documents').delete().eq('id',fatura).select('id');
            return {documentos:docs.data?.length,transacoes:txs.data?.length,regras:regras.data?.length,
                atualizadas:atualizar.data?.length,excluidos:apagar.data?.length,
                erro:!!(docs.error||txs.error||regras.error||atualizar.error||apagar.error)};
        }""", resultado)
        if isolamento != {"documentos": 0, "transacoes": 0, "regras": 0, "atualizadas": 0,
                          "excluidos": 0, "erro": False}:
            raise AssertionError("RLS não isolou os usuários sintéticos")
        if bloqueados:
            raise AssertionError("Frontend tentou alcançar outro host Neon")
        print("OK: segundo JWT não lê regras/documentos/transações nem edita ou exclui linhas do primeiro", flush=True)
        print("OK: nenhuma chamada ao Neon de produção", flush=True)
        saida = RAIZ / "node_modules/.cache/validacao-vinculos-regras-real-resultado.json"
        saida.parent.mkdir(parents=True, exist_ok=True)
        saida.write_text(json.dumps({"ok": True, "branch": BRANCH, "migrações": ["0009", "0010", "0011"],
            "provas": resultado["provas"], "documentosSinteticos": resultado["documentos"],
            "isolamento": isolamento, "interface": True}, ensure_ascii=False, indent=2), encoding="utf-8")
        contexto.close()
        browser.close()
        print("RESULTADO: OK - vínculos, regras e parsers pela Data API real da branch de teste.", flush=True)


if __name__ == "__main__":
    main()
