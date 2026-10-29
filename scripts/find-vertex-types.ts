/**
 * Which circuits show off the most kinds of vertices?
 *
 * Each vertex of a circuit has a pairing number, 1 to 15, as on the Vertex Pairings slide.
 * Mirror images count as the same kind, so there are 11 kinds.
 * This looks at every circuit, ignoring rotations and mirror images, and finds
 * pairs of circuits that show all 11 kinds between their 14 vertices.
 *
 * `npm run find-vertex-types`, or `node scripts/find-vertex-types.ts`.  About a minute.
 */

import {
  type Circuit,
  forEachEulerCircuit,
  makeCanonicalTest,
  mirrorPairingNumber,
  STEPS_7,
  vertexPairingNumbers,
} from "../src/euler-circuits.ts";

/** Each kind of vertex is named by the smaller of its two pairing numbers. */
const kindOf = (number: number) => Math.min(number, mirrorPairingNumber(number));
const KINDS = [...new Set([...Array(15).keys()].map((i) => kindOf(i + 1)))];
/** A bit for each kind, by pairing number. */
const bitOf = (number: number) => 1 << (kindOf(number) - 1);
const ALL_KINDS = KINDS.reduce((bits, kind) => bits | bitOf(kind), 0);
const bitCount = (bits: number) => KINDS.filter((kind) => bits & bitOf(kind)).length;
const describe = (bits: number) =>
  KINDS.filter((kind) => bits & bitOf(kind)).join(",");

/** For each set of kinds, how many circuits show exactly that set, and the first one found. */
const byKinds = new Map<number, { count: number; example: Circuit; numbers: number[] }>();
/** How many circuits show each pairing number, and how many vertices have it. */
const circuitsWith = new Array<number>(16).fill(0);
const verticesWith = new Array<number>(16).fill(0);

const isCanonical = makeCanonicalTest(7, STEPS_7, true);
const numbers = new Array<number>(7);
let circuitCount = 0;
const start = performance.now();
forEachEulerCircuit(7, STEPS_7, (circuit) => {
  if (!isCanonical(circuit)) {
    return;
  }
  circuitCount++;
  vertexPairingNumbers(circuit, numbers);
  let kinds = 0;
  let seen = 0;
  for (const number of numbers) {
    kinds |= bitOf(number);
    verticesWith[number]++;
    if (!(seen & (1 << number))) {
      seen |= 1 << number;
      circuitsWith[number]++;
    }
  }
  const entry = byKinds.get(kinds);
  if (entry) {
    entry.count++;
  } else {
    byKinds.set(kinds, { count: 1, example: [...circuit], numbers: [...numbers] });
  }
});
const seconds = (performance.now() - start) / 1000;

console.log(
  `${circuitCount.toLocaleString()} circuits, ignoring rotations and mirror images.  ${seconds.toFixed(1)} seconds.`,
);
console.log();
console.log("Pairing  Mirror  Circuits with it  Vertices with it");
for (let number = 1; number <= 15; number++) {
  console.log(
    `${String(number).padStart(7)}  ${String(mirrorPairingNumber(number)).padStart(6)}  ` +
      `${circuitsWith[number].toLocaleString().padStart(16)}  ${verticesWith[number].toLocaleString().padStart(16)}`,
  );
}
console.log();

const kindCounts = new Array<number>(12).fill(0);
for (const [kinds, { count }] of byKinds) {
  kindCounts[bitCount(kinds)] += count;
}
console.log("Kinds in one circuit  Circuits");
kindCounts.forEach((count, kinds) => {
  if (count) {
    console.log(`${String(kinds).padStart(20)}  ${count.toLocaleString().padStart(8)}`);
  }
});
console.log();

// MARK: Pairs that show everything

/** Sets of kinds, most kinds first, then in the order the search found them. */
const sets = [...byKinds.entries()].sort(
  ([a], [b]) => bitCount(b) - bitCount(a),
);
let pairCount = 0;
let circuitPairCount = 0;
const examples: string[] = [];
for (let i = 0; i < sets.length; i++) {
  for (let j = i; j < sets.length; j++) {
    const [kindsA, a] = sets[i];
    const [kindsB, b] = sets[j];
    if ((kindsA | kindsB) == ALL_KINDS) {
      pairCount++;
      circuitPairCount += i == j ? (a.count * (a.count - 1)) / 2 : a.count * b.count;
      if (examples.length < 10 && (i != j || a.count > 1)) {
        examples.push(
          `  [${a.example.join(",")}]  pairings ${a.numbers.join(",")}  kinds ${describe(kindsA)}\n` +
            `  [${b.example.join(",")}]  pairings ${b.numbers.join(",")}  kinds ${describe(kindsB)}\n`,
        );
      }
    }
  }
}
console.log(
  `${pairCount.toLocaleString()} pairs of kind sets cover all 11 kinds, from ${circuitPairCount.toLocaleString()} pairs of circuits.`,
);
console.log("The first few, as [circuit] and the pairing number at vertices 0 through 6:");
console.log(examples.join("\n"));
