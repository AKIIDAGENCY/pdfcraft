import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './ipc/handlers';
import { closeDb } from './db/connection';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

// A clerk double-clicking the desktop shortcut twice, or two logins on a
// shared office PC launching it at once, must not get two independent
// windows writing to the same encrypted database — focus the existing
// window instead of starting a second process.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'نظام إدارة غرفة التحقيق',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Open external links (if any) in the OS browser instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // The window should never navigate away from the app's own loaded page —
  // there is no legitimate in-app link that does that. Blocking it is cheap
  // defense in depth against any injected content (e.g. via a compromised
  // dependency) trying to carry the top-level window to an external origin.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url);
    const isDevServer = isDev && target.origin === 'http://localhost:5173';
    const isOwnFile = !isDev && target.protocol === 'file:';
    if (!isDevServer && !isOwnFile) event.preventDefault();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));

    // The case file this app handles is judicial-secrecy material (sealed
    // witness identities, interception targets). DevTools gives unrestricted
    // read/write access to the renderer's memory and the IPC bridge, so it
    // must be unreachable in a packaged build — not just hidden behind a
    // menu bar that Alt reveals.
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const isDevToolsShortcut =
        input.key === 'F12' ||
        ((input.control || input.meta) && input.shift && (input.key.toLowerCase() === 'i' || input.key.toLowerCase() === 'j')) ||
        ((input.control || input.meta) && input.key.toLowerCase() === 'u');
      if (isDevToolsShortcut) event.preventDefault();
    });
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;
  if (!isDev) Menu.setApplicationMenu(null);
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  closeDb();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeDb();
});
