const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { analyzeVideo, discoverTools } = require('./videoAnalyzer');

// Avoid Windows GPU/driver white-screen issues on some systems.
app.disableHardwareAcceleration();

function appendLog(line) {
  try {
    const logDir = app.isReady() ? app.getPath('userData') : process.cwd();
    fs.appendFileSync(path.join(logDir, 'video-inspector-debug.log'), `[${new Date().toISOString()}] ${line}\n`);
  } catch (_) {}
}

function createWindow() {
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
