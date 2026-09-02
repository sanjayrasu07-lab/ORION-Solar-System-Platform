import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { DataLayer } from './dataLayer.js';
import { PLANET_DEFS, DWARF_PLANET_DEF, BLACK_HOLE_DEF, DOMAINS, PROJECT_STATUSES, catalogForPlanet, domainLabel, statusDef } from './catalog.js';
import {
  createAssistantEngine,
  createSpeechListener,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speak
} from './assistantEngine.js';

const ORBIT_RADII = { dashboard: 7, engines: 10, tools: 13, ai: 16 };
const DWARF_ORBIT_RADIUS = 20;

function makeLabel(text, extraStyle) {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.pointerEvents = 'none';
  div.style.fontFamily = "'Inter', system-ui, sans-serif";
  div.style.whiteSpace = 'nowrap';
  div.style.textShadow = '0 2px 8px rgba(0,0,0,0.6)';
  Object.assign(div.style, extraStyle || {});
  return div;
}

function hexToInt(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatDate(ms) {
  if (!ms) return '\u2014';
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

class OrionApp {
  constructor(container) {
    this.container = container;
    this.data = new DataLayer();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.focusedPlanetId = null; // 'dashboard' | 'engines' | 'tools' | 'ai' | 'drafts' | 'blackhole' | null (home)
    this.clickable = [];
    this.editingProjectId = null; // set while the new/edit-project modal is open for an existing project
    this.modalResolve = null;

    this._init();
  }

  async _init() {
    await this.data.loadAll();

    this._initScene();
    this._initPostFX();
    this._buildStarfield();
    this._buildSun();
    this._buildPlanets();
    this._buildDwarfPlanet();
    this._buildBlackHole();
    this._initInteraction();
    this._initUI();
    this._initAssistant();

    window.addEventListener('resize', () => this._onResize());
    this._clock = new THREE.Clock();
    this._animate();

    requestAnimationFrame(() => {
      const loading = document.getElementById('loadingScreen');
      if (loading) loading.style.display = 'none';
    });
  }

  /* =====================================================================
     THREE.JS SCENE SETUP
     ===================================================================== */

  _initScene() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050f);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 400);
    this.camera.position.set(0, 12, 24);
    // Camera-follow state for "zoom toward the selected planet": we don't
    // snap the camera or reparent it — every frame we ease
    // controls.target toward the focused body's live (still-orbiting)
    // position, and ease the camera's distance from that target inward.
    // cameraFocusBlend ramps 0->1 over ~0.9s whenever focus changes, so the
    // transition itself is smooth rather than an instant cut.
    this.cameraFollowTarget = null; // the focused body object, or null when home
    this.cameraFocusBlend = 0;
    this.cameraHomeDistance = 26;
    this.cameraFocusDistance = 7.5;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.inset = '0';
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.inset = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    this.container.appendChild(this.labelRenderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x0a0a1a, 0.2));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 60;
    this.controls.maxPolarAngle = Math.PI * 0.85;
  }

  _initPostFX() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.5, 0.4);
    this.composer.addPass(this.bloom);
  }

  _buildStarfield() {
    const count = 1600, radius = 160;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius * (0.55 + Math.random() * 0.45);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.75 });
    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
  }

  _buildSun() {
    const group = new THREE.Group();
    this.sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb15c, transparent: true, opacity: 0.15 })
    );
    this.sunGlow.scale.setScalar(1.35);
    group.add(this.sunGlow);

    this.sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(2.3, 48, 48),
      new THREE.MeshStandardMaterial({ color: 0xffcf6b, emissive: 0xff9d3d, emissiveIntensity: 1.4, roughness: 0.4 })
    );
    group.add(this.sunCore);
    group.add(new THREE.PointLight(0xffcf6b, 3, 70, 1.5));

    const name = this.data.profile?.name || 'Your Profile';
    const label = new CSS2DObject(makeLabel(name, { fontSize: '13px', color: '#ffe9c2', fontWeight: '600' }));
    label.position.set(0, -3.6, 0);
    group.add(label);
    this.sunLabelEl = label.element;

    this.scene.add(group);
    this.clickable.push({ mesh: this.sunCore, kind: 'sun' });
  }

  _buildPlanets() {
    this.planets = PLANET_DEFS.map((def, i) => {
      const orbitRadius = ORBIT_RADII[def.id] ?? (7 + i * 3);
      const group = new THREE.Group();
      const colorHex = hexToInt(def.color);

      const points = [];
      for (let a = 0; a <= 96; a++) {
        const angle = (a / 96) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
      this.scene.add(new THREE.Line(ringGeo, new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.3 })));

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 32),
        new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.32, roughness: 0.55, metalness: 0.1 })
      );
      group.add(mesh);

      const selRing = new THREE.Mesh(
        new THREE.RingGeometry(1.18, 1.3, 48),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
      );
      selRing.scale.setScalar(1.5);
      selRing.visible = false;
      group.add(selRing);

      const labelEl = makeLabel(`${def.emoji} ${def.label}`, { fontSize: '13px', color: '#e8f0ff', fontWeight: '600' });
      const label = new CSS2DObject(labelEl);
      label.position.set(0, -1.7, 0);
      group.add(label);

      this.scene.add(group);
      this.clickable.push({ mesh, kind: 'planet', data: def });

      return { def, group, mesh, selRing, labelEl, orbitRadius, orbitSpeed: 0.045 + i * 0.006, angle: Math.random() * Math.PI * 2, selected: false };
    });
  }

  _buildDwarfPlanet() {
    const def = DWARF_PLANET_DEF;
    const orbitRadius = DWARF_ORBIT_RADIUS;
    const group = new THREE.Group();
    const colorHex = hexToInt(def.color);

    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6, 0),
      new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.28, roughness: 0.7 })
    );
    group.add(mesh);

    const selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.78, 0.9, 48),
      new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    selRing.scale.setScalar(1.5);
    selRing.visible = false;
    group.add(selRing);

    const labelEl = makeLabel(`${def.emoji} ${def.label}`, { fontSize: '12px', color: '#e8f0ff' });
    const label = new CSS2DObject(labelEl);
    label.position.set(0, -1.2, 0);
    group.add(label);

    this.scene.add(group);
    this.clickable.push({ mesh, kind: 'planet', data: def });
    this.dwarfPlanet = { def, group, mesh, selRing, labelEl, orbitRadius, orbitSpeed: 0.09, angle: Math.random() * Math.PI * 2, selected: false };
  }

  _buildBlackHole() {
    const group = new THREE.Group();
    group.position.set(0, -6, 0);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 32), new THREE.MeshBasicMaterial({ color: 0x050014 }));
    group.add(core);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.1, 16, 64),
      new THREE.MeshBasicMaterial({ color: 0x4a3a7a, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = Math.PI / 2.4;
    group.add(ring);
    group.add(new THREE.PointLight(0x7a5cff, 0.8, 9));

    const labelEl = makeLabel(`${BLACK_HOLE_DEF.emoji} ${BLACK_HOLE_DEF.label}`, { fontSize: '12px', color: '#c9b8ff' });
    const label = new CSS2DObject(labelEl);
    label.position.set(0, -1.9, 0);
    group.add(label);

    this.scene.add(group);
    this.blackHole = { group, core, ring, labelEl };
    this.clickable.push({ mesh: core, kind: 'planet', data: BLACK_HOLE_DEF });
  }

  /* =====================================================================
     INTERACTION (raycasting, tap vs drag detection)
     ===================================================================== */

  _initInteraction() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    const dom = this.renderer.domElement;
    let downPos = null;

    const getPointer = (e) => {
      const rect = dom.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return { x: e.clientX, y: e.clientY };
    };

    dom.addEventListener('pointerdown', (e) => { downPos = getPointer(e); });
    dom.addEventListener('pointerup', (e) => {
      if (!downPos) return;
      const p = getPointer(e);
      const dist = Math.hypot(p.x - downPos.x, p.y - downPos.y);
      downPos = null;
      if (dist > 6) return; // drag-to-orbit gesture, not a selection tap

      const hit = this._raycastPick();
      if (!hit) return;
      if (hit.kind === 'sun') this._openProfile();
      else if (hit.kind === 'planet') this._focusPlanet(hit.data.id);
    });
  }

  _raycastPick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = this.clickable.map((c) => c.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    return this.clickable.find((c) => c.mesh === hits[0].object) || null;
  }

  /* =====================================================================
     CAMERA FOCUS BEHAVIOR
     Per spec: clicking a planet fades other planets, moves the selected
     one into focus, and smoothly zooms the camera toward it. We don't
     reparent the mesh (it keeps orbiting at its own slow pace so the
     scene still feels alive) — instead we smoothly retarget OrbitControls'
     target and desired camera distance toward the planet's live position
     every frame, which naturally "follows" a still-orbiting planet.
     ===================================================================== */

  _allBodies() {
    return [...this.planets, this.dwarfPlanet];
  }

  _setFocusVisuals(planetId) {
    for (const body of this._allBodies()) {
      const isTarget = body.def.id === planetId;
      body.selected = isTarget;
      body.selRing.visible = isTarget;
      body.mesh.material.emissiveIntensity = isTarget ? 0.55 : (planetId ? 0.08 : 0.32);
      body.mesh.material.transparent = !!planetId && !isTarget;
      body.mesh.material.opacity = !!planetId && !isTarget ? 0.25 : 1;
      body.labelEl.style.opacity = !!planetId && !isTarget ? '0.25' : '1';
    }
    this.sunCore.material.transparent = !!planetId;
    this.sunCore.material.opacity = planetId ? 0.35 : 1;
    this.sunGlow.material.opacity = planetId ? 0.05 : 0.15;
    this.sunLabelEl.style.opacity = planetId ? '0.35' : '1';
    this.blackHole.group.visible = !planetId || planetId === 'blackhole';
    if (this.blackHole.group.visible) {
      this.blackHole.core.material.opacity = 1;
    }
  }

  _bodyFor(planetId) {
    return this._allBodies().find((b) => b.def.id === planetId) || null;
  }

  /* =====================================================================
     STATE TRANSITIONS
     ===================================================================== */

  _focusPlanet(planetId) {
    this.focusedPlanetId = planetId;
    this._hideProfile();
    this._setFocusVisuals(planetId);
    this.cameraFollowTarget = planetId === 'blackhole' ? this.blackHole : this._bodyFor(planetId);
    this.cameraFocusBlend = 0; // restart the ease-in so each new focus transition is smooth, not instant

    const planetDef = planetId === 'blackhole' ? BLACK_HOLE_DEF : this._bodyFor(planetId)?.def;
    document.getElementById('planetToolbar').classList.add('visible');
    document.getElementById('planetTitle').textContent = planetDef ? `${planetDef.emoji} ${planetDef.label}` : '';
    document.getElementById('planetBlurb').textContent = planetDef?.blurb || '';

    document.getElementById('contentPanel').classList.add('visible');
    this._renderPlanetContent(planetId);
    this._updateHint(planetDef);
  }

  _goHome() {
    this.focusedPlanetId = null;
    this._setFocusVisuals(null);
    this.cameraFollowTarget = null;
    this.cameraFocusBlend = 0;
    document.getElementById('planetToolbar').classList.remove('visible');
    document.getElementById('contentPanel').classList.remove('visible');
    this._hideProfile();
    this._updateHint(null);
  }

  _updateHint(planetDef) {
    const hintEl = document.getElementById('hint');
    const footerEl = document.getElementById('footerHint');
    if (planetDef) {
      hintEl.textContent = `${planetDef.emoji} ${planetDef.label}`;
      footerEl.style.display = 'none';
    } else {
      hintEl.textContent = 'Drag to orbit · Scroll to zoom · Click a planet to explore';
      footerEl.style.display = 'block';
    }
  }

  /* =====================================================================
     CONTENT PANEL — cards/grid UI per planet (never scattered in 3D space)
     ===================================================================== */

  _renderPlanetContent(planetId) {
    const body = document.getElementById('contentBody');
    body.innerHTML = '';

    if (planetId === 'dashboard') return this._renderDashboard(body);
    if (planetId === 'engines' || planetId === 'tools' || planetId === 'ai') return this._renderCatalog(body, planetId);
    if (planetId === 'drafts') return this._renderDrafts(body);
    if (planetId === 'blackhole') return this._renderBlackHole(body);
  }

  _renderDashboard(body) {
    const projects = this.data.projects;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const working = projects.filter((p) => p.status === 'working').length;
    const drafts = projects.filter((p) => p.status === 'new' || p.status === 'draft').length;

    const stats = document.createElement('div');
    stats.className = 'stat-row';
    stats.innerHTML = `
      ${this._statCardHtml(projects.length, 'Total projects')}
      ${this._statCardHtml(working, 'In progress')}
      ${this._statCardHtml(completed, 'Completed')}
      ${this._statCardHtml(drafts, 'Drafts')}
    `;
    body.appendChild(stats);

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    heading.textContent = 'Your projects';
    body.appendChild(heading);

    if (projects.length === 0) {
      body.appendChild(this._emptyStateEl('📁', 'No projects yet — create your first one with the ➕ button up top.'));
      return;
    }

    const list = document.createElement('div');
    list.className = 'project-list';
    // Most recently updated first, so what you're actively working on floats to the top.
    [...projects].sort((a, b) => b.updatedDate - a.updatedDate).forEach((p) => list.appendChild(this._projectRowEl(p)));
    body.appendChild(list);
  }

  _statCardHtml(value, label) {
    return `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${escapeHtml(label)}</div></div>`;
  }

  _projectRowEl(project) {
    const row = document.createElement('div');
    row.className = 'project-row';
    const status = statusDef(project.status);
    row.innerHTML = `
      <div class="pr-main">
        <div class="pr-name">${escapeHtml(project.name)}</div>
        <div class="pr-meta">${escapeHtml(domainLabel(project.domain))} · updated ${formatDate(project.updatedDate)}</div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${project.progress}%"></div></div>
      <span class="status-pill" style="color:${status.color}; border-color:${status.color}55; background:${status.color}18;">${escapeHtml(status.label)}</span>
    `;
    row.addEventListener('click', () => this._openProjectModal(project.id));
    return row;
  }

  _emptyStateEl(icon, text) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `<div class="es-icon">${icon}</div><div>${escapeHtml(text)}</div>`;
    return div;
  }

  _renderCatalog(body, planetId) {
    const items = catalogForPlanet(planetId);
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'resource-card';
      card.innerHTML = `
        <div class="rc-icon">${item.icon}</div>
        <div class="rc-name">${escapeHtml(item.name)}</div>
        <div class="rc-blurb">${escapeHtml(item.blurb)}</div>
        <div class="rc-link">Open ↗</div>
      `;
      card.addEventListener('click', () => this._openExternalLink(item.url, item.name));
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  _openExternalLink(url, name) {
    // window.open on a real http(s) URL is handed to the OS default
    // browser by main.js's setWindowOpenHandler (shell.openExternal) —
    // Electron never renders external sites inside this app's own window.
    window.open(url, '_blank');
    this._showToast(`Opening ${name} in your browser…`);
  }

  _renderDrafts(body) {
    const drafts = this.data.draftProjects();
    if (drafts.length === 0) {
      body.appendChild(this._emptyStateEl('🪨', 'No drafts or in-progress projects right now.'));
      return;
    }
    const list = document.createElement('div');
    list.className = 'project-list';
    [...drafts].sort((a, b) => b.updatedDate - a.updatedDate).forEach((p) => list.appendChild(this._projectRowEl(p)));
    body.appendChild(list);
  }

  _renderBlackHole(body) {
    const deleted = this.data.deleted;
    if (deleted.length > 0) {
      const emptyBtn = document.createElement('button');
      emptyBtn.className = 'modal-btn danger';
      emptyBtn.style.marginBottom = '14px';
      emptyBtn.style.maxWidth = '200px';
      emptyBtn.textContent = 'Empty all permanently';
      emptyBtn.addEventListener('click', () => this._emptyBlackHole());
      body.appendChild(emptyBtn);
    }

    if (deleted.length === 0) {
      body.appendChild(this._emptyStateEl('🕳️', 'The black hole is empty.'));
      return;
    }

    const list = document.createElement('div');
    list.className = 'project-list';
    deleted.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'project-row';
      row.innerHTML = `
        <div class="pr-main">
          <div class="pr-name">${escapeHtml(entry.record.name)}</div>
          <div class="pr-meta">Deleted ${formatDate(entry.deletedAt)}</div>
        </div>
      `;
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'modal-btn';
      restoreBtn.style.flex = 'none';
      restoreBtn.style.padding = '6px 12px';
      restoreBtn.style.fontSize = '11px';
      restoreBtn.textContent = 'Restore';
      restoreBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const result = await this.data.restoreProject(entry.id);
        if (result.ok) { this._showToast(`Restored ${entry.record.name}`); this._renderPlanetContent('blackhole'); }
        else this._showToast(result.message, 'error');
      });
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'modal-btn danger';
      deleteBtn.style.flex = 'none';
      deleteBtn.style.padding = '6px 12px';
      deleteBtn.style.fontSize = '11px';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await window.orion.confirmDelete(entry.record.name, 1);
        if (!confirmed) return;
        const result = await this.data.deleteProjectPermanently(entry.id);
        if (result.ok) { this._showToast(`Permanently deleted ${entry.record.name}`); this._renderPlanetContent('blackhole'); }
        else this._showToast(result.message, 'error');
      });
      row.appendChild(restoreBtn);
      row.appendChild(deleteBtn);
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  async _emptyBlackHole() {
    const confirmed = await window.orion.confirmDelete(null, this.data.deleted.length);
    if (!confirmed) return;
    const result = await this.data.emptyBlackHole();
    this._showToast(`Emptied the black hole (${result.deletedCount} item(s))`);
    this._renderPlanetContent('blackhole');
  }

  /* =====================================================================
     PROFILE PANEL (the Sun)
     ===================================================================== */

  _openProfile() {
    this._goHome(); // profile is a home-level overlay, not a planet focus state
    const panel = document.getElementById('profilePanel');
    const body = document.getElementById('profileBody');
    const p = this.data.profile;
    body.innerHTML = `
      <div class="profile-field">
        <label>Name</label>
        <input class="modal-input" id="profileName" value="${escapeHtml(p.name)}" />
      </div>
      <div class="profile-field">
        <label>Headline</label>
        <input class="modal-input" id="profileHeadline" value="${escapeHtml(p.headline)}" />
      </div>
      <div class="profile-field">
        <label>Primary domain</label>
        <select class="modal-select" id="profileDomain">
          ${DOMAINS.map((d) => `<option value="${d.id}" ${d.id === p.domain ? 'selected' : ''}>${d.emoji} ${escapeHtml(d.label)}</option>`).join('')}
        </select>
      </div>
      <div class="profile-field">
        <label>Experience level</label>
        <select class="modal-select" id="profileExperience">
          <option value="beginner" ${p.experienceLevel === 'beginner' ? 'selected' : ''}>Beginner</option>
          <option value="intermediate" ${p.experienceLevel === 'intermediate' ? 'selected' : ''}>Intermediate</option>
          <option value="advanced" ${p.experienceLevel === 'advanced' ? 'selected' : ''}>Advanced</option>
        </select>
      </div>
      <div class="profile-field">
        <label>Skills</label>
        <div class="skill-chip-row" id="skillChips"></div>
        <input class="modal-input" id="skillInput" placeholder="Type a skill and press Enter" style="margin-top:8px;" />
      </div>
      <button class="modal-btn primary" id="saveProfileBtn" style="margin-top:10px;">Save profile</button>
    `;

    let skills = [...(p.skills || [])];
    const renderChips = () => {
      const row = document.getElementById('skillChips');
      row.innerHTML = '';
      skills.forEach((skill, i) => {
        const chip = document.createElement('span');
        chip.className = 'skill-chip';
        chip.innerHTML = `${escapeHtml(skill)} <button>✕</button>`;
        chip.querySelector('button').addEventListener('click', () => { skills.splice(i, 1); renderChips(); });
        row.appendChild(chip);
      });
    };
    renderChips();

    document.getElementById('skillInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        skills.push(e.target.value.trim());
        e.target.value = '';
        renderChips();
      }
    });

    document.getElementById('saveProfileBtn').addEventListener('click', async () => {
      const patch = {
        name: document.getElementById('profileName').value.trim() || 'New Explorer',
        headline: document.getElementById('profileHeadline').value.trim(),
        domain: document.getElementById('profileDomain').value,
        experienceLevel: document.getElementById('profileExperience').value,
        skills
      };
      const result = await this.data.updateProfile(patch);
      if (result.ok) {
        this._showToast('Profile saved');
        this.sunLabelEl.textContent = result.profile.name;
        this._hideProfile();
      } else {
        this._showToast(result.message || 'Could not save profile', 'error');
      }
    });

    panel.classList.add('visible');
  }

  _hideProfile() {
    document.getElementById('profilePanel').classList.remove('visible');
  }

  /* =====================================================================
     PROJECT CREATE / EDIT MODAL
     ===================================================================== */

  _openProjectModal(projectId) {
    this.editingProjectId = projectId || null;
    const existing = projectId ? this.data.projects.find((p) => p.id === projectId) : null;
    const box = document.getElementById('modalBox');

    box.innerHTML = `
      <div class="modal-title">${existing ? 'Edit project' : 'New project'}</div>
      <div class="modal-field">
        <label>Project name</label>
        <input class="modal-input" id="pjName" value="${escapeHtml(existing?.name || '')}" placeholder="My first project" />
      </div>
      <div class="modal-field">
        <label>Domain</label>
        <select class="modal-select" id="pjDomain">
          ${DOMAINS.map((d) => `<option value="${d.id}" ${existing?.domain === d.id ? 'selected' : ''}>${d.emoji} ${escapeHtml(d.label)}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field">
        <label>Description</label>
        <textarea class="modal-textarea" id="pjDescription" placeholder="What are you building?">${escapeHtml(existing?.description || '')}</textarea>
      </div>
      <div class="modal-field">
        <label>Status</label>
        <select class="modal-select" id="pjStatus">
          ${PROJECT_STATUSES.map((s) => `<option value="${s.id}" ${(existing?.status || 'new') === s.id ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
        </select>
      </div>
      <div class="modal-field">
        <label>Progress</label>
        <div class="range-row">
          <input type="range" id="pjProgress" min="0" max="100" value="${existing?.progress ?? 0}" />
          <span class="range-value" id="pjProgressValue">${existing?.progress ?? 0}%</span>
        </div>
      </div>
      <div class="modal-field">
        <label>Engine used (optional)</label>
        <input class="modal-input" id="pjEngine" value="${escapeHtml(existing?.engineUsed || '')}" placeholder="e.g. Unity" />
      </div>
      <div class="modal-field">
        <label>AI assistance used (optional)</label>
        <input class="modal-input" id="pjAI" value="${escapeHtml(existing?.aiAssistance || '')}" placeholder="e.g. ChatGPT" />
      </div>
      <div class="modal-row">
        <button class="modal-btn" id="pjCancel">Cancel</button>
        ${existing ? '<button class="modal-btn danger" id="pjTrash">Delete</button>' : ''}
        <button class="modal-btn primary" id="pjSave">${existing ? 'Save' : 'Create'}</button>
      </div>
    `;

    document.getElementById('pjProgress').addEventListener('input', (e) => {
      document.getElementById('pjProgressValue').textContent = `${e.target.value}%`;
    });

    document.getElementById('pjCancel').addEventListener('click', () => this._closeModal(null));

    if (existing) {
      document.getElementById('pjTrash').addEventListener('click', async () => {
        const confirmed = await window.orion.confirmDelete(existing.name, 1);
        if (!confirmed) return;
        const result = await this.data.trashProject(existing.id);
        this._closeModal(null);
        if (result.ok) {
          this._showToast(`${existing.name} sent to the black hole`);
          if (this.focusedPlanetId) this._renderPlanetContent(this.focusedPlanetId);
        } else this._showToast(result.message, 'error');
      });
    }

    document.getElementById('pjSave').addEventListener('click', async () => {
      const input = {
        name: document.getElementById('pjName').value.trim(),
        domain: document.getElementById('pjDomain').value,
        description: document.getElementById('pjDescription').value.trim(),
        status: document.getElementById('pjStatus').value,
        progress: Number(document.getElementById('pjProgress').value),
        engineUsed: document.getElementById('pjEngine').value.trim() || null,
        aiAssistance: document.getElementById('pjAI').value.trim() || null
      };
      const result = existing ? await this.data.updateProject(existing.id, input) : await this.data.createProject(input);
      if (!result.ok) { this._showToast(result.message, 'error'); return; }
      this._showToast(existing ? `Saved ${input.name}` : `Created ${input.name}`);
      this._closeModal(result.project);
      if (this.focusedPlanetId) this._renderPlanetContent(this.focusedPlanetId);
      else this._focusPlanet('dashboard');
    });

    document.getElementById('modalOverlay').classList.add('visible');
  }

  _closeModal(value) {
    document.getElementById('modalOverlay').classList.remove('visible');
    this.editingProjectId = null;
    if (this.modalResolve) { this.modalResolve(value); this.modalResolve = null; }
  }

  /* =====================================================================
     UI WIRING
     ===================================================================== */

  _initUI() {
    this.toastEl = document.getElementById('toast');

    document.getElementById('homeBtn').addEventListener('click', () => this._goHome());
    document.getElementById('backHomeBtn').addEventListener('click', () => this._goHome());
    document.getElementById('closeProfilePanel').addEventListener('click', () => this._hideProfile());
    document.getElementById('newProjectBtn').addEventListener('click', () => this._openProjectModal(null));
    document.getElementById('settingsBtn').addEventListener('click', () => this._openSettingsPage());
    document.getElementById('closeSettingsBtn').addEventListener('click', () => document.getElementById('settingsPage').classList.remove('visible'));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._closeModal(null);
        this._hideProfile();
        document.getElementById('settingsPage').classList.remove('visible');
        document.getElementById('companionPanel').classList.remove('visible');
      }
    });
  }

  _showToast(message, kind) {
    this.toastEl.textContent = message;
    this.toastEl.classList.toggle('error', kind === 'error');
    this.toastEl.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('visible'), 2600);
    this._companionAnnounce(message, kind);
  }

  /* =====================================================================
     SETTINGS PAGE
     ===================================================================== */

  async _openSettingsPage() {
    const settings = await window.orion.getSettings();
    const page = document.getElementById('settingsPage');
    const body = document.getElementById('settingsBody');
    body.innerHTML = '';

    body.appendChild(this._settingsSection('Graphics', [
      this._segmentedRow('Quality', settings.graphicsQuality, ['low', 'medium', 'high'], (v) => this._updateSetting('graphicsQuality', v))
    ]));
    body.appendChild(this._settingsSection('Motion', [
      this._toggleRow('Reduced motion', settings.reducedMotion, (v) => { this.reducedMotion = v; this._updateSetting('reducedMotion', v); })
    ]));
    body.appendChild(this._settingsSection('Display', [
      this._toggleRow('Starfield', settings.starfield, (v) => { this.starfield.visible = v; this._updateSetting('starfield', v); })
    ]));

    page.classList.add('visible');
  }

  _settingsSection(title, rows) {
    const section = document.createElement('div');
    section.className = 'settings-section';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    section.appendChild(h3);
    rows.forEach((r) => section.appendChild(r));
    return section;
  }

  _segmentedRow(label, current, options, onChange) {
    const row = document.createElement('div');
    row.className = 'settings-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'row-label';
    labelEl.textContent = label;
    const seg = document.createElement('div');
    seg.className = 'segmented';
    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      if (opt === current) btn.classList.add('active');
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(opt);
      });
      seg.appendChild(btn);
    });
    row.appendChild(labelEl);
    row.appendChild(seg);
    return row;
  }

  _toggleRow(label, current, onChange) {
    const row = document.createElement('div');
    row.className = 'settings-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'row-label';
    labelEl.textContent = label;
    const toggle = document.createElement('button');
    toggle.className = 'toggle' + (current ? ' on' : '');
    toggle.innerHTML = '<span class="knob"></span>';
    let state = current;
    toggle.addEventListener('click', () => {
      state = !state;
      toggle.classList.toggle('on', state);
      onChange(state);
    });
    row.appendChild(labelEl);
    row.appendChild(toggle);
    return row;
  }

  async _updateSetting(key, value) {
    await window.orion.setSettings({ [key]: value });
  }

  /* =====================================================================
     ASSISTANTS — voice-command mic (top bar) + ORI, the roaming companion

     Both share one command-recognition brain (assistantEngine.js). The mic
     button executes recognized commands immediately and silently (a toast
     confirms what happened). ORI additionally SPEAKS status updates aloud
     via TTS, offers a chat panel for typed/spoken free-form input, and is
     context-aware: it's told the current planet so its canned guidance
     (and eventually a real AI backend, via AI_HOOK) can favor advice
     relevant to wherever the user currently is, per the spec.
     ===================================================================== */

  _initAssistant() {
    this.assistantEngine = createAssistantEngine({
      goHome: () => { this._goHome(); this._openProfile(); },
      openPlanet: (planetId) => this._focusPlanet(planetId),
      openBlackHole: () => this._focusPlanet('blackhole'),
      newProject: () => this._openProjectModal(null),
      openSettings: () => this._openSettingsPage(),
      stopListening: () => { this._stopMicListening(); this._stopCompanionMicListening(); },
      getContextSnapshot: () => ({ focusedPlanetId: this.focusedPlanetId })
    });

    this._initTopBarMic();
    this._initCompanion();
  }

  /* ---------------- top-bar mic (voice commands) ---------------- */

  _initTopBarMic() {
    const micBtn = document.getElementById('micBtn');
    const statusEl = document.getElementById('voiceStatus');

    if (!isSpeechRecognitionSupported()) {
      micBtn.disabled = true;
      micBtn.title = 'Voice input is not supported in this build of Electron/Chromium';
      micBtn.style.opacity = '0.35';
      return;
    }

    micBtn.addEventListener('click', () => {
      if (this.micListener) this._stopMicListening();
      else this._startMicListening(micBtn, statusEl);
    });
  }

  _startMicListening(micBtn, statusEl) {
    statusEl.classList.remove('error');
    statusEl.textContent = 'Listening… try "open engines" or "new project"';
    micBtn.classList.add('listening');

    this.micListener = createSpeechListener(
      async (transcript, isFinal) => {
        if (!isFinal) { statusEl.textContent = transcript; return; }
        statusEl.textContent = `Heard: "${transcript}"`;
        const result = await this.assistantEngine.interpret(transcript);
        if (result.matched) this._showToast(result.spoken);
        else if (result.spoken) { statusEl.classList.add('error'); statusEl.textContent = result.spoken; }
      },
      (error) => {
        statusEl.classList.add('error');
        statusEl.textContent = error === 'not-allowed' ? 'Microphone access was denied.' : `Voice input error: ${error}`;
        this._stopMicListening();
      },
      () => { micBtn.classList.remove('listening'); this.micListener = null; }
    );
    this.micListener.start();
  }

  _stopMicListening() {
    if (this.micListener) { this.micListener.stop(); this.micListener = null; }
    document.getElementById('micBtn').classList.remove('listening');
  }

  /* ---------------- ORI, the roaming companion ---------------- */

  _initCompanion() {
    this.companionEl = document.getElementById('companion');
    this.companionBubble = document.getElementById('companionBubble');
    this.companionPanel = document.getElementById('companionPanel');
    this.companionContext = document.getElementById('companionContext');
    this.companionLog = document.getElementById('companionLog');
    this.companionInput = document.getElementById('companionInput');
    this.companionMicBtn = document.getElementById('companionMicBtn');

    this.companionEl.addEventListener('click', () => this._toggleCompanionPanel());
    document.getElementById('closeCompanionPanel').addEventListener('click', () => this._toggleCompanionPanel(false));

    this.companionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.companionInput.value.trim()) {
        const text = this.companionInput.value.trim();
        this.companionInput.value = '';
        this._companionHandleUserMessage(text);
      }
    });

    if (isSpeechRecognitionSupported()) {
      this.companionMicBtn.addEventListener('click', () => {
        if (this.companionMicListener) this._stopCompanionMicListening();
        else this._startCompanionMicListening();
      });
    } else {
      this.companionMicBtn.disabled = true;
      this.companionMicBtn.style.opacity = '0.35';
    }

    this._companionSay("Hi, I'm ORI. Ask me anything, or click a planet to explore ORION.", { silent: true });
    this._scheduleCompanionRoam();
  }

  _toggleCompanionPanel(force) {
    const show = force !== undefined ? force : !this.companionPanel.classList.contains('visible');
    this.companionPanel.classList.toggle('visible', show);
    if (show) {
      this._updateCompanionContextLine();
      this.companionInput.focus();
    }
  }

  _updateCompanionContextLine() {
    const def = this.focusedPlanetId ? (this._bodyFor(this.focusedPlanetId)?.def || (this.focusedPlanetId === 'blackhole' ? BLACK_HOLE_DEF : null)) : null;
    this.companionContext.textContent = def ? `Currently viewing: ${def.emoji} ${def.label}` : '';
  }

  async _companionHandleUserMessage(text) {
    this._appendCompanionLog(text, 'user');
    this._updateCompanionContextLine();
    const result = await this.assistantEngine.interpret(text);
    this._appendCompanionLog(result.spoken, 'companion');
    this._companionSay(result.spoken);
  }

  _appendCompanionLog(text, from) {
    const div = document.createElement('div');
    div.className = `companion-msg from-${from}`;
    div.textContent = text;
    this.companionLog.appendChild(div);
    this.companionLog.scrollTop = this.companionLog.scrollHeight;
  }

  _startCompanionMicListening() {
    this.companionMicBtn.classList.add('listening');
    this.companionMicListener = createSpeechListener(
      async (transcript, isFinal) => {
        if (!isFinal) return;
        this.companionInput.value = transcript;
        this._stopCompanionMicListening();
        this.companionInput.value = '';
        await this._companionHandleUserMessage(transcript);
      },
      (error) => {
        this._appendCompanionLog(`Microphone error: ${error}`, 'companion');
        this._stopCompanionMicListening();
      },
      () => { this.companionMicBtn.classList.remove('listening'); this.companionMicListener = null; }
    );
    this.companionMicListener.start();
  }

  _stopCompanionMicListening() {
    if (this.companionMicListener) { this.companionMicListener.stop(); this.companionMicListener = null; }
    this.companionMicBtn.classList.remove('listening');
  }

  _companionSay(text, opts = {}) {
    if (!text) return;
    this.companionBubble.textContent = text;
    this.companionBubble.classList.add('visible');
    clearTimeout(this._companionBubbleTimer);
    this._companionBubbleTimer = setTimeout(() => this.companionBubble.classList.remove('visible'), 4200);

    if (!opts.silent && isSpeechSynthesisSupported()) {
      this.companionEl.classList.add('speaking');
      speak(text);
      const estimatedMs = Math.max(1200, text.length * 60);
      clearTimeout(this._companionSpeakingTimer);
      this._companionSpeakingTimer = setTimeout(() => this.companionEl.classList.remove('speaking'), estimatedMs);
    }
  }

  _companionAnnounce(message, kind) {
    if (!this.companionEl) return; // not yet initialized (e.g. an early toast during setup)
    const spoken = kind === 'error' ? `Heads up — ${message}` : message;
    this._companionSay(spoken);
  }

  /**
   * Moves ORI along a smooth, gently curved path that wanders across the
   * lower portion of the screen (not fixed rigidly in one corner, and not
   * covering the top bar / planet toolbar / content panel above it) — per
   * spec: "should NOT simply remain fixed in one corner" and "avoid
   * covering important UI elements."
   */
  _scheduleCompanionRoam() {
    const ORB_SIZE = 64;
    const ANCHOR_MARGIN = 32; // matches #companion's right/bottom in styles.css
    let angle = Math.random() * Math.PI * 2;

    const roam = () => {
      if (!this.reducedMotion && !this.companionPanel.classList.contains('visible')) {
        const baseLeft = window.innerWidth - ANCHOR_MARGIN - ORB_SIZE;
        const baseTop = window.innerHeight - ANCHOR_MARGIN - ORB_SIZE;
        // Orbital wander confined to the lower-right quadrant, well below
        // the content panel's top edge (~128px) so ORI never overlaps it.
        angle += (Math.random() - 0.3) * 1.4;
        const radiusX = 140 + Math.random() * 90;
        const radiusY = 70 + Math.random() * 50;
        let dx = Math.cos(angle) * radiusX - radiusX; // <= 0 bias, keeps it left of the anchor
        let dy = Math.sin(angle) * radiusY - radiusY * 0.4;
        dx = Math.min(0, Math.max(dx, -baseLeft + 12));
        dy = Math.min(radiusY * 0.6, Math.max(dy, -(baseTop - 160)));
        this.companionEl.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      this.companionRoamTimer = setTimeout(roam, 3200 + Math.random() * 2200);
    };
    this.companionRoamTimer = setTimeout(roam, 3000);
  }

  /* =====================================================================
     RENDER LOOP
     ===================================================================== */

  _animate() {
    requestAnimationFrame(() => this._animate());
    const delta = Math.min(this._clock.getDelta(), 0.05);

    if (!this.reducedMotion) {
      this.starfield.rotation.y += delta * 0.0025;
      this.sunCore.rotation.y += delta * 0.05;
      this.sunGlow.scale.setScalar((1 + Math.sin(performance.now() * 0.001) * 0.03) * 1.35);

      this._allBodies().forEach((body) => {
        if (!body.selected) body.angle += delta * body.orbitSpeed;
        body.group.position.set(Math.cos(body.angle) * body.orbitRadius, 0, Math.sin(body.angle) * body.orbitRadius);
        body.mesh.rotation.y += delta * 0.3;
      });

      this.blackHole.ring.rotation.z += delta * 0.6;
      this.blackHole.core.rotation.y += delta * 0.4;
    } else {
      this._allBodies().forEach((body) => {
        body.group.position.set(Math.cos(body.angle) * body.orbitRadius, 0, Math.sin(body.angle) * body.orbitRadius);
      });
    }

    this._updateCameraFollow(delta);

    this.controls.update();
    this.composer.render();
    this.labelRenderer.render(this.scene, this.camera);
  }

  /**
   * Eases OrbitControls' target and the camera's distance toward the
   * focused body (or back to the Sun at the origin when home), every
   * frame. Since the target body keeps orbiting while focused (it just
   * stops advancing its own angle in _animate above — see `!body.selected`
   * — so it holds still once focus lands, but the ease-in itself tracks
   * wherever it was when the camera catches up), this reads as a genuine
   * "zoom toward the selected planet" rather than a snap-cut.
   */
  _updateCameraFollow(delta) {
    if (this.reducedMotion) {
      // Respect the reduced-motion setting: jump directly to the target
      // state instead of animating toward it every frame.
      const focusPos = this.cameraFollowTarget ? this.cameraFollowTarget.group.position : new THREE.Vector3(0, 0, 0);
      this.controls.target.copy(focusPos);
      return;
    }

    this.cameraFocusBlend = Math.min(1, this.cameraFocusBlend + delta / 0.9);
    const ease = 1 - Math.pow(1 - this.cameraFocusBlend, 3); // ease-out cubic

    const focusPos = this.cameraFollowTarget ? this.cameraFollowTarget.group.position : new THREE.Vector3(0, 0, 0);
    this.controls.target.lerp(focusPos, Math.min(1, delta * 4));

    const desiredDistance = this.cameraFollowTarget
      ? THREE.MathUtils.lerp(this.controls.getDistance(), this.cameraFocusDistance, ease * 0.06)
      : THREE.MathUtils.lerp(this.controls.getDistance(), this.cameraHomeDistance, ease * 0.04);

    // Move the camera along its current view direction to the desired
    // distance from the (now-updated) target, preserving whatever angle
    // the user has orbited to rather than forcing a fixed viewing angle.
    const currentDistance = this.controls.getDistance();
    if (Math.abs(currentDistance - desiredDistance) > 0.01) {
      const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
      this.camera.position.copy(this.controls.target).add(dir.multiplyScalar(desiredDistance));
    }
  }

  _onResize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }
}

const container = document.getElementById('app');
new OrionApp(container);

