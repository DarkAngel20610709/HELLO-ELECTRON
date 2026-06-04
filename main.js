 // main.js
const { app, BrowserWindow, ipcMain, dialog, Menu, Tray } = require('electron');

app.disableHardwareAcceleration();

const path = require('node:path');
const fs = require('node:fs');

let notesFilePath;
let trashFilePath;
let settingsFilePath;
let recentFilesPath;
let tray = null;
let mainWindow = null;

// ════════════════════════════════════════════════════════════════════════════════
// File helpers
// ════════════════════════════════════════════════════════════════════════════════

function readNotes() {
    if (!fs.existsSync(notesFilePath)) return [];
    try { return JSON.parse(fs.readFileSync(notesFilePath, 'utf-8')); }
    catch { return []; }
}
function writeNotes(notes) {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2), 'utf-8');
}

// ── FEATURE: Trash bin ─────────────────────────────────────────────────────────
function readTrash() {
    if (!fs.existsSync(trashFilePath)) return [];
    try { return JSON.parse(fs.readFileSync(trashFilePath, 'utf-8')); }
    catch { return []; }
}
function writeTrash(items) {
    fs.writeFileSync(trashFilePath, JSON.stringify(items, null, 2), 'utf-8');
}

// ── FEATURE: Settings (zoom, etc.) ────────────────────────────────────────────
function readSettings() {
    if (!fs.existsSync(settingsFilePath)) return {};
    try { return JSON.parse(fs.readFileSync(settingsFilePath, 'utf-8')); }
    catch { return {}; }
}
function writeSettings(settings) {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
}

// ── FEATURE: Recent files ──────────────────────────────────────────────────────
function readRecentFiles() {
    if (!fs.existsSync(recentFilesPath)) return [];
    try { return JSON.parse(fs.readFileSync(recentFilesPath, 'utf-8')); }
    catch { return []; }
}
function writeRecentFiles(list) {
    fs.writeFileSync(recentFilesPath, JSON.stringify(list, null, 2), 'utf-8');
}
function addRecentFile(filePath) {
    let list = readRecentFiles();
    list = [filePath, ...list.filter(p => p !== filePath)].slice(0, 8);
    writeRecentFiles(list);
    app.addRecentDocument(filePath);
    buildMenu(); // rebuild menu so Recent Files submenu updates
}

// ════════════════════════════════════════════════════════════════════════════════
// Menu builder (extracted so we can rebuild when recent files change)
// ════════════════════════════════════════════════════════════════════════════════

function buildMenu() {
    const recentFiles = readRecentFiles();

    // ── FEATURE: Recent Files submenu ──────────────────────────────────────────
    const recentSubmenu = recentFiles.length > 0
        ? [
            ...recentFiles.map(fp => ({
                label: path.basename(fp),
                click: () => mainWindow && mainWindow.webContents.send('menu-open-recent', fp)
            })),
            { type: 'separator' },
            {
                label: 'Clear Recent Files',
                click: () => { writeRecentFiles([]); app.clearRecentDocuments(); buildMenu(); }
            }
        ]
        : [{ label: 'No recent files', enabled: false }];

    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Note',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => mainWindow && mainWindow.webContents.send('menu-new-note')
                },
                {
                    label: 'Open File…',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => mainWindow && mainWindow.webContents.send('menu-open-file')
                },
                {
                    label: 'Open Recent',
                    submenu: recentSubmenu
                },
                { type: 'separator' },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => mainWindow && mainWindow.webContents.send('menu-save')
                },
                {
                    label: 'Save As…',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => mainWindow && mainWindow.webContents.send('menu-save-as')
                },
                {
                    label: 'Export as PDF',
                    accelerator: 'CmdOrCtrl+Shift+E',
                    click: () => mainWindow && mainWindow.webContents.send('menu-export-pdf')
                },
                { type: 'separator' },
                {
                    label: 'Trash Bin',
                    click: () => mainWindow && mainWindow.webContents.send('menu-open-trash')
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        if (mainWindow) mainWindow.removeAllListeners('close');
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                // ── FEATURE: Zoom ──────────────────────────────────────────────
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+Shift+=',
                    click: () => mainWindow && mainWindow.webContents.send('menu-zoom-in')
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => mainWindow && mainWindow.webContents.send('menu-zoom-out')
                },
                {
                    label: 'Reset Zoom',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => mainWindow && mainWindow.webContents.send('menu-zoom-reset')
                },
                { type: 'separator' },
                // ── FEATURE: Statistics ────────────────────────────────────────
                {
                    label: 'Note Statistics',
                    accelerator: 'CmdOrCtrl+Shift+I',
                    click: () => mainWindow && mainWindow.webContents.send('menu-stats')
                },
                // ── FEATURE: Keyboard cheat sheet ──────────────────────────────
                {
                    label: 'Keyboard Shortcuts',
                    accelerator: 'CmdOrCtrl+/',
                    click: () => mainWindow && mainWindow.webContents.send('menu-shortcuts')
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}

// ════════════════════════════════════════════════════════════════════════════════
// Window creation
// ════════════════════════════════════════════════════════════════════════════════

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100, height: 700,
        minWidth: 800, minHeight: 500,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('close', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });
}

// ════════════════════════════════════════════════════════════════════════════════
// App ready
// ════════════════════════════════════════════════════════════════════════════════

app.whenReady().then(() => {
    const userDataPath = app.getPath('userData');
    notesFilePath = path.join(userDataPath, 'notes.json');
    trashFilePath = path.join(userDataPath, 'trash.json');
    settingsFilePath = path.join(userDataPath, 'settings.json');
    recentFilesPath = path.join(userDataPath, 'recentFiles.json');

    createWindow();
    buildMenu();

    // Tray
    const iconPath = path.join(__dirname, 'tray-icon.png');
    if (!fs.existsSync(iconPath)) {
        const minPng = Buffer.from(
            '89504e470d0a1a0a0000000d494844520000000100000001' +
            '08060000001f15c4890000000a4944415478016360000000' +
            '020001e221bc330000000049454e44ae426082', 'hex'
        );
        fs.writeFileSync(iconPath, minPng);
    }

    tray = new Tray(iconPath);
    tray.setToolTip('Quick Note Taker');

    const trayMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
        { type: 'separator' },
        { label: 'Quit', click: () => { if (mainWindow) mainWindow.removeAllListeners('close'); app.quit(); } }
    ]);
    tray.setContextMenu(trayMenu);

    tray.on('double-click', () => {
        if (!mainWindow) return;
        mainWindow.isVisible() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
    });

    app.on('activate', () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
});

app.on('window-all-closed', () => { });

// ════════════════════════════════════════════════════════════════════════════════
// IPC Handlers — original
// ════════════════════════════════════════════════════════════════════════════════

ipcMain.handle('confirm-new-note', async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning', title: 'Unsaved Changes',
        message: 'You have unsaved changes.',
        detail: 'Discard them and continue?',
        buttons: ['Discard Changes', 'Cancel'], defaultId: 1, cancelId: 1
    });
    return { confirmed: response === 0 };
});

ipcMain.handle('confirm-delete-note', async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning', title: 'Move to Trash',
        message: 'Move this note to trash?',
        detail: 'You can restore it from the trash bin.',
        buttons: ['Move to Trash', 'Cancel'], defaultId: 1, cancelId: 1
    });
    return { confirmed: response === 0 };
});

ipcMain.handle('load-txt-file', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Text File',
        defaultPath: app.getPath('documents'),
        filters: [
            { name: 'Text Files', extensions: ['txt'] },
            { name: 'Markdown', extensions: ['md'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) return { success: false, reason: 'canceled' };
    const content = fs.readFileSync(filePaths[0], 'utf-8');
    addRecentFile(filePaths[0]); // ← FEATURE: track recent files
    return { success: true, content, filePath: filePaths[0] };
});

// ── FEATURE: Open recent file by path ─────────────────────────────────────────
ipcMain.handle('load-file-by-path', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        addRecentFile(filePath);
        return { success: true, content, filePath };
    } catch (e) {
        return { success: false, reason: e.message };
    }
});

ipcMain.handle('save-note-as', async (event, text) => {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Note As',
        defaultPath: path.join(app.getPath('documents'), 'note.txt'),
        filters: [
            { name: 'Text Files', extensions: ['txt'] },
            { name: 'Markdown', extensions: ['md'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    if (canceled || !filePath) return { success: false, reason: 'canceled' };
    fs.writeFileSync(filePath, text, 'utf-8');
    addRecentFile(filePath); // ← track recent files
    return { success: true, filePath };
});

// ── FEATURE: Export as PDF ─────────────────────────────────────────────────────
ipcMain.handle('export-pdf', async (event, payload) => {
    const title = (payload && payload.title) || 'note';
    const content = (payload && payload.content) || '';

    const fileName = (title || 'note').replace(/[/\\?%*:|"<>]/g, '-') + '.pdf';
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
        title: 'Export as PDF',
        defaultPath: path.join(app.getPath('documents'), fileName),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { success: false };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtmlForTemplate(title)}</title>
    <style>
        body { font-family: sans-serif; margin: 40px; color: #111; }
        h1 { font-size: 28px; margin-bottom: 20px; }
        .content { white-space: pre-wrap; word-wrap: break-word; font-size: 14px; line-height: 1.6; }
    </style>
</head>
<body>
    <h1>${escapeHtmlForTemplate(title)}</h1>
    <div class="content">${escapeHtmlForTemplate(content)}</div>
</body>
</html>`;

    let printWin = null;
    try {
        printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
        await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        const data = await printWin.webContents.printToPDF({ printBackground: true, pageSize: 'A4', marginsType: 1 });
        fs.writeFileSync(filePath, data);
        return { success: true, filePath };
    } catch (error) {
        console.error('PDF export error:', error);
        return { success: false };
    } finally {
        if (printWin && !printWin.isDestroyed()) printWin.destroy();
    }
});

// Helper to escape HTML in template strings
function escapeHtmlForTemplate(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── FEATURE: Zoom — save preference ───────────────────────────────────────────
ipcMain.handle('apply-zoom', async (event, zoomFactor) => {
    if (mainWindow) mainWindow.webContents.setZoomFactor(zoomFactor);
    return { success: true };
});
ipcMain.handle('save-zoom', async (event, zoomFactor) => {
    const settings = readSettings();
    settings.zoomFactor = zoomFactor;
    writeSettings(settings);
    return { success: true };
});
ipcMain.handle('save-theme', async (event, theme) => {
    const settings = readSettings();
    settings.theme = theme;
    writeSettings(settings);
    return { success: true };
});

ipcMain.handle('get-settings', async () => {
    return readSettings();
});

// ── FEATURE: Note statistics ───────────────────────────────────────────────────
ipcMain.handle('get-stats', async () => {
    const notes = readNotes();
    if (notes.length === 0) return { total: 0, totalWords: 0, avgWords: 0, mostActiveDay: 'N/A', longestNote: null };

    let totalWords = 0;
    let dayCounts = {};
    let longest = null;
    let longestWC = 0;

    notes.forEach(note => {
        const text = note.content || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        totalWords += words;

        const day = new Date(note.updatedAt).toLocaleDateString(undefined, { weekday: 'long' });
        dayCounts[day] = (dayCounts[day] || 0) + 1;

        if (words > longestWC) { longestWC = words; longest = note.title || 'Untitled'; }
    });

    const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
        total: notes.length,
        totalWords,
        avgWords: Math.round(totalWords / notes.length),
        mostActiveDay,
        longestNote: longest,
        longestWords: longestWC
    };
});

// ── JSON multi-note IPC handlers (original) ────────────────────────────────────

ipcMain.handle('get-notes', async () => readNotes());

ipcMain.handle('save-note-json', async (event, note) => {
    const notes = readNotes();
    const index = notes.findIndex(n => n.id === note.id);
    const now = new Date().toISOString();
    if (index === -1) {
        notes.unshift({ ...note, createdAt: now, updatedAt: now });
    } else {
        notes[index] = { ...notes[index], ...note, updatedAt: now };
    }
    writeNotes(notes);
    return { success: true };
});

ipcMain.handle('delete-note-json', async (event, id) => {
    const notes = readNotes();
    const note = notes.find(n => n.id === id);
    if (note) {
        // ── FEATURE: Move to trash instead of permanent delete ──────────────────
        const trash = readTrash();
        trash.unshift({ ...note, deletedAt: new Date().toISOString() });
        writeTrash(trash);
    }
    writeNotes(notes.filter(n => n.id !== id));
    return { success: true };
});

// ── FEATURE: Trash bin IPC ─────────────────────────────────────────────────────

ipcMain.handle('get-trash', async () => readTrash());

ipcMain.handle('restore-note', async (event, id) => {
    const trash = readTrash();
    const note = trash.find(n => n.id === id);
    if (!note) return { success: false };
    const notes = readNotes();
    const { deletedAt, ...restored } = note;
    restored.updatedAt = new Date().toISOString();
    notes.unshift(restored);
    writeNotes(notes);
    writeTrash(trash.filter(n => n.id !== id));
    return { success: true };
});

ipcMain.handle('permanent-delete', async (event, id) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning', title: 'Permanently Delete',
        message: 'Delete this note forever?',
        detail: 'This cannot be undone.',
        buttons: ['Delete Forever', 'Cancel'], defaultId: 1, cancelId: 1
    });
    if (response !== 0) return { confirmed: false };
    writeTrash(readTrash().filter(n => n.id !== id));
    return { confirmed: true, success: true };
});

ipcMain.handle('empty-trash', async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning', title: 'Empty Trash',
        message: 'Permanently delete all notes in trash?',
        detail: 'This cannot be undone.',
        buttons: ['Empty Trash', 'Cancel'], defaultId: 1, cancelId: 1
    });
    if (response !== 0) return { confirmed: false };
    writeTrash([]);
    return { confirmed: true, success: true };
});
