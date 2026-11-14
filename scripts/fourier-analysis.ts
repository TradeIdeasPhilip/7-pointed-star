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
 * A share of the circuit's total amplitude, as in the step panel:  5%.
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

/**
 * A term, and where it is in the list sorted by amplitude:  the number Term Groups uses.
 * Its `amplitude` is its share of the circuit's total, 0 to 1, not a radius.
 */
type RankedTerm = FourierTerm & { readonly rank: number };

/**
 * The Fourier terms of a circuit, biggest amplitude first.  Terms that are almost exactly 0 are left out.
 * The same as Star Circuit's, so the ranks match the editor's.
 *
 * Each amplitude is divided by the sum of all of them, so they add up to 1, like the step panel's percentages.
 * The library's amplitude is the radius of that term's circle, where the star's radius is 1.
 * Those add up to between 1.5 and 4 for this project's named circuits.
 */
function decompose(circuit: Circuit): RankedTerm[] {
  // Keep the frequency 0 term, as Star Circuit does (`coloredSource()`), so the ranks still match.
  const terms = samplesToFourier(
    samplesFromPath(circuitToPath(7, circuit).pathShape),
    { keepCenter: true },
  );
  const total = terms.reduce((sum, term) => sum + term.amplitude, 0);
  return terms.map((term, rank) => ({
    ...term,
    amplitude: term.amplitude / total,
    rank,
  }));
}

// MARK: Term Groups

/**
 * Split terms into groups, in the order given, each one adding up to at least {@link MIN_INTERESTING_AMPLITUDE}.
 * What's left at the end, too small for a group of its own, joins the last group.
 * @returns The ranks in each group.
 */
function packIntoGroups(list: readonly RankedTerm[]): number[][] {
  const groups: number[][] = [];
  /** The group being filled.  A new array each time:  `groups` keeps the old one. */
  let groupInProgress: number[] = [];
  /** The total of the amplitudes in `groupInProgress`. */
  let currentGroupAmplitude = 0;
  for (const term of list) {
    groupInProgress.push(term.rank);
    currentGroupAmplitude += term.amplitude;
    if (currentGroupAmplitude >= MIN_INTERESTING_AMPLITUDE) {
      groups.push(groupInProgress);
      groupInProgress = [];
      currentGroupAmplitude = 0;
    }
  }
  if (groupInProgress.length > 0) {
    if (groups.length == 0) {
      // This is the only group!
      groups.push(groupInProgress);
    } else {
      groups.at(-1)!.push(...groupInProgress);
    }
  }
  return groups;
}

/**
 * One group in the Term Groups format:  "2 7-11".  Numbers in a group are separated by spaces.  The commas go between groups.
 * `formatTerms()` in `src/fourier-panel.ts` does the same, but Node can't load that file:  it imports the library's main entry (`library-issues.md`, item 24).
 */
function formatRanks(ranks: readonly number[]): string {
  const sorted = [...ranks].sort((a, b) => a - b);
  const pieces: string[] = [];
  let first = 0;
  while (first < sorted.length) {
    let last = first;
    while (last + 1 < sorted.length && sorted[last + 1] == sorted[last] + 1) {
      last++;
    }
    pieces.push(
      last > first ? `${sorted[first]}-${sorted[last]}` : String(sorted[first]),
    );
    first = last + 1;
  }
  return pieces.join(" ");
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
  /** To copy into a Fourier component. */
  readonly termGroups: string;
};

/**
 * Keep only the frequencies that are `start` plus or minus a multiple of `n`, and the curve has
 * n-fold rotational symmetry:  moving `t` ahead by 1/n turns the whole picture by `start` × 360° / n.
 * So 1 and -1 give the same symmetry, turning opposite ways.  (When n is 2 they're the same terms.)
 * @param terms From {@link decompose}.
 * @returns Starting from 1 and starting from -1, the better score first.
 */
function getSymmetryInfo(
  terms: readonly RankedTerm[],
  n: number,
): [SymmetryScore, SymmetryScore] {
  function score(start: 1 | -1): SymmetryScore {
    function matches(term: RankedTerm) {
      return positiveModulo(term.frequency - start, n) == 0;
    }
    const matching = terms.filter(matches);
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
    // First the terms that keep the symmetry, then the ones that break it.
    const termGroups = [
      ...packIntoGroups(matching).flatMap((group) => [group,[]]),
      ...packIntoGroups(terms.filter((term) => !matches(term))),
    ]
      .map(formatRanks)
      .join(", ");
    return {
      start,
      bigTerms,
      estimatedBins,
      score: bigTerms.length + estimatedBins,
      termGroups,
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
    const [better, lesser] = getSymmetryInfo(terms, n);
    if (better.bigTerms.length >= MIN_BIG_TERMS_TO_PRINT) {
      console.log(
        `  ${n}-fold:  ${better.score} from ${better.start},  ${lesser.score} from ${lesser.start}`,
      );
      console.log(better.termGroups);
      console.table(better.bigTerms);
    }
  }
  console.table(terms.slice(0, 6));
}
