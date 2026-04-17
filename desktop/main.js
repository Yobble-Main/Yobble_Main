import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";

const BASE_URL = (process.env.YOBBLE_LIVE_URL || process.env.YOBBLE_BASE_URL || "http://photography-cage.gl.at.ply.gg:52426/").replace(/\/$/, "");
const APP_NAME = "Yobble";
const windows = new Set();

app.setName(APP_NAME);

function isInternalUrl(url) {
  return url.startsWith("/") || url.startsWith(BASE_URL);
}

function resolveUrl(target) {
  if (!target) {
    return new URL("/index", BASE_URL).toString();
  }
  if (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("file://") ||
    target.startsWith("data:")
  ) {
    return target;
  }
  return new URL(target, BASE_URL).toString();
}

function createWindow(target = "/index") {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#11161f",
    title: APP_NAME,
    frame: false,
    webPreferences: {
      preload: path.join(app.getAppPath(), "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.removeMenu();
  windows.add(win);
  win.on("closed", () => windows.delete(win));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) {
      createWindow(url);
      return { action: "deny" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadURL(resolveUrl(target));
  return win;
}

ipcMain.handle("open-game", async (_event, targetUrl) => {
  createWindow(targetUrl);
  return true;
});

ipcMain.handle("open-external", async (_event, targetUrl) => {
  await shell.openExternal(targetUrl);
  return true;
});

ipcMain.handle("window-minimize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
  return true;
});

ipcMain.handle("window-toggle-maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
  return true;
});

ipcMain.handle("window-close", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
  return true;
});

app.whenReady().then(() => {
  createWindow("/index");
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow("/index");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
