/**
 * A prototype:  three Multi Text effects that move every point of the text, built on `PathWarpEffect`.
 * Each is a function on the Multi Text's own coordinates (the slide's units, y down), so Center, radii and Center Y are where they look.
 * Put one directly inside a Multi Text.
 *
 * 1. **Zoom Into Circle**, a magnifying glass that bends the text around it.
 * 2. **Waves: Fixed Amplitude**, rows slide sideways by at most Amplitude, and the waves are tightest in the middle.
 * 3. **Waves: Fixed Frequency**, the same wave all the way down, fading in and out under a bell curve.
 *
 * The names, since the bell curve is everywhere here.  `erf` is the integral of a bell curve:  S shaped, from -1 far below to 1 far above.
 * In terms of a normal distribution with a **mean** μ and **standard deviation** σ, the bell is the *density*
 * `exp(-(y - μ)² / 2σ²)`, and `erf((y - μ) / (σ√2))` is the *cumulative distribution* stretched to run from -1 to 1.
 * (`erf`'s own bell, `exp(-x²)`, has a σ of 1/√2, so the √2 turns it into the usual one.)
 * Center Y is the mean and Standard Deviation is σ, in both wave effects.  About two thirds of the bell is within one σ of the center.
 *
 * @module
 */

import { FULL_CIRCLE } from "phil-lib/misc";
import {
  type Keyframe,
  NumberScheduleInfo,
  PointScheduleInfo,
} from "canvas-recorder-lib";
import type { Point } from "canvas-recorder-lib/src/glib/path-shape";
import { EditorMessage } from "./editor-messages.ts";
import { PathWarpEffect, registerPathWarp } from "./path-warp-effect.ts";
import type { PointFunction } from "./warped-path.ts";

// MARK: Options

/** A number, or its keyframes, as every schedule's `set()` takes. */
type NumberValue = number | readonly Keyframe<number>[];

/** What every effect here takes.  Leave a field out for its default. */
type BaseOptions = { maxSegment?: NumberValue };

// MARK: Math

/**
 * The error function, 2/√π times the integral of `exp(-t²)` from 0 to x.  Odd, and runs from -1 to 1.
 * Checked against known values to better than 1e-6, far finer than a pixel.  A series for |x| < 3, then the tail of erfc's asymptotic series.
 */
export function erf(x: number): number {
  if (Number.isNaN(x)) {
    return NaN;
  }
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  if (a >= 6) {
    return sign;
  }
  if (a < 3) {
    // erf(x) = 2/√π · exp(-x²) · Σ 2ⁿ x^(2n+1) / (1·3·5···(2n+1)).  Every term is positive, so nothing cancels.
    let term = a;
    let sum = a;
    for (let n = 1; n < 200; n++) {
      term *= (2 * a * a) / (2 * n + 1);
      sum += term;
      if (term < sum * 1e-17) {
        break;
      }
    }
    return (sign * 2 * Math.exp(-a * a) * sum) / Math.sqrt(Math.PI);
  }
  // The first terms of erfc's asymptotic series.
  const aa = a * a;
  const erfc =
    (Math.exp(-aa) / (a * Math.sqrt(Math.PI))) *
    (1 - 1 / (2 * aa) + 3 / (4 * aa * aa) - 15 / (8 * aa * aa * aa));
  return sign * (1 - erfc);
}

/** Degrees, as the GUI says, to radians. */
const toRadians = (degrees: number) => (degrees / 360) * FULL_CIRCLE;

/** The bell, 1 at the center, falling off with the standard deviation `sigma`.  `exp(-(y - μ)² / 2σ²)`.  Not a probability density:  its peak is 1. */
export function bell(y: number, center: number, sigma: number): number {
  const z = (y - center) / sigma;
  return Math.exp(-0.5 * z * z);
}

// MARK: Zoom

/**
 * Zoom into a circle.  Around `(centerX, centerY)`, with `r` the distance from it:
 * - `r ≤ zoomInputRadius`:  scaled about the center by `zoomOutputRadius / zoomInputRadius`.
 * - `zoomInputRadius < r < copyVerbatimRadius`:  the angle stays and the radius is a straight line from
 *   `zoomOutputRadius` (at the input radius) to `copyVerbatimRadius`, which doesn't move.  So this ring squeezes to make room.
 * - `r ≥ copyVerbatimRadius`:  copied as is.
 *
 * It works, with a jump, if the radii aren't in order.  Checks says what each mistake does.
 */
export function zoomWarp(
  centerX: number,
  centerY: number,
  zoomInputRadius: number,
  zoomOutputRadius: number,
  copyVerbatimRadius: number,
): PointFunction {
  const usable = [
    centerX,
    centerY,
    zoomInputRadius,
    zoomOutputRadius,
    copyVerbatimRadius,
  ].every(Number.isFinite);
  if (!usable || zoomInputRadius < 0 || zoomOutputRadius < 0) {
    // Said in Checks.  Don't move anything.
    return (point) => point;
  }
  return (point) => {
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const r = Math.hypot(dx, dy);
    if (!(r < copyVerbatimRadius) || r == 0) {
      // Outside, or the center itself, which stays.
      return point;
    }
    const newRadius =
      r <= zoomInputRadius
        ? (r * zoomOutputRadius) / zoomInputRadius
        : zoomOutputRadius +
          ((r - zoomInputRadius) * (copyVerbatimRadius - zoomOutputRadius)) /
            (copyVerbatimRadius - zoomInputRadius);
    const k = newRadius / r;
    return { x: centerX + dx * k, y: centerY + dy * k };
  };
}

/**
 * A magnifying glass over the text.
 *
 * Center is a point on the slide, in the Multi Text's coordinates, so its marker in the Visual Editor is where the glass is.
 * The three radii are in the same units:  Zoom Input Radius ≤ Zoom Output Radius ≤ Copy Verbatim Radius.
 * Everything inside the input circle is blown up to fill the output circle, and the ring out to Copy Verbatim Radius is squeezed to fit.
 * With the first two equal, nothing happens, so animate Zoom Output Radius up from Zoom Input Radius to zoom in.
 */
export class ZoomIntoCircle extends PathWarpEffect {
  readonly registryKey = "Zoom Into Circle";
  /** The middle of the glass, in the Multi Text's coordinates.  The default is the middle of a 16 × 9 slide. */
  readonly centerSchedule = new PointScheduleInfo("Center", { x: 8, y: 4.5 });
  /** Everything within this distance of Center is scaled up to fill Zoom Output Radius. */
  readonly zoomInputRadiusSchedule = new NumberScheduleInfo(
    "Zoom Input Radius",
    0.6,
  );
  /** Where the edge of the input circle ends up.  The magnification is this over the input radius. */
  readonly zoomOutputRadiusSchedule = new NumberScheduleInfo(
    "Zoom Output Radius",
    [
      { time: 0, value: 0.6 },
      { time: 3_000, value: 1.8 },
    ],
  );
  /** Beyond this distance from Center nothing moves.  Between the input radius and this is squeezed to make room. */
  readonly copyVerbatimRadiusSchedule = new NumberScheduleInfo(
    "Copy Verbatim Radius",
    3,
  );

  constructor(
    initialValues: BaseOptions & {
      center?: Point | readonly Keyframe<Point>[];
      zoomInputRadius?: NumberValue;
      zoomOutputRadius?: NumberValue;
      copyVerbatimRadius?: NumberValue;
    } = {},
  ) {
    super("Zoom Into Circle", initialValues);
    if (initialValues.center !== undefined)
      this.centerSchedule.set(initialValues.center);
    if (initialValues.zoomInputRadius !== undefined)
      this.zoomInputRadiusSchedule.set(initialValues.zoomInputRadius);
    if (initialValues.zoomOutputRadius !== undefined)
      this.zoomOutputRadiusSchedule.set(initialValues.zoomOutputRadius);
    if (initialValues.copyVerbatimRadius !== undefined)
      this.copyVerbatimRadiusSchedule.set(initialValues.copyVerbatimRadius);
    this.schedules.unshift(
      this.centerSchedule,
      this.zoomInputRadiusSchedule,
      this.zoomOutputRadiusSchedule,
      this.copyVerbatimRadiusSchedule,
    );
  }

  protected override makeWarp(timeInMs: number): PointFunction {
    const { x, y } = this.centerSchedule.at(timeInMs);
    return zoomWarp(
      x,
      y,
      this.zoomInputRadiusSchedule.at(timeInMs),
      this.zoomOutputRadiusSchedule.at(timeInMs),
      this.copyVerbatimRadiusSchedule.at(timeInMs),
    );
  }

  protected override parameterMessages(): EditorMessage[] {
    const messages: EditorMessage[] = [];
    // Each radius is linear between its keyframes, so if the order holds at every keyframe of any of them, it holds all the way.
    const times = [
      ...new Set(
        [
          this.zoomInputRadiusSchedule,
          this.zoomOutputRadiusSchedule,
          this.copyVerbatimRadiusSchedule,
        ].flatMap((schedule) => schedule.schedule.map(({ time }) => time)),
      ),
    ].sort((a, b) => a - b);
    const at = (time: number) => (times.length > 1 ? `At ${time} ms:  ` : "");
    for (const time of times) {
      const a = this.zoomInputRadiusSchedule.at(time);
      const b = this.zoomOutputRadiusSchedule.at(time);
      const c = this.copyVerbatimRadiusSchedule.at(time);
      if (![a, b, c].every(Number.isFinite) || a < 0 || b < 0 || c < 0) {
        messages.push({
          level: "warning",
          text: `${at(time)}A radius isn't a number, or is negative.  Nothing moves.`,
        });
      } else if (a <= 0) {
        messages.push({
          level: "warning",
          text: `${at(time)}Zoom Input Radius ${a} leaves nothing to zoom.  Only the center point is inside.`,
        });
      } else if (c <= a) {
        messages.push({
          level: "warning",
          text: `${at(time)}Copy Verbatim Radius ${c} isn't past Zoom Input Radius ${a}, so there's no ring to squeeze, and the text jumps at the edge.`,
        });
      } else if (b > c) {
        messages.push({
          level: "warning",
          text: `${at(time)}Zoom Output Radius ${b} is past Copy Verbatim Radius ${c}, so the ring turns inside out.  Try a smaller zoom, or a bigger Copy Verbatim Radius.`,
        });
      } else if (b < a) {
        messages.push({
          level: "note",
          text: `${at(time)}Zoom Output Radius ${b} is under Zoom Input Radius ${a}, so the inside shrinks instead of growing.`,
        });
      }
    }
    return messages;
  }
}

// MARK: Waves

/** What both wave effects take. */
type WaveOptions = BaseOptions & {
  centerY?: NumberValue;
  standardDeviation?: NumberValue;
  amplitude?: NumberValue;
  /** In degrees. */
  phase?: NumberValue;
};

/** Center Y, Standard Deviation, Amplitude and Phase, which both wave effects have. */
abstract class Waves extends PathWarpEffect {
  /** Where the bell is tallest, in the Multi Text's coordinates.  The default is the middle of a 9 unit tall slide. */
  readonly centerYSchedule = new NumberScheduleInfo("Center Y", 4.5);
  /** The bell's standard deviation σ, in the same units.  The effect is mostly within about 2σ of Center Y. */
  readonly standardDeviationSchedule = new NumberScheduleInfo(
    "Standard Deviation",
    1.5,
  );
  /** How far a point can move sideways, in the Multi Text's units.  Either direction. */
  readonly amplitudeSchedule = new NumberScheduleInfo("Amplitude", 0.3);
  /** Slides the wave along, in degrees.  360 is one whole cycle, back where it started. */
  readonly phaseSchedule = new NumberScheduleInfo("Phase (degrees)", [
    { time: 0, value: 0 },
    { time: 4_000, value: 360 },
  ]);

  constructor(description: string, initialValues: WaveOptions) {
    super(description, initialValues);
    if (initialValues.centerY !== undefined)
      this.centerYSchedule.set(initialValues.centerY);
    if (initialValues.standardDeviation !== undefined)
      this.standardDeviationSchedule.set(initialValues.standardDeviation);
    if (initialValues.amplitude !== undefined)
      this.amplitudeSchedule.set(initialValues.amplitude);
    if (initialValues.phase !== undefined)
      this.phaseSchedule.set(initialValues.phase);
  }

  /** The fields both have, in front of the subclass's own. */
  protected addCommonSchedules(...own: NumberScheduleInfo[]) {
    this.schedules.unshift(
      this.centerYSchedule,
      this.standardDeviationSchedule,
      this.amplitudeSchedule,
      ...own,
      this.phaseSchedule,
    );
  }

  protected commonMessages(): EditorMessage[] {
    const messages: EditorMessage[] = [];
    for (const { time, value } of this.standardDeviationSchedule.schedule) {
      if (!(value > 0)) {
        messages.push({
          level: "warning",
          text: `At ${time} ms:  Standard Deviation ${value} won't work.  Try a positive number, like 1.5.  Nothing moves.`,
        });
      }
    }
    return messages;
  }
}

/**
 * The fixed amplitude wave:  `x += amplitude · sin(phase + π · cycles · erf((y - centerY) / (σ√2)))`.
 *
 * The sine's argument is `erf`, which rises fastest at Center Y and flattens out above and below.  So the wave is as tight as it gets in the middle
 * and stretches out toward the top and bottom, but never gets taller or shorter than Amplitude.  "Cycles" is how many whole waves there are in all,
 * from the top of the bell to the bottom.
 *
 * Far from Center Y, the argument is nearly constant, so those rows all shift by the same amount, `amplitude · sin(phase ± π · cycles)`.
 * With a whole number of Cycles and Phase 0 that's 0, and as Phase changes the whole far field slides sideways together.
 */
export class WavesFixedAmplitude extends Waves {
  readonly registryKey = "Waves: Fixed Amplitude";
  /** How many whole waves from far above Center Y to far below it.  It doesn't have to be a whole number. */
  readonly cyclesSchedule = new NumberScheduleInfo("Cycles", 3);

  constructor(initialValues: WaveOptions & { cycles?: NumberValue } = {}) {
    super("Waves: Fixed Amplitude", initialValues);
    if (initialValues.cycles !== undefined)
      this.cyclesSchedule.set(initialValues.cycles);
    this.addCommonSchedules(this.cyclesSchedule);
  }

  protected override makeWarp(timeInMs: number): PointFunction {
    const centerY = this.centerYSchedule.at(timeInMs);
    // σ√2, so erf's own bell becomes a normal bell with this standard deviation.
    const scale = this.standardDeviationSchedule.at(timeInMs) * Math.SQRT2;
    const amplitude = this.amplitudeSchedule.at(timeInMs);
    const turns = Math.PI * this.cyclesSchedule.at(timeInMs);
    const phase = toRadians(this.phaseSchedule.at(timeInMs));
    return ({ x, y }) => ({
      x: x + amplitude * Math.sin(phase + turns * erf((y - centerY) / scale)),
      y,
    });
  }

  protected override parameterMessages(): EditorMessage[] {
    const messages = this.commonMessages();
    messages.push({
      level: "note",
      text: "Far above and below Center Y the rows all shift sideways together, by Amplitude × sin(Phase ± π × Cycles).  A whole number of Cycles and Phase 0 keep them still.",
    });
    return messages;
  }
}

/**
 * The fixed frequency wave:  `x += amplitude · bell(y) · sin(phase + 2π · frequency · (y - centerY))`.
 *
 * The bell is 1 at Center Y and falls off with Standard Deviation, so the wave fades in and out.  The wave itself is the same size everywhere:
 * Frequency is in cycles per unit of y.
 * The bell is the *density*, not `erf`:  `erf` itself is an S curve, which would flip the wave's direction above and below Center Y instead of fading it.
 */
export class WavesFixedFrequency extends Waves {
  readonly registryKey = "Waves: Fixed Frequency";
  /** Waves per unit of y, so 1 is a wave every unit.  Negative runs the other way, which is the same as a negative Phase. */
  readonly frequencySchedule = new NumberScheduleInfo(
    "Frequency (cycles per unit)",
    0.8,
  );

  constructor(initialValues: WaveOptions & { frequency?: NumberValue } = {}) {
    super("Waves: Fixed Frequency", initialValues);
    if (initialValues.frequency !== undefined)
      this.frequencySchedule.set(initialValues.frequency);
    this.addCommonSchedules(this.frequencySchedule);
  }

  protected override makeWarp(timeInMs: number): PointFunction {
    const centerY = this.centerYSchedule.at(timeInMs);
    const sigma = this.standardDeviationSchedule.at(timeInMs);
    const amplitude = this.amplitudeSchedule.at(timeInMs);
    const radiansPerUnit = FULL_CIRCLE * this.frequencySchedule.at(timeInMs);
    const phase = toRadians(this.phaseSchedule.at(timeInMs));
    return ({ x, y }) => ({
      x:
        x +
        amplitude *
          bell(y, centerY, sigma) *
          Math.sin(phase + radiansPerUnit * (y - centerY)),
      y,
    });
  }

  protected override parameterMessages(): EditorMessage[] {
    return this.commonMessages();
  }
}

// MARK: Registry

registerPathWarp(
  "Zoom Into Circle",
  "A prototype text effect:  a magnifying glass.  Inside the input radius the text is scaled up, and the ring around it is squeezed to make room.",
  ZoomIntoCircle,
);
registerPathWarp(
  "Waves: Fixed Amplitude",
  "A prototype text effect:  rows slide sideways by at most Amplitude, in waves that are tightest in the middle.",
  WavesFixedAmplitude,
);
registerPathWarp(
  "Waves: Fixed Frequency",
  "A prototype text effect:  rows slide sideways in waves of one frequency, under a bell curve that fades them in and out.",
  WavesFixedFrequency,
);
