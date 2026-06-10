 // renderer.js — Quick Note Taker (Final Project Edition)
// Features added: Export PDF, Trash Bin, Recent Files, Shortcuts Dialog, Statistics, Zoom

window.addEventListener('DOMContentLoaded', async () => {

    // ── DOM references ─────────────────────────────────────────────────────────
    const textarea = document.getElementById('note');
    const titleInput = document.getElementById('note-title');
    const saveBtn = document.getElementById('saveBtn');
    const saveAsBtn = document.getElementById('saveAsBtn');
    const openFileBtn = document.getElementById('openFileBtn');
     const emojiBtn = document.getElementById('emojiBtn');
    const emojiPanel = document.getElementById('emojiPanel');
    const newNoteBtn = document.getElementById('new-note-btn');
    const trashBtn = document.getElementById('trash-btn');
    const noteList = document.getElementById('note-list');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const wordCountEl = document.getElementById('wordCount');
    const charCountEl = document.getElementById('charCount');
    const lineNumbers = document.getElementById('lineNumbers');
    const noteMeta = document.getElementById('noteMeta');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('search-input');
    const zoomIndicator = document.getElementById('zoom-indicator');

    // Modals
    const shortcutsModal = document.getElementById('shortcutsModal');
    const shortcutsClose = document.getElementById('shortcutsClose');
    const statsModal = document.getElementById('statsModal');
    const statsClose = document.getElementById('statsClose');
    const statsGrid = document.getElementById('statsGrid');
    const statsExtra = document.getElementById('statsExtra');
    const trashModal = document.getElementById('trashModal');
    const trashClose = document.getElementById('trashClose');
    const trashList = document.getElementById('trashList');

    // ── App state ──────────────────────────────────────────────────────────────
    let notes = [];
    let currentNoteId = null;
    let lastSavedContent = '';
    let debounceTimer = null;
    let searchQuery = '';

    // ── FEATURE: Zoom — load saved zoom preference ─────────────────────────────
    let zoomFactor = 1.0;
    const settings = await window.electronAPI.getSettings();// Load saved theme
    if (settings.theme === 'light') {
        document.body.classList.add('light');
        document.getElementById('theme-toggle').textContent = '☀️';
    }

    if (settings.zoomFactor) {
        zoomFactor = settings.zoomFactor;
        applyZoom(zoomFactor, false); // apply without saving again
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Utility helpers
    // ════════════════════════════════════════════════════════════════════════════

    function setStatus(state, msg) {
        statusDot.className = 'status-dot ' + (state || '');
        statusText.textContent = msg;
    }

    function updateCounts() {
        const text = textarea.value.trim();
        wordCountEl.textContent = text ? text.split(/\s+/).length : 0;
        charCountEl.textContent = textarea.value.length;
    }

    function updateLineNumbers() {
        const count = textarea.value.split('\n').length;
        lineNumbers.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    }

    function showEditor(visible) {
        textarea.style.display = visible ? '' : 'none';
        lineNumbers.style.display = visible ? '' : 'none';
        emptyState.classList.toggle('show', !visible);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function insertAtCursor(textarea, text) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        textarea.value = before + text + after;
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
        updateCounts();
        updateLineNumbers();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => saveCurrentNote(), 5000);
    }

    // ── FEATURE: Zoom ──────────────────────────────────────────────────────────
    // Uses webContents.setZoomFactor() via the window.devicePixelRatio approach.
    // In Electron, the renderer can change its own zoom directly.
    function applyZoom(factor, save = true) {
        zoomFactor = Math.min(Math.max(factor, 0.5), 2.0); // clamp 50%–200%
        // Electron exposes this directly in renderer process
        if (save) window.electronAPI.saveZoom(zoomFactor); {
            window.electronAPI.saveZoom(zoomFactor);
        }
        // Use CSS zoom for renderer-side zoom (works in Electron's Chromium)
        window.electronAPI.applyZoom(zoomFactor);
        // Show zoom indicator when not at 100%
        if (Math.abs(zoomFactor - 1.0) > 0.01) {
            zoomIndicator.style.display = '';
            zoomIndicator.textContent = Math.round(zoomFactor * 100) + '%';
        } else {
            zoomIndicator.style.display = 'none';
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Render sidebar note list (with search filter)
    // ════════════════════════════════════════════════════════════════════════════

    function renderNoteList() {
        noteList.innerHTML = '';

        const filtered = searchQuery
            ? notes.filter(n =>
                (n.title || '').toLowerCase().includes(searchQuery) ||
                (n.content || '').toLowerCase().includes(searchQuery)
            )
            : notes;

        if (filtered.length === 0) {
            const el = document.createElement('div');
            el.className = 'sidebar-empty';
            el.textContent = searchQuery ? 'No notes match your search.' : 'No notes yet. Click + New Note.';
            noteList.appendChild(el);
            return;
        }

        filtered.forEach(note => {
            const isActive = note.id === currentNoteId;
            const item = document.createElement('div');
            item.className = 'note-item' + (isActive ? ' active' : '');

            const date = new Date(note.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const preview = (note.content || '').replace(/\n/g, ' ').trim().slice(0, 45) || '—';

            item.innerHTML = `
                <div class="note-item-body">
                    <div class="note-item-title">${escapeHtml(note.title || 'Untitled')}</div>
                    <div class="note-item-preview">${escapeHtml(preview)}</div>
                    <div class="note-item-date">${date}</div>
                </div>
                <button class="note-item-del" title="Move to trash">✕</button>
            `;

            item.addEventListener('click', async (e) => {
                if (e.target.classList.contains('note-item-del')) return;
                await switchNote(note.id);
            });

            item.querySelector('.note-item-del').addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteNote(note.id);
            });

            noteList.appendChild(item);
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Switch to a note
    // ════════════════════════════════════════════════════════════════════════════

    async function switchNote(id) {
        if (currentNoteId && textarea.value !== lastSavedContent) {
            const res = await window.electronAPI.confirmNewNote();
            if (!res.confirmed) return;
        }

        const note = notes.find(n => n.id === id);
        if (!note) return;

        currentNoteId = note.id;
        titleInput.value = note.title || '';
        textarea.value = note.content || '';
        lastSavedContent = note.content || '';
        noteMeta.textContent = 'Last saved: ' + new Date(note.updatedAt).toLocaleString();

        showEditor(true);
        updateCounts();
        updateLineNumbers();
        setStatus('saved', 'Loaded');
        renderNoteList();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Save current note
    // ════════════════════════════════════════════════════════════════════════════

    async function saveCurrentNote() {
        if (!currentNoteId) { setStatus('', 'No note selected'); return; }

        const note = {
            id: currentNoteId,
            title: titleInput.value.trim() || 'Untitled',
            content: textarea.value
        };

        setStatus('saving', 'Saving…');
        await window.electronAPI.saveNoteJson(note);

        const idx = notes.findIndex(n => n.id === currentNoteId);
        if (idx !== -1) {
            notes[idx] = { ...notes[idx], ...note, updatedAt: new Date().toISOString() };
        }

        lastSavedContent = textarea.value;
        noteMeta.textContent = 'Last saved: ' + new Date().toLocaleString();

        renderNoteList();
        setStatus('saved', 'Saved at ' + new Date().toLocaleTimeString());
    }

    // ════════════════════════════════════════════════════════════════════════════
    // FEATURE: Delete → moves to Trash (not permanent)
    // ════════════════════════════════════════════════════════════════════════════

    async function deleteNote(id) {
        const res = await window.electronAPI.confirmDeleteNote();
        if (!res.confirmed) return;

        // main.js moves the note to trash.json before deleting from notes.json
        await window.electronAPI.deleteNoteJson(id);
        notes = notes.filter(n => n.id !== id);

        if (currentNoteId === id) {
            currentNoteId = null;
            titleInput.value = '';
            textarea.value = '';
            lastSavedContent = '';
            noteMeta.textContent = '';
            showEditor(false);
            setStatus('deleted', 'Note moved to trash');
        }

        renderNoteList();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Create new note
    // ════════════════════════════════════════════════════════════════════════════

    async function createNewNote() {
        if (currentNoteId && textarea.value !== lastSavedContent) {
            const res = await window.electronAPI.confirmNewNote();
            if (!res.confirmed) return;
        }

        const newNote = {
            id: Date.now().toString(),
            title: 'Untitled',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await window.electronAPI.saveNoteJson(newNote);
        notes.unshift(newNote);

        currentNoteId = newNote.id;
        titleInput.value = '';
        textarea.value = '';
        lastSavedContent = '';
        noteMeta.textContent = '';

        showEditor(true);
        renderNoteList();
        titleInput.focus();
        setStatus('saved', 'New note created');
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Open file from disk
    // ════════════════════════════════════════════════════════════════════════════

    async function openFile() {
        if (currentNoteId && textarea.value !== lastSavedContent) {
            const res = await window.electronAPI.confirmNewNote();
            if (!res.confirmed) return;
        }

        const result = await window.electronAPI.loadTxtFile();
        if (!result.success) return;

        await importFileContent(result.filePath, result.content);
    }

    // ── FEATURE: Open recent file by path ─────────────────────────────────────
    async function openRecentFile(filePath) {
        if (currentNoteId && textarea.value !== lastSavedContent) {
            const res = await window.electronAPI.confirmNewNote();
            if (!res.confirmed) return;
        }

        const result = await window.electronAPI.loadFileByPath(filePath);
        if (!result.success) {
            setStatus('', 'Could not open: ' + filePath.split(/[\\/]/).pop());
            return;
        }

        await importFileContent(result.filePath, result.content);
    }

    // Shared helper — creates a note from a file path + content
    async function importFileContent(filePath, content) {
        const fileName = filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');

        const newNote = {
            id: Date.now().toString(),
            title: fileName,
            content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await window.electronAPI.saveNoteJson(newNote);
        notes.unshift({ ...newNote });

        currentNoteId = newNote.id;
        titleInput.value = newNote.title;
        textarea.value = newNote.content;
        lastSavedContent = newNote.content;
        noteMeta.textContent = 'Last saved: ' + new Date().toLocaleString();

        showEditor(true);
        updateCounts();
        updateLineNumbers();
        renderNoteList();
        setStatus('saved', 'File imported');
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Save As
    // ════════════════════════════════════════════════════════════════════════════

    async function saveAs() {
        if (!currentNoteId) { setStatus('', 'No note to export'); return; }
        const result = await window.electronAPI.saveNoteAs(textarea.value);
        if (result.success) {
            setStatus('saved', 'Exported to ' + result.filePath.split(/[\\/]/).pop());
        }
    }

    async function exportPdf() {
        if (!currentNoteId) {
            setStatus('', 'Select a note first');
            return;
        }

        setStatus('saving', 'Exporting PDF...');
        const result = await window.electronAPI.exportPdf({
            title: titleInput.value.trim() || 'Untitled',
            content: textarea.value || ''
        });

        if (result.success) {
            setStatus('saved', 'PDF saved: ' + result.filePath.split(/[\\/]/).pop());
        } else {
            setStatus('', 'PDF export canceled');
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // FEATURE: Statistics modal
    // Fetches aggregated data from main.js (which reads notes.json directly)
    // ════════════════════════════════════════════════════════════════════════════

    async function openStats() {
        const s = await window.electronAPI.getStats();

        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-card-num">${s.total}</div>
                <div class="stat-card-label">Total Notes</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-num">${s.totalWords.toLocaleString()}</div>
                <div class="stat-card-label">Total Words</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-num">${s.avgWords}</div>
                <div class="stat-card-label">Avg Words / Note</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-num">${s.longestWords || 0}</div>
                <div class="stat-card-label">Longest Note (words)</div>
            </div>
        `;

        statsExtra.innerHTML = `
            <div class="stat-row">
                <span class="stat-row-label">Most active day</span>
                <span class="stat-row-val">${s.mostActiveDay}</span>
            </div>
            <div class="stat-row">
                <span class="stat-row-label">Longest note</span>
                <span class="stat-row-val">${escapeHtml(s.longestNote || '—')}</span>
            </div>
        `;

        statsModal.classList.add('show');
    }

    // ════════════════════════════════════════════════════════════════════════════
    // FEATURE: Trash bin modal
    // Shows all soft-deleted notes with Restore and Permanently Delete buttons
    // ════════════════════════════════════════════════════════════════════════════

    async function openTrash() {
        const trash = await window.electronAPI.getTrash();
        renderTrashList(trash);
        trashModal.classList.add('show');
    }

    function renderTrashList(trash) {
        if (trash.length === 0) {
            trashList.innerHTML = '<div class="trash-empty-msg">🗑 Trash is empty</div>';
            return;
        }

        trashList.innerHTML = '';

        trash.forEach(note => {
            const el = document.createElement('div');
            el.className = 'trash-item';
            const del = new Date(note.deletedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            el.innerHTML = `
                <div class="trash-item-body">
                    <div class="trash-item-title">${escapeHtml(note.title || 'Untitled')}</div>
                    <div class="trash-item-date">Deleted ${del}</div>
                </div>
                <div class="trash-actions">
                    <button class="btn-restore" data-id="${note.id}">↩ Restore</button>
                    <button class="btn-perma-del" data-id="${note.id}">✕ Delete</button>
                </div>
            `;

            // Restore
            el.querySelector('.btn-restore').addEventListener('click', async () => {
                await window.electronAPI.restoreNote(note.id);
                // Reload notes in sidebar
                notes = await window.electronAPI.getNotes();
                renderNoteList();
                // Refresh trash modal
                const updated = await window.electronAPI.getTrash();
                renderTrashList(updated);
                setStatus('saved', 'Note restored');
            });

            // Permanently delete
            el.querySelector('.btn-perma-del').addEventListener('click', async () => {
                const res = await window.electronAPI.permanentDelete(note.id);
                if (res.confirmed) {
                    const updated = await window.electronAPI.getTrash();
                    renderTrashList(updated);
                    setStatus('deleted', 'Permanently deleted');
                }
            });

            trashList.appendChild(el);
        });

        // Empty trash button
        const emptyBtn = document.createElement('button');
        emptyBtn.className = 'btn-empty-trash';
        emptyBtn.textContent = '🗑 Empty Trash';
        emptyBtn.addEventListener('click', async () => {
            const res = await window.electronAPI.emptyTrash();
            if (res.confirmed) renderTrashList([]);
        });
        trashList.appendChild(emptyBtn);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Modal close helpers
    // ════════════════════════════════════════════════════════════════════════════

    function closeModal(overlay) {
        overlay.classList.remove('show');
    }

    // Close on X button
    shortcutsClose.addEventListener('click', () => closeModal(shortcutsModal));
    statsClose.addEventListener('click', () => closeModal(statsModal));
    trashClose.addEventListener('click', () => closeModal(trashModal));

    // Close on backdrop click
    [shortcutsModal, statsModal, trashModal].forEach(m => {
        m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
    });

    // ════════════════════════════════════════════════════════════════════════════
    // Menu listeners (main → renderer)
    // ════════════════════════════════════════════════════════════════════════════

    window.electronAPI.onMenuAction('menu-new-note', () => createNewNote());
    window.electronAPI.onMenuAction('menu-open-file', () => openFile());
    window.electronAPI.onMenuAction('menu-save', () => saveCurrentNote());
    window.electronAPI.onMenuAction('menu-save-as', () => saveAs());
    window.electronAPI.onMenuAction('menu-open-trash', () => openTrash());
    window.electronAPI.onMenuAction('menu-stats', () => openStats());
    window.electronAPI.onMenuAction('menu-shortcuts', () => shortcutsModal.classList.add('show'));

    // ── FEATURE: Zoom via menu ─────────────────────────────────────────────────
    window.electronAPI.onMenuAction('menu-zoom-in', () => applyZoom(zoomFactor + 0.1));
    window.electronAPI.onMenuAction('menu-zoom-out', () => applyZoom(zoomFactor - 0.1));
    window.electronAPI.onMenuAction('menu-zoom-reset', () => applyZoom(1.0));

    // ── FEATURE: Open recent file via menu ────────────────────────────────────
    window.electronAPI.onMenuAction('menu-open-recent', (_event, filePath) => openRecentFile(filePath));

    // ════════════════════════════════════════════════════════════════════════════
    // Button click listeners
    // ════════════════════════════════════════════════════════════════════════════

    newNoteBtn.addEventListener('click', () => createNewNote());
    saveBtn.addEventListener('click', () => saveCurrentNote());
    saveAsBtn.addEventListener('click', () => saveAs());
    openFileBtn.addEventListener('click', () => openFile());
     emojiBtn.addEventListener('click', () => emojiPanel.classList.toggle('show'));
    emojiPanel.addEventListener('click', (event) => {
        if (event.target.classList.contains('emoji-chip')) {
            insertAtCursor(textarea, event.target.textContent);
            emojiPanel.classList.remove('show');
        }
    });
    document.addEventListener('click', (event) => {
        if (!emojiPanel.contains(event.target) && event.target !== emojiBtn) {
            emojiPanel.classList.remove('show');
        }
    });
    trashBtn.addEventListener('click', () => openTrash());

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light');
        document.getElementById('theme-toggle').textContent = isLight ? '☀️' : '🌙';
        window.electronAPI.saveTheme(isLight ? 'light' : 'dark');
    });

    // ── FEATURE: Search ────────────────────────────────────────────────────────
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim().toLowerCase();
        renderNoteList();
    });

    // ── Auto-save 5 seconds after last keystroke ───────────────────────────────
    textarea.addEventListener('input', () => {
        setStatus('saving', 'Unsaved changes…');
        updateCounts();
        updateLineNumbers();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => saveCurrentNote(), 5000);
    });

    titleInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => saveCurrentNote(), 5000);
    });

    textarea.addEventListener('scroll', () => {
        lineNumbers.scrollTop = textarea.scrollTop;
    });

    // ════════════════════════════════════════════════════════════════════════════
    // Startup
    // ════════════════════════════════════════════════════════════════════════════

    notes = await window.electronAPI.getNotes();

    if (notes.length > 0) {
        const mostRecent = notes.reduce((a, b) =>
            new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b
        );
        renderNoteList();
        await switchNote(mostRecent.id);
    } else {
        renderNoteList();
        await createNewNote();
    }
});
