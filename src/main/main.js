const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { analyzeVideo, discoverTools } = require('./videoAnalyzer');

// Avoid Windows GPU/driver white-screen issues on some systems.
app.disableHardwareAcceleration();

function appendLog(line) {
  const text = `[${new Date().toISOString()}] ${line}\n`;
  const locations = [];
  try {
    locations.push(path.join(app.getPath('temp'), 'Video Inspector', 'video-inspector-startup.log'));
  } catch (_) {}
  try {
    if (app.isReady()) locations.push(path.join(app.getPath('userData'), 'video-inspector-debug.log'));
  } catch (_) {}
  locations.push(path.join(process.cwd(), 'video-inspector-debug.log'));

  for (const file of [...new Set(locations)]) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, text);
    } catch (_) {}
  }
}

process.on('uncaughtException', (err) => {
  appendLog(`uncaughtException: ${err.stack || err}`);
  try { dialog.showErrorBox('Video Inspector startup error', String(err.stack || err)); } catch (_) {}
});

process.on('unhandledRejection', (err) => {
  appendLog(`unhandledRejection: ${err && err.stack ? err.stack : err}`);
});

function createWindow() {
  appendLog(`createWindow appPath=${app.getAppPath()} resourcesPath=${process.resourcesPath} cwd=${process.cwd()}`);
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 650,
    backgroundColor: '#0b1020',
    title: 'Video Inspector',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.removeMenu();

  win.webContents.on('did-fail-load', (_event, code, desc, url) => appendLog(`did-fail-load ${code} ${desc} ${url}`));
  win.webContents.on('render-process-gone', (_event, details) => appendLog(`render-process-gone ${JSON.stringify(details)}`));
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => appendLog(`console[${level}] ${message} (${sourceId}:${line})`));

  if (process.env.VIDEO_INSPECTOR_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.loadFile(path.join(__dirname, '../renderer/index.html')).catch((err) => appendLog(`loadFile failed: ${err.stack || err}`));
}

app.whenReady().then(() => {
  ipcMain.handle('analyze-video', async (_event, filePath) => analyzeVideo(filePath));
  ipcMain.handle('choose-video', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a video file',
      properties: ['openFile'],
      filters: [
        { name: 'Video files', extensions: ['mov', 'mp4', 'mxf', 'mkv', 'avi', 'braw', 'r3d', 'crm', 'mts', 'm2ts', 'insv', 'lrv'] },
        { name: 'All files', extensions: ['*'] }
      ]
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('discover-tools', async () => discoverTools());
  ipcMain.handle('open-path', async (_event, targetPath) => {
    if (!targetPath) return false;
    await shell.showItemInFolder(targetPath);
    return true;
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
