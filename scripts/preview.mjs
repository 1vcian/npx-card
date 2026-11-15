// Draws the pictures used in the README: `npm run preview`.
//
// The same lines the terminal gets are turned into SVG, so the pictures cannot
// drift from the real thing. Block and box characters are drawn as shapes
// instead of text: fonts disagree on their size, shapes do not.

import { writeFileSync } from "node:fs";
import { frame, newGame } from "../lib/game.js";
import { profile } from "../lib/profile.js";
import { cardLines, menuLines } from "../lib/render.js";
import { PALETTE, s } from "../lib/term.js";
import { fly } from "./pilot.js";

const CELL = { w: 9, h: 20 };
const FONT = 15;
const PAD = 22;
const BAR = 38;
const SHADOW = 9;
const SCREEN = "#0a0e27";
const INK = "#fff5dc";
const cap = { tty: true, depth: 24, color: true, unicode: true, links: false, columns: 80, rows: 30 };

const BLOCKS = { "█": [0, 1], "▀": [0, 0.5], "▄": [0.5, 1] };
// which sides of the cell a line character reaches: up, right, down, left
const STROKES = {
  "━": [0, 1, 0, 1, 2.6], "┃": [1, 0, 1, 0, 2.6], "┏": [0, 1, 1, 0, 2.6], "┓": [0, 0, 1, 1, 2.6], "┗": [1, 1, 0, 0, 2.6], "┛": [1, 0, 0, 1, 2.6],
  "─": [0, 1, 0, 1, 1.3], "│": [1, 0, 1, 0, 1.3], "┌": [0, 1, 1, 0, 1.3], "┐": [0, 0, 1, 1, 1.3], "└": [1, 1, 0, 0, 1.3], "┘": [1, 0, 0, 1, 1.3],
};

const colour = (span) => (span.c ? `rgb(${PALETTE[span.c].rgb.join(",")})` : "#c9d1e6");
const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (value) => Number(value.toFixed(2));

function draw(lines) {
  const shapes = [];
  lines.forEach((line, row) => {
    const top = row * CELL.h;
    let column = 0;
    for (const span of line) {
      const fill = colour(span);
      const opacity = span.d ? ' opacity="0.62"' : "";
      let word = "";
      let wordAt = 0;
      let block = null; // a run of the same block character becomes one rectangle, so no seams show
      const flush = () => {
        if (block) {
          const [from, to] = BLOCKS[block.ch];
          shapes.push(`<rect x="${block.at * CELL.w}" y="${n(top + from * CELL.h)}" width="${block.size * CELL.w + 0.4}" height="${n((to - from) * CELL.h + 0.4)}" fill="${fill}"/>`);
          block = null;
        }
        if (!word) return;
        const size = [...word].length;
        shapes.push(
          `<text x="${wordAt * CELL.w}" y="${top + 14.5}" fill="${fill}"${opacity}${span.b ? ' font-weight="700"' : ""}${size > 1 ? ` textLength="${size * CELL.w}" lengthAdjust="spacingAndGlyphs"` : ""}>${escape(word)}</text>`
        );
        word = "";
      };
      for (const ch of span.t) {
        const x = column * CELL.w;
        if (BLOCKS[ch]) {
          if (block?.ch !== ch) {
            flush();
            block = { ch, at: column, size: 0 };
          }
          block.size++;
        } else if (STROKES[ch]) {
          flush();
          const [up, right, down, left, weight] = STROKES[ch];
          const cx = x + CELL.w / 2;
          const cy = top + CELL.h / 2;
          const path = [up && `M${cx} ${cy}V${top}`, right && `M${cx} ${cy}H${x + CELL.w}`, down && `M${cx} ${cy}V${top + CELL.h}`, left && `M${cx} ${cy}H${x}`].filter(Boolean).join("");
          shapes.push(`<path d="${path}" stroke="${fill}" stroke-width="${weight}" stroke-linecap="square" fill="none"/>`);
        } else if (ch === " ") {
          flush();
        } else {
          if (block) flush();
          if (!word) wordAt = column;
          word += ch;
        }
        column++;
      }
      flush();
    }
  });
  return shapes.join("\n");
}

/** A terminal window around some lines. */
function terminal(lines, { title, label }) {
  const columns = Math.max(...lines.map((line) => line.reduce((sum, span) => sum + [...span.t].length, 0)));
  const width = columns * CELL.w + PAD * 2;
  const height = BAR + lines.length * CELL.h + PAD * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + SHADOW + 4} ${height + SHADOW + 4}" width="${width + SHADOW + 4}" role="img" aria-label="${escape(label)}">
<title>${escape(label)}</title>
<rect x="${SHADOW + 2}" y="${SHADOW + 2}" width="${width}" height="${height}" rx="14" fill="rgb(${PALETTE.amber.rgb.join(",")})"/>
<rect x="2" y="2" width="${width}" height="${height}" rx="14" fill="${SCREEN}" stroke="${INK}" stroke-width="3"/>
<path d="M2 ${BAR + 2}H${width + 2}" stroke="${INK}" stroke-width="3"/>
<circle cx="28" cy="${BAR / 2 + 2}" r="6.5" fill="rgb(${PALETTE.red.rgb.join(",")})"/>
<circle cx="50" cy="${BAR / 2 + 2}" r="6.5" fill="rgb(${PALETTE.amber.rgb.join(",")})"/>
<circle cx="72" cy="${BAR / 2 + 2}" r="6.5" fill="rgb(${PALETTE.green.rgb.join(",")})"/>
<g font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace" font-size="${FONT}">
<text x="${width / 2 + 2}" y="${BAR / 2 + 7}" fill="${INK}" opacity="0.7" text-anchor="middle">${escape(title)}</text>
<g transform="translate(${PAD + 2} ${BAR + PAD + 2})">
${draw(lines)}
</g>
</g>
</svg>
`;
}

const prompt = (command) => [s("$ ", { c: "gray" }), s(command, { c: "cream", b: true })];

// 1. the card, as it looks right after `npx 1vcian`
const cardPicture = terminal([prompt("npx 1vcian"), [], ...cardLines(profile, cap), [], ...menuLines(profile.actions, 0, cap)], {
  title: "npx 1vcian",
  label: `${profile.name}'s business card in a terminal, with a menu under it`,
});
writeFileSync(new URL("../preview.svg", import.meta.url), cardPicture);

// 2. the hidden game, a few hundred kilometres into a run flown by the autopilot
const game = newGame(14);
while (game.tick < 330 || game.flash) fly(game, { greedy: true });
const gamePicture = terminal(frame(game, cap, { phase: "run", best: 512, back: "back to the card" }), {
  title: "ORBIT RUN",
  label: "The game hidden in the card: a satellite dodging debris along seven orbit lanes",
});
writeFileSync(new URL("../game.svg", import.meta.url), gamePicture);

console.log("wrote preview.svg and game.svg");
