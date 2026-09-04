/**
 * QynOne preload — the only bridge between the UI and the PC.
 *
 * The renderer stays fully sandboxed (contextIsolation on, nodeIntegration
 * off). It can only ask for narrow, user-level operations: state, launching,
 * system stats, file browsing/search, screenshots, the Markdown vault, and
 * the AI configuration file.
 */

const { contextBridge, ipcRenderer, desktopCapturer } = require("electron");

contextBridge.exposeInMainWorld("qynDesktop", {
  platform: process.platform,
  loadState: () => ipcRenderer.invoke("qyn:load-state"),
  saveState: (state) => ipcRenderer.invoke("qyn:save-state", state),
  launch: (target) => ipcRenderer.invoke("qyn:launch", target),
  findShortcuts: (query) => ipcRenderer.invoke("qyn:find-shortcuts", query),
  getSystemInfo: () => ipcRenderer.invoke("qyn:system-info"),
  getStats: () => ipcRenderer.invoke("qyn:stats"),
  listDir: (dir) => ipcRenderer.invoke("qyn:list-dir", dir),
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

  /* Markdown vault — real .md files under Documents\QynOneVault */
  vaultRoot: () => ipcRenderer.invoke("qyn:vault-root"),
  vaultTree: () => ipcRenderer.invoke("qyn:vault-tree"),
  vaultRead: (rel) => ipcRenderer.invoke("qyn:vault-read", rel),
  vaultWrite: (rel, content) => ipcRenderer.invoke("qyn:vault-write", rel, content),
  vaultRename: (oldRel, newRel) => ipcRenderer.invoke("qyn:vault-rename", oldRel, newRel),
  vaultDelete: (rel) => ipcRenderer.invoke("qyn:vault-delete", rel),
  vaultMkdir: (rel) => ipcRenderer.invoke("qyn:vault-mkdir", rel),
  /* Auto-rescan — the main process watches the vault folder and notifies. */
  onVaultChanged: (cb) => {
    const listener = () => cb();
    ipcRenderer.on("qyn:vault-changed", listener);
    return () => ipcRenderer.removeListener("qyn:vault-changed", listener);
  },

  /* Nex Folder — the single sandboxed folder Nex may read and write.
     Allowed inside: .md, text/code files and photos. */
  nexFolderInfo: () => ipcRenderer.invoke("qyn:nex-folder-info"),
  nexFolderList: () => ipcRenderer.invoke("qyn:nex-folder-list"),
  nexFolderRead: (rel, withData) => ipcRenderer.invoke("qyn:nex-folder-read", rel, Boolean(withData)),
  nexFolderWrite: (rel, content) => ipcRenderer.invoke("qyn:nex-folder-write", rel, content),
  nexFolderDelete: (rel) => ipcRenderer.invoke("qyn:nex-folder-delete", rel),
  nexFolderImport: (rel, dataUrl) => ipcRenderer.invoke("qyn:nex-folder-import", rel, dataUrl),
  nexFolderChoose: () => ipcRenderer.invoke("qyn:nex-folder-choose"),
  nexFolderReset: () => ipcRenderer.invoke("qyn:nex-folder-reset"),
  nexFolderReveal: (rel) => ipcRenderer.invoke("qyn:nex-folder-reveal", rel ?? ""),
  nexFolderPickImport: () => ipcRenderer.invoke("qyn:nex-folder-pick-import"),

  /* AI configuration — qynone.env in the user data folder */
  aiConfigGet: () => ipcRenderer.invoke("qyn:ai-config-get"),
  aiConfigSet: (cfg) => ipcRenderer.invoke("qyn:ai-config-set", cfg),

  /* Start with Windows — real per-user Run entry through the OS */
  autostartGet: () => ipcRenderer.invoke("qyn:autostart-get"),
  autostartSet: (enabled) => ipcRenderer.invoke("qyn:autostart-set", enabled),

  /* Floating Nex — always-on-top companion window with just the eyes */
  floatToggle: () => ipcRenderer.invoke("qyn:float-toggle"),
  floatState: () => ipcRenderer.invoke("qyn:float-state"),
  floatClose: () => ipcRenderer.invoke("qyn:float-close"),
  /* The main process notifies every window when the float opens/closes. */
  onFloatChanged: (cb) => {
    const listener = (_event, state) => cb(Boolean(state && state.open));
    ipcRenderer.on("qyn:float-changed", listener);
    return () => ipcRenderer.removeListener("qyn:float-changed", listener);
  },

  /* MCP — live connections to Roblox Studio, Unreal Engine, etc. */
  mcpList: () => ipcRenderer.invoke("qyn:mcp-list"),
  mcpSave: (cfg) => ipcRenderer.invoke("qyn:mcp-save", cfg),
  mcpRemove: (id) => ipcRenderer.invoke("qyn:mcp-remove", id),
  mcpConnect: (id) => ipcRenderer.invoke("qyn:mcp-connect", id),
  mcpDisconnect: (id) => ipcRenderer.invoke("qyn:mcp-disconnect", id),
  mcpCall: (id, tool, args) => ipcRenderer.invoke("qyn:mcp-call", id, tool, args),
  /* Main pushes the full server list on any connect/disconnect/state change. */
  mcpOnChanged: (cb) => {
    const listener = (_event, servers) => cb(servers);
    ipcRenderer.on("qyn:mcp-changed", listener);
    return () => ipcRenderer.removeListener("qyn:mcp-changed", listener);
  },
});