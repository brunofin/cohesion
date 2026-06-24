import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld('tabsAPI', {
    getTabs: () => ipcRenderer.invoke('get-tabs'),
    switchTab: (index) => ipcRenderer.send('switch-tab', index),
    closeTab: (index) => ipcRenderer.send('close-tab', index),
    addTab: (url) => ipcRenderer.send('add-tab', url),
    onUpdateTabs: (callback) => ipcRenderer.on('update-tabs', () => callback()),
});
