// ORBIT RUN, the game hidden in the card.
//
// You fly a satellite along the orbit lanes. Debris comes in from the right in
// waves; packets (+) are worth catching. It gets faster the longer you last.
//
// The first half of this file is the game itself: plain data in, plain data
// out, no terminal, so it can be tested. The second half draws it and listens
// to the keyboard.

import { s, toAnsi } from "./term.js";

export const LANES = 7;
export const SHIP = "=<o>=";
export const WRECK = "-x*x-";
export const SHIP_X = 3;
export const PACKET_POINTS = 25;
const DEBRIS = ["#", "@", "%", "&", "*"];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** A small seeded random generator, so a seed always gives the same run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newGame(seed = Date.now(), width = 60) {
  const middle = Math.floor(LANES / 2);
  return {
    seed,
    width,
    rand: mulberry32(seed),
    tick: 0,
    lane: middle,
    safe: middle, // the lane the next wave is guaranteed to leave open
    things: [], // { x, lane, kind: "rock" | "packet", glyph }
    untilWave: 8,
    score: 0,
    packets: 0,
    flash: 0, // ticks left of the glow after catching a packet
    alive: true,
  };
}

/** 0 to 9: goes up every 120 ticks. */
export const level = (st) => Math.min(9, Math.floor(st.tick / 120));

/** Milliseconds between ticks: 96 at the start, 42 at full speed. */
export const delay = (st) => 96 - level(st) * 6;

/** Columns between one wave and the next. Never less than two ship lengths. */
const gap = (st) => 14 - Math.floor(level(st) / 2);

/** Lanes a wave fills: 3 of 7 at the start, 5 at full speed. Two always stay open. */
const blockedLanes = (st) => Math.min(LANES - 2, 3 + Math.floor(level(st) / 3));

function spawnWave(st) {
  // The open lane drifts by one at most, so there is always a way through
  // that needs a single move per wave.
  st.safe = clamp(st.safe + Math.floor(st.rand() * 3) - 1, 0, LANES - 1);

  const others = [];
  for (let lane = 0; lane < LANES; lane++) if (lane !== st.safe) others.push(lane);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(st.rand() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const blocked = blockedLanes(st);
  for (const lane of others.slice(0, blocked)) {
    st.things.push({ x: st.width - 1, lane, kind: "rock", glyph: DEBRIS[Math.floor(st.rand() * DEBRIS.length)] });
  }

  // Now and then a packet trails the wave, in a lane the wave left open.
  if (st.rand() < 0.5) {
    const open = [st.safe, ...others.slice(blocked)];
    const lane = open[Math.floor(st.rand() * open.length)];
    st.things.push({ x: st.width + 5, lane, kind: "packet", glyph: "+" });
  }
}

function collide(st) {
  for (const thing of st.things) {
    if (thing.lane !== st.lane || thing.x < SHIP_X || thing.x >= SHIP_X + SHIP.length) continue;
    if (thing.kind === "packet") {
      thing.x = -1;
      st.packets++;
      st.score += PACKET_POINTS;
      st.flash = 5;
    } else {
      st.alive = false;
    }
  }
  st.things = st.things.filter((thing) => thing.x >= 0);
}

/** One tick: everything slides one column to the left. */
export function step(st) {
  if (!st.alive) return st;
  st.tick++;
  st.score++;
  if (st.flash) st.flash--;
  for (const thing of st.things) thing.x--;
  if (--st.untilWave <= 0) {
    spawnWave(st);
    st.untilWave = gap(st);
  }
  collide(st);
  return st;
}

/** Move the satellite one lane up (-1) or down (+1). */
export function move(st, direction) {
  if (!st.alive) return st;
  st.lane = clamp(st.lane + direction, 0, LANES - 1);
  collide(st);
  return st;
}

/** What mission control has to say about a run: one or two short lines. */
export function verdict(score, contact) {
  if (score < 150) return ["The debris sends its regards."];
  if (score < 400) return ["Mission control stopped sighing."];
  if (score < 800) return ["Sentinel-2 is taking notes."];
  return ["You should be flying the real thing.", `Write me: ${contact}`];
}

// ── drawing ────────────────────────────────────────────────────────────────

const STYLES = {
  star: { c: "gray", d: true },
  rock: { c: "red", b: true },
  packet: { c: "green", b: true },
  ship: { c: "amber", b: true },
  glow: { c: "green", b: true },
  wreck: { c: "red", b: true },
};

// A fixed starfield, sampled with an offset so it drifts at half speed.
const isStar = (lane, column) => {
  let h = Math.imul(lane + 1, 0x9e3779b1) ^ Math.imul(column + 1, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) % 43 === 0;
};

/**
 * One frame, as lines of styled text.
 * view: { phase: "ready" | "run" | "over", paused, best, back, contact }
 */
export function frame(st, cap, view = {}) {
  const { phase = "run", paused = false, best = 0, back = "quit", contact = "" } = view;
  const width = st.width;
  const empty = {};
  const cells = Array.from({ length: LANES }, () => Array.from({ length: width }, () => [" ", empty]));

  const drift = st.tick >> 1;
  for (let lane = 0; lane < LANES; lane++) {
    for (let x = 0; x < width; x++) if (isStar(lane, x + drift)) cells[lane][x] = [".", STYLES.star];
  }
  for (const thing of st.things) {
    if (thing.x < width) cells[thing.lane][thing.x] = [thing.glyph, STYLES[thing.kind]];
  }
  const sprite = st.alive ? SHIP : WRECK;
  const shipStyle = st.alive ? (st.flash ? STYLES.glow : STYLES.ship) : STYLES.wreck;
  [...sprite].forEach((ch, i) => (cells[st.lane][SHIP_X + i] = [ch, shipStyle]));

  // Messages are written over the middle of the field, leaving the rest in view.
  const dot = cap.unicode ? "·" : "-";
  const arrows = cap.unicode ? "↑ ↓" : "up/down";
  const say = (row, ...spans) => {
    const text = [s("  "), ...spans, s("  ")];
    const length = text.reduce((n, span) => n + [...span.t].length, 0);
    let x = Math.max(0, Math.floor((width - length) / 2));
    for (const span of text) for (const ch of span.t) if (x < width) cells[row][x++] = [ch, span];
  };
  if (phase === "ready") {
    say(1, s("O R B I T   R U N", { c: "amber", b: true }));
    say(2, s("Dodge the debris. Catch the packets ", { c: "cream" }), s("+", { c: "green", b: true }));
    say(5, s("press any key to launch", { c: "gray" }));
  } else if (phase === "over") {
    say(1, s("S I G N A L   L O S T", { c: "red", b: true }));
    say(2, s(`${st.score} km flown  ${dot}  ${st.packets} ${st.packets === 1 ? "packet" : "packets"} caught`, { c: "cream" }));
    verdict(st.score, contact).forEach((line, i) => say(3 + i, s(line, { c: "amber" })));
    say(5, s("r", { c: "cream", b: true }), s(" fly again    ", { c: "gray" }), s("q", { c: "cream", b: true }), s(` ${back}`, { c: "gray" }));
  } else if (paused) {
    say(3, s("P A U S E D", { c: "amber", b: true }), s("   p to resume", { c: "gray" }));
  }

  // runs of cells with the same style become one span
  const rows = cells.map((row) => {
    const line = [];
    let lastStyle;
    for (const [ch, style] of row) {
      if (line.length && lastStyle === style) line.at(-1).t += ch;
      else line.push({ ...style, t: ch });
      lastStyle = style;
    }
    return line;
  });

  const b = cap.unicode ? { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" } : { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" };
  const edge = (text) => s(text, { c: "gray" });
  const title = " ORBIT RUN";
  const number = (n) => String(n).padStart(4, "0");
  // the longest wording that fits: a narrow field gets the short one
  const fit = (room, ...wordings) => wordings.find((text) => [...text].length <= room) ?? wordings.at(-1);
  const stats = fit(
    width + 1 - title.length,
    `km ${number(st.score)}  ${dot}  packets ${st.packets}  ${dot}  best ${number(Math.max(best, st.score))} `,
    `km ${number(st.score)}  ${dot}  packets ${st.packets} `
  );
  const keys = fit(width + 2, ` ${arrows} change orbit   p pause   q ${back}`, ` ${arrows} move   p pause   q quit`);

  return [
    [s(title, { c: "amber", b: true }), s(" ".repeat(Math.max(1, width + 2 - title.length - stats.length))), s(stats, { c: "cream" })],
    [edge(b.tl + b.h.repeat(width) + b.tr)],
    ...rows.map((row) => [edge(b.v), ...row, edge(b.v)]),
    [edge(b.bl + b.h.repeat(width) + b.br)],
    [s(keys, { c: "gray", d: true })],
  ];
}

// ── running it in a terminal ───────────────────────────────────────────────

export const MIN_COLUMNS = 44;
export const MIN_ROWS = LANES + 5;

/**
 * Plays until the player leaves. Resolves with { best } (the best run of the
 * session), { tooSmall: true } if the window cannot fit the field, and
 * abort: true if the player left with ctrl-c.
 */
export function playGame({ keyboard, cap, out = process.stdout, seed = Date.now(), back = "quit", contact = "" }) {
  if (cap.columns < MIN_COLUMNS || cap.rows < MIN_ROWS) return Promise.resolve({ tooSmall: true, best: 0 });
  const width = Math.min(60, cap.columns - 4);

  let st = newGame(seed, width);
  let runs = 0;
  let phase = "ready";
  let paused = false;
  let best = 0;
  let timer;

  // Each frame is drawn over the last one, in the middle of the window. Lines
  // are cleared as they are rewritten, never the whole screen, so nothing flickers.
  const draw = () => {
    const lines = frame(st, cap, { phase, paused, best, back, contact });
    const columns = out.columns || cap.columns;
    const rows = out.rows || cap.rows;
    const left = " ".repeat(Math.max(0, Math.floor((columns - width - 2) / 2)));
    const above = Array(Math.max(0, Math.floor((rows - lines.length) / 2))).fill("");
    out.write(`\x1b[H${[...above, ...lines.map((line) => left + toAnsi(line, cap))].join("\x1b[K\n")}\x1b[K\x1b[J`);
  };

  const tick = () => {
    step(st);
    if (!st.alive) {
      phase = "over";
      best = Math.max(best, st.score);
    } else {
      timer = setTimeout(tick, delay(st));
    }
    draw();
  };

  const launch = () => {
    if (phase === "over") st = newGame(seed + ++runs, width);
    phase = "run";
    paused = false;
    draw();
    timer = setTimeout(tick, delay(st));
  };

  return new Promise((resolve) => {
    const leave = (abort) => {
      clearTimeout(timer);
      best = Math.max(best, st.score);
      out.off("resize", draw);
      keyboard.pop();
      out.write("\x1b[?1049l"); // back to the screen the card was on
      resolve({ best, abort });
    };

    keyboard.push((key) => {
      if (key === "ctrl-c") return leave(true);
      if (key === "q" || key === "escape") return leave(false);
      if (phase === "ready") return launch();
      if (phase === "over") {
        if (key === "r" || key === "return" || key === "space") launch();
        return;
      }
      if (key === "p") {
        paused = !paused;
        clearTimeout(timer);
        if (!paused) timer = setTimeout(tick, delay(st));
        return draw();
      }
      if (paused) return;
      if (key === "up" || key === "w" || key === "k") move(st, -1);
      else if (key === "down" || key === "s" || key === "j") move(st, 1);
      else return;
      if (!st.alive) {
        clearTimeout(timer);
        phase = "over";
        best = Math.max(best, st.score);
      }
      draw();
    });

    out.on("resize", draw);
    out.write("\x1b[?1049h\x1b[?25l"); // a separate screen, so the card is still there afterwards
    draw();
  });
}
