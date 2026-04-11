/* ══════════════════════════════════════════
   INKPAD — app.js  |  Tauri v2
══════════════════════════════════════════ */

const { invoke } = window.__TAURI__.core;

const state = {
  notesFolder: null,
  notes: [],
  activeNote: null,
  isDirty: false,
  saveTimer: null,
  activeTab: 'editor',
  focusMode: false,
};

// ─── Init ─────────────────────────────────
async function init() {
  state.notesFolder = localStorage.getItem('notesFolder')
    || await invoke('get_default_folder');
  localStorage.setItem('notesFolder', state.notesFolder);

  updateFolderLabel();
  await loadNotes();
  bindEvents();
  restoreLastNote();
}

// ─── Restaura última nota aberta ──────────
function restoreLastNote() {
  const lastPath = localStorage.getItem('lastNotePath');
  const lastName = localStorage.getItem('lastNoteName');

  if (lastPath && lastName) {
    const el = document.getElementById('welcome-last');
    const nameEl = document.getElementById('last-note-name');
    if (el && nameEl) {
      nameEl.textContent = lastName;
      el.style.display = 'flex';
    }

    document.getElementById('btn-open-last')?.addEventListener('click', () => {
      const note = state.notes.find(n => n.path === lastPath);
      if (note) openNote(note);
      else toast('Nota não encontrada na pasta atual.', 'error');
    });
  }
}

// ─── Carregar notas ───────────────────────
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

// ─── Renderizar lista ─────────────────────
function renderNoteList() {
  const list = document.getElementById('note-list');
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  const filtered = query
    ? state.notes.filter(n => n.name.toLowerCase().includes(query))
    : state.notes;

  document.getElementById('note-count').textContent =
    `${filtered.length} nota${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    list.innerHTML = `<div class="list-placeholder">${query ? 'Nenhuma nota encontrada' : 'Nenhuma nota ainda'}</div>`;
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
    el.addEventListener('click', () => { if (state.activeNote?.path !== note.path) openNote(note); });
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

    // Persiste última nota aberta
    localStorage.setItem('lastNotePath', note.path);
    localStorage.setItem('lastNoteName', note.name);

    updateSaveStatus('');
    updateStats();
    renderNoteList();
    if (state.activeTab === 'preview') renderPreview();
    document.getElementById('editor').focus();
  } catch (err) {
    toast(`Erro ao abrir nota: ${err}`, 'error');
  }
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
  try {
    await invoke('delete_note', { path: state.activeNote.path });
    closeModal('modal-delete');
    if (localStorage.getItem('lastNotePath') === state.activeNote.path) {
      localStorage.removeItem('lastNotePath');
      localStorage.removeItem('lastNoteName');
    }
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

// ─── Renomear pelo título ──────────────────
async function handleTitleBlur() {
  if (!state.activeNote) return;
  const newName = document.getElementById('note-title').value.trim();
  if (!newName || newName === state.activeNote.name) return;
  const safeName = newName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
  try {
    const newPath = await invoke('rename_note', {
      oldPath: state.activeNote.path, folder: state.notesFolder, newName: safeName,
    });
    state.activeNote = { ...state.activeNote, name: safeName, path: newPath };
    localStorage.setItem('lastNotePath', newPath);
    localStorage.setItem('lastNoteName', safeName);
    await loadNotes();
    toast('Nota renomeada.', 'success');
  } catch (err) {
    document.getElementById('note-title').value = state.activeNote.name;
    toast(`Erro ao renomear: ${err}`, 'error');
  }
}

// ─── Configurações ────────────────────────
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
  state.activeNote = null; state.isDirty = false;
  document.getElementById('editor-area').style.display = 'none';
  document.getElementById('empty-state').style.display = 'flex';
  await loadNotes();
  toast('Pasta alterada com sucesso.', 'success');
}

// ─── Tabs ─────────────────────────────────
function switchTab(tab) {
  state.activeTab = tab;
  document.getElementById('tab-editor').classList.toggle('active', tab === 'editor');
  document.getElementById('tab-preview').classList.toggle('active', tab === 'preview');
  const editorEl  = document.getElementById('editor');
  const previewEl = document.getElementById('preview');
  const toolbar   = document.getElementById('format-toolbar');
  if (tab === 'editor') {
    editorEl.style.display  = 'block';
    previewEl.style.display = 'none';
    toolbar.style.display   = 'flex';
    editorEl.focus();
  } else {
    editorEl.style.display  = 'none';
    previewEl.style.display = 'block';
    toolbar.style.display   = 'none';
    renderPreview();
  }
}

function renderPreview() {
  document.getElementById('preview').innerHTML = parseMarkdown(document.getElementById('editor').value);
}

// ─── Modo foco ────────────────────────────
function toggleFocusMode() {
  state.focusMode = !state.focusMode;
  document.body.classList.toggle('focus-mode', state.focusMode);
  const btn = document.getElementById('btn-focus');
  btn.title = state.focusMode ? 'Sair do modo foco (Ctrl+Shift+F)' : 'Modo foco (Ctrl+Shift+F)';
  btn.style.color = state.focusMode ? 'var(--accent-hover)' : '';
}

// ─── Toolbar de formatação ────────────────
function applyFormat(fmt) {
  const ta = document.getElementById('editor');
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.substring(start, end);
  const before = ta.value.substring(0, start);
  const after  = ta.value.substring(end);

  const formats = {
    bold:      { wrap: ['**', '**'],      default: 'texto em negrito' },
    italic:    { wrap: ['*', '*'],        default: 'texto em itálico' },
    strike:    { wrap: ['~~', '~~'],      default: 'texto tachado' },
    code:      { wrap: ['`', '`'],        default: 'código' },
    h1:        { line: '# ',             },
    h2:        { line: '## ',            },
    h3:        { line: '### ',           },
    quote:     { line: '> ',             },
    ul:        { line: '- ',             },
    ol:        { line: '1. ',            },
    hr:        { insert: '\n---\n',      },
    codeblock: { block: ['```\n', '\n```'], default: 'código aqui' },
  };

  const f = formats[fmt];
  if (!f) return;

  let newText, cursorStart, cursorEnd;

  if (f.insert) {
    // Insere no cursor sem seleção
    newText = before + f.insert + after;
    cursorStart = cursorEnd = start + f.insert.length;
  } else if (f.line) {
    // Aplica no início da linha
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineContent = ta.value.substring(lineStart);
    const lineEnd = lineContent.indexOf('\n');
    const fullLine = lineEnd === -1 ? lineContent : lineContent.substring(0, lineEnd);

    // Toggle: remove prefixo se já existe
    if (fullLine.startsWith(f.line)) {
      const removed = fullLine.substring(f.line.length);
      newText = ta.value.substring(0, lineStart) + removed + ta.value.substring(lineStart + fullLine.length);
      cursorStart = cursorEnd = lineStart + Math.max(0, (end - lineStart) - f.line.length);
    } else {
      newText = ta.value.substring(0, lineStart) + f.line + ta.value.substring(lineStart);
      cursorStart = cursorEnd = start + f.line.length;
    }
  } else if (f.block) {
    const text = sel || f.default;
    const inserted = f.block[0] + text + f.block[1];
    newText = before + inserted + after;
    cursorStart = start + f.block[0].length;
    cursorEnd   = cursorStart + text.length;
  } else if (f.wrap) {
    const [open, close] = f.wrap;
    const text = sel || f.default;

    // Toggle: remove wrap se já está aplicado
    if (before.endsWith(open) && after.startsWith(close)) {
      newText = before.slice(0, -open.length) + text + after.slice(close.length);
      cursorStart = start - open.length;
      cursorEnd   = cursorStart + text.length;
    } else {
      newText = before + open + text + close + after;
      cursorStart = start + open.length;
      cursorEnd   = cursorStart + text.length;
    }
  }

  ta.value = newText;
  ta.setSelectionRange(cursorStart, cursorEnd);
  ta.focus();
  handleEditorInput();
}

// ─── Auto-save ────────────────────────────
function handleEditorInput() {
  state.isDirty = true;
  updateSaveStatus('unsaved');
  updateStats();
  if (state.activeTab === 'preview') renderPreview();
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveNote(), 1800);
}

// ─── Estatísticas ─────────────────────────
function updateStats() {
  const text  = document.getElementById('editor').value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const pos   = document.getElementById('editor').selectionStart;
  const line  = text.substring(0, pos).split('\n').length;
  document.getElementById('word-count').textContent = `${words} ${words === 1 ? 'palavra' : 'palavras'}`;
  document.getElementById('char-count').textContent = `${text.length} ${text.length === 1 ? 'caractere' : 'caracteres'}`;
  document.getElementById('line-count').textContent = `Ln ${line}`;
}

// ─── Helpers de UI ───────────────────────
function updateSaveStatus(status) {
  const el = document.getElementById('save-status');
  el.className = 'save-status ' + status;
  const labels = { saving: 'Salvando…', saved: '✓ Salvo', unsaved: '● Não salvo', error: '✕ Erro', '': '' };
  el.textContent = labels[status] ?? '';
}

function updateFolderLabel() {
  const label = state.notesFolder.replace(/\\/g, '/').replace(/^.*\/([^/]+\/[^/]+)$/, '…/$1');
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
  const diffMin = Math.floor((Date.now() - d) / 60000);
  if (diffMin < 1)    return 'agora';
  if (diffMin < 60)   return `${diffMin}min atrás`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Parser Markdown ─────────────────────
function parseMarkdown(md) {
  const codeBlocks = [];
  let text = md.replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = codeBlocks.length;
    codeBlocks.push(`<pre><code class="language-${lang || ''}">${escHtml(code.trimEnd())}</code></pre>`);
    return `\uE000${i}\uE001`;
  });
  text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = text.split('\n');
  let html = '', inUl = false, inOl = false;
  const closeList = () => {
    if (inUl) { html += '</ul>\n'; inUl = false; }
    if (inOl) { html += '</ol>\n'; inOl = false; }
  };

  for (const line of lines) {
    if (/^\uE000(\d+)\uE001$/.test(line.trim())) {
      closeList();
      html += codeBlocks[parseInt(line.trim().slice(1))] + '\n';
      continue;
    }
    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) { closeList(); html += `<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>\n`; continue; }
    if (/^(-{3,}|={3,}|\*{3,})$/.test(line.trim())) { closeList(); html += '<hr>\n'; continue; }
    if (line.startsWith('&gt; ')) { closeList(); html += `<blockquote><p>${inline(line.slice(5))}</p></blockquote>\n`; continue; }
    const ulm = line.match(/^[\-\*\+]\s+(.+)$/);
    if (ulm) { if (inOl) { html += '</ol>\n'; inOl = false; } if (!inUl) { html += '<ul>\n'; inUl = true; } html += `<li>${inline(ulm[1])}</li>\n`; continue; }
    const olm = line.match(/^\d+\.\s+(.+)$/);
    if (olm) { if (inUl) { html += '</ul>\n'; inUl = false; } if (!inOl) { html += '<ol>\n'; inOl = true; } html += `<li>${inline(olm[1])}</li>\n`; continue; }
    if (line.trim() === '') { closeList(); html += '<br>\n'; continue; }
    closeList();
    html += `<p>${inline(line)}</p>\n`;
  }
  closeList();
  html = html.replace(/\uE000(\d+)\uE001/g, (_, i) => codeBlocks[parseInt(i)]);
  return html;
}

function inline(text) {
  const ic = [];
  text = text.replace(/`([^`]+)`/g, (_, c) => { ic.push(`<code>${escHtml(c)}</code>`); return `\uE002${ic.length-1}\uE003`; });
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  text = text.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  text = text.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  text = text.replace(/\uE002(\d+)\uE003/g, (_, i) => ic[parseInt(i)]);
  return text;
}

// ─── Bind de eventos ─────────────────────
function bindEvents() {
  // Nova nota
  document.getElementById('btn-new-note').addEventListener('click', showNewNoteModal);
  document.getElementById('btn-new-note-empty').addEventListener('click', showNewNoteModal);
  document.getElementById('btn-confirm-new-note').addEventListener('click', confirmCreateNote);
  document.getElementById('input-new-note').addEventListener('keydown', e => { if (e.key === 'Enter') confirmCreateNote(); });

  // Salvar / excluir
  document.getElementById('btn-save').addEventListener('click', saveNote);
  document.getElementById('btn-delete').addEventListener('click', showDeleteModal);
  document.getElementById('btn-confirm-delete').addEventListener('click', confirmDeleteNote);

  // Configurações
  document.getElementById('btn-settings').addEventListener('click', showSettingsModal);
  document.getElementById('folder-display').addEventListener('click', showSettingsModal);
  document.getElementById('btn-confirm-settings').addEventListener('click', confirmSettings);
  document.getElementById('input-folder').addEventListener('keydown', e => { if (e.key === 'Enter') confirmSettings(); });

  // Editor
  document.getElementById('editor').addEventListener('input', handleEditorInput);
  document.getElementById('editor').addEventListener('keyup', updateStats);
  document.getElementById('editor').addEventListener('click', updateStats);

  // Título
  document.getElementById('note-title').addEventListener('blur', handleTitleBlur);
  document.getElementById('note-title').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('note-title').blur(); });

  // Tabs
  document.getElementById('tab-editor').addEventListener('click', () => switchTab('editor'));
  document.getElementById('tab-preview').addEventListener('click', () => switchTab('preview'));

  // Modo foco
  document.getElementById('btn-focus').addEventListener('click', toggleFocusMode);

  // Toolbar de formatação
  document.querySelectorAll('.fmt-btn[data-fmt]').forEach(btn => {
    btn.addEventListener('click', () => applyFormat(btn.dataset.fmt));
  });

  // Busca
  document.getElementById('search-input').addEventListener('input', renderNoteList);

  // Fechar modais
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
  });

  // Tab no editor → 2 espaços
  document.getElementById('editor').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target, s = el.selectionStart, end = el.selectionEnd;
      el.value = el.value.substring(0, s) + '  ' + el.value.substring(end);
      el.selectionStart = el.selectionEnd = s + 2;
      handleEditorInput();
    }
  });

  // Atalhos globais
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 's') { e.preventDefault(); saveNote(); }
    if (ctrl && e.key === 'n') { e.preventDefault(); showNewNoteModal(); }
    if (ctrl && e.key === 'p') { e.preventDefault(); switchTab(state.activeTab === 'editor' ? 'preview' : 'editor'); }
    if (ctrl && e.key === 'f') { e.preventDefault(); document.getElementById('search-input').focus(); }
    if (ctrl && e.key === 'b') { e.preventDefault(); applyFormat('bold'); }
    if (ctrl && e.key === 'i') { e.preventDefault(); applyFormat('italic'); }
    if (ctrl && e.shiftKey && e.key === 'F') { e.preventDefault(); toggleFocusMode(); }
    if (e.key === 'Escape') {
      if (state.focusMode) { toggleFocusMode(); return; }
      document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
    }
  });
}

init();
