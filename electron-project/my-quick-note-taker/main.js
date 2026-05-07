const { app, BrowserWindow, Menu, ipcMain, dialog, Main, Tray } = require('electron');
app.commandLine.appendSwitch('disable-http-cache');
app.disableHardwareAcceleration();
const path = require('node:path');
const fs = require('node:fs');
const notesFilePath = path.join(app.getPath('userData'), 'notes.json');
//New : system tray (which helps to create the tray  bar in the bottom of the se)

let tray = null;
let win = null;

function createWindow() {
    win = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('index.html');

    // Window close event
    win.on('close', (event) => {
        event.preventDefault();
        win.hide();
    });
}

app.whenReady().then(() => {
    createWindow();

    try {
        tray = new Tray(path.join(__dirname, 'icon.png'));
    } catch (err) {
        console.log('Tray icon not found, starting without tray');
        return;
    }

    const trayMenu = Menu.buildFromTemplate([
        {
            label: 'show app ',
            click: () => {
                BrowserWindow.getAllWindows()[0].show();
            }
        },
        {
            label: ' Quit',
            click: () => app.quit()
        }
    ]);
    tray.setToolTip('quick note taker');
    tray.setContextMenu(trayMenu);

    // Tray double-click event
    tray.on('double-click', () => {
        const mainWin = BrowserWindow.getAllWindows()[0];
        if (mainWin && mainWin.isVisible()) {
            mainWin.hide();
        } else if (mainWin) {
            mainWin.show();
        }
    });
});


const menuTemplate = [
    {
        label: 'File',
        submenu: [
            {
                label: 'New Note',
                accelerator: 'CmdOrCtrl+N',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.send('menu-new-note');
                }
            },
            {
                label: 'Open File',
                accelerator: 'CmdOrCtrl+O',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.send('menu-open-file');
                }
            },
            { type: 'separator' },
            {
                label: 'Save',
                accelerator: 'CmdOrCtrl+S',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.send('menu-save');
                }
            },
            {
                label: 'Save As',
                accelerator: 'CmdOrCtrl+Shift+S',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.send('menu-save-as');
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => app.quit()
            }

        ]
    },

    {
        label: 'Edit',
        submenu: [
            {
                label: 'Cut',
                accelerator: 'CmdOrCtrl+X',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.cut();
                }

            },
            {
                label: 'Copy',
                accelerator: 'CmdOrCtrl+C',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.copy();
                },
            },
            {
                label: 'Paste',
                accelerator: 'CmdOrCtrl+V',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.paste();
                }
            },

            {
                label: 'Delete',
                accelerator: 'Delete',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.delete();
                }
            },
            { type: 'separator' },
            {
                label: 'Clear formatting',
                accelerator: 'CmdOrCtrl+Shift+X',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.send('menu-clear-formatting');
                }
            },
            {
                label: 'Search with google ',
                accelerator: 'CmdOrCtrl+Shift+L',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.send('menu-search-google');

                }
            },
            {
                label: 'Select All',
                accelerator: 'CmdOrCtrl+A',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) win.webContents.selectAll();
                }
            },




        ]
    },
];
function setApplicationMenu() {
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    createWindow();
    setApplicationMenu();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

function readNotes() {
    if (!fs.existsSync(notesFilePath)) {
        return [];
    }
    const raw = fs.readFileSync(notesFilePath, 'utf-8');
    return JSON.parse(raw || '[]');
}

function writeNotes(notes) {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf-8');
}
ipcMain.handle('save-note', async (event, text) => {
    const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
    fs.writeFileSync(filePath, text, 'utf-8');
    return { success: true, filePath };
});

ipcMain.handle('load-note', async () => {
    const filePath = path.join(app.getPath('documents'), 'quicknote.txt');
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
});

ipcMain.handle('save-as', async (event, text) => {
    const result = await dialog.showSaveDialog({
        defaultPath: 'mynote.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
    }

    fs.writeFileSync(result.filePath, text, 'utf-8');
    return { success: true, filePath: result.filePath };
});

ipcMain.handle('open-file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Text Files', extensions: ['txt', 'md'] }]
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, filePath, content };
});

ipcMain.handle('new-note', async () => {
    return { success: true };
});
// i=this ine helps to  get  the notes from the json file and send it to the renderer 
ipcMain.handle('get-notes', async () => {
    return readNotes();

});
// this lines of code helps to delete the notes from the json file and filtered the note
ipcMain.handle('delete-note', async (event, id) => {
    const notes = readNotes();
    const filtered = notes.filter(n => n.id !== id);
    writeNotes(filtered);
    return { success: true };
});

ipcMain.handle('save-note-json', async (event, note) => {
    const now = new Date().toISOString();
    const notes = readNotes();
    const index = notes.findIndex(n => n.id === note.id);

    if (index === -1) {
        notes.push({ ...note, createdAt: now, updatedAt: now });
    } else {
        notes[index] = { ...notes[index], ...note, updatedAt: now };
    }

    writeNotes(notes);
    return { success: true };
});
