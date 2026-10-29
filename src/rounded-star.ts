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
import { PathShape, Point } from "canvas-recorder-lib/src/glib/path-shape";
import { panAndZoom } from "canvas-recorder-lib/src/glib/transforms";
import {
  Circuit,
  EVERY_KIND_A_7,
  EVERY_KIND_B_7,
  GROUPED_7,
  INTERLEAVED_7,
  spokeIndex,
  VERTEX_PAIRINGS_7,
  vertexPairingNumbers,
} from "./euler-circuits.ts";
import { starVertex } from "./star-path.ts";
import { roundCorners, RoundingSettings, SPOKES } from "./vertex-corners.ts";

/** The circuits offered by the Circuit field. */
const CIRCUITS: ReadonlyMap<string, Circuit> = new Map([
  ["Every kind A", EVERY_KIND_A_7],
  ["Every kind B", EVERY_KIND_B_7],
  ["Grouped", GROUPED_7],
  ["Interleaved", INTERLEAVED_7],
]);

/** The star's own coordinates:  the unit circle.  The same as Colorful Star and the Fourier component. */
export const STAR_BOUNDS: ReadOnlyRect = { x: -1, y: -1, width: 2, height: 2 };

/**
 * Draw one circuit with every corner rounded:  a reference image.
 * Uses the context's current line width.
 * @param fit From the star's own coordinates ({@link STAR_BOUNDS}) to the canvas.
 * @param colors The circle, the fat star and the thin star.
 */
export function drawRoundedCircuit(
  context: CanvasRenderingContext2D,
  circuit: Circuit,
  fit: DOMMatrix,
  settings: RoundingSettings,
  colors: readonly [string, string, string],
) {
  /** Everything at vertex v is drawn at the top vertex, then rotated into place. */
  const rotations = Array.from({ length: 7 }, (_, vertex) =>
    fit.multiply(new DOMMatrix().rotate((360 * vertex) / 7)),
  );
  /** The pieces of each color, by distance:  1 for the circle, 2 the fat star, 3 the thin star. */
  const layers = [[], [], [], []] as PathShape[][];
  /** `cuts[vertex][spoke]` is how much of that edge the turn at that vertex replaced. */
  const cuts: number[][] = [];
  vertexPairingNumbers(circuit).forEach((number, vertex) => {
    cuts[vertex] = [];
    const rounded = roundCorners(
      VERTEX_PAIRINGS_7[number - 1],
      settings,
      (spoke) => spoke.length / 2,
    );
    for (const { spokes, cuts: pairCuts, halfTurns } of rounded) {
      spokes.forEach((spoke, side) => {
        cuts[vertex][SPOKES.indexOf(spoke)] = pairCuts[side];
        layers[spoke.distance].push(
          halfTurns[side].transform(rotations[vertex]),
        );
      });
    }
  });
  // The rest of each edge, between the turns at its two ends.
  for (let position = 0; position < circuit.length - 1; position++) {
    const from = circuit[position];
    const to = circuit[position + 1];
    const spoke = SPOKES[spokeIndex(from, to)];
    const start = cuts[from][spokeIndex(from, to)];
    const end = spoke.length - cuts[to][spokeIndex(to, from)];
    if (end > start + 1e-9) {
      layers[spoke.distance].push(
        spoke.piece(start, end).transform(rotations[from]),
      );
    }
  }
  context.lineCap = "round";
  context.lineJoin = "round";
  // Circle, then fat star, then thin star, like Colorful Star.
  for (const distance of [1, 2, 3]) {
    context.strokeStyle = colors[distance - 1];
    for (const path of layers[distance]) {
      context.stroke(path.canvasPath);
    }
  }
}

/**
 * A reference image:  one whole circuit, with the corners rounded at every vertex,
 * so you can follow the circuit through each vertex.  It doesn't move.
 *
 * Each vertex is drawn like the matching closeup on the Vertex Pairings slide, rotated into place.
 * Each edge keeps its color up to the middle of each turn.
 *
 * Only for reference images.  Never mixed with a Fourier animation.
 *
 * Not in the component registry.  Add it to a parent with `add()`, as a fixed child.
 */
export class RoundedStar implements Showable {
  readonly description: string;
  readonly duration = 0;
  readonly circuitSchedule = new SelectScheduleInfo(
    "Circuit",
    "Every kind A",
    [...CIRCUITS.keys()],
  );
  /** The star fits inside this, centered, keeping its shape. */
  readonly destRectSchedule = new RectangleScheduleInfo("Dest Rect", {
    x: 4.5,
    y: 1,
    width: 7,
    height: 7,
  });
  /**
   * How much of an edge a curve can replace at most, in the star's units:  the circle has radius 1.
   * Half of an arc is about 0.45.  Bigger values are cut down to half of each edge.
   */
  readonly cornerSizeSchedule = new NumberScheduleInfo("Corner Size", 0.4);
  /** The same as on the Vertex Pairings slide, but as a fraction of the Corner Size. */
  readonly roundingSchedule = new NumberScheduleInfo("Rounding", 0.6);
  readonly roundingStepSchedule = new NumberScheduleInfo("Rounding Step", 0.25);
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
  /** The pairing number next to each vertex.  0 to hide them. */
  readonly labelSizeSchedule = new NumberScheduleInfo("Label Size", 0.35);
  readonly labelColorSchedule = new ColorScheduleInfo("Label Color", "#999");
  readonly schedules = [
    this.circuitSchedule,
    this.destRectSchedule,
    this.cornerSizeSchedule,
    this.roundingSchedule,
    this.roundingStepSchedule,
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
      circuit?: string;
      destRect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      cornerSize?: number | readonly Keyframe<number>[];
      rounding?: number | readonly Keyframe<number>[];
      roundingStep?: number | readonly Keyframe<number>[];
    } = {},
  ) {
    this.description = initialValues.description ?? "Rounded Star";
    if (initialValues.circuit !== undefined)
      this.circuitSchedule.set(initialValues.circuit);
    if (initialValues.destRect !== undefined)
      this.destRectSchedule.set(initialValues.destRect);
    if (initialValues.cornerSize !== undefined)
      this.cornerSizeSchedule.set(initialValues.cornerSize);
    if (initialValues.rounding !== undefined)
      this.roundingSchedule.set(initialValues.rounding);
    if (initialValues.roundingStep !== undefined)
      this.roundingStepSchedule.set(initialValues.roundingStep);
  }
  show({ context, timeInMs }: ShowOptions) {
    const circuit =
      CIRCUITS.get(this.circuitSchedule.at(timeInMs)) ?? EVERY_KIND_A_7;
    const fit = panAndZoom(
      STAR_BOUNDS,
      this.destRectSchedule.at(timeInMs),
      "meet",
    );
    context.lineWidth = this.lineWidthSchedule.at(timeInMs);
    drawRoundedCircuit(
      context,
      circuit,
      fit,
      {
        cornerSize: this.cornerSizeSchedule.at(timeInMs),
        rounding: this.roundingSchedule.at(timeInMs),
        roundingStep: this.roundingStepSchedule.at(timeInMs),
      },
      [
        this.circleColorSchedule.at(timeInMs),
        this.fatStarColorSchedule.at(timeInMs),
        this.thinStarColorSchedule.at(timeInMs),
      ],
    );
    const numbers = vertexPairingNumbers(circuit);
    const labelSize = this.labelSizeSchedule.at(timeInMs);
    if (labelSize > 0) {
      context.font = `${labelSize}px sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = this.labelColorSchedule.at(timeInMs);
      numbers.forEach((number, vertex) => {
        const direction = starVertex(7, vertex);
        const onScreen = fit.transformPoint(direction);
        const position: Point = {
          x: onScreen.x + direction.x * labelSize,
          y: onScreen.y + direction.y * labelSize,
        };
        context.fillText(String(number), position.x, position.y);
      });
    }
  }
}
