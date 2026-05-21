const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onMenuAction: (channel, callback) => {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    getNotes: () => ipcRenderer.invoke('get-notes'),
    saveNote: (note) => ipcRenderer.invoke('save-note', note),
    saveAs: (content) => ipcRenderer.invoke('save-as', content),
    openFile: () => ipcRenderer.invoke('open-file'),
    deleteNote: (id) => ipcRenderer.invoke('delete-note', id),
    newNote: () => ipcRenderer.invoke('new-note-dialog')
});