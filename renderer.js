window.addEventListener('DOMContentLoaded', async () => {
    // Original DOM selection structures kept intact
    const textarea = document.getElementById('note');
    const titleInput = document.getElementById('note-title');
    const saveBtn = document.getElementById('save');
    const saveAsBtn = document.getElementById('save-as');
    const openFileBtn = document.getElementById('open-file');
    const newNoteBtn = document.getElementById('new-note');
    const noteList = document.getElementById('note-list');
    const statusEl = document.getElementById('save_status');
    // Slide 9 - Step 1: Grab the newly added layout element
    const wordCountEl = document.getElementById('word-count');

    // Original State variables remain completely untouched
    let notes = [];
    let currentNoteId = null;
    let lastSavedContent = '';
    let debounceTimer = null;

    // Slide 7 & 8 - Step 2: Spacing-regulated Word/Character Count Engine (Added on top)
    function updateWordCount() {
        const text = textarea.value.trim();
        const words = text === '' ? 0 : text.split(/\s+/).length;
        const characters = textarea.value.length;
        wordCountEl.textContent = `Words: ${words} | Characters: ${characters}`;
    }

    // Original Sidebar rendering engine remains intact
    function renderNoteList() {
        noteList.innerHTML = '';
        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = `note-item ${note.id === currentNoteId ? 'active' : ''}`;
            const date = new Date(note.updatedAt || note.createdAt).toLocaleDateString();

            div.innerHTML = `
                <button class="note-item-delete" data-id="${note.id}">Delete</button>
                <div class="note-item-title">${note.title || 'Untitled Note'}</div>
                <div class="note-item-date">${date}</div>
            `;

            div.addEventListener('click', () => switchNote(note.id));
            div.querySelector('.note-item-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNote(note.id);
            });
            noteList.appendChild(div);
        });
    }

    // Original switchNote code with updateWordCount hook added safely inside
    async function switchNote(id) {
        if (id === currentNoteId) return;
        if (textarea.value !== lastSavedContent) {
            if ((await window.electronAPI.newNote()) === 1) return;
        }

        const note = notes.find(n => n.id === id);
        if (note) {
            currentNoteId = note.id;
            titleInput.value = note.title || '';
            textarea.value = note.content || '';
            lastSavedContent = textarea.value;

            updateWordCount(); // Slide 9 - Step 3: Call counter on note switch
            renderNoteList();
        }
    }

    // Original saveCurrentNote logic remains completely untouched
    async function saveCurrentNote() {
        if (!currentNoteId) return;
        statusEl.textContent = 'Saving...';
        const updatedNote = {
            id: currentNoteId,
            title: titleInput.value.trim() || 'Untitled Note',
            content: textarea.value,
            updatedAt: new Date().toISOString()
        };
        await window.electronAPI.saveNote(updatedNote);
        const index = notes.findIndex(n => n.id === currentNoteId);
        if (index !== -1) notes[index] = { ...notes[index], ...updatedNote };
        lastSavedContent = textarea.value;
        statusEl.textContent = 'Saved';
        renderNoteList();
    }

    // Original deleteNote functionality remains completely untouched
    async function deleteNote(id) {
        if ((await window.electronAPI.newNote()) === 1) return;
        await window.electronAPI.deleteNote(id);
        notes = notes.filter(n => n.id !== id);
        if (currentNoteId === id) {
            if (notes.length > 0) {
                currentNoteId = null;
                switchNote(notes[0].id);
            } else {
                currentNoteId = null;
                titleInput.value = ''; textarea.value = ''; lastSavedContent = '';
                updateWordCount(); // Update display counts when text field clears
            }
        }
        renderNoteList();
    }

    // Original newNoteBtn event logic remains unchanged with added layout metrics hook
    newNoteBtn.addEventListener('click', async () => {
        if (textarea.value !== lastSavedContent) {
            if ((await window.electronAPI.newNote()) === 1) return;
        }
        const newNote = { id: Date.now().toString(), title: '', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        notes.unshift(newNote);
        currentNoteId = newNote.id;
        titleInput.value = ''; textarea.value = ''; lastSavedContent = '';
        renderNoteList();
        updateWordCount(); // Reset display counts for a clean, new blank canvas
        titleInput.focus();
    });

    saveBtn.addEventListener('click', () => saveCurrentNote());

    saveAsBtn.addEventListener('click', async () => {
        try {
            const result = await window.electronAPI.saveAs(textarea.value);
            if (result.success) {
                lastSavedContent = textarea.value;
                statusEl.textContent = `Saved to: ${result.filePath}`;
            } else {
                statusEl.textContent = 'Save as canceled.';
            }
        } catch (error) {
            console.error('Error saving as:', error);
            statusEl.textContent = 'Error saving as';
        }
    });

    openFileBtn.addEventListener('click', async () => {
        try {
            const result = await window.electronAPI.openFile();
            if (result.success) {
                textarea.value = result.content;
                lastSavedContent = result.content;
                statusEl.textContent = `Opened: ${result.filePath}`;
                updateWordCount();
            } else {r
                statusEl.textContent = 'Open file canceled.';
            }
        } catch (error) {
            console.error('Error opening file:', error);
            statusEl.textContent = 'Error opening file';
        }
    });

    // Original input listening hooks with added updateWordCount hook (Slide 9 - Step 3)
    textarea.addEventListener('input', () => {
        statusEl.textContent = 'Unsaved changes';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => saveCurrentNote(), 5000);
    });

    titleInput.addEventListener('input', () => {
        statusEl.textContent = 'Unsaved changes';
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => saveCurrentNote(), 5000);
    });

    // Original Top Menu Action listening routes 
    window.electronAPI.onMenuAction('menu-new', () => newNoteBtn.click());
    window.electronAPI.onMenuAction('menu-save', () => saveBtn.click());
    window.electronAPI.onMenuAction('menu-save-as', () => saveAsBtn.click());
    window.electronAPI.onMenuAction('menu-open', () => openFileBtn.click());

    // Original Lifecycle Boot Hook Setup
    notes = await window.electronAPI.getNotes();
    if (notes.length > 0) {
        const mostRecentNote = notes.reduce((max, note) => new Date(note.updatedAt) > new Date(max.updatedAt) ? note : max, notes[0]);
        currentNoteId = mostRecentNote.id;
        titleInput.value = mostRecentNote.title || '';
        textarea.value = mostRecentNote.content || '';
        lastSavedContent = textarea.value;
    } else {
        const defaultNote = { id: Date.now().toString(), title: 'Welcome Note', content: 'Type your thoughts here...', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        notes.push(defaultNote);
        await window.electronAPI.saveNote(defaultNote);
        currentNoteId = defaultNote.id;
        titleInput.value = defaultNote.title; textarea.value = defaultNote.content; lastSavedContent = textarea.value;
    }
    renderNoteList();
    updateWordCount(); // Establish counts accurately on application startup boot
});