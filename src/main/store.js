const Store = require('electron-store');

/**
 * Persisted app state, saved as JSON under the OS user-data directory
 * (e.g. %APPDATA%\ORION\config.json on Windows). Survives app restarts.
 *
 * This inherits the electron-store pattern from the Solar OS foundation
 * (which persisted settings/planet-mappings/recycle-bin the same way) —
 * only the schema changed to fit ORION's IT-platform concept instead of
 * a file manager's folder mappings.
 *
 * Shape:
 *   profile: { name, headline, domain, skills: string[], experienceLevel }
 *   projects: { [id]: ProjectRecord }
 *   deleted: Array<{ id, record, deletedAt }>   // Black Hole contents
 *   settings: { graphicsQuality, reducedMotion, starfield, ... }
 *   companionLog: Array<{from, text, at}>        // last N companion chat turns, for continuity across restarts
 */
const store = new Store({
  name: 'config',
  defaults: {
    profile: {
      name: 'New Explorer',
      headline: 'Just getting started in IT',
      domain: 'game-development',
      skills: [],
      experienceLevel: 'beginner'
    },
    projects: {},
    deleted: [],
    settings: {
      graphicsQuality: 'medium',
      reducedMotion: false,
      starfield: true
    },
    companionLog: []
  }
});

module.exports = { store };
