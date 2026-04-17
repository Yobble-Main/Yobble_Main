const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  openGame: (targetUrl) => ipcRenderer.invoke("open-game", targetUrl),
  openExternal: (targetUrl) => ipcRenderer.invoke("open-external", targetUrl),
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowToggleMaximize: () => ipcRenderer.invoke("window-toggle-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close")
});
