const electron = require('electron');
const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld('videoInspector', {
  analyzeVideo: (filePath) => ipcRenderer.invoke('analyze-video', filePath),
  chooseVideo: () => ipcRenderer.invoke('choose-video'),
  discoverTools: () => ipcRenderer.invoke('discover-tools'),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  getPathForFile: (file) => {
    // Electron changed drag/drop file path access over time. Support both APIs.
    if (electron.webUtils && typeof electron.webUtils.getPathForFile === 'function') {
      return electron.webUtils.getPathForFile(file);
    }
    return file && file.path ? file.path : '';
  }
});
