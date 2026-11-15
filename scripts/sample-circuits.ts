/**
 * 10,000 circuits picked at random, with their biggest Fourier terms, as one JSON file.
 *
 * `npm run sample-circuits` writes `data/circuit-sample.json`.  About a minute.
 * Running this directly writes the JSON to stdout, and progress to stderr.
 * The same seed always picks the same circuits.
 *
 * A first, cautious step toward `development-plans/enumerate-all-circuits.md`:  enough circuits to look for
 * ones that start with the same frequencies (term-ordering.md, "Shared frequencies"), small enough to keep in memory.
 * The full enumeration should keep the same fields, and the same `index`.
 * @module
 */

import { decomposeWithTotal } from "./circuit-terms.ts";

import {
  forEachEulerCircuit,
  makeCanonicalTest,
  STEPS_7,
  vertexPairingNumbers,
} from "../src/euler-circuits.ts";

// MARK: Settings

const SAMPLE_SIZE = 10_000;
const SEED = 7;
/** How many terms to keep for each circuit, biggest first. */
const TERMS_KEPT = 40;
/** Decimal places for each amplitude.  0.00001 of the total is far too small to see. */
const AMPLITUDE_PLACES = 5;

// MARK: Pick

/**
 * mulberry32:  a small, seedable random number generator.  0 ≤ result < 1.
 * A copy of the one in `pick-circuits.ts`.
 */
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

const startTime = performance.now();
/** Seconds since the start, for the progress messages. */
function elapsed() {
  return ((performance.now() - startTime) / 1000).toFixed(1) + " s";
}

console.error(
  `Choosing ${SAMPLE_SIZE.toLocaleString()} circuits, seed ${SEED}…`,
);
const random = makeRandom(SEED);
const isCanonical = makeCanonicalTest(7, STEPS_7, true);
/** Reservoir sampling, like `pick-circuits.ts`:  every circuit has the same chance, in one pass. */
const picks: { index: number; circuit: number[] }[] = [];
let seen = 0;
forEachEulerCircuit(7, STEPS_7, (circuit) => {
  if (!isCanonical(circuit)) {
    return;
  }
  if (picks.length < SAMPLE_SIZE) {
    picks.push({ index: seen, circuit: [...circuit] });
  } else {
    const slot = Math.floor(random() * (seen + 1));
    if (slot < SAMPLE_SIZE) {
      picks[slot] = { index: seen, circuit: [...circuit] };
    }
  }
  seen++;
});
picks.sort((a, b) => a.index - b.index);
console.error(`${seen.toLocaleString()} circuits searched, ${elapsed()}.`);

// MARK: Decompose

/**
 * One line of the file.
 * `import type` this, never a plain import:  importing this file runs it.
 */
export type SampleRecord = {
  /** This circuit's place among all of them, in search order.  A stable ID. */
  readonly index: number;
  /** The 22 vertices.  Pastes straight into Star Circuit's Circuit field. */
  readonly circuit: readonly number[];
  /** `vertexPairingNumbers()`:  how each vertex pairs off its 6 edges, 1 to 15. */
  readonly pairings: readonly number[];
  /** The sum of the library's amplitudes.  A share times this is a radius, where the star's radius is 1. */
  readonly total: number;
  /** The biggest terms, `[frequency, share of the total]`.  The position is the rank, the number Term Groups uses. */
  readonly terms: readonly (readonly [number, number])[];
};

const scale = 10 ** AMPLITUDE_PLACES;
const records: SampleRecord[] = picks.map(({ index, circuit }) => {
  const { terms, total } = decomposeWithTotal(circuit);
  return {
    index,
    circuit,
    pairings: vertexPairingNumbers(circuit),
    total: Math.round(total * scale) / scale,
    terms: terms
      .slice(0, TERMS_KEPT)
      .map(
        (term) =>
          [term.frequency, Math.round(term.amplitude * scale) / scale] as const,
      ),
  };
});
console.error(`Decomposed, ${elapsed()}.`);

// MARK: Write

/** The whole file:  the header, and `circuits`. */
export type SampleFile = typeof header & {
  readonly circuits: readonly SampleRecord[];
};

const header = {
  about:
    `${SAMPLE_SIZE.toLocaleString()} Euler circuits on the 7 pointed star, picked at random by scripts/sample-circuits.ts.  ` +
    "Each is the canonical one of its family:  rotations and mirror images are left out.  " +
    "terms are the biggest Fourier terms, [frequency, amplitude], biggest first:  the position is the rank, the number Term Groups uses.  " +
    "The amplitudes don't change with rotation or the starting vertex.  " +
    "A mirror image, or the same loop traced backwards, has the same amplitudes at minus each frequency, so compare circuits both ways.",
  amplitude:
    "Each term's share of the circuit's total amplitude, like the step panel.",
  seed: SEED,
  sampleSize: SAMPLE_SIZE,
  canonicalCircuits: seen,
  termsKept: TERMS_KEPT,
};
/** The header as JSON, without its closing brace, so `circuits` can follow, one per line. */
const headerText = JSON.stringify(header, undefined, 2).replace(/\n}$/, "");
console.log(
  headerText +
    ',\n  "circuits": [\n' +
    records.map((record) => "    " + JSON.stringify(record)).join(",\n") +
    "\n  ]\n}",
);
console.error(`Done, ${elapsed()}.`);
