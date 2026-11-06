import {
  ColorScheduleInfo,
  componentRegistry,
  Keyframe,
  LatticeScheduleInfo,
  LatticeValue,
  NumberScheduleInfo,
  Showable,
  ShowOptions,
  StringScheduleInfo,
} from "canvas-recorder-lib";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import { panAndZoom } from "canvas-recorder-lib/src/glib/transforms";
import {
  Circuit,
  EVERY_KIND_A_7,
  EVERY_KIND_B_7,
  RANDOM_7,
} from "./euler-circuits.ts";
import {
  ColoredAnimations,
  coloredSource,
  drawColoredFrame,
} from "./colored-fourier.ts";
import { drawRoundedCircuit, STAR_BOUNDS } from "./rounded-star.ts";

/**
 * The circuits, in order:  the two from the Every Kind of Vertex slide, then the random ones.
 * A grid with more than 16 cells starts over at the beginning.
 */
const CIRCUITS: readonly Circuit[] = [EVERY_KIND_A_7, EVERY_KIND_B_7, ...RANDOM_7];

/**
 * Several circuits at once, each as a Fourier animation next to its reference image.
 *
 * The Lattice says where the cells are.  Reading left to right, then down,
 * the cells alternate:  a Fourier animation, then the reference image of the same circuit,
 * then the next circuit's Fourier animation, and so on.
 * With an odd number of columns, a pair can wrap onto the next row.
 *
 * Each circle fills its cell, keeping its shape.  The space between cells is the Lattice's slack.
 * All the Fourier animations share one Term Groups and one Step, so they move together.
 * Each part of a Fourier animation is the color of the edges it becomes,
 * the same colors as the reference images.
 *
 * A quick way to try a layout.  In the component registry as "Circuit Grid".
 */
export class CircuitGrid implements Showable {
  readonly registryKey = "Circuit Grid";
  readonly description: string;
  readonly duration = 0;
  readonly latticeSchedule = new LatticeScheduleInfo("Lattice", {
    x: 0.25,
    y: 0.5,
    width: 15.5,
    height: 8,
    cellWidth: 3.6,
    cellHeight: 3.6,
  });
  /** The same as the Fourier component's Term Groups. */
  readonly termGroupsSchedule = new StringScheduleInfo(
    "Term Groups",
    "0, 1, 2, 3, 4, 5-9, 10-19, 20-39, 40-99, 100-299, 300-1023",
  );
  /** The same as the Fourier component's Step:  0 is a dot, the number of groups is the finished curve. */
  readonly stepSchedule = new NumberScheduleInfo("Step", [
    { time: 0, value: 0 },
    { time: 22_000, value: 11 },
  ]);
  /** The same as on the Every Kind of Vertex slide. */
  readonly cornerSizeSchedule = new NumberScheduleInfo("Corner Size", 0.4);
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
  readonly schedules = [
    this.latticeSchedule,
    this.termGroupsSchedule,
    this.stepSchedule,
    this.cornerSizeSchedule,
    this.roundingSchedule,
    this.roundingStepSchedule,
    this.circleColorSchedule,
    this.thinStarColorSchedule,
    this.fatStarColorSchedule,
    this.lineWidthSchedule,
  ] as const;
  constructor(
    initialValues: {
      description?: string;
      lattice?: LatticeValue | readonly Keyframe<LatticeValue>[];
      step?: number | readonly Keyframe<number>[];
    } = {},
  ) {
    this.description = initialValues.description ?? "Circuit Grid";
    if (initialValues.lattice !== undefined)
      this.latticeSchedule.set(initialValues.lattice);
    if (initialValues.step !== undefined)
      this.stepSchedule.set(initialValues.step);
  }
  readonly #animations = new ColoredAnimations();
  show({ context, timeInMs }: ShowOptions) {
    const lattice = this.latticeSchedule.latticeAt(timeInMs);
    const termGroups = this.termGroupsSchedule.at(timeInMs);
    const step = this.stepSchedule.at(timeInMs);
    const settings = {
      cornerSize: this.cornerSizeSchedule.at(timeInMs),
      rounding: this.roundingSchedule.at(timeInMs),
      roundingStep: this.roundingStepSchedule.at(timeInMs),
    };
    const colors = [
      this.circleColorSchedule.at(timeInMs),
      this.fatStarColorSchedule.at(timeInMs),
      this.thinStarColorSchedule.at(timeInMs),
    ] as const;
    const lineWidth = this.lineWidthSchedule.at(timeInMs);
    lattice.cells().forEach(({ rect, row, column }) => {
      const index = row * lattice.columnCount + column;
      const circuit = CIRCUITS[Math.floor(index / 2) % CIRCUITS.length];
      const fit = panAndZoom(STAR_BOUNDS, rect, "meet");
      context.lineWidth = lineWidth;
      if (index % 2 == 1) {
        drawRoundedCircuit(context, circuit, fit, settings, colors);
      } else {
        const frame = this.#animations.frameAt(circuit, termGroups, step);
        if (frame) {
          drawColoredFrame(
            context,
            frame,
            coloredSource(circuit).runs,
            fit,
            colors,
          );
        }
      }
    });
  }
}

// MARK: Registry

componentRegistry.set("Circuit Grid", {
  create() {
    return new CircuitGrid();
  },
  description:
    "Several 7 pointed star circuits at once, for trying layouts.  " +
    "The Lattice says where the cells are:  a Fourier animation, then its reference image, then the next circuit.",
  howToGenerate: { type: "class", class: CircuitGrid },
});
