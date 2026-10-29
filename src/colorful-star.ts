import { ReadOnlyRect } from "phil-lib/misc";
import {
  ColorScheduleInfo,
  Keyframe,
  NumberScheduleInfo,
  RectangleScheduleInfo,
  Showable,
  ShowOptions,
} from "canvas-recorder-lib";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import { panAndZoom } from "canvas-recorder-lib/src/glib/transforms";
import { GROUPED_7 } from "./euler-circuits.ts";
import { circuitToPath, selectEdges } from "./star-path.ts";

/**
 * Where the star is in its own coordinates:  the unit circle.
 * The Fourier component finds the same bounds from its samples,
 * so the two line up when they share a Dest Rect.
 */
const STAR_BOUNDS: ReadOnlyRect = { x: -1, y: -1, width: 2, height: 2 };

/**
 * The finished picture:  the circle, the thin star {7/3} and the fat star {7/2},
 * each in its own color.  It doesn't move.
 *
 * Every circuit draws the same picture, so this uses the grouped one.
 * It draws from the circuit's edge records, the same records a multi-color
 * Fourier will use to decide where each color starts and stops.
 *
 * Not in the component registry.  Add it to a parent with `add()`, as a fixed
 * child.  The Visual Editor can still edit and save its schedules, matched by
 * `description`.
 */
export class ColorfulStar implements Showable {
  readonly description: string;
  readonly duration = 0;
  /** The star fits inside this, centered, keeping its shape. */
  readonly destRectSchedule = new RectangleScheduleInfo("Dest Rect", {
    x: 4.5,
    y: 1,
    width: 7,
    height: 7,
  });
  readonly circleColorSchedule = new ColorScheduleInfo(
    "Circle Color",
    myRainbow.red,
  );
  /** The long chords, {7/3}. */
  readonly thinStarColorSchedule = new ColorScheduleInfo(
    "Thin Star Color",
    "white",
  );
  /** The short chords, {7/2}. */
  readonly fatStarColorSchedule = new ColorScheduleInfo(
    "Fat Star Color",
    myRainbow.myBlue,
  );
  readonly lineWidthSchedule = new NumberScheduleInfo("Line Width", 0.05);
  readonly schedules = [
    this.destRectSchedule,
    this.circleColorSchedule,
    this.thinStarColorSchedule,
    this.fatStarColorSchedule,
    this.lineWidthSchedule,
  ] as const;
  constructor(
    initialValues: {
      description?: string;
      destRect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      circleColor?: string | readonly Keyframe<string>[];
      thinStarColor?: string | readonly Keyframe<string>[];
      fatStarColor?: string | readonly Keyframe<string>[];
      lineWidth?: number | readonly Keyframe<number>[];
    } = {},
  ) {
    this.description = initialValues.description ?? "Colorful Star";
    if (initialValues.destRect !== undefined)
      this.destRectSchedule.set(initialValues.destRect);
    if (initialValues.circleColor !== undefined)
      this.circleColorSchedule.set(initialValues.circleColor);
    if (initialValues.thinStarColor !== undefined)
      this.thinStarColorSchedule.set(initialValues.thinStarColor);
    if (initialValues.fatStarColor !== undefined)
      this.fatStarColorSchedule.set(initialValues.fatStarColor);
    if (initialValues.lineWidth !== undefined)
      this.lineWidthSchedule.set(initialValues.lineWidth);
  }
  /** One path per color, in the star's own coordinates, in drawing order. */
  static readonly #paths = (() => {
    const starPath = circuitToPath(7, GROUPED_7);
    const withDistance = (distance: number) =>
      selectEdges(starPath, (edge) => edge.distance == distance);
    return { circle: withDistance(1), fat: withDistance(2), thin: withDistance(3) };
  })();
  show({ context, timeInMs }: ShowOptions) {
    const fit = panAndZoom(
      STAR_BOUNDS,
      this.destRectSchedule.at(timeInMs),
      "meet",
    );
    const paths = ColorfulStar.#paths;
    // Round, so the 6 edges meeting at each point look like one solid corner.
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = this.lineWidthSchedule.at(timeInMs);
    const layers = [
      [paths.circle, this.circleColorSchedule],
      [paths.fat, this.fatStarColorSchedule],
      [paths.thin, this.thinStarColorSchedule],
    ] as const;
    for (const [path, colorSchedule] of layers) {
      // Transform the path, not the context, so the line width isn't scaled.
      context.strokeStyle = colorSchedule.at(timeInMs);
      context.stroke(path.transform(fit).canvasPath);
    }
  }
}
