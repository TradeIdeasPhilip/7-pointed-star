/**
 * Pick some circuits at random, ignoring rotations and mirror images.
 *
 * `npm run pick-circuits`, or `node scripts/pick-circuits.ts`.  About 25 seconds.
 * The same seed always picks the same circuits.  Change `count` and `seed` to pick others.
 */

import {
  forEachEulerCircuit,
  makeCanonicalTest,
  STEPS_7,
  vertexPairingNumbers,
} from "../src/euler-circuits.ts";

const count = 6;
const seed = 7;

/** mulberry32:  a small, seedable random number generator.  0 ≤ result < 1. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(seed);
const isCanonical = makeCanonicalTest(7, STEPS_7, true);
/** Reservoir sampling:  every circuit has the same chance, in one pass, without storing them all. */
const picks: { index: number; circuit: number[] }[] = [];
let seen = 0;
forEachEulerCircuit(7, STEPS_7, (circuit) => {
  if (!isCanonical(circuit)) {
    return;
  }
  if (picks.length < count) {
    picks.push({ index: seen, circuit: [...circuit] });
  } else {
    const slot = Math.floor(random() * (seen + 1));
    if (slot < count) {
      picks[slot] = { index: seen, circuit: [...circuit] };
    }
  }
  seen++;
});

console.log(`${count} of ${seen.toLocaleString()} circuits, seed ${seed}, in search order:`);
picks.sort((a, b) => a.index - b.index);
for (const { index, circuit } of picks) {
  const numbers = vertexPairingNumbers(circuit);
  console.log(
    `#${index.toLocaleString()}  [${circuit.join(", ")}]  pairings ${numbers.join(",")}`,
  );
}
