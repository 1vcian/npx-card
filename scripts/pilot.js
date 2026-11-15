// A simple autopilot, shared by the tests and by the script that draws the
// README pictures. Between two waves it slides to a lane the next wave leaves open.

import { LANES, SHIP, SHIP_X, move, step } from "../lib/game.js";

const SHIP_END = SHIP_X + SHIP.length - 1;

/** Flies one tick. `greedy` also goes after packets when it is safe to. */
export function fly(st, { greedy = false } = {}) {
  const rocks = st.things.filter((thing) => thing.kind === "rock");
  // Nothing may be next to the satellite while it changes lane (one column of margin for this tick's slide).
  const clear = !rocks.some((rock) => rock.x >= SHIP_X - 1 && rock.x <= SHIP_END + 2);
  const ahead = rocks.filter((rock) => rock.x > SHIP_END + 2);
  if (clear && ahead.length) {
    const next = Math.min(...ahead.map((rock) => rock.x));
    const shut = new Set(ahead.filter((rock) => rock.x === next).map((rock) => rock.lane));
    const open = [...Array(LANES).keys()].filter((lane) => !shut.has(lane));
    const packet = greedy && st.things.find((thing) => thing.kind === "packet" && thing.x > SHIP_END && thing.x < next + 8 && open.includes(thing.lane));
    const target = packet ? packet.lane : open.reduce((best, lane) => (Math.abs(lane - st.lane) < Math.abs(best - st.lane) ? lane : best));
    while (st.alive && st.lane !== target) move(st, Math.sign(target - st.lane));
  }
  return step(st);
}
