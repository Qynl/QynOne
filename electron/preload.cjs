/**
 * QynOne preload — the only bridge between the UI and the PC.
 *
 * The renderer stays fully sandboxed (contextIsolation on, nodeIntegration
 * off). It can only ask for narrow, user-level operations: state, launching,
 * system stats, file browsing/search, and screenshots.
 */

const { contextBridge, ipcRenderer, desktopCapturer } = require("electron");

contextBridge.exposeInMainWorld("qynDesktop", {
  platform: process.platform,
  loadState: () => ipcRenderer.invoke("qyn:load-state"),
  saveState: (state) => ipcRenderer.invoke("qyn:save-state", state),
  launch: (target) => ipcRenderer.invoke("qyn:launch", target),
  findShortcuts: (query) => ipcRenderer.invoke("qyn:find-shortcuts", query),
  getSystemInfo: () => ipcRenderer.invoke("qyn:system-info"),
  getStats: () => ipcRenderer.invoke("qyn:stats"),    listDir: (dir) => ipcRenderer.invoke("qyn:list-dir", dir),
    getHomeDir: () => ipcRenderer.invoke("qyn:home-dir"),
  openPath: (p) => ipcRenderer.invoke("qyn:open-path", p),
  searchFiles: (query) => ipcRenderer.invoke("qyn:search-files", query),
  saveScreenshot: (dataUrl) => ipcRenderer.invoke("qyn:save-screenshot", dataUrl),
  captureScreen: async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      return sources.length > 0 ? sources[0].thumbnail.toDataURL() : null;
    } catch {
      return null;
    }
  },
});