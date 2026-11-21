/**
 * Look for Fourier terms that we could group, or reorder, in interesting ways.
 *
 * `npm run fourier-analysis`, or `node scripts/fourier-analysis.ts`.
 *
 * The terms are exactly the ones Star Circuit animates:  `decompose()` in `circuit-terms.ts`.
 * So a term's `rank` is the number to type into Term Groups.
 * @module
 */

// First, so the library can load.
import { decompose, type RankedTerm } from "./circuit-terms.ts";

import { positiveModulo } from "phil-lib/misc";
import { type Circuit, NAMED_CIRCUITS_7 } from "../src/euler-circuits.ts";
import type { SampleFile, SampleRecord } from "./sample-circuits.ts";

// MARK: Settings

/** Print the symmetries of the named circuits.  See "First loop". */
const SHOW_SYMMETRY_OF_NAMED_CIRCUITS = false;

const SHOW_SYMMETRY_OF_MORE = false;

/** Search the sample for circuits that start with the same frequencies.  See "Shared frequencies". */
const SHOW_SHARED_FREQUENCIES = false;

/**
 * A term smaller than this isn't interesting on its own.
 * A share of the circuit's total amplitude, as in the step panel:  5%.
 */
const MIN_INTERESTING_AMPLITUDE = 0.05;

const MAX_ROUND_RANK = 100;

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
    if (
      currentGroupAmplitude >= MIN_INTERESTING_AMPLITUDE
    ) {
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
      if (term.amplitude < MIN_INTERESTING_AMPLITUDE &&
      term.rank <= MAX_ROUND_RANK) {
        rest += term.amplitude;
      }
    }
    const estimatedBins = Math.floor(rest / MIN_INTERESTING_AMPLITUDE);
    // REMINDER, from video №6 (Random 5, 2026-11-14):  this puts the small matching terms in with the
    // symmetry groups, and the corners came in too soon.  Next time, try what often worked best in the
    // hexagram videos:  save a few big terms for the very end, and bring in the small terms (the corners)
    // just before them.  See "Forward and back" in `development-plans/term-ordering.md`.
    // First the terms that keep the symmetry, then the ones that break it.
    const termGroups = [
      ...packIntoGroups(matching).flatMap((group) => [group, []]),
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

if (SHOW_SYMMETRY_OF_NAMED_CIRCUITS) {
  console.log("——— SHOW_SYMMETRY_OF_NAMED_CIRCUITS ————————————————————————");
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
}

// MARK: BigSampleFile

class BigSampleFile {
  private constructor() {
    throw new Error("wtf");
  }
  /** The sample, from `npm run sample-circuits`.  Not a plain string in `import()`, so `tsc` doesn't look for it:  GitHub doesn't have it. */
  private static SAMPLE_FILE = "../data/circuit-sample.json";
  private static cached: Promise<SampleFile> | undefined;
  static getRecords(): Promise<SampleFile> {
    if (!this.cached) {
      this.cached = import(this.SAMPLE_FILE, { with: { type: "json" } }).then(
        (wholeFile) => {
          return wholeFile.default;
        },
      );
      this.cached.catch((reason) => {
        console.error(
          `Can't read ${this.SAMPLE_FILE}.  Run "npm run sample-circuits" first.  ${(reason as Error).message}`,
        );
      });
    }
    return this.cached;
  }
  /**
   *
   * @returns `undefined` on failure.
   * @throws never
   */
  static async tryGet() {
    try {
      return this.getRecords();
    } catch {
      return undefined;
    }
  }
}

// MARK: More symmetry

if (SHOW_SYMMETRY_OF_MORE) {
  console.log("——— SHOW_SYMMETRY_OF_MORE —————————————————————————————————");
  for (const { index, circuit } of (await BigSampleFile.getRecords())
    .circuits) {
    let introPrinted = false;
    const terms = decompose(circuit);
    for (let n = 2; n <= LARGEST_SYMMETRY; n++) {
      const [better, lesser] = getSymmetryInfo(terms, n);
      if (better.bigTerms.length >= MIN_BIG_TERMS_TO_PRINT) {
        console.log(
          `  ${n}-fold:  ${better.score} from ${better.start},  ${lesser.score} from ${lesser.start}`,
        );
        if (!introPrinted) {
          console.log(`\n#${index} — ${circuit}`);
          introPrinted = true;
        }
        //console.log(better.termGroups);
        //console.table(better.bigTerms);
      }
    }
    //console.table(terms.slice(0, 6));
  }
}

const DETAILED_SYMMETRY_REQUEST = new Set<number>([/*837357,*/ 511824]);
if (DETAILED_SYMMETRY_REQUEST.size > 0) {
  for (const { index, circuit } of (await BigSampleFile.getRecords())
    .circuits) {
    if (DETAILED_SYMMETRY_REQUEST.has(index)) {
      console.log(`\n#${index} — ${circuit}`);
      const terms = decompose(circuit);
      for (let n = 2; n <= LARGEST_SYMMETRY; n++) {
        const [better, lesser] = getSymmetryInfo(terms, n);
        if (better.bigTerms.length >= MIN_BIG_TERMS_TO_PRINT) {
          console.log(
            `  ${n}-fold:  ${better.score} from ${better.start},  ${lesser.score} from ${lesser.start}`,
          );
          console.log(better.termGroups);
          console.table(better.bigTerms);
          if (n > 2 /*&&(lesser.bigTerms.length >= MIN_BIG_TERMS_TO_PRINT)*/) {
            console.log(
              `  ${n}-fold lesser:  ${lesser.score} from ${better.start}`,
            );
            console.log(lesser.termGroups);
            console.table(lesser.bigTerms);
          }
        }
      }
    }
  }
}

// MARK: Shared frequencies

/*
 * Look in the sample for 3 or 4 *different* circuits that start with the same frequencies,
 * so they can draw the same frequency at the same time (term-ordering.md, "Shared frequencies").
 * Each one prints what to type into the Visual Editor:  the Circuit, and the Term Groups.
 *
 * Three searches:
 * * **Same start:**  every circuit's biggest M terms have the same frequencies, in any order.  The biggest M wins.
 * * **Same start, same order:**  the same, with the frequencies in the same order.  The first M ranks line up with no reordering.
 * * **Most in sync:**  the most amplitude drawn in step, from any of the first 40 terms.  "A decent job for a lot of circles."
 *
 * Each circuit is tried forwards and backwards.  Backwards negates every frequency, and the printed vertices are reversed to match.
 */

/** How many circuits on the screen at once. */
const GROUP_SIZES = [3, 4] as const;

/** The best few groups from each search. */
const GROUPS_TO_PRINT = 3;

/** For Most in sync:  a frequency counts as shared only if it's at least this much of every circuit's total.  1%. */
const MIN_SHARED_AMPLITUDE = 0.01;

/** For Most in sync:  at most this many shared frequencies, one step each.  The rest come later, by rank. */
const MAX_SHARED_STEPS = 12;

/**
 * After the shared steps, each circuit's other terms, in groups by rank:  below 10, 10 to 19, 20 to 39, …
 * The same for every circuit, so they all have the same number of groups.  A group can be empty, a pause.
 */
const RANK_BINS = [10, 20, 40, 100, 300] as const;

/** One circuit, drawn forwards or backwards. */
type Oriented = {
  readonly record: SampleRecord;
  readonly backward: boolean;
  /** The terms, `[frequency, amplitude]`, biggest first.  Backwards, every frequency is negated. */
  readonly terms: readonly (readonly [number, number])[];
  /** Amplitude by frequency. */
  readonly amplitudeAt: ReadonlyMap<number, number>;
};

function orient(record: SampleRecord, backward: boolean): Oriented {
  const terms = record.terms.map(
    ([frequency, amplitude]) =>
      [backward ? -frequency : frequency, amplitude] as const,
  );
  return { record, backward, terms, amplitudeAt: new Map(terms) };
}

/** A group found by one of the searches. */
type SyncGroup = {
  readonly members: readonly Oriented[];
  /** The shared frequencies, in the order to draw them, one step each. */
  readonly shared: readonly number[];
  /** For each shared frequency, the smallest amplitude among the members, added up.  Bigger is better. */
  readonly score: number;
  /** For the same start searches, how many terms are the same.  Otherwise the number of shared frequencies. */
  readonly m: number;
};

/** The sum of each frequency's smallest amplitude among the members. */
function scoreOf(members: readonly Oriented[], shared: readonly number[]) {
  let score = 0;
  for (const frequency of shared) {
    score += Math.min(
      ...members.map((member) => member.amplitudeAt.get(frequency) ?? 0),
    );
  }
  return score;
}

/** Biggest first, by the total amplitude among the members. */
function byTotalAmplitude(
  members: readonly Oriented[],
  frequencies: Iterable<number>,
): number[] {
  const total = (frequency: number) =>
    members.reduce(
      (sum, member) => sum + (member.amplitudeAt.get(frequency) ?? 0),
      0,
    );
  return [...frequencies].sort((a, b) => total(b) - total(a));
}

/**
 * Pick `size` members of `candidates`, one at a time, each time the one that keeps the score highest.
 * Never the same circuit twice, even in opposite directions.
 * @param start The members to start with.
 * @param scoreFor The score of a possible group.
 */
function growGroup(
  start: readonly Oriented[],
  candidates: readonly Oriented[],
  size: number,
  scoreFor: (members: readonly Oriented[]) => number,
): Oriented[] | undefined {
  const members = [...start];
  while (members.length < size) {
    let best: Oriented | undefined;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      if (members.some((m) => m.record.index == candidate.record.index)) {
        continue;
      }
      const score = scoreFor([...members, candidate]);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (!best) {
      return undefined;
    }
    members.push(best);
  }
  return members;
}

/** The same circuits, whichever direction each one was found in. */
function groupKey(members: readonly Oriented[]) {
  return members
    .map((member) => member.record.index)
    .sort((a, b) => a - b)
    .join(" ");
}

/** Sort, drop repeats of the same circuits, and keep the best few. */
function bestGroups(
  groups: SyncGroup[],
  compare: (a: SyncGroup, b: SyncGroup) => number,
): SyncGroup[] {
  groups.sort(compare);
  const seen = new Set<string>();
  const result: SyncGroup[] = [];
  for (const group of groups) {
    const key = groupKey(group.members);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(group);
      if (result.length == GROUPS_TO_PRINT) {
        break;
      }
    }
  }
  return result;
}

/**
 * Same start:  circuits whose biggest M terms have the same frequencies.
 * For each M, one group from each set of frequencies that at least `size` circuits share.
 * @param sameOrder The frequencies must also be in the same order.
 * @returns The best groups, the biggest M first.
 */
function sameStart(
  oriented: readonly Oriented[],
  size: number,
  sameOrder: boolean,
): SyncGroup[] {
  const found: SyncGroup[] = [];
  for (let m = 2; m <= oriented[0].terms.length; m++) {
    const buckets = new Map<string, Oriented[]>();
    for (const item of oriented) {
      const frequencies = item.terms
        .slice(0, m)
        .map(([frequency]) => frequency);
      if (!sameOrder) {
        frequencies.sort((a, b) => a - b);
      }
      const key = frequencies.join(" ");
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = [];
        buckets.set(key, bucket);
      }
      bucket.push(item);
    }
    let foundAny = false;
    for (const bucket of buckets.values()) {
      const first = bucket[0].terms.slice(0, m).map(([frequency]) => frequency);
      const scoreFor = (members: readonly Oriented[]) =>
        scoreOf(members, first);
      // Start with the one that has the most amplitude in these terms.
      const start = [...bucket].sort(
        (a, b) => scoreFor([b]) - scoreFor([a]),
      )[0];
      const members = growGroup([start], bucket, size, scoreFor);
      if (members) {
        foundAny = true;
        const shared = sameOrder ? first : byTotalAmplitude(members, first);
        found.push({ members, shared, score: scoreFor(members), m });
      }
    }
    if (!foundAny) {
      break;
    }
  }
  return bestGroups(found, (a, b) => b.m - a.m || b.score - a.score);
}

/**
 * The frequencies all the members have, each at least {@link MIN_SHARED_AMPLITUDE}, biggest first,
 * at most {@link MAX_SHARED_STEPS} of them.
 */
function sharedFrequencies(members: readonly Oriented[]): number[] {
  const common = [...members[0].amplitudeAt.keys()].filter((frequency) =>
    members.every(
      (member) =>
        (member.amplitudeAt.get(frequency) ?? 0) >= MIN_SHARED_AMPLITUDE,
    ),
  );
  return byTotalAmplitude(members, common).slice(0, MAX_SHARED_STEPS);
}

/**
 * Most in sync:  the most amplitude drawn in step, from any shared frequencies.
 * Checking every group of 3 or 4 would take far too long.  So this only looks among circuits whose two biggest terms
 * have the same frequencies, and grows each group from the best few pairs there.
 */
function mostInSync(oriented: readonly Oriented[], size: number): SyncGroup[] {
  const scoreFor = (members: readonly Oriented[]) =>
    scoreOf(members, sharedFrequencies(members));
  const buckets = new Map<string, Oriented[]>();
  for (const item of oriented) {
    const key = item.terms
      .slice(0, 2)
      .map(([frequency]) => frequency)
      .sort((a, b) => a - b)
      .join(" ");
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(item);
  }
  /** How many of the best pairs in each bucket to grow into groups. */
  const SEEDS = 10;
  const found: SyncGroup[] = [];
  for (const bucket of buckets.values()) {
    const pairs: { pair: [Oriented, Oriented]; score: number }[] = [];
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        if (bucket[i].record.index != bucket[j].record.index) {
          const pair: [Oriented, Oriented] = [bucket[i], bucket[j]];
          pairs.push({ pair, score: scoreFor(pair) });
        }
      }
    }
    pairs.sort((a, b) => b.score - a.score);
    for (const { pair } of pairs.slice(0, SEEDS)) {
      const members = growGroup(pair, bucket, size, scoreFor);
      if (members) {
        const shared = sharedFrequencies(members);
        found.push({
          members,
          shared,
          score: scoreFor(members),
          m: shared.length,
        });
      }
    }
  }
  return bestGroups(found, (a, b) => b.score - a.score);
}

/** A percentage, for printing. */
function percent(fraction: number) {
  return (fraction * 100).toFixed(0) + "%";
}

/**
 * Print a group, ready to type into the Visual Editor.
 * Each circuit's Term Groups:  the shared frequencies, one step each, then its other terms by {@link RANK_BINS}.
 * The ranks come from decomposing the vertices as printed, so they're exactly what Star Circuit uses.
 */
function printGroup(group: SyncGroup, number: number) {
  const steps = group.shared.length + RANK_BINS.length + 1;
  console.log(
    `  Group ${number}:  score ${percent(group.score)}, ${group.shared.length} shared steps, Step 0 to ${steps}.`,
  );
  console.log(`    Shared frequencies:  ${group.shared.join(", ")}`);
  for (const member of group.members) {
    const vertices = member.backward
      ? [...member.record.circuit].reverse()
      : member.record.circuit;
    const terms = decompose(vertices);
    const rankOf = new Map(terms.map((term) => [term.frequency, term.rank]));
    const sharedRanks = new Set<number>();
    const groups: number[][] = group.shared.map((frequency) => {
      const rank = rankOf.get(frequency);
      if (rank === undefined) {
        return [];
      }
      // The sample's amplitudes are for the circuit forwards.  Backwards, each one moves to minus its frequency,
      // but changes a little:  at most 0.0017 of the total, measured on 200 circuits.
      // Enough to swap nearly equal terms (14% of the top 20 ranks moved), which is why the ranks come from `terms`.
      // A wrong sign would be off by far more:  up to 0.128.
      const expected = member.amplitudeAt.get(frequency) ?? 0;
      if (Math.abs(terms[rank].amplitude - expected) > 0.005) {
        throw new Error(
          `#${member.record.index}, frequency ${frequency}:  ${terms[rank].amplitude}, expected ${expected}.`,
        );
      }
      sharedRanks.add(rank);
      return [rank];
    });
    const bounds = [0, ...RANK_BINS, terms.length];
    for (let bin = 0; bin + 1 < bounds.length; bin++) {
      const ranks: number[] = [];
      for (let rank = bounds[bin]; rank < bounds[bin + 1]; rank++) {
        if (!sharedRanks.has(rank)) {
          ranks.push(rank);
        }
      }
      groups.push(ranks);
    }
    const inSync = group.shared.reduce(
      (sum, frequency) => sum + (member.amplitudeAt.get(frequency) ?? 0),
      0,
    );
    console.log(
      `    #${member.record.index} ${member.backward ? "backward" : "forward"}, ${percent(inSync)} in sync`,
    );
    console.log(`      Circuit:  ${vertices.join(" ")}`);
    console.log(`      Term Groups:  ${groups.map(formatRanks).join(", ")}`);
  }
}

if (SHOW_SHARED_FREQUENCIES) {
  console.log("——— SHOW_SHARED_FREQUENCIES ———————————————————————————————");
  const sample: SampleFile | undefined = await BigSampleFile.tryGet();
  if (sample) {
    const oriented = sample.circuits.flatMap((record) => [
      orient(record, false),
      orient(record, true),
    ]);
    console.log(
      `\nShared frequencies, from ${sample.circuits.length.toLocaleString()} circuits.`,
    );
    for (const size of GROUP_SIZES) {
      const searches: [string, SyncGroup[]][] = [
        ["Same start", sameStart(oriented, size, false)],
        ["Same start, same order", sameStart(oriented, size, true)],
        ["Most in sync", mostInSync(oriented, size)],
      ];
      for (const [title, groups] of searches) {
        console.log(`\n${size} circuits, ${title}:`);
        if (groups.length == 0) {
          console.log("  None found.");
        }
        groups.forEach((group, index) => printGroup(group, index + 1));
      }
    }
  }
}
