#!/usr/bin/env node
// A business card for the terminal: `npx 1vcian`.
// To make it yours, edit lib/profile.js.

import { readFileSync } from "node:fs";
import { profile } from "./lib/profile.js";
import { KONAMI, OUTER, cardLines, compactLines, isKonami, liveCard, menuLines, moveSelection, wipe } from "./lib/render.js";
import { MIN_COLUMNS, MIN_ROWS, playGame } from "./lib/game.js";
import { clip, copyText, createKeyboard, detect, openUrl, s, sleep, toAnsi } from "./lib/term.js";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const out = process.stdout;
const argv = process.argv.slice(2);
const has = (...names) => names.some((name) => argv.includes(name));
const seedAt = argv.indexOf("--seed");
const seed = seedAt >= 0 && /^\d+$/.test(argv[seedAt + 1] ?? "") ? Number(argv[seedAt + 1]) : undefined;

const FLAGS = ["--static", "--still", "--json", "--plain", "--ascii", "--play", "--seed", "--help", "-h", "--version", "-v"];
const unknown = argv.find((arg, i) => !FLAGS.includes(arg) && !(i === seedAt + 1 && seedAt >= 0));

const help = `${pkg.name}: ${profile.name}'s business card, for the terminal

  npx ${pkg.name}             the card, with a menu
  npx ${pkg.name} --play      straight to the game
  npx ${pkg.name} --static    just the card
  npx ${pkg.name} --still     the menu, without the animations
  npx ${pkg.name} --json      the same facts, for scripts
  npx ${pkg.name} --plain     no colours
  npx ${pkg.name} --ascii     no fancy characters
  npx ${pkg.name} --version
`;

const VIM = { k: "up", j: "down", h: "left", l: "right" };
const TICK_MS = 80;

const isBoxed = (cap) => cap.columns >= OUTER + 2;
const card = (cap) => (isBoxed(cap) ? cardLines(profile, cap, { tight: cap.tty && cap.rows < 24 }) : compactLines(profile, cap));
// On a terminal a line is cut at the window's edge: one that wraps would break redrawing.
const show = (line, cap) => toAnsi(cap.tty ? clip(line, cap.columns - 1) : line, cap);

/** The card with its menu: everything that happens after `npx 1vcian` in a terminal. */
async function app(cap) {
  const base = card(cap);
  const wide = isBoxed(cap);
  const tallest = menuLines(profile.actions, 0, cap).length;
  // The animations redraw lines above the cursor, so the whole card has to be on screen.
  const fits = () => cap.rows >= base.length + 1 + tallest;
  const lively = wide && cap.color && !has("--still");

  // ── the card wipes in ──
  if (cap.rows > 24) out.write("\n");
  if (lively && fits()) {
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      if (i) out.write(`\x1b[${base.length}A`);
      out.write(`${wipe(base, Math.round((i / steps) * (OUTER + 2))).map((line) => `\r${toAnsi(line, cap)}`).join("\n")}\n`);
      await sleep(20);
    }
  } else {
    out.write(`${base.map((line) => show(line, cap)).join("\n")}\n`);
  }
  out.write("\n");

  // ── then waits for you ──
  const keyboard = createKeyboard();
  const recent = [];
  let selected = 0;
  let note;
  let drawn = 0;
  let tick = 0;
  let busy = false;
  let timer;

  const paintArea = () => {
    const lines = menuLines(profile.actions, selected, cap, note);
    if (drawn > 1) out.write(`\x1b[${drawn - 1}A`);
    out.write(`\r${lines.map((line) => `\x1b[2K${show(line, cap)}`).join("\n")}\x1b[J`);
    drawn = lines.length;
  };

  // The cursor rests on the last line of the menu: the card starts base.length + drawn lines above it.
  const paintCard = (lines) => out.write(`\x1b7\x1b[${base.length + drawn}A\r${lines.map((line) => toAnsi(line, cap)).join("\n")}\x1b8`);
  const animate = () => {
    if (!busy && fits()) paintCard(liveCard(base, ++tick));
  };

  const quit = () => {
    clearInterval(timer);
    if (lively && fits()) paintCard(base); // leave the card clean in the scrollback
    if (drawn > 1) out.write(`\x1b[${drawn - 1}A`);
    out.write(`\r\x1b[J${show([s(wide ? "  " : ""), s(profile.bye, { c: "amber", b: true })], cap)}\n\n`);
    keyboard.close();
  };

  const play = async () => {
    busy = true;
    const result = await playGame({ keyboard, cap: detect(argv), out, seed, back: "back to the card", contact: profile.contact });
    busy = false;
    if (result.abort) return quit();
    if (result.tooSmall) note = [s(`Too small for the game: needs ${MIN_COLUMNS} x ${MIN_ROWS}`, { c: "red" })];
    else note = [s(result.best ? `Welcome back. Best run: ${result.best} km.` : "Welcome back.", { c: "green" })];
    paintArea();
  };

  const choose = (action) => {
    if (action.run === "game") return play();
    openUrl(action.url);
    // the address is always shown: on a server there is no browser to open
    note = [s("Opening ", { c: "green" }), s(action.url.replace(/^mailto:/, ""), { c: "blue", link: action.url })];
    if (action.copy && copyText(action.copy)) note.push(s("  (copied to your clipboard too)", { c: "green" }));
    paintArea();
  };

  keyboard.push((pressed) => {
    if (busy) return;
    const key = VIM[pressed] ?? pressed;
    recent.push(pressed);
    if (recent.length > KONAMI.length) recent.shift();
    if (isKonami(recent)) {
      recent.length = 0;
      return play(); // the old way in still works
    }
    if (key === "ctrl-c") return quit();

    if (["up", "down", "left", "right", "tab"].includes(key)) {
      selected = moveSelection(selected, key, profile.actions.length);
      note = undefined;
    } else if (key === "return" || key === "space") return choose(profile.actions[selected]);
    else if (key === "q" || key === "escape") return quit();
    else return;
    paintArea();
  });

  out.on("resize", () => {
    cap.rows = out.rows || cap.rows;
    cap.columns = out.columns || cap.columns;
  });
  paintArea();
  if (lively) timer = setInterval(animate, TICK_MS);
}

async function main() {
  if (unknown) {
    process.stderr.write(`Unknown option: ${unknown}\n\n${help}`);
    process.exitCode = 1;
    return;
  }
  if (has("--help", "-h")) return void out.write(help);
  if (has("--version", "-v")) return void out.write(`${pkg.version}\n`);
  if (has("--json")) {
    const { name, title, place, pitch, facts, building } = profile;
    const links = Object.fromEntries(facts.map(([label, shown, link]) => [label, link || shown]));
    return void out.write(`${JSON.stringify({ name, title, place, pitch, links, building, card: `npx ${pkg.name}` }, null, 2)}\n`);
  }

  const cap = detect(argv);
  const interactive = cap.tty && Boolean(process.stdin.isTTY) && !has("--static");

  if (has("--play")) {
    if (!interactive) {
      process.stderr.write("The game needs a real terminal.\n");
      process.exitCode = 1;
      return;
    }
    process.on("exit", () => out.write("\x1b[?25h"));
    const keyboard = createKeyboard();
    const result = await playGame({ keyboard, cap, out, seed, contact: profile.contact });
    keyboard.close();
    if (result.tooSmall) out.write(`The game needs a window of at least ${MIN_COLUMNS} by ${MIN_ROWS}.\n`);
    return;
  }

  if (!interactive) return void out.write(`${card(cap).map((line) => show(line, cap)).join("\n")}\n`);

  // hide the cursor while the menu is up, and always give it back
  out.write("\x1b[?25l");
  process.on("exit", () => out.write("\x1b[?25h"));
  await app(cap);
}

main();
