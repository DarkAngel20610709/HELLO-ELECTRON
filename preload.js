  // preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

    // ── Original dialogs ───────────────────────────────────────────────────────
    confirmNewNote: () => ipcRenderer.invoke('confirm-new-note'),
    confirmDeleteNote: () => ipcRenderer.invoke('confirm-delete-note'),

    // ── Original file operations ───────────────────────────────────────────────
    loadTxtFile: () => ipcRenderer.invoke('load-txt-file'),
    saveNoteAs: (text) => ipcRenderer.invoke('save-note-as', text),

    // ── Original JSON multi-note storage ──────────────────────────────────────
    getNotes: () => ipcRenderer.invoke('get-notes'),
    saveNoteJson: (note) => ipcRenderer.invoke('save-note-json', note),
    deleteNoteJson: (id) => ipcRenderer.invoke('delete-note-json', id),

    // ── FEATURE: Recent files ──────────────────────────────────────────────────
    loadFileByPath: (fp) => ipcRenderer.invoke('load-file-by-path', fp),

    // ── FEATURE: Export as PDF ─────────────────────────────────────────────────
    exportPdf: (title, content) => ipcRenderer.invoke('export-pdf', { title, content }),

    // ── FEATURE: Zoom ──────────────────────────────────────────────────────────
    saveZoom: (factor) => ipcRenderer.invoke('save-zoom', factor),
    applyZoom: (factor) => ipcRenderer.invoke('apply-zoom', factor),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveTheme: (theme) => ipcRenderer.invoke('save-theme', theme),

    // ── FEATURE: Statistics ────────────────────────────────────────────────────
    getStats: () => ipcRenderer.invoke('get-stats'),

    // ── FEATURE: Trash bin ─────────────────────────────────────────────────────
    getTrash: () => ipcRenderer.invoke('get-trash'),
    restoreNote: (id) => ipcRenderer.invoke('restore-note', id),
    permanentDelete: (id) => ipcRenderer.invoke('permanent-delete', id),
    emptyTrash: () => ipcRenderer.invoke('empty-trash'),

    // ── Menu listener (main → renderer, one-way) ───────────────────────────────
    onMenuAction: (channel, callback) => ipcRenderer.on(channel, callback),

});
