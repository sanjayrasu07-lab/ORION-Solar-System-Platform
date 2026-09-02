const { contextBridge, ipcRenderer } = require('electron');

/**
 * The ONLY surface the renderer (3D UI) can use to touch persisted data.
 * Every method here is a thin pass-through to a specific, validated
 * main-process IPC handler (see dataHandlers.js) — the renderer never
 * gets direct Node access, even though nodeIntegration/sandbox settings
 * in main.js are permissive for the preload script itself. This is the
 * same boundary the Solar OS foundation enforced for real filesystem
 * access; ORION applies it to the profile/project/companion store instead.
 */
contextBridge.exposeInMainWorld('orion', {
  // ---- profile (the Sun) ----
  getProfile: () => ipcRenderer.invoke('profile:get'),
  updateProfile: (patch) => ipcRenderer.invoke('profile:update', patch),

  // ---- projects ----
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (input) => ipcRenderer.invoke('projects:create', input),
  updateProject: (id, patch) => ipcRenderer.invoke('projects:update', { id, patch }),
  trashProject: (id) => ipcRenderer.invoke('projects:trash', id),
  restoreProject: (entryId) => ipcRenderer.invoke('projects:restore', entryId),
  deleteProjectPermanently: (entryId) => ipcRenderer.invoke('projects:deletePermanently', entryId),
  emptyBlackHole: () => ipcRenderer.invoke('projects:emptyBlackHole'),
  listDeleted: () => ipcRenderer.invoke('deleted:list'),

  // ---- settings ----
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),

  // ---- companion persisted log ----
  getCompanionLog: () => ipcRenderer.invoke('companionLog:get'),
  appendCompanionLog: (turn) => ipcRenderer.invoke('companionLog:append', turn),
  clearCompanionLog: () => ipcRenderer.invoke('companionLog:clear'),

  // ---- dialogs ----
  confirmDelete: (itemName, count) => ipcRenderer.invoke('dialog:confirmDelete', { itemName, count })
});
