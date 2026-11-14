/**
 * A circuit's Fourier terms, exactly as Star Circuit animates them, for scripts that run in Node.
 *
 * Shared by `fourier-analysis.ts` and `sample-circuits.ts`, so their ranks and units always agree.
 * @module
 */

// First, so the library can load.
import "./node-dom.ts";

import {
  type FourierTerm,
  samplesFromPath,
  samplesToFourier,
} from "canvas-recorder-lib/src/peano-fourier/fourier-shared";
import { type Circuit } from "../src/euler-circuits.ts";
import { circuitToPath } from "../src/star-path.ts";

/**
 * A term, and where it is in the list sorted by amplitude:  the number Term Groups uses.
 * Its `amplitude` is its share of the circuit's total, 0 to 1, not a radius.
 */
export type RankedTerm = FourierTerm & { readonly rank: number };

/**
 * The Fourier terms of a circuit, biggest amplitude first.  Terms that are almost exactly 0 are left out.
 * The same as Star Circuit's, so the ranks match the editor's.
 *
 * Each amplitude is divided by the sum of all of them, so they add up to 1, like the step panel's percentages.
 * The library's amplitude is the radius of that term's circle, where the star's radius is 1.
 * Those add up to between 1.5 and 4 for this project's named circuits.
 */
export function decompose(circuit: Circuit): RankedTerm[] {
  return decomposeWithTotal(circuit).terms;
}

/**
 * {@link decompose}, and the sum of the library's amplitudes.
 * A share times `total` is the radius of that term's circle again.
 */
export function decomposeWithTotal(circuit: Circuit): {
  readonly terms: RankedTerm[];
  readonly total: number;
} {
  // Keep the frequency 0 term, as Star Circuit does (`coloredSource()`), so the ranks still match.
  const terms = samplesToFourier(
    samplesFromPath(circuitToPath(7, circuit).pathShape),
    { keepCenter: true },
  );
  const total = terms.reduce((sum, term) => sum + term.amplitude, 0);
  return {
    terms: terms.map((term, rank) => ({
      ...term,
      amplitude: term.amplitude / total,
      rank,
    })),
    total,
  };
}
