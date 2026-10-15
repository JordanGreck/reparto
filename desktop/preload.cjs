const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('reparto', {
  desktop: true,
  load: () => ipcRenderer.invoke('reparto:load'),
  save: (document) => ipcRenderer.invoke('reparto:save', document),
  search: (query) => ipcRenderer.invoke('reparto:search', query),
  exportBackup: () => ipcRenderer.invoke('reparto:backup'),
  importBackup: () => ipcRenderer.invoke('reparto:import'),
  exportMap: (rect) => ipcRenderer.invoke('reparto:image', rect),
  openData: () => ipcRenderer.invoke('reparto:data'),
  setDirty: (dirty) => ipcRenderer.send('reparto:dirty', Boolean(dirty)),
  ready: () => ipcRenderer.send('reparto:ready')
});
