const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  scanDownloadsFolder: (options) =>
    ipcRenderer.invoke("janitor:scan-downloads", options),
  runDownloadsJanitor: (options) =>
    ipcRenderer.invoke("janitor:run-downloads", options),
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("janitor:progress", listener);
    return () => ipcRenderer.removeListener("janitor:progress", listener);
  },
});
