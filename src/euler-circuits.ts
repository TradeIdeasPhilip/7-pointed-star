/**
 * Euler circuits on a star inscribed in a circle:  n vertices evenly spaced
 * around a circle, numbered 0 through n-1, and an edge from each vertex to
 * the vertices `step` places away, for each step in a list.
 *
 * * Pentagram:  n = 5, steps [1, 2].  Every pair of vertices is connected.
 * * Hexagram:  n = 6, steps [1, 2].  Opposite vertices are *not* connected,
 *   so every vertex has an even number of edges.
 * * This project:  n = 7, steps [1, 2, 3].  Every pair of vertices is connected.
 *   Step 1 is the circle, step 2 is the fat star {7/2}, step 3 is the thin star {7/3}.
 *
 * A port of `Edge` and `Progress` from random-svg-tests/src/fourier-smackdown.ts,
 * rewritten to handle 7 points.  The old version built every circuit as a new
 * array, and remembered every rotation of every circuit in a `Set`.  That's
 * fine for the pentagram's 132 circuits, but not for the 7 pointed star's
 * millions.  This version reuses one buffer, and checks for duplicates one
 * circuit at a time, without remembering anything.
 *
 * No imports, so `node scripts/count-circuits.ts` can run this directly.
 * @module
 */

// MARK: Circuits

/**
 * A closed path through the vertices, listed in order.
 *
 * The first and last entries are both 0.  The second entry is 1.
 * That's the canonical form:  every loop passes through the edge from 0 to 1
 * exactly once, so starting there, in that direction, gives each loop exactly
 * one name, no matter where you start or which way you go.
 */
export type Circuit = readonly number[];

/** `numerator` mod `denominator`, always in the range 0 to `denominator` - 1. */
function mod(numerator: number, denominator: number) {
  return ((numerator % denominator) + denominator) % denominator;
}

/**
 * How many places apart are these vertices, going the short way around?
 * 1 means neighbors.  For n = 7:  1 is the circle, 2 the fat star, 3 the thin star.
 */
export function stepDistance(n: number, a: number, b: number) {
  const forward = mod(b - a, n);
  return Math.min(forward, n - forward);
}

/**
 * Start at vertex 0 and take these steps.
 * @param n The number of vertices.
 * @param steps How far to move each time.  Positive is clockwise.
 * @returns Every vertex visited, starting and ending with 0 if the steps add up
 * to a multiple of n.
 */
export function circuitFromSteps(n: number, steps: readonly number[]): Circuit {
  const result = [0];
  let vertex = 0;
  for (const step of steps) {
    vertex = mod(vertex + step, n);
    result.push(vertex);
  }
  return result;
}

/**
 * The edges of an inscribed star.  The same as `inscribed()` in fourier-smackdown.ts.
 * @param n The number of vertices.
 * @param steps Connect each vertex to the vertex this many places clockwise.
 * @returns Each edge once, as `[smaller, larger]`.
 */
export function starEdges(
  n: number,
  steps: readonly number[],
): (readonly [number, number])[] {
  const seen = new Set<number>();
  const result: (readonly [number, number])[] = [];
  for (let vertex = 0; vertex < n; vertex++) {
    for (const step of steps) {
      const other = mod(vertex + step, n);
      const a = Math.min(vertex, other);
      const b = Math.max(vertex, other);
      const key = a * n + b;
      if (a != b && !seen.has(key)) {
        seen.add(key);
        result.push([a, b]);
      }
    }
  }
  return result;
}

/**
 * Throw an error unless `circuit` is a canonical Euler circuit of this star:
 * it's closed, it starts 0 → 1, and it uses every edge exactly once.
 */
export function assertEulerCircuit(
  n: number,
  steps: readonly number[],
  circuit: Circuit,
) {
  const remaining = new Set(starEdges(n, steps).map(([a, b]) => a * n + b));
  const problem = (why: string) =>
    new Error(`Not an Euler circuit:  ${why}\n${circuit.join(",")}`);
  if (circuit[0] !== 0 || circuit[1] !== 1 || circuit.at(-1) !== 0) {
    throw problem("it must start 0, 1 and end 0.");
  }
  for (let i = 1; i < circuit.length; i++) {
    const a = Math.min(circuit[i - 1], circuit[i]);
    const b = Math.max(circuit[i - 1], circuit[i]);
    if (!remaining.delete(a * n + b)) {
      throw problem(`edge ${a}-${b} is missing from the star, or used twice.`);
    }
  }
  if (remaining.size > 0) {
    throw problem(`${remaining.size} edges are never used.`);
  }
}

// MARK: Hand picked

/** The steps that make the 7 pointed star:  the circle, the fat star and the thin star. */
export const STEPS_7 = [1, 2, 3] as const;

/**
 * The circle, then the fat star {7/2}, then the thin star {7/3}.
 * Each color is in one piece.
 */
export const GROUPED_7: Circuit = circuitFromSteps(7, [
  ...Array<number>(7).fill(1),
  ...Array<number>(7).fill(2),
  ...Array<number>(7).fill(3),
]);

/**
 * Steps of 1, 2, 3, repeated 7 times:  each color is cut into 7 pieces.
 * 0,1,3,6, 0,2,5, 6,1,4, 5,0,3, 4,6,2, 3,5,1, 2,4,0.
 */
export const INTERLEAVED_7: Circuit = circuitFromSteps(
  7,
  Array.from({ length: 7 }, () => [1, 2, 3]).flat(),
);

assertEulerCircuit(7, STEPS_7, GROUPED_7);
assertEulerCircuit(7, STEPS_7, INTERLEAVED_7);

// MARK: Search

/**
 * Find every canonical Euler circuit, depth first, the same order as
 * `Progress.get()` in fourier-smackdown.ts.  Each loop is listed once:  it
 * starts at 0 and goes to 1 first.  Rotations and mirror images of a loop are
 * still listed; see {@link makeCanonicalTest}.
 *
 * @param callback Called once for each circuit.  The array is reused, so copy
 * it to keep it.  Return `false` to stop the search.
 */
export function forEachEulerCircuit(
  n: number,
  steps: readonly number[],
  callback: (circuit: Circuit) => boolean | void,
) {
  const edges = starEdges(n, steps);
  if (edges.length > 31) {
    throw new Error("Too many edges for a 32 bit mask.");
  }
  /** For each vertex, its neighbors and the edge numbers that lead to them. */
  const neighbors = Array.from({ length: n }, () => new Array<[number, number]>());
  edges.forEach(([a, b], index) => {
    neighbors[a].push([b, index]);
    neighbors[b].push([a, index]);
  });
  const firstEdge = edges.findIndex(([a, b]) => a == 0 && b == 1);
  if (firstEdge < 0) {
    throw new Error("There must be an edge from 0 to 1.");
  }
  const path = new Array<number>(edges.length + 1).fill(0);
  path[1] = 1;
  let stopped = false;
  /**
   * @param depth path[depth] is the current vertex.
   * @param used A bit for each edge already in the path.
   */
  function extend(depth: number, used: number) {
    if (depth == edges.length) {
      // With every edge used, an Euler graph always ends where it started.
      if (callback(path) === false) {
        stopped = true;
      }
      return;
    }
    for (const [next, edge] of neighbors[path[depth]]) {
      const bit = 1 << edge;
      if (!(used & bit)) {
        path[depth + 1] = next;
        extend(depth + 1, used | bit);
        if (stopped) {
          return;
        }
      }
    }
  }
  extend(1, 1 << firstEdge);
}

/**
 * Makes a filter that keeps one circuit from each family of look-alikes.
 *
 * Rotating the star, or flipping it over, turns one circuit into another.
 * This keeps a circuit only if it comes first, in dictionary order, among all
 * the circuits it can turn into.  That picks exactly one circuit from each
 * family, without remembering which families have already been seen.
 *
 * This replaces `Progress.getUnique()`, which kept a `Set` of every rotation
 * it had seen.  That handled rotations, but not mirror images.
 *
 * @param mirror `true` to count a mirror image as a duplicate.
 * `false` to only count rotations, like `Progress.getUnique()`.
 * @returns A function that says whether to keep a canonical circuit.
 */
export function makeCanonicalTest(
  n: number,
  steps: readonly number[],
  mirror: boolean,
) {
  const edges = starEdges(n, steps);
  const edgeCount = edges.length;
  /** edgeIndex[a * n + b] is the edge connecting a and b, in either order. */
  const edgeIndex = new Int32Array(n * n).fill(-1);
  edges.forEach(([a, b], index) => {
    edgeIndex[a * n + b] = index;
    edgeIndex[b * n + a] = index;
  });
  /** Each symmetry of the star, as a multiplier (1, or -1 for a mirror image) and a rotation. */
  const symmetries: { readonly sign: number; readonly shift: number }[] = [];
  for (const sign of mirror ? [1, -1] : [1]) {
    for (let shift = 0; shift < n; shift++) {
      if (sign == 1 && shift == 0) {
        // The identity.  Never smaller than itself.
        continue;
      }
      symmetries.push({ sign, shift });
    }
  }
  /** positionOf[edge] is where in the circuit this edge is traversed. */
  const positionOf = new Int32Array(edgeCount);
  return (circuit: Circuit): boolean => {
    for (let i = 0; i < edgeCount; i++) {
      positionOf[edgeIndex[circuit[i] * n + circuit[i + 1]]] = i;
    }
    for (const { sign, shift } of symmetries) {
      // This symmetry moves vertex v to sign * v + shift.
      // The edge that lands on 0 → 1 becomes the start of the new canonical form.
      const zeroFrom = mod(sign * -shift, n);
      const oneFrom = mod(sign * (1 - shift), n);
      const position = positionOf[edgeIndex[zeroFrom * n + oneFrom]];
      const forward = circuit[position] == zeroFrom;
      // Compare the new circuit to the original, one vertex at a time.
      for (let k = 1; k < edgeCount; k++) {
        const index = forward
          ? mod(position + k, edgeCount)
          : mod(position + 1 - k, edgeCount);
        const difference = mod(sign * circuit[index] + shift, n) - circuit[k];
        if (difference < 0) {
          return false;
        }
        if (difference > 0) {
          break;
        }
      }
    }
    return true;
  };
}
