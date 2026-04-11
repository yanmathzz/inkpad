# Inkpad - Bloco de Notas Avançado

Aplicativo desktop para Windows com design moderno, construído com **Tauri v2**.  
Edite e organize notas em Markdown — arquivos `.md` reais no seu sistema de arquivos. 
<img width="1279" height="798" alt="Inkpad" src="https://github.com/user-attachments/assets/e047f1bf-13ae-42ae-8688-cf772d6f642b" />



---

## Por que Tauri?

O executável final tem **menos de 10 MB**, sem instalar runtimes extras. Isso é possível porque o Tauri utiliza a WebView nativa do Windows (Edge/WebView2, já presente no Windows 10/11) em vez de empacotar um Chromium inteiro (como o Electron faria, gerando +150 MB).

> O usuário final só precisa do `.exe` ou `.msi`. Nada mais.

---

## Pré-requisitos para **compilar**

Necessários apenas para quem vai compilar o projeto (desenvolvedores):

| Ferramenta | Versão mínima | Download |
|---|---|---|
| **Node.js** | 18+ | https://nodejs.org |
| **Rust** | stable (1.77+) | https://rustup.rs |
| **WebView2** | qualquer | Já incluso no Windows 10/11 |

---

## Instalação e execução (desenvolvimento)

```bash
# 1. Clone o repositório
git clone https://github.com/yanmathzz/bloco-notas-avancado.git
cd bloco-notas-avancado

# 2. Instale o Tauri CLI
npm install

# 3. Rode em modo desenvolvimento (com hot-reload do frontend)
npm run dev
```

---

## Gerar o executável para distribuição

```bash
# Gera o instalador .msi e o .exe portátil em target/release/bundle/
npm run build
```

Os arquivos gerados ficam em:
```
src-tauri/target/release/bundle/
├── msi/
│   └── Bloco de Notas Avançado_0.1.0_x64_en-US.msi   ← instalador
└── nsis/
    └── Bloco de Notas Avançado_0.1.0_x64-setup.exe    ← instalador NSIS
```

> O executável portátil fica em `src-tauri/target/release/bloco-notas-avancado.exe`

---

## Gerar ícones

Antes do primeiro build, gere os ícones a partir de uma imagem `icon.png` (512×512 px):

```bash
npx tauri icon icon.png
```

Isso cria automaticamente todos os tamanhos necessários em `src-tauri/icons/`.

---

## Funcionalidades

- **Listagem automática** de todos os arquivos `.md` de uma pasta
- **Editor Markdown** com fonte monospace e syntax highlighting visual
- **Preview** em tempo real com renderização Markdown completa
- **Auto-save** 1,8 segundos após parar de digitar
- **Nova nota** com nome sanitizado automaticamente
- **Renomear nota** — edite o título e saia do campo
- **Excluir nota** com confirmação
- **Busca** instantânea na lista de notas
- **Troca de pasta** — configure qualquer diretório como pasta de notas
- **Atalhos de teclado:**

| Atalho | Ação |
|---|---|
| `Ctrl+S` | Salvar agora |
| `Ctrl+N` | Nova nota |
| `Ctrl+P` | Alternar Editor/Preview |
| `Ctrl+F` | Focar na busca |
| `Tab` | Inserir 2 espaços no editor |
| `Escape` | Fechar modal |

---

## Estrutura do projeto

```
bloco-notas-avancado/
├── index.html              # Frontend (estrutura HTML)
├── src/
│   ├── app.js              # Lógica do frontend + parser Markdown
│   └── style.css           # Tema escuro estilo Obsidian
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # Ponto de entrada Rust
│   │   └── lib.rs          # Comandos Tauri (ler/escrever arquivos)
│   ├── Cargo.toml          # Dependências Rust
│   ├── tauri.conf.json     # Configuração do Tauri
│   └── capabilities/
│       └── default.json    # Permissões da WebView
├── package.json
└── README.md
```

---

## Como as notas funcionam

As notas são **arquivos `.md` comuns** na sua pasta `~/Notas` (configurável).  
Você pode abrir, editar e criar notas com qualquer editor de texto:

```bash
# Abrir no VS Code
code ~/Notas/minha-nota.md

# Abrir no Bloco de Notas do Windows
notepad ~/Notas/minha-nota.md
```

Não há banco de dados, não há lock-in. Seus dados são seus.

---

## Publicar no GitHub Releases

```bash
# 1. Faça o build
npm run build

# 2. Crie uma release no GitHub e faça upload dos arquivos:
#    - src-tauri/target/release/bundle/msi/*.msi
#    - src-tauri/target/release/bundle/nsis/*-setup.exe
```

O usuário final baixa o `.msi` ou o `.exe` e instala normalmente — sem precisar de Node.js ou Rust.
