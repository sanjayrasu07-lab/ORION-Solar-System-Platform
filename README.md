# ORION — Solar System Platform

A 3D solar-system interface for exploring IT domains, development engines/tools, AI
resources, and your own projects — built for freshers, students, and beginners. Built
with Electron + vanilla Three.js.

This project **evolved from an existing Solar OS file-manager foundation** (also
Electron + Three.js + an app-managed "black hole" recycle bin + a roaming voice
assistant) rather than being written from scratch — see Section 8 for exactly what
was reused vs. rewritten.

---

## 1. What ORION is

The Solar System is your IT workspace:

- **☀️ Sun** — your profile (name, headline, domain, experience level, skills)
- **📊 Dashboard planet** — project overview: totals, in-progress, completed, drafts,
  and a full sortable project list
- **🎮 Engines planet** — Unity, Godot, Unreal Engine, CryEngine (clickable, opens
  each tool's real homepage in your browser)
- **🛠️ Tools planet** — VS Code, Android Studio, Blender, Maya
- **✨ AI planet** — ChatGPT, Claude, Cursor, Meshy, ElevenLabs, Sora, Leonardo AI
- **🪨 Drafts (dwarf planet)** — projects still in New/Draft/Working status
- **🕳️ Black Hole** — deleted projects, restorable or permanently removable
- **✨ ORI** — a roaming AI companion that lives inside the Solar System, offers
  voice/typed guidance, and speaks status updates aloud

Click any planet: the others fade out, the camera smoothly eases toward the selected
one, and its contents open in a clean card/grid panel (never scattered in 3D space).
A Back/Home button is always available.

## 2. Prerequisites

- **Node.js 18+** and npm — https://nodejs.org
- Windows 10/11 to run the built app (buildable from other OSes, but test on Windows)

## 3. Install and run

```bash
npm install
npm start          # launches the app directly via Electron, no build step
```

## 4. Build the Windows installer / portable exe

```bash
npm run dist              # both NSIS installer and portable exe
npm run dist:portable     # portable exe only
```

Output lands in `release/`: `ORION Setup <version>.exe` (installer) and
`ORION-portable-<version>.exe` (portable, no install needed).

## 5. Project creation

Click ➕ in the top bar (or say "new project" to ORI/the mic) to open the project
form: name, domain, description, status (New/Draft/Working/Completed/Archived),
progress slider, engine used, and AI assistance used. Editing an existing project
reuses the same form — click any project row on the Dashboard or Drafts planet.

## 6. ORI, the roaming AI companion

ORI lives inside the Solar System and wanders on a smooth, gently curved orbital path
across the lower portion of the screen — not fixed in one corner, and never covering
the top bar, planet toolbar, or content panel. Click ORI to open a chat panel (type or
speak); ORI also speaks every toast notification aloud via your OS's text-to-speech
voice.

**Context awareness:** ORI is told which planet you're currently viewing. Ask "what
should I use" while on the Engines planet and canned engine guidance is prioritized
over the same question asked on the Tools planet — this is genuine context-scoping,
not a coincidence of wording (see `assistantEngine.js`'s `planetHint` field and the
scoring step in `interpret()`).

**Example interactions that work out of the box** (matching the spec's examples):
- *"What should I learn for game development?"* → engine + programming/3D guidance
- *"Which tool should I use to create 3D models?"* → Blender
- *"Open engines"* / *"new project"* / *"go home"* / *"open settings"* — real commands

**What ORI is — and isn't:** both the mic and ORI use a small, fully-local
phrase/keyword matcher (plain JS, no network call, no API key) plus a curated set of
beginner-friendly canned tips. It is not a real language model and cannot reason about
novel questions outside that set.

**The AI hook, for later:** anything unmatched falls through to
`AI_HOOK.handleUnmatched()` in `assistantEngine.js` — a clearly-marked placeholder
returning a canned "I don't know that one yet" response. Replace its body with a real
AI API call (keep the same `{ text, spoken }` return shape) to give ORI genuine
free-form understanding.

**Requirements and honest caveats:**
- Uses the Web Speech API (`SpeechRecognition` + `speechSynthesis`) — built into
  Chromium/Electron, no extra npm package.
- `main.js` explicitly grants microphone (`media`) permission — Electron denies all
  permission requests by default otherwise.
- Recognition/synthesis quality and offline-ness depend on your Windows/Chromium
  configuration; cannot be guaranteed fully offline from JS alone.
- If `SpeechRecognition` isn't available, both mic buttons disable themselves with an
  explanatory tooltip.

## 7. The Black Hole (deleted projects)

Deleting a project moves it into the Black Hole (a soft delete, persisted in the same
JSON store as everything else) rather than erasing it immediately — restorable via the
Black Hole planet's Restore button, or permanently removable one at a time or via
"Empty all permanently." This mirrors the app-managed recycle bin pattern from the
Solar OS foundation, applied to projects instead of files.

## 8. What was reused vs. rewritten (per your modification request)

**Reused wholesale from the Solar OS foundation** (same security model, same IPC
discipline, same visual language):
- The Electron main-process architecture: `contextIsolation: true`,
  `nodeIntegration: false`, a single whitelisted `contextBridge` API surface
  (`window.orion`, was `window.solarOS`), every real operation validated in the main
  process behind explicit IPC channels.
- The microphone permission-grant pattern in `main.js`.
- The `electron-store`-backed persistence pattern (JSON under the OS user-data dir).
- The dark-space, glassmorphism visual language (CSS custom the same way, same accent
  palette, same Orbitron/Inter type pairing).
- The voice-assistant architecture: one shared `assistantEngine.js` (local
  phrase-matching + a clearly-marked `AI_HOOK` placeholder) driving both a top-bar mic
  and a roaming orb companion that speaks toast notifications aloud.
- The soft-delete-to-recycle-bin pattern, applied to projects instead of files.

**Rewritten because the concept changed** (per your explicit instruction — this is
not a file manager anymore):
- All filesystem operations (`fsHandlers.js`, folder pickers, file open/rename/
  copy/move) were **removed** — ORION manages profile/project/settings data, not real
  files, so `dataHandlers.js` replaces `fsHandlers.js` with project CRUD instead.
- Planets changed from folder categories (Downloads/Images/Videos/...) to IT-platform
  areas (Dashboard/Engines/Tools/AI), plus a new dwarf planet (Drafts) and a
  repurposed Black Hole (deleted projects instead of deleted files).
- The content view changed from an asteroid-field of individual files to card/grid
  panels — per your spec's explicit "use cards/grid layouts rather than scattering
  content randomly in 3D space."
- **Camera behavior was upgraded**: the foundation's `OrbitControls` never
  programmatically moved the camera (it only responded to user drag/zoom). ORION adds
  real "zoom toward the selected planet" — `OrbitControls.target` and camera distance
  now smoothly ease toward the focused body every frame (see `_updateCameraFollow` in
  `app.js`), which the foundation never had and this spec explicitly requires.
- The companion was renamed and re-scoped: from a generic status-announcer to ORI, a
  context-aware guide that knows which planet you're viewing and prioritizes relevant
  canned advice accordingly.

**New files** (none of these existed in the file-manager foundation):
`src/renderer/catalog.js` (planet/domain/status/engine/tool/AI-resource definitions),
`src/main/dataHandlers.js` (profile/project/black-hole/companion-log IPC handlers).

## 9. Known limitations

- **This project has not been run or built in the environment it was written in.**
  Verified via static syntax checking (every file), structural brace-balance checking
  (character-accurate, comment/string-aware), full DOM-ID cross-referencing between
  `app.js` and `index.html` (including dynamically-generated form IDs), and complete
  bidirectional IPC-channel parity checking (every `preload.js` invoke has exactly one
  `dataHandlers.js`/`dialogHandlers.js` handler, and vice versa) — done in a sandbox
  without npm registry access or a Windows machine to actually launch Electron. Real
  compilation may surface issues static analysis can't catch.
- **`OrbitControls.getDistance()`** (used in the new camera-follow logic) is a
  long-standing public method on three.js's OrbitControls and should work as written,
  but could not be verified against the actual installed library source in this
  sandbox (no local three.js package was available to inspect). If it errors, replace
  it with `this.camera.position.distanceTo(this.controls.target)`, which is equivalent.
- **ORI's guidance is a curated keyword-matched tip set, not real AI** — see Section 6.
  The `AI_HOOK` placeholder is where real intelligence would be added.
- **External links (Engines/Tools/AI cards) open your default browser** via
  `window.open` + `shell.openExternal` in `main.js`'s `setWindowOpenHandler` — they
  are real URLs to each tool's actual homepage, not affiliate links or mock pages.
- **Placeholder app icon**, generated programmatically (orbit ring + sun + a small
  orbiting dot, distinct from the file-manager foundation's icon). Swap
  `build/icon.ico` for a designed icon anytime — no code changes needed.
- **No LinkedIn/Roblox/GitHub-branded UI** — per your instruction, the mini-project
  concept (profile+skills from LinkedIn, interactive 3D exploration from Roblox,
  project/status tracking from GitHub) is expressed through ORION's own Sun profile +
  Solar System navigation + Dashboard/Black-Hole project lifecycle, with no copied
  branding or UI.

## 10. Project structure

```
src/
├── main/
│   ├── main.js            # Electron entry point, window creation, mic permission grant
│   ├── dataHandlers.js      # ALL real data operations: profile/projects/black-hole/companion log
│   ├── dialogHandlers.js     # native confirm-delete dialog
│   └── store.js                # persisted profile/projects/deleted/settings/companion log (JSON)
├── preload/
│   └── preload.js                # the ONLY bridge between renderer and the persisted store
└── renderer/
    ├── index.html                  # UI shell (top bar, planet toolbar, content panel, profile, ORI, modals, settings)
    ├── styles.css                   # ORION visual language (dark space, glassmorphism)
    ├── catalog.js                     # planet/domain/status defs + curated engine/tool/AI resource lists
    ├── dataLayer.js                     # wraps window.orion; local state kept in sync after real ops succeed
    ├── assistantEngine.js                 # ORI's command grammar, canned tips, TTS/mic wrappers, AI_HOOK placeholder
    └── app.js                               # 3D scene, camera-follow, planet content panels, project CRUD, ORI wiring

build/
└── icon.ico                # Windows app icon (placeholder, swap anytime)
```

## 11. Security model

The renderer has **no direct access to Node.js or the filesystem**. `contextIsolation`
is on and `nodeIntegration` is off — every operation goes through `preload.js`'s
whitelisted `window.orion.*` bridge into a specific, validated IPC handler in the main
process (`dataHandlers.js`), which is the only code that ever touches the persisted
store. The only other permission requested is the microphone, explicitly scoped to
`media` only via `session.defaultSession.setPermissionRequestHandler` in `main.js` —
every other permission request is denied by that same handler.

## 12. Dependencies

**Added relative to the file-manager foundation's `package.json`:** `three` (moved
from a devDependency-adjacent runtime import to an explicit `dependencies` entry,
since ORION's 3D scene needs it directly). `electron-store`, `electron`, and
`electron-builder` were already present and are unchanged/version-compatible.

**Removed:** none of the foundation's dependencies were removed — `three` is now the
only runtime dependency ORION needs beyond `electron-store`, since all filesystem-
specific packages (there weren't any beyond Node's built-in `fs`) are gone along with
`fsHandlers.js`.
