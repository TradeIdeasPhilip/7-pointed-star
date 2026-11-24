/**
 * A prototype, the second version of Warped Path:  the same path, but the turn depends on how far each point is from the origin.
 * The aim is pleasing curves.  A straight line becomes a spiral, as if the path were a string dragged through a thick fluid.
 *
 * It's a subclass of `WarpedPath`, so the first version, and anything saved with it, is untouched.
 * Only `makeWarp()` and the editor's checks change, plus three new fields.
 *
 * For each point, in order:
 * 1. Move toward the origin by Radius Offset, never past it, as before.  Call the new distance `r`.
 * 2. Turn it by Angle, as before.  Every point turns the same amount.
 * 3. Then turn it by Twist, scaled by `(1 - r / Effect Radius) ** Falloff Power`.
 *    The center gets all of Twist, and the points at Effect Radius or farther get none.  With Falloff Power 1 that's linear.
 *
 * "The rim leads and the inside lags" is Angle = A and Twist = -A.  A point at the rim turns A, and one halfway in turns A / 2.
 * "The center leads" is Twist alone.  They differ by one rigid turn of the whole picture, so these two fields cover both.
 * To straighten it out again:  take Twist to 0, which is the identity, or shrink Effect Radius to 0 to pull the swirl into the center.
 *
 * Step 3 uses the distance after step 1, so the swirl is a field fixed on the screen, and the shrinking path moves through it.
 *
 * TODO:  It inherits Warped Path's "one connected piece" requirement, which we'll eventually remove.  See the top of `warped-path.ts`.
 * @module
 */

import { FULL_CIRCLE } from "phil-lib/misc";
import {
  componentRegistry,
  Keyframe,
  NumberScheduleInfo,
} from "canvas-recorder-lib";
import { PathShape } from "canvas-recorder-lib/src/glib/path-shape";
import { samplesFromPath } from "canvas-recorder-lib/src/peano-fourier/fourier-shared";
import { EditorMessage } from "./editor-messages.ts";
import { PointFunction, WarpedPath } from "./warped-path.ts";

// MARK: The function

/**
 * `polarWarp()` plus a twist that fades out with the distance from the origin.  See the module comment.
 * @param radiusOffset In the path's units.  Positive pulls every point toward the origin, never past it.
 * @param angleRadians Every point turns this much.  Positive is clockwise on the screen, since y points down.
 * @param twistRadians How much the point at the origin turns, on top of `angleRadians`.
 * @param effectRadius The distance at which the twist reaches 0, and beyond which there is none.  0 or less means no twist.
 * @param falloffPower 1 is linear.  2 and up leave the twist's edge smooth, with no crease where it ends.
 */
export function twistWarp(
  radiusOffset: number,
  angleRadians: number,
  twistRadians: number,
  effectRadius: number,
  falloffPower: number,
): PointFunction {
  if (radiusOffset === 0 && angleRadians === 0 && twistRadians === 0) {
    return (point) => point;
  }
  const twisting = twistRadians !== 0 && effectRadius > 0;
  return ({ x, y }) => {
    const radius = Math.max(0, Math.hypot(x, y) - radiusOffset);
    let turn = angleRadians;
    if (twisting && radius < effectRadius) {
      turn += twistRadians * (1 - radius / effectRadius) ** falloffPower;
    }
    const angle = Math.atan2(y, x) + turn;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  };
}

/** How far the farthest sample of the path is from the origin, or `undefined` if there's no path.  For the editor's note. */
function farthestPoint(text: string): number | undefined {
  try {
    const samples = samplesFromPath(PathShape.fromRawString(text), 1024);
    return Math.max(...samples.map(([x, y]) => Math.hypot(x, y)));
  } catch {
    // The base class's checks already say what's wrong with the path.
    return undefined;
  }
}

/** Degrees, as the GUI says, to radians. */
const toRadians = (degrees: number) => (degrees / 360) * FULL_CIRCLE;

// MARK: The component

/** The base class's options, which this class takes too. */
type WarpedPathOptions = NonNullable<
  ConstructorParameters<typeof WarpedPath>[0]
>;

/**
 * A Warped Path where the turn depends on the distance from the origin.  See the module comment.
 *
 * The defaults start with every point at the center and a full turn of twist, and end at the identity.
 * Effect Radius is in the path's units, 1 by default:  the radius of the unit circle and of the stars on it.
 * It isn't taken from Source Rect, which is only the window, and can show more or less than the path.
 * Checks says how far the path's farthest point is, to help pick a value.
 */
export class TwistedPath extends WarpedPath {
  override readonly registryKey = "Twisted Path";
  /** How much the point at the origin turns, on top of Angle, in degrees.  Fades to 0 at Effect Radius.  Not clamped. */
  readonly twistSchedule = new NumberScheduleInfo("Twist (degrees)", [
    { time: 0, value: 360 },
    { time: 10_000, value: 0 },
  ]);
  /** How far from the origin the twist reaches, in the path's units.  0 or less means no twist. */
  readonly effectRadiusSchedule = new NumberScheduleInfo("Effect Radius", 1);
  /** 1 fades the twist out in a straight line.  2 or more is smooth where it ends.  Must be above 0. */
  readonly falloffPowerSchedule = new NumberScheduleInfo("Falloff Power", 1);

  constructor(
    initialValues: WarpedPathOptions & {
      twist?: number | readonly Keyframe<number>[];
      effectRadius?: number | readonly Keyframe<number>[];
      falloffPower?: number | readonly Keyframe<number>[];
    } = {},
  ) {
    super({
      ...initialValues,
      description: initialValues.description ?? "Twisted Path",
    });
    if (initialValues.twist !== undefined)
      this.twistSchedule.set(initialValues.twist);
    if (initialValues.effectRadius !== undefined)
      this.effectRadiusSchedule.set(initialValues.effectRadius);
    if (initialValues.falloffPower !== undefined)
      this.falloffPowerSchedule.set(initialValues.falloffPower);
    // Next to Angle in the Visual Editor, not at the end.
    this.schedules.splice(
      this.schedules.indexOf(this.angleSchedule) + 1,
      0,
      this.twistSchedule,
      this.effectRadiusSchedule,
      this.falloffPowerSchedule,
    );
  }

  protected override makeWarp(timeInMs: number): PointFunction {
    const falloffPower = this.falloffPowerSchedule.at(timeInMs);
    return twistWarp(
      this.radiusOffsetSchedule.at(timeInMs),
      toRadians(this.angleSchedule.at(timeInMs)),
      toRadians(this.twistSchedule.at(timeInMs)),
      this.effectRadiusSchedule.at(timeInMs),
      // Not above 0 is a warning in Checks.  Draw it as linear.
      falloffPower > 0 ? falloffPower : 1,
    );
  }

  /** The base class's checks, then this class's:  the numbers that don't work, and how far the path reaches. */
  override editorMessages(): EditorMessage[] {
    const messages = super.editorMessages();
    for (const { time, value } of this.effectRadiusSchedule.schedule) {
      if (!(value > 0)) {
        messages.push({
          level: "warning",
          text: `At ${time} ms:  Effect Radius ${value} means no twist.  Try a positive number, like 1.`,
        });
      }
    }
    for (const { time, value } of this.falloffPowerSchedule.schedule) {
      if (!(value > 0)) {
        messages.push({
          level: "warning",
          text: `At ${time} ms:  Falloff Power ${value} won't work.  Try 1 for linear.  Drawing it as 1.`,
        });
      }
    }
    const pathKeyframes = this.pathSchedule.schedule;
    for (const { time, value } of pathKeyframes) {
      const farthest = farthestPoint(value);
      if (farthest !== undefined) {
        messages.push({
          level: "note",
          text: `${pathKeyframes.length > 1 ? `At ${time} ms:  ` : ""}The path reaches ${farthest.toPrecision(3)} from the origin.  The twist reaches Effect Radius.`,
        });
      }
    }
    return messages;
  }
}

// MARK: Registry

componentRegistry.set("Twisted Path", {
  create() {
    return new TwistedPath();
  },
  description:
    "A prototype:  Warped Path where the turn depends on the distance from the center.  " +
    "Twist is how much the center turns, fading to nothing at Effect Radius, so lines become spirals.",
  howToGenerate: { type: "class", class: TwistedPath },
});
