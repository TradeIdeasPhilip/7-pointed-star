/**
 * A Fourier animation of a star circuit, each part drawn in the color of the edges it becomes.
 *
 * The library draws each frame as one PathShape.  This draws each frame in pieces, by `t`.
 * Sample i is at t = i / N, and each edge starts with a sample at its first vertex,
 * so each run of same colored edges covers a known range of `t`.
 * Each frame draws each of those ranges in its own color.
 *
 * Two functions here are copies of library functions, changed to expose more:
 * `samplesWithStarts()` from `samplesFromPath()`, and `getFrameRules()` from `getAnimationRules()`.
 * A prototype.  If it works out, the library could offer a way to do this without the copies.
 * @module
 */

import { ease } from "canvas-recorder-lib";
import {
  Command,
  LCommand,
  ParametricFunction,
  PathBuilder,
  PathShape,
} from "canvas-recorder-lib/src/glib/path-shape";
import {
  Complex,
  FourierTerm,
  hasFixedContribution,
  numberOfFourierSamples,
  samplesToFourier,
  termsToParametricFunction,
} from "canvas-recorder-lib/src/peano-fourier/fourier-shared";
import {
  assertNonNullable,
  initializedArray,
  lerp,
  makeBoundedLinear,
  makeLinear,
  sum,
} from "phil-lib/misc";
import { Circuit } from "./euler-circuits.ts";
import { circuitToPath, StarPath } from "./star-path.ts";

// MARK: Samples

/**
 * A copy of the library's `samplesFromPath()` that also says where each command's samples start.
 * The same samples, in the same order.
 * Without the fallback to `samplesFromPathOrig()`:  this throws instead.
 * @returns `starts[k]` is the index of command k's first sample.
 * `starts[commands.length]` is the number of samples.
 * A command with no length has no samples, so it starts where the next command starts.
 */
export function samplesWithStarts(
  pathShape: PathShape,
  numberOfSamples = numberOfFourierSamples,
): { samples: Complex[]; starts: number[] } {
  const commands = pathShape.commands;
  if (commands.length == 0) {
    throw new Error("wtf");
  }
  /** The path's commands, plus a straight line to fill each jump.  `original` is undefined for those lines. */
  const connected: {
    readonly command: Command;
    readonly original: number | undefined;
    readonly length: number;
    numberOfVertices: number;
  }[] = [];
  commands.forEach((command, index) => {
    connected.push({
      command,
      original: index,
      length: command.getLength(),
      numberOfVertices: 0,
    });
    const nextCommand = commands[(index + 1) % commands.length];
    if (PathShape.needAnM(command, nextCommand)) {
      const line = new LCommand(
        command.x,
        command.y,
        nextCommand.x0,
        nextCommand.y0,
      );
      connected.push({
        command: line,
        original: undefined,
        length: line.getLength(),
        numberOfVertices: 0,
      });
    }
  });
  {
    // Share out the samples by length, shortest first, at least one each.
    const working = connected.toSorted((a, b) => b.length - a.length);
    let verticesAvailable = numberOfSamples;
    let lengthAvailable = sum(working.map(({ length }) => length));
    while (verticesAvailable != 0) {
      const segmentInfo = assertNonNullable(working.pop());
      if (segmentInfo.length > 0) {
        const idealNumberOfVertices =
          (verticesAvailable / lengthAvailable) * segmentInfo.length;
        const numberOfVertices = Math.max(1, Math.round(idealNumberOfVertices));
        segmentInfo.numberOfVertices = numberOfVertices;
        verticesAvailable -= numberOfVertices;
        lengthAvailable -= segmentInfo.length;
      }
    }
  }
  const samples: Complex[] = [];
  const starts: number[] = [];
  for (const { command, original, numberOfVertices } of connected) {
    if (original !== undefined) {
      starts[original] = samples.length;
    }
    if (numberOfVertices == 1) {
      samples.push([command.x0, command.y0]);
    } else if (numberOfVertices > 1) {
      const splitter = command.makeSplitter();
      for (let i = 0; i < numberOfVertices; i++) {
        const { x, y } = splitter.at((splitter.length * i) / numberOfVertices);
        samples.push([x, y]);
      }
    }
  }
  starts.push(samples.length);
  return { samples, starts };
}

// MARK: Color runs

/** Some edges in a row, all the same color, and the range of `t` they become. */
export type ColorRun = {
  /** 1 for the circle, 2 for the fat star, 3 for the thin star. */
  readonly distance: number;
  /** `t` at the run's first vertex.  0 to 1. */
  readonly start: number;
  /** `t` at the run's last vertex. */
  readonly end: number;
};

/** Merge neighboring edges of the same color.  The first and last runs are never merged, even if they match. */
function colorRuns(starPath: StarPath, starts: readonly number[]): ColorRun[] {
  const count = starts[starts.length - 1];
  const runs: { distance: number; start: number; end: number }[] = [];
  for (const { distance, firstCommand, endCommand } of starPath.edges) {
    const start = starts[firstCommand] / count;
    const end = starts[endCommand] / count;
    const previous = runs.at(-1);
    if (previous?.distance === distance) {
      previous.end = end;
    } else {
      runs.push({ distance, start, end });
    }
  }
  return runs;
}

/** What a colored Fourier animation needs to know about one circuit. */
export type ColoredSource = {
  /** Largest first, straight from `samplesToFourier()`. */
  readonly terms: readonly FourierTerm[];
  /** In order, covering 0 to 1. */
  readonly runs: readonly ColorRun[];
};

/** Kept forever.  There are only a few circuits. */
const sourceCache = new Map<Circuit, ColoredSource>();

/**
 * The Fourier terms of a 7 pointed star circuit, and where each color goes.
 * Computed the first time it's needed.
 */
export function coloredSource(circuit: Circuit): ColoredSource {
  let source = sourceCache.get(circuit);
  if (!source) {
    const starPath = circuitToPath(7, circuit);
    const { samples, starts } = samplesWithStarts(starPath.pathShape);
    source = {
      terms: samplesToFourier(samples),
      runs: colorRuns(starPath, starts),
    };
    sourceCache.set(circuit, source);
  }
  return source;
}

// MARK: Frames

/** One frame of the animation, as a function, not a finished path. */
export type Frame = {
  /** The curve.  `t` from 0 to 1 is the whole loop. */
  readonly f: ParametricFunction;
  /** Only `t` from 0 to `end` is drawn.  Less than 1 while the dot grows into the first curve. */
  readonly end: number;
  /**
   * How many segments `PathShape.glitchFreeParametric()` should use for the whole loop.
   * 0 means `f` is a straight line or a single point.
   */
  readonly segments: number;
};

/** A copy of the private `makeEasing()` in the library's fourier-shared.ts. */
function makeEasing(x1: number, x2: number) {
  if (x1 >= x2) {
    throw new Error("wtf");
  }
  const inputMap = makeLinear(x1, 0, x2, 1);
  return (t: number) => {
    if (t <= x1) {
      return 0;
    } else if (t >= x2) {
      return 1;
    }
    return ease(inputMap(t));
  };
}

/**
 * A copy of the library's `getAnimationRules()` that returns each frame as a {@link Frame},
 * so the caller can draw any part of it.
 * The same curves, the same timing and the same number of segments.
 * @param terms In the order they're added, from `orderTerms()`.
 * @param keyframes From `orderTerms()`.
 * @returns One function for each step, from progress (0 to 1) to the frame.
 */
export function getFrameRules(
  terms: readonly FourierTerm[],
  keyframes: readonly number[],
): ((progress: number) => Frame)[] {
  const getMaxFrequency = (numberOfTerms: number) =>
    Math.max(
      ...terms.slice(0, numberOfTerms).map((term) => Math.abs(term.frequency)),
    );
  const recommendedNumberOfSegments = (numberOfTerms: number) =>
    numberOfTerms == 0 ? 8 : 8 * Math.min(getMaxFrequency(numberOfTerms), 110) + 7;
  return initializedArray(keyframes.length - 1, (index) => {
    const startingTermCount = keyframes[index];
    const endingTermCount = keyframes[index + 1];
    if (
      startingTermCount == 0 &&
      endingTermCount == 1 &&
      terms[0].frequency == 0
    ) {
      // A dot moves from the origin to the center of the curve.
      // It's a short line:  both ends start at the origin, and the leading end gets there first.
      const goal = assertNonNullable(hasFixedContribution(terms[0]));
      const getLeadingProgress = makeEasing(0, 0.5);
      const getTrailingProgress = makeEasing(0, 1);
      return (progress: number): Frame => {
        const from = getTrailingProgress(progress);
        const to = getLeadingProgress(progress);
        return {
          f: (t) => {
            const along = lerp(from, to, t);
            return { x: goal.x * along, y: goal.y * along };
          },
          end: 1,
          segments: 0,
        };
      };
    } else if (startingTermCount == endingTermCount) {
      const frame: Frame = {
        f: termsToParametricFunction(terms, startingTermCount),
        end: 1,
        segments: recommendedNumberOfSegments(endingTermCount),
      };
      return () => frame;
    } else {
      const firstInterestingFrequency = Math.abs(
        terms[startingTermCount].frequency,
      );
      /** How much of `t` is changing at once, on each side of the center of the change. */
      const r = 0.2 / firstInterestingFrequency;
      const tToCenter = makeBoundedLinear(0, -r, 1, 1 + r);
      const startingFunction = termsToParametricFunction(
        terms,
        startingTermCount,
      );
      const addingFunction = termsToParametricFunction(
        terms,
        endingTermCount - startingTermCount,
        startingTermCount,
      );
      const numberOfDisplaySegments =
        recommendedNumberOfSegments(endingTermCount);
      /** The new terms are all the way in before the change, and fade out across it. */
      const changingFunction = (centerOfChange: number): ParametricFunction => {
        const getFraction = makeEasing(centerOfChange - r, centerOfChange + r);
        return (t) => {
          const base = startingFunction(t);
          const fraction = 1 - getFraction(t);
          if (fraction == 0) {
            return base;
          }
          const adding = addingFunction(t);
          return {
            x: base.x + fraction * adding.x,
            y: base.y + fraction * adding.y,
          };
        };
      };
      if (
        startingTermCount == 0 ||
        (startingTermCount == 1 && hasFixedContribution(terms[0]))
      ) {
        // A dot grows into a curve.  Only the part the change has passed is drawn.
        const startingPoint = hasFixedContribution(terms[0]) ?? {
          x: 0,
          y: 0,
        };
        return (progress: number): Frame => {
          const centerOfChange = tToCenter(progress);
          const end = Math.min(1, centerOfChange + r);
          if (end <= 0) {
            return { f: () => startingPoint, end: 1, segments: 0 };
          }
          return {
            f: changingFunction(centerOfChange),
            end,
            segments: Math.max(numberOfDisplaySegments, 150),
          };
        };
      } else {
        return (progress: number): Frame => ({
          f: changingFunction(tToCenter(progress)),
          end: 1,
          segments: numberOfDisplaySegments,
        });
      }
    }
  });
}

// MARK: Drawing

/**
 * Draw one frame, each run of edges in its own color.
 *
 * Circle, then fat star, then thin star, the same order as the reference images.
 * Round caps, so where two colors meet, the one drawn later covers the joint with a round cap.
 * Uses the context's current line width.
 * @param fit From the star's own coordinates to the canvas.
 * @param colors The circle, the fat star and the thin star.
 */
export function drawColoredFrame(
  context: CanvasRenderingContext2D,
  frame: Frame,
  runs: readonly ColorRun[],
  fit: DOMMatrix,
  colors: readonly [string, string, string],
) {
  const { f, end, segments } = frame;
  /** The commands of each color, by distance:  1 for the circle, 2 the fat star, 3 the thin star. */
  const layers = [[], [], [], []] as Command[][];
  for (const run of runs) {
    if (run.start >= end) {
      break;
    }
    const runEnd = Math.min(run.end, end);
    const width = runEnd - run.start;
    let piece: PathShape;
    if (segments == 0) {
      const from = f(run.start);
      const to = f(runEnd);
      piece = PathBuilder.M(from.x, from.y).L(to.x, to.y).pathShape;
    } else {
      piece = PathShape.glitchFreeParametric(
        (s) => f(run.start + s * width),
        Math.max(2, Math.ceil(segments * width)),
      );
    }
    layers[run.distance].push(...piece.commands);
  }
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const distance of [1, 2, 3]) {
    if (layers[distance].length > 0) {
      context.strokeStyle = colors[distance - 1];
      context.stroke(new PathShape(layers[distance]).transform(fit).canvasPath);
    }
  }
}
