import { ReadOnlyRect } from "phil-lib/misc";
import {
  ColorScheduleInfo,
  componentRegistry,
  Keyframe,
  NumberScheduleInfo,
  RectangleScheduleInfo,
  Showable,
  ShowOptions,
} from "canvas-recorder-lib";
import { showError } from "canvas-recorder-lib/src/slide-components/show-error";

/** More than this, and it's surely a typo in Side Length. */
const MAX_TRIANGLES = 200_000;

/**
 * A rectangle filled with equilateral triangles, in two colors, ▲ and ▼.  Meant for a background.
 *
 * The first row starts at the rectangle's top left corner, with a ▲ whose top point is on the left edge.
 * Triangles are cut off at the rectangle's edges.
 *
 * In the component registry as "Tessellating Triangles".
 */
export class TessellatingTriangles implements Showable {
  readonly registryKey = "Tessellating Triangles";
  readonly description: string;
  readonly duration = 0;
  /** 16 × 16 covers the whole canvas, landscape or portrait. */
  readonly rectSchedule = new RectangleScheduleInfo("Rect", {
    x: 0,
    y: 0,
    width: 16,
    height: 16,
  });
  /** The triangles that point up, ▲. */
  readonly upColorSchedule = new ColorScheduleInfo("▲ Color", "#0b1a33");
  /** The triangles that point down, ▼. */
  readonly downColorSchedule = new ColorScheduleInfo("▼ Color", "#13284a");
  /** In units. */
  readonly sideLengthSchedule = new NumberScheduleInfo("Side Length", 1);
  readonly schedules = [
    this.rectSchedule,
    this.upColorSchedule,
    this.downColorSchedule,
    this.sideLengthSchedule,
  ] as const;
  constructor(
    initialValues: {
      description?: string;
      rect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      upColor?: string | readonly Keyframe<string>[];
      downColor?: string | readonly Keyframe<string>[];
      sideLength?: number | readonly Keyframe<number>[];
    } = {},
  ) {
    this.description = initialValues.description ?? "Tessellating Triangles";
    if (initialValues.rect !== undefined)
      this.rectSchedule.set(initialValues.rect);
    if (initialValues.upColor !== undefined)
      this.upColorSchedule.set(initialValues.upColor);
    if (initialValues.downColor !== undefined)
      this.downColorSchedule.set(initialValues.downColor);
    if (initialValues.sideLength !== undefined)
      this.sideLengthSchedule.set(initialValues.sideLength);
  }

  show({ context, timeInMs }: ShowOptions) {
    const rect = this.rectSchedule.at(timeInMs);
    const side = this.sideLengthSchedule.at(timeInMs);
    const rowHeight = (side * Math.sqrt(3)) / 2;
    const rows = Math.ceil(rect.height / rowHeight);
    const columns = Math.ceil(rect.width / side) + 1;

    context.save();
    const clip = new Path2D();
    clip.rect(rect.x, rect.y, rect.width, rect.height);
    context.clip(clip);
    // Every ▼ at once:  the whole rectangle.  Then the ▲s on top.
    context.fillStyle = this.downColorSchedule.at(timeInMs);
    context.fill(clip);
    if (!(side > 0) || rows * columns > MAX_TRIANGLES) {
      // A user error, so a warning on the canvas.  The ▼ color alone is still a usable background.
      context.translate(rect.x, rect.y);
      context.scale(rect.width / 16, rect.width / 16);
      showError(
        context,
        `Side Length ${side} won't work.  Try a positive number, like 1.`,
      );
    } else {
      const up = new Path2D();
      for (let row = 0; row < rows; row++) {
        const top = rect.y + row * rowHeight;
        const bottom = top + rowHeight;
        // Every other row is shifted half a triangle.
        const offset = row % 2 == 0 ? 0 : side / 2;
        for (let column = -1; column < columns; column++) {
          const peak = rect.x + offset + column * side;
          up.moveTo(peak, top);
          up.lineTo(peak + side / 2, bottom);
          up.lineTo(peak - side / 2, bottom);
          up.closePath();
        }
      }
      context.fillStyle = this.upColorSchedule.at(timeInMs);
      context.fill(up);
    }
    context.restore();
  }
}

// MARK: Registry

componentRegistry.set("Tessellating Triangles", {
  create() {
    return new TessellatingTriangles();
  },
  description:
    "A background of equilateral triangles in two colors, ▲ and ▼.  The default Rect covers the canvas in either orientation.",
  howToGenerate: { type: "class", class: TessellatingTriangles },
});
