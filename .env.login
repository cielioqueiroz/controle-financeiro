# Modo do `scripts/medir-login.py` — a rede de testes que a ADR-0008 pedia.
#
# VERSIONADO de propósito, e sem segredo nenhum: são dois endereços de
# localhost servidos pelo próprio medidor, que responde como o Neon Auth
# responderia. A porta é fixa porque as VITE_* são ASSADAS NO BUILD — não dá
# para sortear a porta depois e avisar o bundle.
#
# ⚠️ O `.env.semlogin.local` é gitignored, e por isso o `build:semlogin` só
# funciona na máquina do dono (num clone limpo ele passa por acaso, porque a
# ausência das VITE_* leva ao mesmo modo). Este aqui não repete o erro.
VITE_NEON_AUTH_URL=http://127.0.0.1:4599/auth
VITE_NEON_DATA_API_URL=http://127.0.0.1:4599/data
