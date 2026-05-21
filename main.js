const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const notesFilePath = path.join(app.getPath('userData'), 'notes.json');
let win;

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    win.loadFile('index.html');
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Note',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        if (win) win.webContents.send('menu-new');
                    },
                },
                {
                    label: 'Save Note',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        if (win) win.webContents.send('menu-save');
                    },
                },
                {
                    label: 'Save As...',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        if (win) win.webContents.send('menu-save-as');
                    },
                },
                {
                    label: 'Open File',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        if (win) win.webContents.send('menu-open');
                    },
                },
                { type: 'separator' },
                { role: 'quit' },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    click: () => {
                        const focused = BrowserWindow.getFocusedWindow();
                        if (focused) focused.webContents.cut();
                    },
                },
                {
                    label: 'Copy',
                    accelerator: 'CmdOrCtrl+C',
                    click: () => {
                        const focused = BrowserWindow.getFocusedWindow();
                        if (focused) focused.webContents.copy();
                    },
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    click: () => {
                        const focused = BrowserWindow.getFocusedWindow();
                        if (focused) focused.webContents.paste();
                    },
                },
                { role: 'delete' },
                { type: 'separator' },
                {
                    label: 'Clear formatting',
                    accelerator: 'CmdOrCtrl+Shift+X',
                    click: () => {
                        const focused = BrowserWindow.getFocusedWindow();
                        if (focused) focused.webContents.send('menu-clear-formatting');
                    },
                },
                {
                    label: 'Search with Google',
                    accelerator: 'CmdOrCtrl+Shift+L',
                    click: () => {
                        const focused = BrowserWindow.getFocusedWindow();
                        if (focused) focused.webContents.send('menu-search-google');
                    },
                },
                {
                    label: 'Select All',
                    accelerator: 'CmdOrCtrl+A',
                    click: () => {
                        const focused = BrowserWindow.getFocusedWindow();
                        if (focused) focused.webContents.selectAll();
                    },
                },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function readNotes() {
    try {
        if (!fs.existsSync(notesFilePath)) {
            return [];
        }
        const data = fs.readFileSync(notesFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading notes file:', error);
        return [];
    }
}

function writeNotes(notes) {
    try {
        fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing notes file:', error);
    }
}

app.whenReady().then(() => {
    createWindow();
    createMenu();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

ipcMain.handle('get-notes', async () => readNotes());

ipcMain.handle('save-note', async (event, note) => {
    const notes = readNotes();
    const index = notes.findIndex((n) => n.id === note.id);

    if (index === -1) {
        notes.push(note);
    } else {
        notes[index] = { ...notes[index], ...note };
    }

    writeNotes(notes);
    return true;
});

ipcMain.handle('delete-note', async (event, id) => {
    let notes = readNotes();
    notes = notes.filter((note) => note.id !== id);
    writeNotes(notes);
    return true;
});

ipcMain.handle('save-as', async (event, content) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: 'Save Note As',
        defaultPath: path.join(app.getPath('documents'), 'note.txt'),
        filters: [
            { name: 'Text Files', extensions: ['txt'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (canceled || !filePath) {
        return { success: false };
    }

    try {
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: true, filePath };
    } catch (error) {
        console.error('Error saving file:', error);
        return { success: false };
    }
});

ipcMain.handle('open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Open File',
        properties: ['openFile'],
        filters: [
            { name: 'Text Files', extensions: ['txt', 'md'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (canceled || filePaths.length === 0) {
        return { success: false };
    }

    try {
        const content = fs.readFileSync(filePaths[0], 'utf8');
        return { success: true, filePath: filePaths[0], content };
    } catch (error) {
        console.error('Error opening file:', error);
        return { success: false };
    }
});

ipcMain.handle('new-note-dialog', async () => 0);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});