import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { LANES, PACKET_POINTS, SHIP, SHIP_X, delay, frame, move, newGame, step, verdict } from "../lib/game.js";
import { profile } from "../lib/profile.js";
import { KONAMI, OUTER, cardLines, compactLines, isKonami, liveCard, menuLines, moveSelection, projectLines, wipe, wrap } from "../lib/render.js";
import { clip, lineWidth, toAnsi } from "../lib/term.js";
import { fly } from "../scripts/pilot.js";

const card = fileURLToPath(new URL("../card.js", import.meta.url));
const run = (...args) => execFileSync(process.execPath, [card, ...args], { encoding: "utf8" });

const fancy = { tty: true, depth: 24, color: true, unicode: true, links: true, columns: 80, rows: 30 };
const plain = { ...fancy, depth: 1, color: false, unicode: false, links: false };
const isAscii = (text) => [...text].every((ch) => ch.codePointAt(0) < 127);

// ── the card ───────────────────────────────────────────────────────────────

test("the boxed card is a clean rectangle that fits 80 columns", () => {
  for (const cap of [fancy, plain]) {
    for (const tight of [false, true]) {
      const widths = cardLines(profile, cap, { tight }).map(lineWidth);
      assert.ok(Math.max(...widths) <= 80);
      assert.deepEqual(new Set(widths.slice(1)), new Set([OUTER + 2]), "every row under the top border is equally wide");
    }
  }
});

test("the plain version uses nothing but ASCII", () => {
  const lines = [...cardLines(profile, plain), ...compactLines(profile, plain), ...menuLines(profile.actions, 0, plain), ...projectLines(profile.projects, 0, plain)];
  for (const line of lines) assert.ok(isAscii(toAnsi(line, plain)), toAnsi(line, plain));
  for (const phase of ["ready", "run", "over"]) {
    for (const line of frame(newGame(1), plain, { phase })) assert.ok(isAscii(toAnsi(line, plain)));
  }
});

test("the compact card fits a narrow window", () => {
  const cap = { ...fancy, columns: 40 };
  for (const line of compactLines(profile, cap)) assert.ok(lineWidth(line) <= 40, toAnsi(line, plain));
});

test("the menu has two columns, one entry marked, and a line about it underneath", () => {
  const text = (lines) => lines.map((line) => toAnsi(line, { ...plain, unicode: true }));
  const lines = text(menuLines(profile.actions, 6, fancy));
  assert.equal(lines.length, Math.ceil(profile.actions.length / 2) + 2);
  assert.equal(lines.join("\n").split("❯").length - 1, 1);
  assert.match(lines[3], /❯ Play ORBIT RUN/);
  assert.ok(lines.at(-1).includes(profile.actions[6].hint));
  for (const line of menuLines(profile.actions, 0, fancy)) assert.ok(lineWidth(line) <= 80);

  const narrow = text(menuLines(profile.actions, 0, { ...fancy, columns: 40 }));
  assert.equal(narrow.length, profile.actions.length + 2, "one column when the window is narrow");
});

test("arrows move around the two columns", () => {
  const count = 8; // 0-3 on the left, 4-7 on the right
  assert.equal(moveSelection(0, "down", count), 1);
  assert.equal(moveSelection(3, "down", count), 0);
  assert.equal(moveSelection(0, "up", count), 3);
  assert.equal(moveSelection(1, "right", count), 5);
  assert.equal(moveSelection(5, "left", count), 1);
  assert.equal(moveSelection(7, "down", count), 4);
  assert.equal(moveSelection(7, "tab", count), 0);
  assert.equal(moveSelection(3, "right", 7), 6, "an odd menu has a shorter right column");
  assert.equal(moveSelection(2, "x", count), 2);
});

test("the list of projects fits the card and shows where the selected one lives", () => {
  const lines = projectLines(profile.projects, 2, fancy);
  assert.equal(lines.length, profile.projects.length + 2);
  for (const line of lines) assert.ok(lineWidth(line) <= OUTER + 2, toAnsi(line, plain));
  assert.ok(toAnsi(lines.at(-1), plain).includes("im.center"));
});

test("the animations never change the shape of the card", () => {
  const base = cardLines(profile, fancy);
  const widths = base.map(lineWidth);
  for (const tick of [1, 17, 64, 65, 200, 1000]) assert.deepEqual(liveCard(base, tick).map(lineWidth), widths);
  for (const shown of [0, 30, 200]) assert.deepEqual(wipe(base, shown).map(lineWidth), widths);
  assert.equal(wipe(base, 0).map((line) => toAnsi(line, plain)).join("").trim(), "", "nothing shows before the wipe starts");
  assert.equal(wipe(base, 200).map((line) => toAnsi(line, plain)).join("\n"), base.map((line) => toAnsi(line, plain)).join("\n"));
  assert.notEqual(liveCard(base, 5).map((line) => toAnsi(line, fancy)).join(""), base.map((line) => toAnsi(line, fancy)).join(""), "the comet is on the frame");
});

test("links are clickable where the terminal allows, plain text elsewhere", () => {
  const withLinks = cardLines(profile, fancy).map((line) => toAnsi(line, fancy)).join("\n");
  assert.ok(withLinks.includes("\x1b]8;;https://1vcian.me\x1b\\"));
  assert.ok(!cardLines(profile, plain).map((line) => toAnsi(line, plain)).join("\n").includes("\x1b"));
});

test("wrap and clip respect the width", () => {
  for (const width of [12, 20, 45]) for (const line of wrap(profile.pitch, width)) assert.ok(line.length <= width);
  const line = menuLines(profile.actions, 0, fancy)[1];
  assert.equal(lineWidth(clip(line, 10)), 10);
  assert.equal(lineWidth(clip(line, 500)), lineWidth(line));
});

test("the Konami code is spotted at the end of what was typed, and only then", () => {
  assert.ok(isKonami(KONAMI));
  assert.ok(isKonami(["down", "q", ...KONAMI]));
  assert.ok(!isKonami(KONAMI.slice(1)));
  assert.ok(!isKonami([...KONAMI, "a"]));
});

// ── the command ────────────────────────────────────────────────────────────

test("piped, it prints the card with no escape codes", () => {
  const output = run();
  assert.ok(output.includes(profile.name));
  assert.ok(!output.includes("\x1b"));
});

test("--json gives the facts to scripts", () => {
  const data = JSON.parse(run("--json"));
  assert.equal(data.name, profile.name);
  assert.equal(data.links.web, "https://1vcian.me");
});

test("--version matches package.json, --help lists the game", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(run("--version").trim(), pkg.version);
  assert.match(run("--help"), /--play\s+straight to the game/);
});

test("an unknown option fails with the help", () => {
  assert.throws(() => execFileSync(process.execPath, [card, "--nope"], { encoding: "utf8", stdio: "pipe" }), /Unknown option: --nope/);
});

// ── the game ───────────────────────────────────────────────────────────────

const snapshot = (st) => JSON.stringify([st.tick, st.lane, st.score, st.things]);

test("a seed always gives the same run", () => {
  const a = newGame(42);
  const b = newGame(42);
  const c = newGame(43);
  for (let i = 0; i < 400; i++) [a, b, c].forEach((st) => fly(st));
  assert.equal(snapshot(a), snapshot(b));
  assert.notEqual(snapshot(a), snapshot(c));
});

test("every wave leaves at least two lanes open, and the promised one drifts by one at most", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const st = newGame(seed);
    let promised = st.safe;
    for (let i = 0; i < 3000; i++) {
      fly(st);
      const wave = st.things.filter((thing) => thing.kind === "rock" && thing.x === st.width - 1);
      if (!wave.length) continue;
      assert.ok(wave.length <= LANES - 2);
      assert.ok(!wave.some((rock) => rock.lane === st.safe), "the promised lane is open");
      assert.ok(Math.abs(st.safe - promised) <= 1);
      promised = st.safe;
    }
  }
});

test("a careful pilot never crashes, at any speed", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const st = newGame(seed);
    for (let i = 0; i < 5000; i++) fly(st);
    assert.ok(st.alive, `seed ${seed} crashed at tick ${st.tick}`);
    assert.equal(delay(st), 42);
  }
});

test("debris ends the run, packets add to the score", () => {
  const crash = newGame(1);
  crash.things.push({ x: SHIP_X + SHIP.length, lane: crash.lane, kind: "rock", glyph: "#" });
  step(crash);
  assert.equal(crash.alive, false);
  assert.equal(step(crash).tick, 1, "nothing moves after a crash");

  const catcher = newGame(1);
  catcher.things.push({ x: SHIP_X, lane: catcher.lane + 1, kind: "packet", glyph: "+" });
  move(catcher, 1);
  assert.equal(catcher.packets, 1);
  assert.equal(catcher.score, PACKET_POINTS);
  assert.equal(catcher.alive, true);
});

test("the satellite stays inside the lanes", () => {
  const st = newGame(1);
  for (let i = 0; i < LANES * 2; i++) move(st, -1);
  assert.equal(st.lane, 0);
  for (let i = 0; i < LANES * 2; i++) move(st, 1);
  assert.equal(st.lane, LANES - 1);
});

test("every frame is a rectangle, whatever is on screen", () => {
  for (const width of [40, 60]) {
    const st = newGame(9, width);
    for (let i = 0; i < 300; i++) fly(st);
    for (const view of [{ phase: "ready" }, { phase: "run" }, { phase: "run", paused: true }, { phase: "over", contact: profile.contact }]) {
      const lines = frame(st, fancy, view);
      assert.equal(lines.length, LANES + 4);
      for (const line of lines.slice(1, -1)) assert.equal(lineWidth(line), width + 2);
      for (const cap of [fancy, plain]) for (const line of frame(st, cap, { ...view, back: "back to the card" })) assert.ok(lineWidth(line) <= width + 2);
    }
  }
});

test("mission control fits its verdict in the smallest field", () => {
  for (const score of [0, 200, 500, 5000]) {
    for (const line of verdict(score, profile.contact)) assert.ok(line.length <= 40 - 4, line);
  }
});
