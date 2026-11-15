// Turns the profile into lines of styled text: the card and the menu under it.

import { box, pad, s } from "./term.js";

/** Columns inside the box. The whole card is this plus 4 (borders and shadow). */
export const INNER = 70;
export const OUTER = INNER + 4;
const MARGIN = 3;
const LABEL = 8;

export const KONAMI = ["up", "up", "down", "down", "left", "right", "left", "right", "b", "a"];

const size = (text) => [...text].length;

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
    rows.push([indent, s((logo[i] ?? "").padEnd(logoWidth), { c: "amber", b: true }), s("   "), ...(head[i] ?? [])]);
  }
  rows.push(...blank, ...factRows(p.facts));
  const making = p.building.flatMap((name, i) => [...(i ? [s(`  ${dot}  `, { c: "gray" })] : []), s(name, { c: "cream", b: true })]);
  rows.push([indent, s("making".padEnd(LABEL), { c: "gray" }), ...making], ...blank);

  return box(rows, INNER, cap).map((line) => [s("  "), ...line]);
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

/** Where the hidden game is. Shown under the menu until something else needs the line. */
export const hint = (cap) => [s(cap.unicode ? "psst:  ↑ ↑ ↓ ↓ ← → ← → b a" : "psst:  up up down down left right left right b a", { c: "gray", d: true })];

/** The menu, with one row selected and a line of notes (the hint, by default) underneath. */
export function menuLines(actions, selected, cap, note) {
  const pointer = cap.unicode ? "❯" : ">";
  const keys = cap.unicode ? "↑ ↓ move  ·  enter open  ·  q quit" : "up/down move  -  enter open  -  q quit";
  const title = "What next?";
  const wide = cap.columns >= OUTER + 2;
  const labelWidth = Math.max(...actions.map((a) => size(a.label))) + 3;

  const out = [
    wide
      ? [s("  "), s(title, { c: "cream", b: true }), s(" ".repeat(OUTER - size(title) - size(keys))), s(keys, { c: "gray", d: true })]
      : [s(title, { c: "cream", b: true })],
  ];
  actions.forEach((action, i) => {
    const on = i === selected;
    out.push([
      s(on ? `  ${pointer} ` : "    ", { c: "amber", b: true }),
      s(action.label.padEnd(labelWidth), on ? { c: "amber", b: true } : { c: "cream" }),
      ...(wide ? [s(action.hint, { c: "gray", d: !on })] : []),
    ]);
  });
  out.push([s(wide ? "  " : ""), ...(note ?? hint(cap))]);
  return out;
}

/** True when the last keys pressed spell the Konami code. */
export const isKonami = (keys) => keys.length >= KONAMI.length && KONAMI.every((key, i) => keys[keys.length - KONAMI.length + i] === key);
