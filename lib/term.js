// A tiny terminal toolkit: what the terminal can do, colour, a box, keys.
// No dependencies, so `npx` has nothing to download but this package.

import readline from "node:readline";
import { spawn, spawnSync } from "node:child_process";

// Each colour in the three depths a terminal may offer.
export const PALETTE = {
  amber: { rgb: [255, 178, 0], x256: 214, basic: 93 },
  cream: { rgb: [255, 245, 220], x256: 230, basic: 97 },
  red: { rgb: [255, 99, 82], x256: 203, basic: 91 },
  green: { rgb: [99, 220, 156], x256: 79, basic: 92 },
  blue: { rgb: [120, 170, 255], x256: 111, basic: 94 },
  gray: { rgb: [138, 147, 170], x256: 246, basic: 90 },
};

/** Works out what this terminal supports. */
export function detect(argv = [], stream = process.stdout, env = process.env) {
  const tty = Boolean(stream.isTTY);
  const plain = argv.includes("--plain") || "NO_COLOR" in env || env.TERM === "dumb";
  const depth = tty && !plain ? (typeof stream.getColorDepth === "function" ? stream.getColorDepth() : 4) : 1;
  const locale = env.LC_ALL || env.LC_CTYPE || env.LANG || "";
  const modernWindows = Boolean(env.WT_SESSION || env.TERM_PROGRAM || env.ConEmuANSI);
  const unicode = !argv.includes("--ascii") && (process.platform === "win32" ? modernWindows : locale === "" || /utf-?8/i.test(locale));
  return {
    tty,
    depth,
    color: depth > 1,
    unicode,
    links: tty && !plain && depth >= 8,
    columns: stream.columns || 80,
    rows: stream.rows || 24,
  };
}

// ── styled text ────────────────────────────────────────────────────────────
// A line is an array of spans; a span is a piece of text plus its style. The
// same lines are turned into ANSI for the terminal and into SVG for the README.

/** s("text", { c: "amber", b: true })  c colour, b bold, d dim, u underline, link url */
export const s = (t, style = {}) => ({ t: String(t), ...style });

export const lineWidth = (line) => line.reduce((n, span) => n + [...span.t].length, 0);

export const pad = (line, width) => {
  const gap = width - lineWidth(line);
  return gap > 0 ? [...line, s(" ".repeat(gap))] : line;
};

/** Cut a line to a width, so it never wraps (a wrapped line would break redrawing). */
export function clip(line, width) {
  const out = [];
  let room = width;
  for (const span of line) {
    if (room <= 0) break;
    const chars = [...span.t];
    out.push(chars.length > room ? { ...span, t: chars.slice(0, room).join("") } : span);
    room -= chars.length;
  }
  return out;
}

/**
 * Restyle single characters, for animations. `fn(row, column, char, span)`
 * returns the style to use instead (always the same object for the same
 * look), or nothing to leave the character as it is. A style with
 * `blank: true` hides the character.
 */
export function paint(lines, fn) {
  return lines.map((line, row) => {
    const out = [];
    let column = 0;
    let last;
    for (const span of line) {
      for (const ch of span.t) {
        const style = fn(row, column++, ch, span) ?? span;
        const shown = style.blank ? " " : ch;
        if (style === last) out.at(-1).t += shown;
        else out.push({ ...style, t: shown });
        last = style;
      }
    }
    return out;
  });
}

const colourCode = (name, cap, background) => {
  const p = PALETTE[name];
  if (!p) return "";
  if (cap.depth >= 24) return `${background ? 48 : 38};2;${p.rgb.join(";")}`;
  if (cap.depth >= 8) return `${background ? 48 : 38};5;${p.x256}`;
  return String(background ? p.basic + 10 : p.basic);
};

/** "résumé" becomes "resume" for terminals that only speak ASCII. */
const unaccent = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function toAnsi(line, cap) {
  if (!cap.unicode) line = line.map((span) => ({ ...span, t: unaccent(span.t) }));
  if (!cap.color) return line.map((span) => span.t).join("");
  let out = "";
  for (const span of line) {
    const codes = [];
    if (span.b) codes.push(1);
    if (span.d) codes.push(2);
    if (span.u) codes.push(4);
    if (span.c) codes.push(colourCode(span.c, cap, false));
    if (span.bg) codes.push(colourCode(span.bg, cap, true));
    // OSC 8: a clickable link in terminals that support it, plain text elsewhere
    const text = span.link && cap.links ? `\x1b]8;;${span.link}\x1b\\${span.t}\x1b]8;;\x1b\\` : span.t;
    out += codes.length ? `\x1b[${codes.join(";")}m${text}\x1b[0m` : text;
  }
  return out;
}

/** A box with a hard shadow down the right and along the bottom, comic-book style. */
export function box(lines, width, cap, { border = "cream", shadow = "amber" } = {}) {
  const ch = cap.unicode
    ? { tl: "┏", tr: "┓", bl: "┗", br: "┛", h: "━", v: "┃", sh: "█" }
    : { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|", sh: "#" };
  const edge = (text) => s(text, { c: border });
  const dark = (n) => s(ch.sh.repeat(n), { c: shadow });
  const out = [[edge(ch.tl + ch.h.repeat(width) + ch.tr)]];
  for (const line of lines) out.push([edge(ch.v), ...pad(line, width), edge(ch.v), dark(2)]);
  out.push([edge(ch.bl + ch.h.repeat(width) + ch.br), dark(2)]);
  out.push([s("  "), dark(width + 2)]);
  return out;
}

// ── keys ───────────────────────────────────────────────────────────────────

/**
 * One keyboard, a stack of listeners: only the top one hears the keys. The
 * menu sits at the bottom; the game pushes itself on top while it runs.
 */
export function createKeyboard(stdin = process.stdin) {
  const stack = [];
  const onKey = (str, key = {}) => {
    const name = key.ctrl && key.name === "c" ? "ctrl-c" : key.name || str || "";
    stack.at(-1)?.(name);
  };
  readline.emitKeypressEvents(stdin);
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.resume();
  stdin.on("keypress", onKey);
  return {
    push: (handler) => stack.push(handler),
    pop: () => stack.pop(),
    close: () => {
      stdin.off("keypress", onKey);
      if (stdin.isTTY) stdin.setRawMode(false);
      stdin.pause();
    },
  };
}

// ── the outside world ──────────────────────────────────────────────────────

/** Opens a link with the system's default app. Returns false if it could not. */
export function openUrl(url) {
  if (process.env.CARD_DRY_RUN) return true; // used by the tests
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [url]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** Puts a text in the system clipboard. Returns false where there is no tool for it. */
export function copyText(text) {
  if (process.env.CARD_DRY_RUN) return true; // used by the tests
  const tools =
    process.platform === "darwin"
      ? [["pbcopy", []]]
      : process.platform === "win32"
        ? [["clip", []]]
        : [["wl-copy", []], ["xclip", ["-selection", "clipboard"]], ["xsel", ["--clipboard", "--input"]]];
  for (const [cmd, args] of tools) {
    try {
      if (spawnSync(cmd, args, { input: text, stdio: ["pipe", "ignore", "ignore"], timeout: 1500 }).status === 0) return true;
    } catch {
      // not installed: try the next one
    }
  }
  return false;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
