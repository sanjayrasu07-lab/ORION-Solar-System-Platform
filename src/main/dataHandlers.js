const { ipcMain } = require('electron');
const crypto = require('crypto');
const { store } = require('./store');

/**
 * SECURITY NOTE (inherited from the Solar OS foundation's fsHandlers.js)
 * -----------------------------------------------------------------------
 * All persisted-data mutations happen HERE, in the main process, behind
 * explicit IPC channels — the renderer never gets direct access to the
 * store or the filesystem. It only gets the thin, whitelisted bridge
 * exposed by preload.js via contextBridge.
 */

const PROJECT_STATES = ['new', 'draft', 'working', 'completed', 'archived'];

function newId() {
  return crypto.randomBytes(8).toString('hex');
}

function validateProjectInput(input) {
  if (!input || typeof input !== 'object') return 'Invalid project data.';
  if (!input.name || !input.name.trim()) return 'Project name is required.';
  if (input.status && !PROJECT_STATES.includes(input.status)) return `Status must be one of: ${PROJECT_STATES.join(', ')}.`;
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function registerDataHandlers() {
  // ---- Profile (the Sun) ----

  ipcMain.handle('profile:get', async () => store.get('profile'));

  ipcMain.handle('profile:update', async (_e, patch) => {
    const current = store.get('profile');
    const next = { ...current, ...patch };
    store.set('profile', next);
    return { ok: true, profile: next };
  });

  // ---- Projects (Dashboard, Draft/Dwarf-planet, per-domain views) ----

  ipcMain.handle('projects:list', async () => Object.values(store.get('projects')));

  ipcMain.handle('projects:create', async (_e, input) => {
    const error = validateProjectInput(input);
    if (error) return { ok: false, message: error };

    const id = newId();
    const now = Date.now();
    const record = {
      id,
      name: input.name.trim(),
      domain: input.domain || 'game-development',
      description: input.description || '',
      status: input.status || 'new',
      progress: typeof input.progress === 'number' ? clamp(input.progress, 0, 100) : 0,
      toolsUsed: Array.isArray(input.toolsUsed) ? input.toolsUsed : [],
      engineUsed: input.engineUsed || null,
      aiAssistance: input.aiAssistance || null,
      createdDate: now,
      updatedDate: now
    };

    const projects = store.get('projects');
    projects[id] = record;
    store.set('projects', projects);
    return { ok: true, project: record };
  });

  ipcMain.handle('projects:update', async (_e, { id, patch }) => {
    const projects = store.get('projects');
    const existing = projects[id];
    if (!existing) return { ok: false, message: 'Project not found.' };

    const merged = { ...existing, ...patch };
    const error = validateProjectInput(merged);
    if (error) return { ok: false, message: error };

    if (typeof merged.progress === 'number') merged.progress = clamp(merged.progress, 0, 100);
    merged.updatedDate = Date.now();

    projects[id] = merged;
    store.set('projects', projects);
    return { ok: true, project: merged };
  });

  // Soft delete — moves the project into the Black Hole (deleted list)
  // rather than erasing it immediately, mirroring the Solar OS
  // foundation's app-managed recycle bin (trash-then-restore-or-purge).
  ipcMain.handle('projects:trash', async (_e, id) => {
    const projects = store.get('projects');
    const record = projects[id];
    if (!record) return { ok: false, message: 'Project not found.' };

    delete projects[id];
    store.set('projects', projects);

    const deleted = store.get('deleted');
    const entry = { id: newId(), record, deletedAt: Date.now() };
    deleted.unshift(entry);
    store.set('deleted', deleted);
    return { ok: true, entry };
  });

  ipcMain.handle('projects:restore', async (_e, entryId) => {
    const deleted = store.get('deleted');
    const entry = deleted.find((e) => e.id === entryId);
    if (!entry) return { ok: false, message: 'Entry not found in the black hole.' };

    const projects = store.get('projects');
    projects[entry.record.id] = entry.record;
    store.set('projects', projects);
    store.set('deleted', deleted.filter((e) => e.id !== entryId));
    return { ok: true, project: entry.record };
  });

  ipcMain.handle('projects:deletePermanently', async (_e, entryId) => {
    const deleted = store.get('deleted');
    const exists = deleted.some((e) => e.id === entryId);
    if (!exists) return { ok: false, message: 'Entry not found in the black hole.' };
    store.set('deleted', deleted.filter((e) => e.id !== entryId));
    return { ok: true };
  });

  ipcMain.handle('projects:emptyBlackHole', async () => {
    const count = store.get('deleted').length;
    store.set('deleted', []);
    return { ok: true, deletedCount: count };
  });

  ipcMain.handle('deleted:list', async () => store.get('deleted'));

  // ---- Settings ----

  ipcMain.handle('settings:get', async () => store.get('settings'));
  ipcMain.handle('settings:set', async (_e, patch) => {
    store.set('settings', { ...store.get('settings'), ...patch });
    return { ok: true };
  });

  // ---- Companion chat log (persisted so ORI remembers recent turns across restarts) ----

  ipcMain.handle('companionLog:get', async () => store.get('companionLog'));
  ipcMain.handle('companionLog:append', async (_e, turn) => {
    const log = store.get('companionLog');
    log.push({ ...turn, at: Date.now() });
    // Cap history so the persisted file doesn't grow unbounded over a long-lived install.
    const trimmed = log.slice(-200);
    store.set('companionLog', trimmed);
    return { ok: true };
  });
  ipcMain.handle('companionLog:clear', async () => {
    store.set('companionLog', []);
    return { ok: true };
  });
}

module.exports = { registerDataHandlers, PROJECT_STATES };
