/**
 * catalog.js
 *
 * Static content model for ORION's Solar System: the planets, and the
 * curated resources (engines/tools/AI services) shown on each. This plays
 * the role the Solar OS foundation's dataLayer.js PLANET_DEFS played for
 * file-manager planets — a fixed definition list the 3D scene renders
 * from — but the "contents" here are a curated catalog instead of
 * scanned real files, since ORION is a learning/project platform, not a
 * file browser.
 *
 * Project data (the actually-dynamic part) is NOT in this file — see
 * dataLayer.js, which wraps window.orion (the real persisted store).
 */

export const PLANET_DEFS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    color: '#4f9dff',
    emoji: '📊',
    kind: 'dashboard',
    blurb: 'Your project overview — what\u2019s done, what\u2019s in progress, what\u2019s next.'
  },
  {
    id: 'engines',
    label: 'Engines',
    color: '#ff5b5b',
    emoji: '🎮',
    kind: 'catalog',
    blurb: 'Game and development engines to build with.'
  },
  {
    id: 'tools',
    label: 'Tools',
    color: '#ffb15c',
    emoji: '🛠️',
    kind: 'catalog',
    blurb: 'Everyday development tools — editors, 3D software, IDEs.'
  },
  {
    id: 'ai',
    label: 'AI',
    color: '#b98bff',
    emoji: '✨',
    kind: 'catalog',
    blurb: 'AI services that can help you build faster.',
    interactive: true
  }
];

/** The Dwarf Planet — drafts and unfinished projects, a filtered view rather than a separate data source. */
export const DWARF_PLANET_DEF = {
  id: 'drafts',
  label: 'Drafts',
  color: '#8bffcf',
  emoji: '🪨',
  kind: 'drafts',
  blurb: 'Projects still in progress — new, draft, or being worked on.'
};

/** The Black Hole — deleted/archived projects. */
export const BLACK_HOLE_DEF = {
  id: 'blackhole',
  label: 'Deleted',
  color: '#4a3a7a',
  emoji: '🕳️',
  kind: 'blackhole',
  blurb: 'Deleted projects live here until restored or permanently removed.'
};

export const DOMAINS = [
  { id: 'game-development', label: 'Game Development', emoji: '🎮' },
  { id: 'app-development', label: 'App Development', emoji: '📱' },
  { id: 'web-development', label: 'Web Development', emoji: '🌐' }
];

export const PROJECT_STATUSES = [
  { id: 'new', label: 'New', color: '#7dd3ff' },
  { id: 'draft', label: 'Draft', color: '#8bffcf' },
  { id: 'working', label: 'Working', color: '#ffb15c' },
  { id: 'completed', label: 'Completed', color: '#4fd97a' },
  { id: 'archived', label: 'Archived', color: '#8b95b8' }
];

/**
 * Curated engine/tool/AI catalog. Beginner-friendly one-line descriptions,
 * not exhaustive documentation — this is meant to orient a fresher, not
 * replace each tool's own docs. "url" is the tool's real homepage, opened
 * via the OS default browser when clicked (see app.js openExternalLink).
 */
export const ENGINES = [
  { id: 'unity', name: 'Unity', icon: '🧩', url: 'https://unity.com', blurb: 'A beginner-friendly engine with a huge tutorial community — a great first engine.' },
  { id: 'godot', name: 'Godot', icon: '🤖', url: 'https://godotengine.org', blurb: 'Free and open-source, lightweight, and great for 2D or small 3D projects.' },
  { id: 'unreal', name: 'Unreal Engine', icon: '🕹️', url: 'https://www.unrealengine.com', blurb: 'Powerful, AAA-grade visuals — steeper learning curve, strong for 3D.' },
  { id: 'cryengine', name: 'CryEngine', icon: '🌲', url: 'https://www.cryengine.com', blurb: 'Known for realistic outdoor environments and high-end visuals.' }
];

export const TOOLS = [
  { id: 'vscode', name: 'VS Code', icon: '💻', url: 'https://code.visualstudio.com', blurb: 'The most widely used code editor — a solid default for almost any language.' },
  { id: 'android-studio', name: 'Android Studio', icon: '📱', url: 'https://developer.android.com/studio', blurb: 'The official IDE for building Android apps.' },
  { id: 'blender', name: 'Blender', icon: '🧱', url: 'https://www.blender.org', blurb: 'Free 3D modeling, animation, and rendering software.' },
  { id: 'maya', name: 'Maya', icon: '🎬', url: 'https://www.autodesk.com/products/maya', blurb: 'Industry-standard 3D animation software, common in studios.' }
];

export const AI_TOOLS = [
  { id: 'chatgpt', name: 'ChatGPT', icon: '💬', url: 'https://chat.openai.com', blurb: 'General-purpose AI assistant — great for explanations and code help.' },
  { id: 'claude', name: 'Claude', icon: '🟠', url: 'https://claude.ai', blurb: 'An AI assistant strong at reasoning, writing, and working through code.' },
  { id: 'cursor', name: 'Cursor', icon: '⌨️', url: 'https://www.cursor.com', blurb: 'An AI-native code editor that helps you write and edit code faster.' },
  { id: 'meshy', name: 'Meshy', icon: '🗿', url: 'https://www.meshy.ai', blurb: 'Generates 3D models from text or images — useful for quick game assets.' },
  { id: 'elevenlabs', name: 'ElevenLabs', icon: '🔊', url: 'https://elevenlabs.io', blurb: 'AI voice generation — useful for narration or character voices.' },
  { id: 'sora', name: 'Sora', icon: '🎞️', url: 'https://openai.com/sora', blurb: 'AI video generation from text prompts.' },
  { id: 'leonardo', name: 'Leonardo AI', icon: '🖼️', url: 'https://leonardo.ai', blurb: 'AI image generation, popular for concept art and game textures.' }
];

export function catalogForPlanet(planetId) {
  if (planetId === 'engines') return ENGINES;
  if (planetId === 'tools') return TOOLS;
  if (planetId === 'ai') return AI_TOOLS;
  return [];
}

export function domainLabel(domainId) {
  return DOMAINS.find((d) => d.id === domainId)?.label || domainId;
}

export function statusDef(statusId) {
  return PROJECT_STATUSES.find((s) => s.id === statusId) || PROJECT_STATUSES[0];
}
