const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
    // File dialogs
    openFileDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
    saveFileDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),

    // File operations
    readFileAsDataURL: (filePath) => ipcRenderer.invoke('file:readAsDataURL', filePath),

    // Media operations
    getMediaInfo: (filePath) => ipcRenderer.invoke('media:getInfo', filePath),
    exportMedia: (options) => ipcRenderer.invoke('media:export', options),
    exportImage: (options) => ipcRenderer.invoke('image:export', options),
    getVideoThumbnails: (options) => ipcRenderer.invoke('video:getThumbnails', options),

    // Menu events
    onMenuImport: (callback) => ipcRenderer.on('menu:import', callback),
    onMenuExport: (callback) => ipcRenderer.on('menu:export', callback),
    onMenuUndo: (callback) => ipcRenderer.on('menu:undo', callback),
    onMenuRedo: (callback) => ipcRenderer.on('menu:redo', callback),

    // Export progress
    onExportProgress: (callback) => ipcRenderer.on('export:progress', (event, percent) => callback(percent)),

    // Glass control
    updateGlassSettings: (settings, persist) => ipcRenderer.invoke('glass:updateSettings', settings, persist),
    onReceivePanelSettings: (callback) => ipcRenderer.on('glass:panelSettings', (event, settings) => callback(settings)),

    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
