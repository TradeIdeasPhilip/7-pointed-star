/**
 * A prototype, a strawman:  apply a function to every point of a path, and watch what happens.
 * The idea is to make interesting animations by feeding an arbitrary path through various functions.
 *
 * One frame:
 * 1. **Path → samples.**  The library's `samplesFromPath()`, the one the Fourier components use.
 *    Every point the path names is a sample, the long edges get more, and the gaps between pieces are filled with straight lines.
 *    Done once, then cached.
 * 2. **A function moves each sample.**  Here, one function:  `polarWarp()`.  Override `makeWarp()` for another.
 * 3. **New samples → PathShape.**  `samplesToPathShape()`:  straight lines, closed.
 * 4. **Fit it into Dest Rect and stroke it.**
 *
 * In the finished state the function is the identity, so the picture is the path exactly as drawn.
 *
 * The path should be one connected piece.  More than that is a warning in the Visual Editor, not an error:
 * the gaps are joined with straight lines, as in the Fourier component.  Ideally each piece would get its own component.
 *
 * Registered as "Warped Path".
 * @module
 */

import { FULL_CIRCLE, ReadOnlyRect } from "phil-lib/misc";
import {
  ColorScheduleInfo,
  componentRegistry,
  DurationAgnosticComponent,
  Keyframe,
  NumberScheduleInfo,
  RectangleScheduleInfo,
  ShowOptions,
  StringScheduleInfo,
} from "canvas-recorder-lib";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import {
  LCommand,
  PathShape,
  type Point,
} from "canvas-recorder-lib/src/glib/path-shape";
import { panAndZoom } from "canvas-recorder-lib/src/glib/transforms";
import {
  makePolygon,
  samplesFromPath,
} from "canvas-recorder-lib/src/peano-fourier/fourier-shared";
import { EditorMessage, HasEditorMessages } from "./editor-messages.ts";

// MARK: Paths

/**
 * The unit circle, starting at the top and going clockwise on the screen, like the stars below.
 * Two half circles, because an arc can't start and end at the same point.  Needs library 0.8.3 or later, for arcs.
 */
export const CIRCLE_PATH = "M0-1A1 1 0 0 1 0 1A1 1 0 0 1 0-1Z";

/**
 * The 7 pointed stars, as path strings, in the same place and orientation as the circle:  vertices on the unit circle, one at the top.
 * The same shapes as "7-Star: fat" and "7-Star: thin" in `star-sources.ts`.
 * @param step 2 for the fat star, {7/2}.  3 for the thin star, {7/3}.
 */
export function starPath(step: 2 | 3): string {
  return makePolygon(7, step - 1, undefined, 0).transform(
    new DOMMatrix().rotate(-90),
  ).rawPath;
}

// MARK: The functions

/** One point in, one point out. */
export type PointFunction = (point: Point) => Point;

/**
 * Polar coordinates around the origin, in the path's own units.
 * * The radius becomes `Math.max(0, radius - radiusOffset)`.  It never goes below 0.
 * * The angle becomes `angle + angleRadians`.  Not clamped, so it can be anything.
 *
 * An offset of 0 and an angle of 0 is the identity, exactly:  the point comes back untouched.
 * A point at the origin stays there, unless the offset is negative.  `Math.atan2(0, 0)` is 0, which is fine.
 * @param radiusOffset In the path's units.  Positive pulls every point toward the origin.
 * @param angleRadians Positive is clockwise on the screen, since y points down.
 */
export function polarWarp(
  radiusOffset: number,
  angleRadians: number,
): PointFunction {
  if (radiusOffset === 0 && angleRadians === 0) {
    return (point) => point;
  }
  return ({ x, y }) => {
    const radius = Math.max(0, Math.hypot(x, y) - radiusOffset);
    const angle = Math.atan2(y, x) + angleRadians;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  };
}

// MARK: Samples to path

/**
 * Straight lines through the samples, and one more from the last back to the first.
 * The samples are a closed curve, like the Fourier components' samples.
 * The path ends exactly where it started, so the canvas closes it and the start joins smoothly.
 */
export function samplesToPathShape(samples: readonly Point[]): PathShape {
  const commands = samples.map((from, index) => {
    const to = samples[(index + 1) % samples.length];
    return new LCommand(from.x, from.y, to.x, to.y);
  });
  return new PathShape(commands);
}

// MARK: Reading the path

/** What the Path field says, and what the Visual Editor needs to know about it. */
type ParsedPath = {
  readonly shape: PathShape;
  /** How many pieces, separated by moves.  The path should be 1. */
  readonly pieces: number;
  /** One piece that ends where it starts.  Otherwise a line is drawn back to the start. */
  readonly closed: boolean;
};

/** @returns Or why not.  A user error, for the editor's Checks. */
function parsePath(text: string): ParsedPath | string {
  let shape: PathShape;
  try {
    shape = PathShape.fromRawString(text);
  } catch (reason) {
    return reason instanceof Error ? reason.message : String(reason);
  }
  if (shape.isEmpty) {
    return "There's nothing to draw.  Try `M0-1A1 1 0 0 1 0 1A1 1 0 0 1 0-1Z`, a circle.";
  }
  const pieces = shape.splitOnMove().length;
  const gap = Math.hypot(
    shape.endX! - shape.startX!,
    shape.endY! - shape.startY!,
  );
  return { shape, pieces, closed: pieces == 1 && gap < 1e-6 };
}

/** The fewest and the most samples we'll ask for. */
const MIN_SAMPLES = 4;
const MAX_SAMPLES = 10_000;

/** A whole number in range, whatever was typed.  `samplesFromPath()` is only safe with whole numbers. */
function usableSampleCount(typed: number) {
  return Math.min(MAX_SAMPLES, Math.max(MIN_SAMPLES, Math.round(typed) || 0));
}

// MARK: The component

/**
 * Any path, with its points moved by a function that changes over time.
 *
 * Radius Offset and Angle are keyframed.  The defaults start with every point at the center and end at the identity.
 * The finished picture fits inside Dest Rect, centered, keeping its shape.  Source Rect says which part of the path's
 * own coordinates that is, so several components with different paths can share one scale.
 *
 * A DurationAgnosticComponent, like Star Circuit:  Min Duration is 0 by default, so the scene sets the length.
 *
 * In the Visual Editor, the Checks box says whether the path is one connected piece.
 */
export class WarpedPath
  extends DurationAgnosticComponent
  implements HasEditorMessages
{
  readonly registryKey = "Warped Path";
  /** An SVG path, in its own coordinates, around the origin.  All commands work, arcs included. */
  readonly pathSchedule = new StringScheduleInfo("Path", CIRCLE_PATH);
  /**
   * How far every point moves toward the origin, in the path's own units.
   * The default is 1 unit at the start, which pulls the unit circle, or a star on it, into a dot.  0 at the end is the identity.
   */
  readonly radiusOffsetSchedule = new NumberScheduleInfo("Radius Offset", [
    { time: 0, value: 1 },
    { time: 10_000, value: 0 },
  ]);
  /** How far every point turns around the origin, in degrees.  Positive is clockwise.  Not clamped. */
  readonly angleSchedule = new NumberScheduleInfo("Angle (degrees)", 0);
  /** How many points to sample from the path.  More is smoother and slower.  Whole numbers from 4 to 10,000. */
  readonly samplesSchedule = new NumberScheduleInfo("Samples", 1024);
  /**
   * The part of the path's own coordinates that fits in Dest Rect.
   * The default is the square around the unit circle, which is all of `CIRCLE_PATH` and `starPath()`.
   */
  readonly sourceRectSchedule = new RectangleScheduleInfo("Source Rect", {
    x: -1,
    y: -1,
    width: 2,
    height: 2,
  });
  /** Where it goes on the canvas.  Same default as Bridged Path:  fits both videos. */
  readonly destRectSchedule = new RectangleScheduleInfo("Dest Rect", {
    x: 0.5,
    y: 0.5,
    width: 8,
    height: 8,
  });
  readonly colorSchedule = new ColorScheduleInfo("Color", myRainbow.red);
  /** In units, so it doesn't grow or shrink with Dest Rect.  0 draws nothing. */
  readonly lineWidthSchedule = new NumberScheduleInfo("Line Width", 0.05);

  constructor(
    initialValues: {
      description?: string;
      path?: string | readonly Keyframe<string>[];
      radiusOffset?: number | readonly Keyframe<number>[];
      angle?: number | readonly Keyframe<number>[];
      samples?: number | readonly Keyframe<number>[];
      sourceRect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      destRect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      color?: string | readonly Keyframe<string>[];
      lineWidth?: number | readonly Keyframe<number>[];
      /** How long to ask the parent for.  0 by default:  nothing on the timeline, and the parent sets the length. */
      minDuration?: number;
    } = {},
  ) {
    super(initialValues.description ?? "Warped Path");
    if (initialValues.path !== undefined)
      this.pathSchedule.set(initialValues.path);
    if (initialValues.radiusOffset !== undefined)
      this.radiusOffsetSchedule.set(initialValues.radiusOffset);
    if (initialValues.angle !== undefined)
      this.angleSchedule.set(initialValues.angle);
    if (initialValues.samples !== undefined)
      this.samplesSchedule.set(initialValues.samples);
    if (initialValues.sourceRect !== undefined)
      this.sourceRectSchedule.set(initialValues.sourceRect);
    if (initialValues.destRect !== undefined)
      this.destRectSchedule.set(initialValues.destRect);
    if (initialValues.color !== undefined)
      this.colorSchedule.set(initialValues.color);
    if (initialValues.lineWidth !== undefined)
      this.lineWidthSchedule.set(initialValues.lineWidth);
    this.minDurationScalar.value = initialValues.minDuration ?? 0;
    this.schedules.push(
      this.pathSchedule,
      this.radiusOffsetSchedule,
      this.angleSchedule,
      this.samplesSchedule,
      this.sourceRectSchedule,
      this.destRectSchedule,
      this.colorSchedule,
      this.lineWidthSchedule,
    );
  }

  /** The function that moves each point.  Override this to try another one.  `timeInMs` is the scene's time. */
  protected makeWarp(timeInMs: number): PointFunction {
    return polarWarp(
      this.radiusOffsetSchedule.at(timeInMs),
      (this.angleSchedule.at(timeInMs) / 360) * FULL_CIRCLE,
    );
  }

  // MARK: Caches

  /** The last path text.  Never more than one entry. */
  #parsed:
    { readonly text: string; readonly result: ParsedPath | string } | undefined;
  #parsedAt(timeInMs: number) {
    const text = this.pathSchedule.at(timeInMs);
    if (this.#parsed?.text !== text) {
      this.#parsed = { text, result: parsePath(text) };
    }
    return this.#parsed.result;
  }

  /** The samples for the last path and count.  Never more than one entry. */
  #sampled:
    | {
        readonly shape: PathShape;
        readonly count: number;
        readonly samples: readonly Point[];
      }
    | undefined;
  #samplesFor(shape: PathShape, count: number): readonly Point[] {
    if (this.#sampled?.shape !== shape || this.#sampled.count !== count) {
      let samples: Point[];
      try {
        samples = samplesFromPath(shape, count).map(([x, y]) => ({ x, y }));
      } catch (reason) {
        // A path with no length, for example.  Nothing to move.
        console.warn("Warped Path couldn't sample the path.", reason);
        samples = [];
      }
      this.#sampled = { shape, count, samples };
    }
    return this.#sampled.samples;
  }

  // MARK: Visual Editor

  /** For the Visual Editor's Checks:  is the path one connected piece, and are the numbers usable? */
  editorMessages(): EditorMessage[] {
    const messages: EditorMessage[] = [];
    const pathKeyframes = this.pathSchedule.schedule;
    /** Says which keyframe, when there's more than one. */
    const at = (time: number) =>
      pathKeyframes.length > 1 ? `At ${time} ms:  ` : "";
    for (const { time, value } of pathKeyframes) {
      const parsed = parsePath(value);
      if (typeof parsed == "string") {
        messages.push({
          level: "error",
          text: `${at(time)}Path:  ${parsed}`,
        });
      } else if (parsed.pieces > 1) {
        messages.push({
          level: "warning",
          text:
            `${at(time)}Path:  ${parsed.pieces} pieces.  The gaps are joined with straight lines, as in the Fourier component.  ` +
            `Ideally each piece gets its own component.`,
        });
      } else if (!parsed.closed) {
        messages.push({
          level: "warning",
          text: `${at(time)}Path:  not closed.  A straight line from its end back to its start is drawn too, as in the Fourier component.`,
        });
      } else {
        messages.push({
          level: "ok",
          text: `${at(time)}Path:  one closed piece`,
        });
      }
    }
    for (const { time, value } of this.samplesSchedule.schedule) {
      if (
        !Number.isInteger(value) ||
        value < MIN_SAMPLES ||
        value > MAX_SAMPLES
      ) {
        messages.push({
          level: "warning",
          text: `At ${time} ms:  Samples ${value} won't work.  Use a whole number from ${MIN_SAMPLES} to ${MAX_SAMPLES}.  Drawing ${usableSampleCount(value)}.`,
        });
      }
    }
    for (const schedule of [this.sourceRectSchedule, this.destRectSchedule]) {
      for (const { time, value } of schedule.schedule) {
        if (!(value.width > 0 && value.height > 0)) {
          messages.push({
            level: "warning",
            text: `At ${time} ms:  ${schedule.description} needs a positive width and height.  Nothing is drawn.`,
          });
        }
      }
    }
    return messages;
  }

  // MARK: Drawing

  override show(options: ShowOptions): void {
    // Any children first, under the path, as in the Fourier components.
    super.show(options);
    const { context, timeInMs } = options;
    const lineWidth = this.lineWidthSchedule.at(timeInMs);
    // The canvas ignores a line width of 0 or less, and keeps the last one.
    if (!(lineWidth > 0)) {
      return;
    }
    const sourceRect = this.sourceRectSchedule.at(timeInMs);
    const destRect = this.destRectSchedule.at(timeInMs);
    if (
      !(sourceRect.width > 0 && sourceRect.height > 0) ||
      !(destRect.width > 0 && destRect.height > 0)
    ) {
      // Said in the editor's Checks.
      return;
    }
    const parsed = this.#parsedAt(timeInMs);
    if (typeof parsed == "string") {
      // Said in the editor's Checks.
      return;
    }
    const samples = this.#samplesFor(
      parsed.shape,
      usableSampleCount(this.samplesSchedule.at(timeInMs)),
    );
    if (samples.length == 0) {
      return;
    }
    const warp = this.makeWarp(timeInMs);
    const fit = panAndZoom(sourceRect, destRect, "meet");
    const path = samplesToPathShape(
      samples.map((sample) => {
        const { x, y } = fit.transformPoint(warp(sample));
        return { x, y };
      }),
    );
    context.save();
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = this.colorSchedule.at(timeInMs);
    context.stroke(path.canvasPath);
    context.restore();
  }
}

// MARK: Registry

componentRegistry.set("Warped Path", {
  create() {
    return new WarpedPath();
  },
  description:
    "A prototype:  any path with every point moved by a function, polar to start.  " +
    "Radius Offset pulls the points toward the center, and Angle turns them around it.  " +
    "Both end at 0, which is the path as drawn.",
  howToGenerate: { type: "class", class: WarpedPath },
});
