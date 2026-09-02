/**
 * dataLayer.js
 *
 * Thin wrapper around window.orion (the preload-exposed IPC bridge),
 * playing the same role the Solar OS foundation's dataLayer.js played for
 * FileManager: local state that mirrors the persisted store, updated only
 * after a real operation confirms success.
 */

export class DataLayer {
  constructor() {
    this.profile = null;
    this.projects = [];
    this.deleted = [];
  }

  async loadAll() {
    const [profile, projects, deleted] = await Promise.all([
      window.orion.getProfile(),
      window.orion.listProjects(),
      window.orion.listDeleted()
    ]);
    this.profile = profile;
    this.projects = projects;
    this.deleted = deleted;
    return { profile, projects, deleted };
  }

  async updateProfile(patch) {
    const result = await window.orion.updateProfile(patch);
    if (result.ok) this.profile = result.profile;
    return result;
  }

  async createProject(input) {
    const result = await window.orion.createProject(input);
    if (result.ok) this.projects = [...this.projects, result.project];
    return result;
  }

  async updateProject(id, patch) {
    const result = await window.orion.updateProject(id, patch);
    if (result.ok) this.projects = this.projects.map((p) => (p.id === id ? result.project : p));
    return result;
  }

  async trashProject(id) {
    const result = await window.orion.trashProject(id);
    if (result.ok) {
      this.projects = this.projects.filter((p) => p.id !== id);
      this.deleted = [result.entry, ...this.deleted];
    }
    return result;
  }

  async restoreProject(entryId) {
    const result = await window.orion.restoreProject(entryId);
    if (result.ok) {
      this.deleted = this.deleted.filter((e) => e.id !== entryId);
      this.projects = [...this.projects, result.project];
    }
    return result;
  }

  async deleteProjectPermanently(entryId) {
    const result = await window.orion.deleteProjectPermanently(entryId);
    if (result.ok) this.deleted = this.deleted.filter((e) => e.id !== entryId);
    return result;
  }

  async emptyBlackHole() {
    const result = await window.orion.emptyBlackHole();
    if (result.ok) this.deleted = [];
    return result;
  }

  projectsByStatus(status) {
    return this.projects.filter((p) => p.status === status);
  }

  draftProjects() {
    return this.projects.filter((p) => p.status === 'new' || p.status === 'draft' || p.status === 'working');
  }
}
