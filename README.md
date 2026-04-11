<div align="center">
  <h1>🖊️ Inkpad</h1>
  <p>Editor de notas Markdown para Windows — leve, rápido e sem banco de dados.</p>

  <p>
    <img src="https://img.shields.io/badge/Tauri-v2-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri v2">
    <img src="https://img.shields.io/badge/Rust-stable-CE412B?style=flat-square&logo=rust&logoColor=white" alt="Rust">
    <img src="https://img.shields.io/badge/Windows-10%2F11-0078D4?style=flat-square&logo=windows&logoColor=white" alt="Windows">
    <img src="https://img.shields.io/badge/Licença-MIT-green?style=flat-square" alt="MIT">
  </p>

  <img width="1275" height="798" alt="Inkpad" src="https://github.com/user-attachments/assets/38931ff6-108d-4ec1-a2bc-090d0a74412d" />
</div>

---

## Visão geral

O **Inkpad** lê uma pasta do seu sistema de arquivos e lista todos os arquivos `.md` como notas. Sem banco de dados, sem lock-in — suas notas são arquivos de texto puro que você pode abrir em qualquer editor.

<table>
  <tr>
    <td><img src="screenshots/preview.png" alt="Preview Markdown"></td>
    <td><img src="screenshots/empty.png" alt="Tela inicial"></td>
  </tr>
  <tr>
    <td align="center"><em>Preview Markdown em tempo real</em></td>
    <td align="center"><em>Tela inicial limpa</em></td>
  </tr>
</table>

---

## Funcionalidades

- **Editor Markdown** com fonte monospace e auto-save
- **Preview** em tempo real — sem precisar sair do app
- **Sidebar** com busca instantânea nas notas
- **Renomear notas** editando o título diretamente
- **Troca de pasta** — use qualquer diretório como pasta de notas
- **Tema escuro** com paleta inspirada no Obsidian
- Arquivos `.md` compatíveis com VS Code, Obsidian e qualquer editor de texto

---

## Atalhos

| Atalho | Ação |
|---|---|
| `Ctrl + S` | Salvar nota |
| `Ctrl + N` | Nova nota |
| `Ctrl + P` | Alternar Editor / Preview |
| `Ctrl + F` | Focar na busca |
| `Tab` | Inserir 2 espaços |
| `Escape` | Fechar modal |

---

## Por que Tauri?

O executável final tem **menos de 10 MB**. O Tauri usa a WebView nativa do Windows (Edge/WebView2, já presente no Windows 10/11) em vez de empacotar um Chromium completo como o Electron faria (+150 MB).

> O usuário final só precisa do `.exe` ou `.msi`. Nada mais.

---

## Compilar e rodar

### Pré-requisitos (apenas para desenvolvedores)

| Ferramenta | Versão mínima |
|---|---|
| [Node.js](https://nodejs.org) | 18+ |
| [Rust](https://rustup.rs) | stable |
| WebView2 | já incluso no Windows 10/11 |

### Comandos

```bash
# Clonar o repositório
git clone https://github.com/yanmathzz/inkpad.git
cd inkpad

# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm run dev

# Gerar instalador para distribuição
npm run build
```

O instalador é gerado em:
```
src-tauri/target/release/bundle/
├── msi/   → instalador Windows (.msi)
└── nsis/  → instalador alternativo (.exe)
```

---

## Estrutura do projeto

```
inkpad/
├── ui/
│   ├── index.html        # Estrutura da interface
│   └── src/
│       ├── app.js        # Lógica + parser Markdown
│       └── style.css     # Tema escuro
├── src-tauri/
│   ├── src/
│   │   ├── main.rs       # Entrada Rust
│   │   └── lib.rs        # Comandos de arquivo (ler/escrever/criar/excluir)
│   ├── Cargo.toml
│   └── tauri.conf.json
└── screenshots/
```

---

## Licença

MIT © [yanmathzz](https://github.com/yanmathzz)
