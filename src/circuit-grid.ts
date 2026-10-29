import {
  ColorScheduleInfo,
  Keyframe,
  LatticeScheduleInfo,
  NumberScheduleInfo,
  Showable,
  ShowOptions,
  StringScheduleInfo,
} from "canvas-recorder-lib";
import { LatticeValue } from "canvas-recorder-lib/src/lattice";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import { PathShape } from "canvas-recorder-lib/src/glib/path-shape";
import { panAndZoom } from "canvas-recorder-lib/src/glib/transforms";
import {
  FourierTerm,
  getAnimationRules,
  samplesFromPath,
  samplesToFourier,
} from "canvas-recorder-lib/src/peano-fourier/fourier-shared";
import {
  orderTerms,
  parseTermGroups,
} from "canvas-recorder-lib/src/slide-components/fourier";
import {
  Circuit,
  EVERY_KIND_A_7,
  EVERY_KIND_B_7,
  RANDOM_7,
} from "./euler-circuits.ts";
import { drawRoundedCircuit, STAR_BOUNDS } from "./rounded-star.ts";
import { circuitToPath } from "./star-path.ts";

/**
 * The circuits, in order:  the two from the Every Kind of Vertex slide, then the random ones.
 * A grid with more than 16 cells starts over at the beginning.
 */
const CIRCUITS: readonly Circuit[] = [EVERY_KIND_A_7, EVERY_KIND_B_7, ...RANDOM_7];

/** The Fourier terms for each circuit, computed the first time it's drawn. */
const termsCache = new Map<Circuit, readonly FourierTerm[]>();

function termsFor(circuit: Circuit) {
  let terms = termsCache.get(circuit);
  if (!terms) {
    terms = samplesToFourier(samplesFromPath(circuitToPath(7, circuit).pathShape));
    termsCache.set(circuit, terms);
  }
  return terms;
}

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
 *
 * Not in the component registry.  Add it to a parent with `add()`, as a fixed child.
 */
export class CircuitGrid implements Showable {
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
  readonly fourierColorSchedule = new ColorScheduleInfo(
    "Fourier Color",
    myRainbow.myBlue,
  );
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
    this.fourierColorSchedule,
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
  /** The animation for each circuit, for the Term Groups in `#rulesTermGroups`.  Thrown away when Term Groups changes. */
  readonly #rules = new Map<Circuit, ((progress: number) => PathShape)[]>();
  #rulesTermGroups = "";
  #rulesFor(circuit: Circuit, termGroups: string) {
    if (termGroups != this.#rulesTermGroups) {
      this.#rules.clear();
      this.#rulesTermGroups = termGroups;
    }
    let rules = this.#rules.get(circuit);
    if (!rules) {
      const ordered = orderTerms(termsFor(circuit), parseTermGroups(termGroups).groups);
      rules =
        ordered.keyframes.length < 2
          ? []
          : getAnimationRules(ordered.terms, ordered.keyframes);
      this.#rules.set(circuit, rules);
    }
    return rules;
  }
  show({ context, timeInMs }: ShowOptions) {
    const lattice = this.latticeSchedule.latticeAt(timeInMs);
    const termGroups = this.termGroupsSchedule.at(timeInMs);
    const step = this.stepSchedule.at(timeInMs);
    const fourierColor = this.fourierColorSchedule.at(timeInMs);
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
      } else if (step >= 0) {
        const rules = this.#rulesFor(circuit, termGroups);
        if (rules.length > 0) {
          const ruleIndex = Math.min(Math.floor(step), rules.length - 1);
          const progress = Math.min(1, step - ruleIndex);
          const path = rules[ruleIndex](progress).transform(fit);
          context.lineCap = "round";
          context.lineJoin = "round";
          context.strokeStyle = fourierColor;
          context.stroke(path.canvasPath);
        }
      }
    });
  }
}
