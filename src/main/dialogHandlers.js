const { ipcMain, dialog } = require('electron');

/**
 * getWindow is a function (not the window itself) because the window is
 * created after registerDataHandlers/registerDialogHandlers run in
 * main.js — lazily resolving it avoids a null reference at registration
 * time. (Same pattern as the Solar OS foundation's dialogHandlers.js.)
 */
function registerDialogHandlers(getWindow) {
  ipcMain.handle('dialog:confirmDelete', async (_e, { itemName, count }) => {
    const win = getWindow();
    const message = count > 1 ? `Permanently delete ${count} project(s)?` : `Permanently delete "${itemName}"?`;
    const result = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
      title: 'Delete permanently',
      message,
      detail: 'This cannot be undone.'
    });
    return result.response === 1;
  });
}

module.exports = { registerDialogHandlers };
