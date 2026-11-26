/**
 * A prototype:  two more Multi Text effects, built on `PathWarpEffect` like the ones in `text-warps.ts`.
 * Both are **radial**:  each point keeps its angle around Center, and only its distance from Center changes.
 * So each is one function from the old distance to the new one, and everything interesting is the shape of that function.
 *
 * 1. **Eased Circle**, Zoom Into Circle with a smooth curve in place of three straight pieces, and one radius in place of three.
 * 2. **Ripples**, rings that move out from Center, like a pebble dropped in a pond.
 *
 * As in `text-warps.ts`, every distance is in the Multi Text's own coordinates, the slide's units, once the library passes `placed` (0.8.4).
 * @module
 */

import {
  ease,
  easeOut,
  type Keyframe,
  NumberScheduleInfo,
  PointScheduleInfo,
  SelectScheduleInfo,
} from "canvas-recorder-lib";
import type { Point } from "canvas-recorder-lib/src/glib/path-shape";
import { FULL_CIRCLE } from "phil-lib/misc";
import { EditorMessage } from "./editor-messages.ts";
import {
  type FieldUnits,
  PathWarpEffect,
  registerPathWarp,
} from "./path-warp-effect.ts";
import type { PointFunction } from "./warped-path.ts";

// MARK: Shared

/** A number, or its keyframes, as every schedule's `set()` takes. */
type NumberValue = number | readonly Keyframe<number>[];

/** A point, or its keyframes. */
type PointValue = Point | readonly Keyframe<Point>[];

/** Degrees, as the GUI says, to radians. */
const toRadians = (degrees: number) => (degrees / 360) * FULL_CIRCLE;

/**
 * Move every point toward or away from `center`, keeping its angle.
 * @param newRadius Takes the distance from `center` and returns the new distance.  A negative result goes through the center to the other side.
 */
export function radialWarp(
  center: Point,
  newRadius: (r: number) => number,
): PointFunction {
  return (point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const r = Math.hypot(dx, dy);
    if (r == 0) {
      return point;
    }
    const k = newRadius(r) / r;
    return { x: center.x + dx * k, y: center.y + dy * k };
  };
}

/**
 * Every time any of these schedules has a keyframe, in order.
 * Between keyframes each number is a straight line, so checking there catches most mistakes.
 */
function keyframeTimes(
  ...schedules: { readonly schedule: readonly { time: number }[] }[]
): number[] {
  return [
    ...new Set(
      schedules.flatMap((schedule) =>
        schedule.schedule.map(({ time }) => time),
      ),
    ),
  ].sort((a, b) => a - b);
}

/** "At 1500 ms:  ", or nothing when there's only one time to talk about. */
const atTime = (time: number, times: readonly number[]) =>
  times.length > 1 ? `At ${time} ms:  ` : "";

/** A number for a message:  3 significant digits, no trailing zeros. */
const show = (n: number) =>
  // Slopes are measured numerically, so a 0 comes out as 0.00000123.
  Math.abs(n) < 1e-4 ? "0" : String(Number(n.toPrecision(3)));

// MARK: Eased Circle

/**
 * The curves Eased Circle offers.  Each one, `g(t)`, runs from g(0) = 0 to g(1) = 1, where t is the distance from Center as a fraction of Effect Radius.
 * - `smooth`:  `t + t(1 - t)²`.  The center is magnified 2× at Strength 1, and the edge meets the untouched text with no crease.
 *   It's the cubic with those slopes at the ends, 2 and 1.  The recommendation.
 * - `ease out`:  the library's `easeOut()`, a quarter of a sine wave.  The center is magnified π/2 ≈ 1.57× at Strength 1,
 *   but the slope at the edge is 0, so the text just inside Effect Radius is crushed into a thin ring:  a crease.
 * - `ease in out`:  the library's `ease()`, half a cosine wave.  Its slope is 0 at both ends, so at Strength 1 the *center* is crushed to a point,
 *   the middle of the ring is blown up instead (π/2 ≈ 1.57× at half the radius), and the edge has the same crease as `ease out`:  a donut.
 */
export const EASING_CURVES = ["smooth", "ease out", "ease in out"] as const;
export type EasingCurve = (typeof EASING_CURVES)[number];

const CURVES: Readonly<Record<EasingCurve, (t: number) => number>> = {
  smooth: (t) => t + t * (1 - t) ** 2,
  "ease out": easeOut,
  "ease in out": ease,
};

/** The curve with this name, or `smooth` for anything else, like a bad value from an old save.  Checks says so. */
function curveFunction(name: string): (t: number) => number {
  return CURVES[name as EasingCurve] ?? CURVES.smooth;
}

/**
 * The new distance as a fraction of Effect Radius:  `f(t) = t + strength · (g(t) - t)`.
 * Strength 0 is the identity, and Strength 1 is the curve itself, `r → R · g(r / R)`.  In between, and beyond, it's a straight mix.
 */
export function easedProfile(
  curve: string,
  strength: number,
): (t: number) => number {
  const g = curveFunction(curve);
  return (t) => t + strength * (g(t) - t);
}

/**
 * Eased Circle's warp.  Inside `effectRadius` of `center`, a point at distance r goes to `effectRadius · f(r / effectRadius)`.  Outside, it stays.
 * Anything that doesn't work, like a radius of 0, returns the identity.  Checks says why.
 */
export function easedWarp(
  center: Point,
  effectRadius: number,
  curve: string,
  strength: number,
): PointFunction {
  if (
    !(effectRadius > 0) ||
    strength === 0 ||
    !Number.isFinite(strength) ||
    !Number.isFinite(center.x) ||
    !Number.isFinite(center.y)
  ) {
    return (point) => point;
  }
  const f = easedProfile(curve, strength);
  return radialWarp(center, (r) =>
    r >= effectRadius ? r : effectRadius * f(r / effectRadius),
  );
}

/**
 * The slope of `f` at the center and at the edge, and the range of Strength that keeps `f` from folding back on itself.
 * The slope at the center is the magnification there.  The slope at the edge, compared with 1, says how sharp the crease is.
 * `f` is linear in Strength, so `f' = 1 + strength · (g' - 1)` stays positive exactly when Strength is between the two limits.
 */
export function describeCurve(curve: string) {
  const g = curveFunction(curve);
  const h = 1e-6;
  const slope = (t: number) =>
    (g(Math.min(1, t + h)) - g(Math.max(0, t - h))) /
    (Math.min(1, t + h) - Math.max(0, t - h));
  let mostBelowOne = 0;
  let mostAboveOne = 0;
  for (let i = 0; i <= 1000; i++) {
    const s = slope(i / 1000);
    mostBelowOne = Math.max(mostBelowOne, 1 - s);
    mostAboveOne = Math.max(mostAboveOne, s - 1);
  }
  return {
    centerSlope: slope(0),
    edgeSlope: slope(1),
    /** The biggest Strength that doesn't fold.  `Infinity` if none does. */
    maxStrength: mostBelowOne > 0 ? 1 / mostBelowOne : Infinity,
    /** The most negative Strength that doesn't fold. */
    minStrength: mostAboveOne > 0 ? -1 / mostAboveOne : -Infinity,
  };
}

/**
 * A smoother Zoom Into Circle, with one radius instead of three.
 *
 * Inside Effect Radius of Center, the distance from Center goes through a curve, and outside it nothing moves.
 * The curve starts steep, so the middle is magnified, and flattens out, so the ring around it is squeezed to make room.
 * Strength 0 changes nothing, so animate Strength up from 0 to zoom in.  See `EASING_CURVES` for what each Curve does at Strength 1.
 * With Curve "smooth", Strength is the magnification at the center minus 1, and it folds above 3.
 */
export class EasedCircle extends PathWarpEffect {
  readonly registryKey = "Eased Circle";
  /** The middle of the lens, in the Multi Text's coordinates.  The default is the middle of a 16 × 9 slide. */
  readonly centerSchedule = new PointScheduleInfo("Center", { x: 8, y: 4.5 });
  /** Beyond this distance from Center nothing moves. */
  readonly effectRadiusSchedule = new NumberScheduleInfo("Effect Radius", 2.4);
  /** The shape of the lens.  See {@link EASING_CURVES}. */
  readonly curveSchedule = new SelectScheduleInfo<EasingCurve, EasingCurve>(
    "Curve",
    "smooth",
    EASING_CURVES,
  );
  /** 0 changes nothing.  1 is the Curve itself.  Not clamped:  Checks says when it folds. */
  readonly strengthSchedule = new NumberScheduleInfo("Strength", [
    { time: 0, value: 0 },
    { time: 3_000, value: 1 },
  ]);

  constructor(
    initialValues: {
      maxSegment?: NumberValue;
      center?: PointValue;
      effectRadius?: NumberValue;
      curve?: EasingCurve | readonly Keyframe<EasingCurve>[];
      strength?: NumberValue;
    } = {},
  ) {
    super("Eased Circle", initialValues);
    if (initialValues.center !== undefined)
      this.centerSchedule.set(initialValues.center);
    if (initialValues.effectRadius !== undefined)
      this.effectRadiusSchedule.set(initialValues.effectRadius);
    if (initialValues.curve !== undefined)
      this.curveSchedule.set(initialValues.curve);
    if (initialValues.strength !== undefined)
      this.strengthSchedule.set(initialValues.strength);
    this.schedules.unshift(
      this.centerSchedule,
      this.effectRadiusSchedule,
      this.curveSchedule,
      this.strengthSchedule,
    );
  }

  protected override makeWarp(timeInMs: number): PointFunction {
    return easedWarp(
      this.centerSchedule.at(timeInMs),
      this.effectRadiusSchedule.at(timeInMs),
      this.curveSchedule.at(timeInMs),
      this.strengthSchedule.at(timeInMs),
    );
  }

  protected override fieldUnits(): FieldUnits {
    return {
      points: [this.centerSchedule],
      lengths: [this.effectRadiusSchedule],
    };
  }

  protected override parameterMessages(): EditorMessage[] {
    const messages: EditorMessage[] = [];
    for (const { time, value } of this.curveSchedule.schedule) {
      if (!(EASING_CURVES as readonly string[]).includes(value)) {
        messages.push({
          level: "warning",
          text: `At ${time} ms:  Curve "${value}" isn't one I know.  Drawing "smooth".`,
        });
      }
    }
    for (const { time, value } of this.effectRadiusSchedule.schedule) {
      if (!(value > 0)) {
        messages.push({
          level: "warning",
          text: `At ${time} ms:  Effect Radius ${value} won't work.  Try a positive number, like 2.4.  Nothing moves.`,
        });
      }
    }
    // Strength is the only thing that changes the shape, so describe each Strength keyframe, with the curve in use then.
    const times = keyframeTimes(this.strengthSchedule, this.curveSchedule);
    for (const time of times) {
      const strength = this.strengthSchedule.at(time);
      if (strength === 0 || !Number.isFinite(strength)) {
        continue;
      }
      const curve = this.curveSchedule.at(time);
      const { centerSlope, edgeSlope, maxStrength, minStrength } =
        describeCurve(curve);
      const center = 1 + strength * (centerSlope - 1);
      const edge = 1 + strength * (edgeSlope - 1);
      const at = atTime(time, times);
      if (strength > maxStrength || strength < minStrength) {
        messages.push({
          level: "warning",
          text: `${at}Strength ${show(strength)} turns part of the lens inside out.  With "${curve}", ${show(minStrength)} to ${show(maxStrength)} doesn't.`,
        });
      }
      const crease =
        Math.abs(edge - 1) > 0.01
          ? `  At Effect Radius the text is ${show(edge)}× as thick as outside it:  a crease.`
          : "";
      messages.push({
        level: "note",
        text:
          `${at}"${curve}" at Strength ${show(strength)}:  ` +
          (Math.abs(center) < 0.01
            ? "the center is crushed to a point."
            : `the center is magnified ${show(center)}×.`) +
          crease,
      });
    }
    return messages;
  }
}

// MARK: Ripples

/**
 * How tall the ripples are at distance r from Center, as a fraction of Amplitude.  0 at the center, 1 at `peakRadius`, then falling off like `r ^ -falloffPower`.
 *
 * The shape is `u / (1 + u^q)`, with `q = 1 + falloffPower` and u proportional to r, scaled so the peak is 1 at `peakRadius`.
 * Near the center it's a straight line, so the center only breathes in and out a little, with no sharp point.
 * Ripples that spread out on a pond carry the same energy around a bigger and bigger circle, so their height falls like `1 / √r`:  `falloffPower` 0.5.
 * (`1 / r` is a sound wave spreading out in 3D.)  A real pond also loses some to friction, so a little more than 0.5 is fine too.
 * With `falloffPower` 0 or less it never falls off:  it rises like `tanh` and levels out at 1.
 */
export function rippleEnvelope(
  r: number,
  peakRadius: number,
  falloffPower: number,
): number {
  if (!(falloffPower > 0)) {
    return Math.tanh(r / peakRadius);
  }
  const q = 1 + falloffPower;
  // u / (1 + u^q) peaks where u^q = 1 / falloffPower.
  const uPeak = falloffPower ** (-1 / q);
  const peak = (uPeak * falloffPower) / (1 + falloffPower);
  const u = (uPeak * r) / peakRadius;
  return u / (1 + u ** q) / peak;
}

/**
 * 1 well inside `reach`, easing down to 0 over the last `width` before it, and 0 beyond.  The leading edge of the ripples.
 */
export function rippleFront(r: number, reach: number, width: number): number {
  if (r >= reach) {
    return 0;
  }
  if (r <= reach - width) {
    return 1;
  }
  return ease((reach - r) / width);
}

/** Everything Ripples needs, for one moment. */
export type RippleSettings = {
  readonly center: Point;
  /** Distance between crests. */
  readonly wavelength: number;
  /** How far a point moves, toward or away from Center, at the peak of the envelope. */
  readonly amplitude: number;
  /** Radians.  Increasing it moves the crests outward. */
  readonly phase: number;
  readonly peakRadius: number;
  readonly falloffPower: number;
  /** The leading edge.  Beyond it the water is still. */
  readonly reach: number;
};

/**
 * Ripples' warp:  a point at distance r moves to `r + amplitude · envelope(r) · front(r) · sin(2πr / wavelength - phase)`.
 *
 * Seen from above, what bends the picture under water is the *slope* of the surface, which pushes each point toward or away from Center.
 * So this moves points along the radius, not sideways.  A crest of the sine is where the text is pushed outward the most.
 */
export function rippleWarp(settings: RippleSettings): PointFunction {
  const {
    center,
    wavelength,
    amplitude,
    phase,
    peakRadius,
    falloffPower,
    reach,
  } = settings;
  if (
    !(wavelength > 0) ||
    !(peakRadius > 0) ||
    !(reach > 0) ||
    amplitude === 0 ||
    ![amplitude, phase, falloffPower, center.x, center.y].every(Number.isFinite)
  ) {
    return (point) => point;
  }
  const k = FULL_CIRCLE / wavelength;
  return radialWarp(
    center,
    (r) =>
      r +
      amplitude *
        rippleEnvelope(r, peakRadius, falloffPower) *
        rippleFront(r, reach, wavelength) *
        Math.sin(k * r - phase),
  );
}

/**
 * The biggest Amplitude that never folds the text over itself, at any phase.
 *
 * The new radius is `r + A · E(r) · sin(kr - φ)`, where E includes the front.  Its slope is `1 + A · (E' sin + E k cos)`,
 * and over every φ the most negative that bracket gets is `-√(E'² + (E k)²)`.  So it's safe while A is under 1 over the largest of those.
 * Checked numerically out to where the ripples stop.
 */
export function maxSafeAmplitude(
  settings: Omit<RippleSettings, "amplitude" | "phase" | "center">,
): number {
  const { wavelength, peakRadius, falloffPower, reach } = settings;
  const k = FULL_CIRCLE / wavelength;
  const envelope = (r: number) =>
    rippleEnvelope(r, peakRadius, falloffPower) *
    rippleFront(r, reach, wavelength);
  const end = Math.min(reach, 100 * peakRadius, 1000);
  const step = Math.max(end / 20_000, Math.min(wavelength, peakRadius) / 50);
  let worst = 0;
  for (let r = step; r < end; r += step) {
    const value = envelope(r);
    const slope = (envelope(r + step / 2) - envelope(r - step / 2)) / step;
    worst = Math.max(worst, Math.hypot(slope, value * k));
  }
  return worst > 0 ? 1 / worst : Infinity;
}

/**
 * Ripples on a pond, spreading out from Center.  Each point moves toward or away from Center, by a sine wave in its distance.
 *
 * Increase Phase to move the crests outward:  each 360° moves them one Wavelength.  Reach is the leading edge, still water beyond it.
 * Grow Reach from 0 for the moment the pebble drops.
 * The ripples are tallest at Peak Radius and fade toward the center, so the center never makes a sharp point, and fall off outside it by Falloff Power.
 * Too much Amplitude for the Wavelength folds the text over itself at the crests.  Checks says how much is safe.
 */
export class Ripples extends PathWarpEffect {
  readonly registryKey = "Ripples";
  /** Where the pebble went in, in the Multi Text's coordinates.  The default is the middle of a 16 × 9 slide. */
  readonly centerSchedule = new PointScheduleInfo("Center", { x: 8, y: 4.5 });
  /** The distance from one crest to the next.  0.9 puts 5 between the middle of a 16 × 9 slide and its top. */
  readonly wavelengthSchedule = new NumberScheduleInfo("Wavelength", 0.9);
  /** How far the text moves, toward or away from Center, where the ripples are tallest.  Too much folds it.  See Checks. */
  readonly amplitudeSchedule = new NumberScheduleInfo("Amplitude", 0.1);
  /** In degrees.  Increasing moves the crests outward, a Wavelength for each 360°. */
  readonly phaseSchedule = new NumberScheduleInfo("Phase (degrees)", [
    { time: 0, value: 0 },
    { time: 10_000, value: 3600 },
  ]);
  /** Where the ripples are tallest.  Inside, they fade to nothing at Center. */
  readonly peakRadiusSchedule = new NumberScheduleInfo("Peak Radius", 1);
  /** How fast they fade beyond Peak Radius:  height ∝ r ^ -power.  0.5 is a pond.  0 never fades. */
  readonly falloffPowerSchedule = new NumberScheduleInfo("Falloff Power", 0.5);
  /** The leading edge:  still water beyond this distance from Center.  Grow it from 0 to drop the pebble. */
  readonly reachSchedule = new NumberScheduleInfo("Reach", [
    { time: 0, value: 0 },
    { time: 8_000, value: 10 },
  ]);

  constructor(
    initialValues: {
      maxSegment?: NumberValue;
      center?: PointValue;
      wavelength?: NumberValue;
      amplitude?: NumberValue;
      phase?: NumberValue;
      peakRadius?: NumberValue;
      falloffPower?: NumberValue;
      reach?: NumberValue;
    } = {},
  ) {
    super("Ripples", initialValues);
    if (initialValues.center !== undefined)
      this.centerSchedule.set(initialValues.center);
    if (initialValues.wavelength !== undefined)
      this.wavelengthSchedule.set(initialValues.wavelength);
    if (initialValues.amplitude !== undefined)
      this.amplitudeSchedule.set(initialValues.amplitude);
    if (initialValues.phase !== undefined)
      this.phaseSchedule.set(initialValues.phase);
    if (initialValues.peakRadius !== undefined)
      this.peakRadiusSchedule.set(initialValues.peakRadius);
    if (initialValues.falloffPower !== undefined)
      this.falloffPowerSchedule.set(initialValues.falloffPower);
    if (initialValues.reach !== undefined)
      this.reachSchedule.set(initialValues.reach);
    this.schedules.unshift(
      this.centerSchedule,
      this.wavelengthSchedule,
      this.amplitudeSchedule,
      this.phaseSchedule,
      this.peakRadiusSchedule,
      this.falloffPowerSchedule,
      this.reachSchedule,
    );
  }

  /** Every setting at this time. */
  settingsAt(timeInMs: number): RippleSettings {
    return {
      center: this.centerSchedule.at(timeInMs),
      wavelength: this.wavelengthSchedule.at(timeInMs),
      amplitude: this.amplitudeSchedule.at(timeInMs),
      phase: toRadians(this.phaseSchedule.at(timeInMs)),
      peakRadius: this.peakRadiusSchedule.at(timeInMs),
      falloffPower: this.falloffPowerSchedule.at(timeInMs),
      reach: this.reachSchedule.at(timeInMs),
    };
  }

  protected override makeWarp(timeInMs: number): PointFunction {
    return rippleWarp(this.settingsAt(timeInMs));
  }

  protected override fieldUnits(): FieldUnits {
    return {
      points: [this.centerSchedule],
      lengths: [
        this.wavelengthSchedule,
        this.amplitudeSchedule,
        this.peakRadiusSchedule,
        this.reachSchedule,
      ],
    };
  }

  protected override parameterMessages(): EditorMessage[] {
    const messages: EditorMessage[] = [];
    for (const [schedule, example] of [
      [this.wavelengthSchedule, 0.9],
      [this.peakRadiusSchedule, 1],
    ] as const) {
      for (const { time, value } of schedule.schedule) {
        if (!(value > 0)) {
          messages.push({
            level: "warning",
            text: `At ${time} ms:  ${schedule.description} ${value} won't work.  Try a positive number, like ${example}.  Nothing moves.`,
          });
        }
      }
    }
    // Phase never changes whether it folds, so leave it out.
    const times = keyframeTimes(
      this.wavelengthSchedule,
      this.amplitudeSchedule,
      this.peakRadiusSchedule,
      this.falloffPowerSchedule,
      this.reachSchedule,
    );
    /** The smallest safe Amplitude among the keyframes, for the note when nothing folds. */
    let strictest = Infinity;
    let folds = false;
    for (const time of times) {
      const settings = this.settingsAt(time);
      const { amplitude, wavelength, peakRadius, reach } = settings;
      if (!(wavelength > 0 && peakRadius > 0 && reach > 0) || amplitude == 0) {
        continue;
      }
      const safe = maxSafeAmplitude(settings);
      strictest = Math.min(strictest, safe);
      if (Math.abs(amplitude) > safe) {
        folds = true;
        messages.push({
          level: "warning",
          text: `${atTime(time, times)}Amplitude ${show(amplitude)} folds the text over itself near the crests.  Up to ${show(safe)} doesn't, with this Wavelength.`,
        });
      }
    }
    if (!folds && Number.isFinite(strictest)) {
      messages.push({
        level: "note",
        text: `Amplitude up to ${show(strictest)} doesn't fold the text, with these settings.  More than that folds it over itself near the crests.`,
      });
    }
    return messages;
  }
}

// MARK: Registry

registerPathWarp(
  "Eased Circle",
  "A prototype text effect:  a lens, like Zoom Into Circle but with one smooth curve and one radius.  Strength 0 changes nothing.",
  EasedCircle,
);
registerPathWarp(
  "Ripples",
  "A prototype text effect:  ripples on a pond, moving out from Center.  Increase Phase to move them, and grow Reach to drop the pebble.",
  Ripples,
);
