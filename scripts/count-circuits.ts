/**
 * How many Euler circuits does each star have?
 *
 * `npm run count-circuits`, or `node scripts/count-circuits.ts`.
 * Node strips the types itself.
 *
 * The pentagram and hexagram come first, to check this against the old
 * numbers in random-svg-tests/src/fourier-smackdown.ts:  132 and 28, 372 and 66.
 */

import { forEachEulerCircuit, makeCanonicalTest } from "../src/euler-circuits.ts";

function count(name: string, n: number, steps: readonly number[]) {
  const rotationTest = makeCanonicalTest(n, steps, false);
  const mirrorTest = makeCanonicalTest(n, steps, true);
  let all = 0;
  let rotations = 0;
  let rotationsAndMirrors = 0;
  const start = performance.now();
  forEachEulerCircuit(n, steps, (circuit) => {
    all++;
    if (rotationTest(circuit)) rotations++;
    if (mirrorTest(circuit)) rotationsAndMirrors++;
  });
  const seconds = (performance.now() - start) / 1000;
  console.log(
    `${name} (n=${n}, steps ${steps.join(",")}):  ${all.toLocaleString()} circuits, ` +
      `${rotations.toLocaleString()} after removing rotations, ` +
      `${rotationsAndMirrors.toLocaleString()} after also removing mirror images.  ` +
      `${seconds.toFixed(1)} seconds.`,
  );
}

count("Pentagram", 5, [1, 2]);
count("Hexagram", 6, [1, 2]);
count("7 pointed star", 7, [1, 2, 3]);
