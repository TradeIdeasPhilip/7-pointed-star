/**
 * Look for Fourier terms that we could group, or reorder, in interesting ways.
 *
 * `npm run fourier-analysis`, or `node scripts/fourier-analysis.ts`.
 *
 * The terms are exactly the ones Star Circuit animates:  the library's `samplesFromPath()` and
 * `samplesToFourier()`, on the same path.  So a term's `rank` is the number to type into Term Groups.
 * @module
 */

// First, so the library can load.
import "./node-dom.ts";

import {
  type FourierTerm,
  samplesFromPath,
  samplesToFourier,
} from "canvas-recorder-lib/src/peano-fourier/fourier-shared";
import { positiveModulo } from "phil-lib/misc";
import { type Circuit, NAMED_CIRCUITS_7 } from "../src/euler-circuits.ts";
import { circuitToPath } from "../src/star-path.ts";

// MARK: Settings

/**
 * A term smaller than this isn't interesting on its own.
 * The star is on the unit circle, so this is a fraction of its radius:  5%.
 */
const MIN_INTERESTING_AMPLITUDE = 0.05;

/** Look for symmetries from 2 up to this. */
const LARGEST_SYMMETRY = 9;

/** Print a symmetry only if its better start has at least this many terms bigger than {@link MIN_INTERESTING_AMPLITUDE}. */
const MIN_BIG_TERMS_TO_PRINT = 3;

/**
 * Already in videos.  All Forward and Forward Backward Forward in Scratch 1, Every kind A in Scratch 2,
 * Every kind B in Scratch 3.
 */
const ALREADY_USED = new Set([
  "All Forward",
  "Forward Backward Forward",
  "Every kind A",
  "Every kind B",
  "Random 2",
]);

// MARK: Examples

const examples: readonly {
  readonly name: string;
  readonly circuit: Circuit;
}[] = [...NAMED_CIRCUITS_7]
  .filter(([name]) => !ALREADY_USED.has(name))
  .map(([name, circuit]) => ({ name, circuit }));

/** A term, and where it is in the list sorted by amplitude:  the number Term Groups uses. */
type RankedTerm = FourierTerm & { readonly rank: number };

/**
 * The Fourier terms of a circuit, biggest amplitude first.  Terms that are almost exactly 0 are left out.
 * The same as Star Circuit's, so the ranks match the editor's.
 */
function decompose(circuit: Circuit): RankedTerm[] {
  const terms = samplesToFourier(
    samplesFromPath(circuitToPath(7, circuit).pathShape),
  );
  return terms.map((term, rank) => ({ ...term, rank }));
}

// MARK: Symmetry

/** How well one set of terms gives N-fold rotational symmetry. */
type SymmetryScore = {
  /** The frequencies are this, plus or minus a multiple of N. */
  readonly start: 1 | -1;
  /** The terms with those frequencies that are at least {@link MIN_INTERESTING_AMPLITUDE}, biggest first. */
  readonly bigTerms: readonly RankedTerm[];
  /** The rest of those terms, added up and divided by {@link MIN_INTERESTING_AMPLITUDE}, rounded down. */
  readonly estimatedBins: number;
  /** `bigTerms.length + estimatedBins`.  Bigger is better. */
  readonly score: number;
};

/**
 * Keep only the frequencies that are `start` plus or minus a multiple of `n`, and the curve has
 * n-fold rotational symmetry:  moving `t` ahead by 1/n turns the whole picture by `start` × 360° / n.
 * So 1 and -1 give the same symmetry, turning opposite ways.  (When n is 2 they're the same terms.)
 * @param terms From {@link decompose}.
 * @returns Starting from 1 and starting from -1, the better score first.
 */
function symmetryInfo(
  terms: readonly RankedTerm[],
  n: number,
): [SymmetryScore, SymmetryScore] {
  function score(start: 1 | -1): SymmetryScore {
    const matching = terms.filter(
      (term) => positiveModulo(term.frequency - start, n) == 0,
    );
    const bigTerms = matching.filter(
      (term) => term.amplitude >= MIN_INTERESTING_AMPLITUDE,
    );
    let rest = 0;
    for (const term of matching) {
      if (term.amplitude < MIN_INTERESTING_AMPLITUDE) {
        rest += term.amplitude;
      }
    }
    const estimatedBins = Math.floor(rest / MIN_INTERESTING_AMPLITUDE);
    return {
      start,
      bigTerms,
      estimatedBins,
      score: bigTerms.length + estimatedBins,
    };
  }
  const plus = score(1);
  const minus = score(-1);
  return minus.score > plus.score ? [minus, plus] : [plus, minus];
}

// MARK: First loop

for (const { name, circuit } of examples) {
  console.log(name);
  const terms = decompose(circuit);
  for (let n = 2; n <= LARGEST_SYMMETRY; n++) {
    const [better, lesser] = symmetryInfo(terms, n);
    if (better.bigTerms.length >= MIN_BIG_TERMS_TO_PRINT) {
      console.log(
        `  ${n}-fold:  ${better.score} from ${better.start},  ${lesser.score} from ${lesser.start}`,
      );
    }
  }
  console.table(terms.slice(0, 6));
}
