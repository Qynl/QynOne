/**
 * QynOne preload — the only bridge between the UI and the PC.
 *
 * The renderer stays fully sandboxed (contextIsolation on, nodeIntegration
 * off). It can only: read/write the saved state, launch a target the user
 * configured, and search Start Menu shortcuts.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qynDesktop", {
  platform: process.platform,
  loadState: () => ipcRenderer.invoke("qyn:load-state"),
  saveState: (state) => ipcRenderer.invoke("qyn:save-state", state),
  launch: (target) => ipcRenderer.invoke("qyn:launch", target),
  findShortcuts: (query) => ipcRenderer.invoke("qyn:find-shortcuts", query),
  getSystemInfo: () => ipcRenderer.invoke("qyn:system-info"),
});