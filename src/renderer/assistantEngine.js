/**
 * assistantEngine.js
 *
 * Shared brain for both ORI surfaces:
 *   - the mic button next to the top bar (voice COMMANDS — see below)
 *   - ORI, the roaming orb that lives inside the Solar System
 *
 * WHAT THIS IS: a small, fully-local phrase-matcher plus a set of
 * beginner-friendly canned tips, keyed by ORION's current planet context.
 * No network calls, no API keys, nothing leaves the machine.
 *
 * WHAT THIS IS NOT: real natural-language understanding or real AI
 * guidance. "what should I learn for game development" gets a genuinely
 * useful canned answer because that exact scenario is in the spec — but
 * ORI cannot reason about novel questions. See AI_HOOK below for where a
 * real AI backend would plug in to give ORI that ability for real.
 *
 * ── AI_HOOK ──────────────────────────────────────────────────────────────
 * When a message matches no local command and no canned tip, interpret()
 * falls through to AI_HOOK.handleUnmatched(transcript, context). That
 * function is a clearly-marked placeholder — wire in a real AI API
 * (OpenAI, Anthropic, a local LLM server, etc.) whenever you're ready.
 * Keep the same { text, spoken } return shape and both the mic and ORI
 * keep working without further changes.
 * ────────────────────────────────────────────────────────────────────────
 */

function buildCommandTable() {
  return [
    {
      id: 'go-home',
      patterns: [/^(go |take me )?home$/, /^show (the )?sun$/, /^open (my )?profile$/],
      action: (_m, ctx) => ctx.goHome(),
      describe: () => 'Going to your profile.'
    },
    {
      id: 'open-planet',
      patterns: [
        /^open (the )?(dashboard|engines|tools|ai|drafts) ?(planet)?$/,
        /^(show|go to) (the )?(dashboard|engines|tools|ai|drafts) ?(planet)?$/
      ],
      action: (m, ctx) => ctx.openPlanet(m[2] || m[3]),
      describe: (m) => `Opening ${m[2] || m[3]}.`
    },
    {
      id: 'open-blackhole',
      patterns: [/^open (the )?(black hole|deleted|trash)$/],
      action: (_m, ctx) => ctx.openBlackHole(),
      describe: () => 'Opening deleted projects.'
    },
    {
      id: 'new-project',
      patterns: [/^(new|create) project$/, /^start a (new )?project$/],
      action: (_m, ctx) => ctx.newProject(),
      describe: () => 'Let\u2019s create a new project.'
    },
    {
      id: 'open-settings',
      patterns: [/^open settings$/],
      action: (_m, ctx) => ctx.openSettings(),
      describe: () => 'Opening settings.'
    },
    {
      id: 'stop-listening',
      patterns: [/^stop listening$/, /^never mind$/, /^cancel$/],
      action: (_m, ctx) => ctx.stopListening(),
      describe: () => 'Okay.'
    }
  ];
}

/**
 * Beginner-friendly canned guidance. Each entry is tested against the
 * transcript with simple keyword matching (not full regex phrases like the
 * commands above), since real questions phrase themselves many ways —
 * "what should I learn for game dev" / "how do I get started making
 * games" should both land here.
 *
 * `context` scoping (per the spec: ORI should discuss what's relevant to
 * wherever the user currently is) is handled by ordering — tips relevant
 * to the current planet are checked first, so being on the Engines planet
 * and asking a generic "what do I use" question still gets an
 * engine-flavored answer rather than a generic one.
 */
function buildTipTable() {
  return [
    {
      keywords: ['game development', 'game dev', 'making games', 'build games'],
      planetHint: 'engines',
      reply: 'For a beginner, start with a game engine such as Unity or Godot, then learn basic programming and 3D concepts.'
    },
    {
      keywords: ['3d model', 'modeling', '3d art', 'make models'],
      planetHint: 'tools',
      reply: 'You can start with Blender \u2014 it\u2019s free, and there are tons of beginner tutorials.'
    },
    {
      keywords: ['app development', 'mobile app', 'android app', 'ios app'],
      planetHint: 'engines',
      reply: 'For app development, Android Studio is the official tool for Android, and it comes with everything you need to get started.'
    },
    {
      keywords: ['web development', 'website', 'web dev'],
      reply: 'For web development, start with HTML, CSS, and JavaScript \u2014 VS Code is a great free editor to write them in.'
    },
    {
      keywords: ['engine', 'which engine', 'what engine'],
      reply: 'Unity and Godot are both beginner-friendly. Unity has a huge tutorial community; Godot is free, open-source, and lightweight.'
    },
    {
      keywords: ['ai tool', 'which ai', 'what ai'],
      reply: 'ChatGPT and Claude are great for explanations and code help. Cursor is an AI-native code editor if you want AI built right into your workflow.'
    },
    {
      keywords: ['tool', 'which tool', 'what tool'],
      reply: 'VS Code is a solid default code editor for almost anything. Pair it with Blender if you need 3D assets.'
    },
    {
      keywords: ['project', 'get started', 'where do i start', 'how do i start'],
      reply: 'Try creating your first project from the ➕ button \u2014 give it a name and pick a domain, and you can fill in the rest as you go.'
    },
    {
      keywords: ['what is orion', 'what is this', 'help'],
      reply: 'ORION is your 3D IT workspace. Each planet is a different area \u2014 Dashboard for your projects, Engines and Tools for building, and AI for AI resources. Click any planet to explore it.'
    }
  ];
}

const AI_HOOK = {
  /**
   * @param {string} transcript - raw lowercased message
   * @param {object} context - { focusedPlanetId } and anything else you want to give the AI
   * @returns {Promise<{text: string, spoken: string}>}
   */
  async handleUnmatched(transcript, _context) {
    return {
      text: `I don't have a canned answer for "${transcript}" yet.`,
      spoken: "I don't know that one yet \u2014 try asking about engines, tools, AI, or how to start a project."
    };
  }
};

export function createAssistantEngine(ctx) {
  const commands = buildCommandTable();
  const tips = buildTipTable();

  async function interpret(transcriptRaw) {
    const transcript = (transcriptRaw || '').trim().toLowerCase().replace(/[.!?]+$/, '');
    if (!transcript) return { matched: false, spoken: '' };

    for (const cmd of commands) {
      for (const pattern of cmd.patterns) {
        const m = transcript.match(pattern);
        if (m) {
          try {
            cmd.action(m, ctx);
          } catch (err) {
            return { matched: true, commandId: cmd.id, spoken: `Something went wrong: ${err.message}` };
          }
          return { matched: true, commandId: cmd.id, spoken: cmd.describe(m) };
        }
      }
    }

    const currentPlanet = ctx.getContextSnapshot ? ctx.getContextSnapshot().focusedPlanetId : null;
    const scored = tips
      .filter((tip) => tip.keywords.some((kw) => transcript.includes(kw)))
      .sort((a, b) => {
        const aMatch = a.planetHint === currentPlanet ? 1 : 0;
        const bMatch = b.planetHint === currentPlanet ? 1 : 0;
        return bMatch - aMatch;
      });
    if (scored.length > 0) {
      return { matched: true, commandId: 'tip', spoken: scored[0].reply };
    }

    const result = await AI_HOOK.handleUnmatched(transcript, ctx.getContextSnapshot ? ctx.getContextSnapshot() : {});
    return { matched: false, spoken: result.spoken };
  }

  return { interpret, commands, tips };
}

/* =========================================================================
   Speech recognition + speech synthesis wrappers — built into Chromium
   (and therefore Electron) with no extra dependency. Some Chromium builds
   may route recognition through a web service depending on OS
   configuration; there is no way to guarantee fully offline speech
   recognition from JS alone.
   ========================================================================= */

export function isSpeechRecognitionSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported() {
  return !!window.speechSynthesis;
}

export function createSpeechListener(onResult, onError, onEnd) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    onResult(result[0].transcript, result.isFinal);
  };
  recognition.onerror = (event) => onError(event.error || 'unknown-error');
  recognition.onend = () => onEnd();

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop()
  };
}

export function speak(text, { rate = 1.02, pitch = 1.0, volume = 1.0 } = {}) {
  if (!isSpeechSynthesisSupported() || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;
  // Chromium quirk mitigation: speak() called synchronously right after
  // cancel() can silently drop the utterance. A short defer greatly
  // reduces how often that happens (not a full guarantee).
  setTimeout(() => window.speechSynthesis.speak(utterance), 40);
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}

export { AI_HOOK };
