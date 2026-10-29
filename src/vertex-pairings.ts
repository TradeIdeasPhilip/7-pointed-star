import { ReadOnlyRect } from "phil-lib/misc";
import {
  ColorScheduleInfo,
  Keyframe,
  NumberScheduleInfo,
  RectangleScheduleInfo,
  SelectScheduleInfo,
  Showable,
  ShowOptions,
} from "canvas-recorder-lib";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import { PathShape } from "canvas-recorder-lib/src/glib/path-shape";
import { panAndZoom } from "canvas-recorder-lib/src/glib/transforms";
import { VERTEX_PAIRINGS_7 } from "./euler-circuits.ts";
import { starVertex } from "./star-path.ts";
import { roundCorners } from "./vertex-corners.ts";

/**
 * How much of each edge the closeup shows, measured along the edge from the top vertex.
 * In the star's units:  the circle has radius 1.
 * The nearest other vertex is about 0.87 away.
 *
 * This is also the Corner Size:  Rounding is a fraction of the visible part of each edge.
 */
const VISIBLE_LENGTH = 0.6;

/** The top vertex, where all of the closeups are centered. */
const TOP = starVertex(7, 0);

/**
 * Where the closeup is in the star's coordinates.
 * The arcs and the chords all stay inside this box, with room for the line width.
 */
const CLOSEUP_BOUNDS: ReadOnlyRect = {
  x: TOP.x - VISIBLE_LENGTH,
  y: TOP.y - 0.1 * VISIBLE_LENGTH,
  width: 2 * VISIBLE_LENGTH,
  height: 1.1 * VISIBLE_LENGTH,
};

const COLUMNS = 5;
const ROWS = 3;

/** For the "Pair" choice of the Colors schedule. */
const PAIR_COLORS = [myRainbow.yellow, myRainbow.cyan, myRainbow.magenta];

/**
 * Closeups of the top vertex of the star, one for each way an Euler circuit can pass through it.
 *
 * Six edges meet at each vertex, and a circuit visits each vertex three times.
 * Each visit comes in on one edge and leaves on another, so a circuit pairs off the six edges.
 * There are 15 ways to do that, all shown at once in a 5 × 3 grid, numbered like {@link VERTEX_PAIRINGS_7}.
 *
 * Each pair's corner is rounded, so you can see which edge continues into which.
 * Pairs inside other pairs, or crossing wider pairs, get rounded more, to get out of the way.
 * Each edge keeps its own color up to the middle of the turn.
 * With nothing rounded, every pairing looks the same:  six lines meeting at a point.
 *
 * Not in the component registry.  Add it to a parent with `add()`, as a fixed child.
 */
export class VertexPairings implements Showable {
  readonly description: string;
  readonly duration = 0;
  /** All 15 closeups fit inside this, in 5 columns and 3 rows. */
  readonly destRectSchedule = new RectangleScheduleInfo("Dest Rect", {
    x: 0.5,
    y: 1.5,
    width: 15,
    height: 6,
  });
  /**
   * How much of each visible edge to replace with a curve, for pairs that don't have to get out of anyone's way.
   * 0 for sharp corners.  1 to replace the entire visible part of each edge.
   */
  readonly roundingSchedule = new NumberScheduleInfo("Rounding", 0.6);
  /**
   * Added to the Rounding for each step a pair moves out of the way.
   * See `levels()` in vertex-corners.ts.
   */
  readonly roundingStepSchedule = new NumberScheduleInfo(
    "Rounding Step",
    0.25,
  );
  /** "Edge type" uses the star's colors.  "Pair" gives each pair its own color. */
  readonly colorsSchedule = new SelectScheduleInfo("Colors", "Edge type", [
    "Edge type",
    "Pair",
  ]);
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
  /** Each closeup's pairing number, in the top left corner of its cell.  0 to hide them. */
  readonly labelSizeSchedule = new NumberScheduleInfo("Label Size", 0.3);
  readonly labelColorSchedule = new ColorScheduleInfo("Label Color", "#999");
  readonly schedules = [
    this.destRectSchedule,
    this.roundingSchedule,
    this.roundingStepSchedule,
    this.colorsSchedule,
    this.circleColorSchedule,
    this.thinStarColorSchedule,
    this.fatStarColorSchedule,
    this.lineWidthSchedule,
    this.labelSizeSchedule,
    this.labelColorSchedule,
  ] as const;
  constructor(
    initialValues: {
      description?: string;
      destRect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      rounding?: number | readonly Keyframe<number>[];
      roundingStep?: number | readonly Keyframe<number>[];
      lineWidth?: number | readonly Keyframe<number>[];
    } = {},
  ) {
    this.description = initialValues.description ?? "Vertex Pairings";
    if (initialValues.destRect !== undefined)
      this.destRectSchedule.set(initialValues.destRect);
    if (initialValues.rounding !== undefined)
      this.roundingSchedule.set(initialValues.rounding);
    if (initialValues.roundingStep !== undefined)
      this.roundingStepSchedule.set(initialValues.roundingStep);
    if (initialValues.lineWidth !== undefined)
      this.lineWidthSchedule.set(initialValues.lineWidth);
  }
  show({ context, timeInMs }: ShowOptions) {
    const destRect = this.destRectSchedule.at(timeInMs);
    const settings = {
      cornerSize: VISIBLE_LENGTH,
      rounding: this.roundingSchedule.at(timeInMs),
      roundingStep: this.roundingStepSchedule.at(timeInMs),
    };
    const byPair = this.colorsSchedule.at(timeInMs) == "Pair";
    const colorByDistance = [
      undefined,
      this.circleColorSchedule.at(timeInMs),
      this.fatStarColorSchedule.at(timeInMs),
      this.thinStarColorSchedule.at(timeInMs),
    ];
    const labelSize = this.labelSizeSchedule.at(timeInMs);
    const labelColor = this.labelColorSchedule.at(timeInMs);
    const lineWidth = this.lineWidthSchedule.at(timeInMs);
    const cellWidth = destRect.width / COLUMNS;
    const cellHeight = destRect.height / ROWS;
    /** Space around each closeup, as a fraction of its cell. */
    const margin = 0.1;
    VERTEX_PAIRINGS_7.forEach((pairing, index) => {
      const column = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const cellX = destRect.x + column * cellWidth;
      const cellY = destRect.y + row * cellHeight;
      const fit = panAndZoom(
        CLOSEUP_BOUNDS,
        {
          x: cellX + margin * cellWidth,
          y: cellY + margin * cellHeight,
          width: (1 - 2 * margin) * cellWidth,
          height: (1 - 2 * margin) * cellHeight,
        },
        "meet",
      );
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = lineWidth;
      roundCorners(pairing, settings, () => VISIBLE_LENGTH).forEach(
        ({ spokes, cuts, halfTurns }, pairIndex) => {
          spokes.forEach((spoke, side) => {
            const cut = cuts[side];
            const path = new PathShape([
              ...halfTurns[side].commands,
              ...(cut < VISIBLE_LENGTH
                ? spoke.piece(cut, VISIBLE_LENGTH).commands
                : []),
            ]);
            context.strokeStyle = byPair
              ? PAIR_COLORS[pairIndex]
              : colorByDistance[spoke.distance]!;
            // Transform the path, not the context, so the line width isn't scaled.
            context.stroke(path.transform(fit).canvasPath);
          });
        },
      );
      if (labelSize > 0) {
        context.font = `${labelSize}px sans-serif`;
        context.textAlign = "left";
        context.textBaseline = "top";
        context.fillStyle = labelColor;
        context.fillText(String(index + 1), cellX, cellY);
      }
    });
  }
}
