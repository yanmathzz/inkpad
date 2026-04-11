/* ══════════════════════════════════════════
   BLOCO DE NOTAS AVANÇADO — app.js
   Requer Tauri v2 com withGlobalTauri: true
══════════════════════════════════════════ */

const { invoke } = window.__TAURI__.core;

// ─── Estado global ────────────────────────
const state = {
  notesFolder: null,
  notes: [],
  activeNote: null,   // { name, path, modified }
  isDirty: false,
  saveTimer: null,
  activeTab: 'editor',
};

// ─── Inicialização ────────────────────────
async function init() {
  state.notesFolder = localStorage.getItem('notesFolder')
    || await invoke('get_default_folder');

  localStorage.setItem('notesFolder', state.notesFolder);
  updateFolderLabel();
  await loadNotes();
  bindEvents();
}

// ─── Carregar lista de notas ──────────────
async function loadNotes(selectPath = null) {
  try {
    state.notes = await invoke('list_notes', { folder: state.notesFolder });
    renderNoteList();

    if (selectPath) {
      const note = state.notes.find(n => n.path === selectPath);
      if (note) openNote(note);
    }
  } catch (err) {
    toast(`Erro ao carregar notas: ${err}`, 'error');
  }
}

// ─── Renderizar lista de notas ────────────
function renderNoteList() {
  const list = document.getElementById('note-list');
  const query = document.getElementById('search-input').value.toLowerCase().trim();

  const filtered = query
    ? state.notes.filter(n => n.name.toLowerCase().includes(query))
    : state.notes;

  document.getElementById('note-count').textContent =
    `${filtered.length} nota${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="list-placeholder">${
      query ? 'Nenhuma nota encontrada' : 'Nenhuma nota ainda'
    }</div>`;
    return;
  }

  list.innerHTML = '';
  filtered.forEach(note => {
    const el = document.createElement('div');
    el.className = 'note-item' + (state.activeNote?.path === note.path ? ' active' : '');
    el.innerHTML = `
      <div class="note-item-name">${escHtml(note.name)}</div>
      <div class="note-item-date">${formatDate(note.modified)}</div>
    `;
    el.addEventListener('click', () => handleNoteClick(note));
    list.appendChild(el);
  });
}

// ─── Abrir nota ───────────────────────────
async function openNote(note) {
  if (state.isDirty) await saveNote();

  try {
    const content = await invoke('read_note', { path: note.path });
    state.activeNote = note;
    state.isDirty = false;

    document.getElementById('note-title').value = note.name;
    document.getElementById('editor').value = content;
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('editor-area').style.display = 'flex';

    updateSaveStatus('');
    updateStats();
    renderNoteList();

    if (state.activeTab === 'preview') renderPreview();
    document.getElementById('editor').focus();
  } catch (err) {
    toast(`Erro ao abrir nota: ${err}`, 'error');
  }
}

async function handleNoteClick(note) {
  if (state.activeNote?.path === note.path) return;
  openNote(note);
}

// ─── Salvar nota ──────────────────────────
async function saveNote() {
  if (!state.activeNote) return;

  clearTimeout(state.saveTimer);
  updateSaveStatus('saving');

  try {
    const content = document.getElementById('editor').value;
    await invoke('write_note', { path: state.activeNote.path, content });
    state.isDirty = false;
    updateSaveStatus('saved');
    setTimeout(() => updateSaveStatus(''), 2500);
    await loadNotes();
  } catch (err) {
    updateSaveStatus('error');
    toast(`Erro ao salvar: ${err}`, 'error');
  }
}

// ─── Criar nota ───────────────────────────
function showNewNoteModal() {
  const input = document.getElementById('input-new-note');
  input.value = '';
  openModal('modal-new-note');
  setTimeout(() => input.focus(), 50);
}

async function confirmCreateNote() {
  const raw = document.getElementById('input-new-note').value.trim();
  if (!raw) return;

  // Sanitiza o nome: remove caracteres inválidos para nome de arquivo no Windows
  const name = raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, '-');

  try {
    const newPath = await invoke('create_note', { folder: state.notesFolder, name });
    closeModal('modal-new-note');
    await loadNotes(newPath);
    toast('Nota criada!', 'success');
  } catch (err) {
    toast(`Erro: ${err}`, 'error');
  }
}

// ─── Excluir nota ─────────────────────────
function showDeleteModal() {
  if (!state.activeNote) return;
  document.getElementById('delete-note-name').textContent = state.activeNote.name;
  openModal('modal-delete');
}

async function confirmDeleteNote() {
  if (!state.activeNote) return;
  const path = state.activeNote.path;

  try {
    await invoke('delete_note', { path });
    closeModal('modal-delete');
    state.activeNote = null;
    state.isDirty = false;

    document.getElementById('editor-area').style.display = 'none';
    document.getElementById('empty-state').style.display = 'flex';
    await loadNotes();
    toast('Nota excluída.', 'info');
  } catch (err) {
    toast(`Erro ao excluir: ${err}`, 'error');
  }
}

// ─── Renomear nota pelo título ─────────────
async function handleTitleBlur() {
  if (!state.activeNote) return;
  const newName = document.getElementById('note-title').value.trim();
  if (!newName || newName === state.activeNote.name) return;

  const safeName = newName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');

  try {
    const newPath = await invoke('rename_note', {
      oldPath: state.activeNote.path,
      folder: state.notesFolder,
      newName: safeName,
    });
    state.activeNote = { ...state.activeNote, name: safeName, path: newPath };
    await loadNotes();
    toast('Nota renomeada.', 'success');
  } catch (err) {
    // Reverte o título se falhar
    document.getElementById('note-title').value = state.activeNote.name;
    toast(`Erro ao renomear: ${err}`, 'error');
  }
}

// ─── Configurações (pasta) ────────────────
function showSettingsModal() {
  document.getElementById('input-folder').value = state.notesFolder;
  openModal('modal-settings');
  setTimeout(() => document.getElementById('input-folder').focus(), 50);
}

async function confirmSettings() {
  const folder = document.getElementById('input-folder').value.trim();
  if (!folder) return;

  state.notesFolder = folder;
  localStorage.setItem('notesFolder', folder);
  updateFolderLabel();
  closeModal('modal-settings');

  state.activeNote = null;
  state.isDirty = false;
  document.getElementById('editor-area').style.display = 'none';
  document.getElementById('empty-state').style.display = 'flex';
  await loadNotes();
  toast('Pasta alterada com sucesso.', 'success');
}

// ─── Tabs (Editor / Preview) ──────────────
function switchTab(tab) {
  state.activeTab = tab;

  document.getElementById('tab-editor').classList.toggle('active', tab === 'editor');
  document.getElementById('tab-preview').classList.toggle('active', tab === 'preview');

  const editorEl  = document.getElementById('editor');
  const previewEl = document.getElementById('preview');

  if (tab === 'editor') {
    editorEl.style.display  = 'block';
    previewEl.style.display = 'none';
    editorEl.focus();
  } else {
    editorEl.style.display  = 'none';
    previewEl.style.display = 'block';
    renderPreview();
  }
}

function renderPreview() {
  const content = document.getElementById('editor').value;
  document.getElementById('preview').innerHTML = parseMarkdown(content);
}

// ─── Auto-save com debounce ───────────────
function handleEditorInput() {
  state.isDirty = true;
  updateSaveStatus('unsaved');
  updateStats();

  if (state.activeTab === 'preview') renderPreview();

  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveNote(), 1800);
}

// ─── Estatísticas da barra de status ──────
function updateStats() {
  const text = document.getElementById('editor').value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;

  const pos = document.getElementById('editor').selectionStart;
  const line = text.substring(0, pos).split('\n').length;

  document.getElementById('word-count').textContent = `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
  document.getElementById('char-count').textContent = `${chars} ${chars === 1 ? 'caractere' : 'caracteres'}`;
  document.getElementById('line-count').textContent = `Ln ${line}`;
}

// ─── UI helpers ───────────────────────────
function updateSaveStatus(status) {
  const el = document.getElementById('save-status');
  el.className = 'save-status ' + status;
  const labels = { saving: 'Salvando…', saved: '✓ Salvo', unsaved: '● Não salvo', error: '✕ Erro', '': '' };
  el.textContent = labels[status] ?? '';
}

function updateFolderLabel() {
  const label = state.notesFolder
    .replace(/\\/g, '/')
    .replace(/^.*\/([^/]+\/[^/]+)$/, '…/$1');
  document.getElementById('folder-label').textContent = label;
  document.getElementById('folder-display').title = state.notesFolder;
}

function openModal(id) {
  const el = document.getElementById(id);
  el.style.display = 'flex';
  requestAnimationFrame(() => el.classList.add('open'));
}

function closeModal(id) {
  const el = document.getElementById(id);
  el.classList.remove('open');
  el.style.display = 'none';
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.2s ease forwards';
    setTimeout(() => el.remove(), 200);
  }, 3000);
}

function formatDate(unixSecs) {
  const d = new Date(unixSecs * 1000);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)   return 'agora';
  if (diffMin < 60)  return `${diffMin}min atrás`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Parser Markdown ─────────────────────
function parseMarkdown(md) {
  // 1. Protege blocos de código
  const codeBlocks = [];
  let text = md.replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = codeBlocks.length;
    codeBlocks.push(`<pre><code class="language-${lang || ''}">${escHtml(code.trimEnd())}</code></pre>`);
    return `\uE000${i}\uE001`;
  });

  // 2. Escapa o restante
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 3. Processa linha a linha
  const lines = text.split('\n');
  let html = '';
  let inUl = false, inOl = false;

  const closeList = () => {
    if (inUl) { html += '</ul>\n'; inUl = false; }
    if (inOl) { html += '</ol>\n'; inOl = false; }
  };

  for (const raw of lines) {
    const line = raw;

    // Placeholder de bloco de código
    if (/^\uE000(\d+)\uE001$/.test(line.trim())) {
      closeList();
      const idx = parseInt(line.trim().slice(1));
      html += codeBlocks[idx] + '\n';
      continue;
    }

    // Cabeçalhos ATX
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      closeList();
      const n = hm[1].length;
      html += `<h${n}>${inline(hm[2])}</h${n}>\n`;
      continue;
    }

    // Linha horizontal
    if (/^(-{3,}|={3,}|\*{3,})$/.test(line.trim())) {
      closeList();
      html += '<hr>\n';
      continue;
    }

    // Blockquote (> já virou &gt; no escape)
    if (line.startsWith('&gt; ')) {
      closeList();
      html += `<blockquote><p>${inline(line.slice(5))}</p></blockquote>\n`;
      continue;
    }

    // Lista não-ordenada
    const ulm = line.match(/^[\-\*\+]\s+(.+)$/);
    if (ulm) {
      if (inOl) { html += '</ol>\n'; inOl = false; }
      if (!inUl) { html += '<ul>\n'; inUl = true; }
      html += `<li>${inline(ulm[1])}</li>\n`;
      continue;
    }

    // Lista ordenada
    const olm = line.match(/^\d+\.\s+(.+)$/);
    if (olm) {
      if (inUl) { html += '</ul>\n'; inUl = false; }
      if (!inOl) { html += '<ol>\n'; inOl = true; }
      html += `<li>${inline(olm[1])}</li>\n`;
      continue;
    }

    // Linha vazia
    if (line.trim() === '') {
      closeList();
      html += '<br>\n';
      continue;
    }

    // Parágrafo normal
    closeList();
    html += `<p>${inline(line)}</p>\n`;
  }
  closeList();

  // 4. Restaura blocos de código
  html = html.replace(/\uE000(\d+)\uE001/g, (_, i) => codeBlocks[parseInt(i)]);

  return html;
}

function inline(text) {
  // Protege código inline
  const ic = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    ic.push(`<code>${escHtml(code)}</code>`);
    return `\uE002${ic.length - 1}\uE003`;
  });

  // Negrito + itálico
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___([^_]+)___/g,        '<strong><em>$1</em></strong>');

  // Negrito
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_\n]+)__/g,      '<strong>$1</strong>');

  // Itálico
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_\n]+)_/g,   '<em>$1</em>');

  // Tachado
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

  // Imagens (antes de links)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Restaura inline code
  text = text.replace(/\uE002(\d+)\uE003/g, (_, i) => ic[parseInt(i)]);

  return text;
}

// ─── Bind de eventos ─────────────────────
function bindEvents() {
  // Botões Nova Nota
  document.getElementById('btn-new-note').addEventListener('click', showNewNoteModal);
  document.getElementById('btn-new-note-empty').addEventListener('click', showNewNoteModal);

  // Confirmar criação
  document.getElementById('btn-confirm-new-note').addEventListener('click', confirmCreateNote);
  document.getElementById('input-new-note').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmCreateNote();
  });

  // Salvar
  document.getElementById('btn-save').addEventListener('click', () => saveNote());

  // Excluir
  document.getElementById('btn-delete').addEventListener('click', showDeleteModal);
  document.getElementById('btn-confirm-delete').addEventListener('click', confirmDeleteNote);

  // Configurações
  document.getElementById('btn-settings').addEventListener('click', showSettingsModal);
  document.getElementById('folder-display').addEventListener('click', showSettingsModal);
  document.getElementById('btn-confirm-settings').addEventListener('click', confirmSettings);
  document.getElementById('input-folder').addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmSettings();
  });

  // Editor
  document.getElementById('editor').addEventListener('input', handleEditorInput);
  document.getElementById('editor').addEventListener('keyup', updateStats);
  document.getElementById('editor').addEventListener('click', updateStats);

  // Título (renomear ao sair do campo)
  document.getElementById('note-title').addEventListener('blur', handleTitleBlur);
  document.getElementById('note-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('note-title').blur();
  });

  // Tabs
  document.getElementById('tab-editor').addEventListener('click', () => switchTab('editor'));
  document.getElementById('tab-preview').addEventListener('click', () => switchTab('preview'));

  // Busca
  document.getElementById('search-input').addEventListener('input', renderNoteList);

  // Fechar modais com botão X ou Cancelar
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Fechar modal clicando fora
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Atalhos de teclado globais
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveNote();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      showNewNoteModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      switchTab(state.activeTab === 'editor' ? 'preview' : 'editor');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      document.getElementById('search-input').focus();
    }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
    }
  });

  // Tab no editor → insere 2 espaços
  document.getElementById('editor').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = el.value.substring(0, start) + '  ' + el.value.substring(end);
      el.selectionStart = el.selectionEnd = start + 2;
      handleEditorInput();
    }
  });
}

// ─── Start ────────────────────────────────
init();
