# 💰 Controle Financeiro

Aplicação web para gerenciar suas finanças pessoais: registre **entradas** e **saídas**, acompanhe seu **saldo**, organize por **categorias** e visualize tudo em um gráfico. Os dados ficam salvos no próprio navegador — não precisa de cadastro, login ou internet depois de carregar.

> Feito com HTML, CSS e JavaScript puro (módulos ES), **sem frameworks e sem etapa de build**.

---

## ✨ Funcionalidades

- ➕ **Lançamentos** de entrada e saída com descrição, valor, tipo, categoria e data
- 💵 **Máscara de moeda automática** — digite só os números e o `R$`, os pontos e a vírgula entram sozinhos
- 📊 **Resumo** de entradas, saídas, saldo total e saldo do mês atual
- 🍩 **Gráfico donut** com a proporção entre entradas e saídas
- 🏷️ **Categorias** com ícone e cor (Salário, Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Outros)
- 🔎 **Busca e filtros** por descrição, tipo, categoria e período (mês atual)
- ↕️ **Ordenação** por data ou valor
- ✏️ **Editar** e 🗑️ **excluir** lançamentos com confirmação
- 🌗 **Tema claro/escuro** com a preferência salva
- 📁 **Exportar** (JSON) e **importar** (JSON/CSV) seus dados — ótimo para backup
- 📱 **Responsivo** — no celular a tabela vira cartões empilhados
- ♿ **Acessível** — modais com foco automático, navegação por teclado e fechamento com `Esc`

---

## 🚀 Como executar

A aplicação usa **módulos ES**, então precisa ser servida por um servidor HTTP (não funciona abrindo o arquivo direto com `file://`).

### Opção 1 — Python

```bash
python -m http.server 5500
```

Depois abra <http://localhost:5500> no navegador.

### Opção 2 — Node (npx)

```bash
npx serve
```

### Opção 3 — VS Code

Instale a extensão **Live Server** e clique em **"Go Live"**.

---

## 🗂️ Estrutura do projeto

```
controle-financeiro/
├── index.html              # Estrutura da página
├── css/
│   ├── tokens.css          # Variáveis de tema (claro/escuro), tipografia, espaçamentos
│   └── style.css           # Layout, componentes e responsividade
├── js/
│   ├── main.js             # Ponto de entrada: conecta tudo
│   ├── store.js            # Estado + persistência no localStorage
│   ├── render.js           # Renderiza tabela, resumo e estado vazio
│   ├── chart.js            # Gráfico donut em SVG
│   ├── filters.js          # Busca, filtros e ordenação
│   ├── modals.js           # Modais de editar/excluir
│   ├── money.js            # Máscara de moeda (R$)
│   ├── categories.js       # Catálogo de categorias
│   ├── format.js           # Formatação de moeda/data e escape de HTML
│   ├── io.js               # Exportar/importar (JSON e CSV)
│   ├── theme.js            # Alternância de tema
│   └── toast.js            # Notificações
└── public/img/             # Favicon e imagens
```

---

## 💾 Onde os dados ficam

Tudo é salvo no **`localStorage`** do navegador, na chave `db_items`. Isso significa:

- Os dados **ficam só no seu dispositivo/navegador** — nada vai para a internet.
- Limpar os dados do navegador **apaga seus lançamentos**. Use **Exportar** para fazer backup.

Cada lançamento tem o seguinte formato:

```json
{
  "id": "uuid",
  "desc": "Salário",
  "amount": 3500.0,
  "type": "Entrada",
  "category": "salario",
  "date": "2026-06-02",
  "createdAt": 1717286400000
}
```

---

## 🛠️ Tecnologias

- **HTML5** e **CSS3** (variáveis, grid, flexbox)
- **JavaScript** (módulos ES, sem dependências de build)
- [Boxicons](https://boxicons.com/) — ícones
- [Toastify](https://github.com/apvarun/toastify-js) — notificações
- Fontes [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) e [Manrope](https://fonts.google.com/specimen/Manrope)

---

## 🌐 Compatibilidade

Funciona nos navegadores modernos (Chrome, Edge, Firefox e Safari recentes). Usa recursos como `crypto.randomUUID` e `color-mix`, disponíveis nas versões atuais.

---

## 👤 Autor

**Cielio Queiroz**

---

## 📄 Licença

Projeto de uso livre para fins pessoais e de estudo.
