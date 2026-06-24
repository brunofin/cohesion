import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld('tabsAPI', {
    getTabs: () => ipcRenderer.invoke('get-tabs'),
    switchTab: (index: number) => ipcRenderer.send('switch-tab', index),
    closeTab: (index: number) => ipcRenderer.send('close-tab', index),
    onUpdateTabs: (callback: () => void) => ipcRenderer.on('update-tabs', () => callback()),
});
