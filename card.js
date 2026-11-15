#!/usr/bin/env node
// A business card for the terminal: `npx 1vcian`.
// To make it yours, edit lib/profile.js.

import { readFileSync } from "node:fs";
import { profile } from "./lib/profile.js";
import { OUTER, cardLines, compactLines, isKonami, KONAMI, menuLines } from "./lib/render.js";
import { MIN_COLUMNS, MIN_ROWS, playGame } from "./lib/game.js";
import { clip, createKeyboard, detect, openUrl, s, sleep, toAnsi } from "./lib/term.js";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const out = process.stdout;
const argv = process.argv.slice(2);
const has = (...names) => names.some((name) => argv.includes(name));
const seedAt = argv.indexOf("--seed");
const seed = seedAt >= 0 && /^\d+$/.test(argv[seedAt + 1] ?? "") ? Number(argv[seedAt + 1]) : undefined;

const FLAGS = ["--static", "--json", "--plain", "--ascii", "--play", "--seed", "--help", "-h", "--version", "-v"];
const unknown = argv.find((arg, i) => !FLAGS.includes(arg) && !(i === seedAt + 1 && seedAt >= 0));

const help = `${pkg.name}: ${profile.name}'s business card, for the terminal

  npx ${pkg.name}             the card, with a menu
  npx ${pkg.name} --static    just the card
  npx ${pkg.name} --json      the same facts, for scripts
  npx ${pkg.name} --plain     no colours
  npx ${pkg.name} --ascii     no fancy characters
  npx ${pkg.name} --version

There is a game hidden in here. The card tells you how to find it.
`;

const card = (cap) => (cap.columns >= OUTER + 2 ? cardLines(profile, cap, { tight: cap.tty && cap.rows < 24 }) : compactLines(profile, cap));
// On a terminal a line is cut at the window's edge: one that wraps would break redrawing.
const show = (line, cap) => toAnsi(cap.tty ? clip(line, cap.columns - 1) : line, cap);

async function menu(cap) {
  const keyboard = createKeyboard();
  const recent = [];
  let selected = 0;
  let note;
  let drawn = 0;
  let busy = false;
  const wide = cap.columns >= OUTER + 2;

  const paint = () => {
    const lines = menuLines(profile.actions, selected, cap, note);
    if (drawn > 1) out.write(`\x1b[${drawn - 1}A`);
    out.write(`\r${lines.map((line) => `\x1b[2K${show(line, cap)}`).join("\n")}`);
    drawn = lines.length;
  };

  const quit = () => {
    // the menu makes way for the goodbye; the card stays in the scrollback
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
    paint();
  };

  keyboard.push((key) => {
    if (busy) return;
    recent.push(key);
    if (recent.length > KONAMI.length) recent.shift();
    if (isKonami(recent)) {
      recent.length = 0;
      return play();
    }

    const count = profile.actions.length;
    if (key === "up" || key === "k") selected = (selected + count - 1) % count;
    else if (key === "down" || key === "j" || key === "tab") selected = (selected + 1) % count;
    else if (key === "return" || key === "space") {
      const { url } = profile.actions[selected];
      openUrl(url);
      // the address is always shown: on a server there is no browser to open
      note = [s("Opening ", { c: "green" }), s(url.replace(/^mailto:/, ""), { c: "blue", link: url })];
    } else if (key === "q" || key === "escape" || key === "ctrl-c") return quit();
    else return;
    paint();
  });

  paint();
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

  if (cap.rows > 24) out.write("\n");
  for (const line of card(cap)) {
    out.write(`${show(line, cap)}\n`);
    await sleep(14);
  }
  out.write("\n");
  await menu(cap);
}

main();
