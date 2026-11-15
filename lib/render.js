// Turns the profile into lines of styled text: the card, the menu, the list
// of projects, and the small animations that keep the card alive.

import { box, pad, paint, s } from "./term.js";

/** Columns inside the box. The whole card is this plus 4 (borders and shadow). */
export const INNER = 70;
export const OUTER = INNER + 4;
const MARGIN = 3;
const LABEL = 8;
const INDENT = 2; // spaces before the box

export const KONAMI = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];

const size = (text) => [...text].length;
const isWide = (cap) => cap.columns >= OUTER + INDENT;

/** Greedy word wrap. */
export function wrap(text, width) {
  const lines = [""];
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1);
    if (last && size(last) + 1 + size(word) > width) lines.push(word);
    else lines[lines.length - 1] = last ? `${last} ${word}` : word;
  }
  return lines;
}

const fact = ([label, text, link]) => [s(label.padEnd(LABEL), { c: "gray" }), s(text, link ? { c: "blue", link } : { c: "cream" })];

/** Facts two per row when both columns fit, one per row otherwise. */
function factRows(facts) {
  const indent = s(" ".repeat(MARGIN));
  const left = facts.filter((_, i) => i % 2 === 0);
  const right = facts.filter((_, i) => i % 2 === 1);
  const leftWidth = Math.max(...left.map((f) => LABEL + size(f[1]))) + 3;
  const rightWidth = Math.max(0, ...right.map((f) => LABEL + size(f[1])));
  if (MARGIN + leftWidth + rightWidth > INNER - 2) return facts.map((f) => [indent, ...fact(f)]);
  return left.map((f, i) => [indent, ...pad(fact(f), leftWidth), ...(right[i] ? fact(right[i]) : [])]);
}

/** The card as it appears in a terminal wide enough for the box. `tight` drops the blank rows. */
export function cardLines(p, cap, { tight = false } = {}) {
  const logo = cap.unicode ? p.logo : p.logoAscii;
  const logoWidth = Math.max(...logo.map(size));
  const dot = cap.unicode ? "·" : "-";
  const indent = s(" ".repeat(MARGIN));
  const head = [
    [s(p.name, { c: "cream", b: true })],
    [s(p.title, { c: "amber", b: true }), s(`  ${dot}  ${p.place}`, { c: "gray" })],
    [],
    ...wrap(p.pitch, INNER - MARGIN - logoWidth - 3 - 2).map((line) => [s(line, { c: "cream" })]),
  ];

  const blank = tight ? [] : [[]];
  const rows = [...blank];
  for (let i = 0; i < Math.max(logo.length, head.length); i++) {
    rows.push([indent, s((logo[i] ?? "").padEnd(logoWidth), { c: "amber", b: true, logo: true }), s("   "), ...(head[i] ?? [])]);
  }
  rows.push(...blank, ...factRows(p.facts));
  const making = p.building.flatMap((name, i) => [...(i ? [s(`  ${dot}  `, { c: "gray" })] : []), s(name, { c: "cream", b: true })]);
  rows.push([indent, s("making".padEnd(LABEL), { c: "gray" }), ...making], ...blank);

  return box(rows, INNER, cap).map((line) => [s(" ".repeat(INDENT)), ...line]);
}

/** The same content with no box, for narrow terminals. */
export function compactLines(p, cap) {
  const width = Math.max(24, Math.min(cap.columns, 72) - 2);
  return [
    [s(p.name, { c: "cream", b: true })],
    [s(p.title, { c: "amber", b: true }), s(`, ${p.place}`, { c: "gray" })],
    [],
    ...wrap(p.pitch, width).map((line) => [s(line, { c: "cream" })]),
    [],
    ...p.facts.map(fact),
    ...wrap(p.building.join(", "), width - LABEL).map((line, i) => [s((i ? "" : "making").padEnd(LABEL), { c: "gray" }), s(line, { c: "cream" })]),
  ];
}

// ── the card, alive ────────────────────────────────────────────────────────

const COMET = { c: "amber", b: true };
const SHINE = { c: "cream", b: true };
const HIDDEN = { blank: true };
const COMET_LENGTH = 9;
const SHINE_EVERY = 64; // ticks between two glints on the logo

/** The cells of the frame, clockwise from the top left corner, as [row, column]. */
function frameCells(height) {
  const left = INDENT;
  const right = INDENT + INNER + 1;
  const bottom = height - 2; // the last line is the shadow
  const cells = [];
  for (let c = left; c <= right; c++) cells.push([0, c]);
  for (let r = 1; r < bottom; r++) cells.push([r, right]);
  for (let c = right; c >= left; c--) cells.push([bottom, c]);
  for (let r = bottom - 1; r > 0; r--) cells.push([r, left]);
  return cells;
}

/**
 * The boxed card at one moment in time: a comet runs around the frame and,
 * now and then, a glint crosses the logo.
 */
export function liveCard(lines, tick) {
  const frame = frameCells(lines.length);
  const head = (tick * 2) % frame.length;
  const comet = new Set();
  for (let i = 0; i < COMET_LENGTH; i++) comet.add(frame[(head - i + frame.length) % frame.length].join());
  const glint = (tick % SHINE_EVERY) * 1.5 - 4; // moves left to right, then waits off the logo

  return paint(lines, (row, column, ch, span) => {
    if (comet.has(`${row},${column}`)) return COMET;
    if (span.logo && ch !== " " && Math.abs(column - INDENT - 1 - MARGIN + row * 0.8 - glint) < 1.6) return SHINE;
    return undefined;
  });
}

/** The card with only its first `shown` columns visible: the way it wipes in at the start. */
export const wipe = (lines, shown) => paint(lines, (_row, column) => (column >= shown ? HIDDEN : undefined));

// ── the menu ───────────────────────────────────────────────────────────────

const POINTER = (cap) => (cap.unicode ? "❯" : ">");

/** Arrow keys on a menu laid out in two columns, first half on the left. */
export function moveSelection(selected, key, count) {
  const half = Math.ceil(count / 2);
  const column = selected < half ? 0 : 1;
  const row = selected - column * half;
  const inColumn = column ? count - half : half;
  if (key === "up") return column * half + ((row + inColumn - 1) % inColumn);
  if (key === "down") return column * half + ((row + 1) % inColumn);
  if (key === "left" || key === "right") return Math.min(count - 1, (1 - column) * half + row);
  if (key === "tab") return (selected + 1) % count;
  return selected;
}

/** The menu: two columns of things to do, and under them a line about the one selected. */
export function menuLines(actions, selected, cap, note) {
  const wide = isWide(cap);
  const arrows = cap.unicode ? "↑ ↓ ← →" : "arrows";
  const dot = cap.unicode ? "·" : "-";
  const keys = `${arrows} move  ${dot}  enter choose  ${dot}  q quit`;
  const title = "What next?";
  const entry = (action, on, width) => [
    s(on ? `  ${POINTER(cap)} ` : "    ", { c: "amber", b: true }),
    s(action.label.padEnd(width), on ? { c: "amber", b: true } : { c: "cream" }),
  ];

  const out = [];
  if (wide) {
    out.push([s("  "), s(title, { c: "cream", b: true }), s(" ".repeat(OUTER - size(title) - size(keys))), s(keys, { c: "gray", d: true })]);
    const half = Math.ceil(actions.length / 2);
    for (let row = 0; row < half; row++) {
      const right = actions[row + half];
      out.push([...entry(actions[row], row === selected, 32), ...(right ? entry(right, row + half === selected, 28) : [])]);
    }
  } else {
    out.push([s(title, { c: "cream", b: true })]);
    actions.forEach((action, i) => out.push(entry(action, i === selected, size(action.label))));
  }
  out.push([s(wide ? "    " : ""), ...(note ?? [s(actions[selected].hint, { c: "gray" })])]);
  return out;
}

/** The list of projects, one selected, with its address underneath. */
export function projectLines(projects, selected, cap) {
  const wide = isWide(cap);
  const arrows = cap.unicode ? "↑ ↓" : "up/down";
  const dot = cap.unicode ? "·" : "-";
  const keys = `${arrows} move  ${dot}  enter open  ${dot}  esc back`;
  const title = "What I'm making";
  const nameWidth = Math.max(...projects.map((project) => size(project.name))) + 3;

  const out = [wide ? [s("  "), s(title, { c: "cream", b: true }), s(" ".repeat(OUTER - size(title) - size(keys))), s(keys, { c: "gray", d: true })] : [s(title, { c: "cream", b: true })]];
  projects.forEach((project, i) => {
    const on = i === selected;
    out.push([
      s(on ? `  ${POINTER(cap)} ` : "    ", { c: "amber", b: true }),
      s(project.name.padEnd(nameWidth), on ? { c: "amber", b: true } : { c: "cream", b: true }),
      ...(wide ? [s(project.what, on ? { c: "cream" } : { c: "gray" })] : []),
    ]);
  });
  const selectedProject = projects[selected];
  out.push([s(wide ? "    " : ""), s(selectedProject.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), { c: "blue", link: selectedProject.url })]);
  return out;
}

/** True when the last keys pressed spell the Konami code. */
export const isKonami = (keys) => keys.length >= KONAMI.length && KONAMI.every((key, i) => keys[keys.length - KONAMI.length + i] === key);
