import { ReadOnlyRect } from "phil-lib/misc";
import {
  checkStepRange,
  checkTermGroups,
  ColorScheduleInfo,
  componentRegistry,
  DurationAgnosticComponent,
  Keyframe,
  NumberScheduleInfo,
  parseTermGroups,
  RectangleScheduleInfo,
  ShowOptions,
  StringScheduleInfo,
} from "canvas-recorder-lib";
import {
  addEditorMessages,
  EditorMessage,
  HasEditorMessages,
} from "./editor-messages.ts";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import { panAndZoom } from "canvas-recorder-lib/src/glib/transforms";
import { showError } from "canvas-recorder-lib/src/slide-components/show-error";
import { Circuit, NAMED_CIRCUITS_7, parseCircuit7 } from "./euler-circuits.ts";
import {
  ColoredAnimations,
  coloredSource,
  drawColoredFrame,
} from "./colored-fourier.ts";
import { drawRoundedCircuit, STAR_BOUNDS } from "./rounded-star.ts";
import { RoundingSettings } from "./vertex-corners.ts";

/** The circle, the fat star and the thin star. */
export type StarColors = readonly [string, string, string];

/**
 * One Euler circuit of the 7 pointed star, shown twice:  a Fourier animation, and a reference image.
 * Each has its own rectangle and line width, so they can go anywhere, and change while the animation runs.
 * One set of colors for both, so they match.
 *
 * The Circuit field takes a name from its suggestions, or the vertices in order, like "0 1 2 0 3 …".
 * See {@link parseCircuit7}.
 *
 * Override {@link drawFourier} or {@link drawReference} to draw either one differently.
 *
 * A DurationAgnosticComponent, like the library's FourierComponent.  That gives it Min Duration,
 * and a block on the Visual Editor's timeline, with a handle to drag it.
 *
 * In the component registry as "Star Circuit".
 */
export class StarCircuit
  extends DurationAgnosticComponent
  implements HasEditorMessages
{
  readonly registryKey = "Star Circuit";
  /** A name from the suggestions, or the vertices in order. */
  readonly circuitSchedule = new StringScheduleInfo("Circuit", "Every kind A");
  /** The finished Fourier curve fits inside this, centered, keeping its shape.  Earlier steps can wander outside it. */
  readonly fourierRectSchedule = new RectangleScheduleInfo("Fourier Rect", {
    x: 0.5,
    y: 1,
    width: 7,
    height: 7,
  });
  /** The reference image fits inside this, centered, keeping its shape. */
  readonly referenceRectSchedule = new RectangleScheduleInfo("Reference Rect", {
    x: 8.5,
    y: 1,
    width: 7,
    height: 7,
  });
  /** The same as the Fourier component's Term Groups. */
  readonly termGroupsSchedule = new StringScheduleInfo(
    "Term Groups",
    "0, 1, 2, 3, 4, 5-9, 10-19, 20-39, 40-99, 100-299, 300-1023",
  );
  /** The same as the Fourier component's Step:  negative hides it, 0 is a dot, the number of groups is the finished curve. */
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
  /**
   * Fills the inside of both the Fourier and the reference image, under the lines.
   * Where the curve crosses itself, the fill alternates, like a checkerboard.
   * Try a color with a low alpha.
   */
  readonly fillColorSchedule = new ColorScheduleInfo(
    "Fill Color",
    "transparent",
  );
  /**
   * In units, so it doesn't grow or shrink with the Fourier Rect.
   * 0 means no lines.  With no Fill Color too, that turns the Fourier off, at no cost.
   */
  readonly fourierLineWidthSchedule = new NumberScheduleInfo(
    "Fourier Line Width",
    0.05,
  );
  /**
   * In units, so it doesn't grow or shrink with the Reference Rect.
   * 0 means no lines.  With no Fill Color too, that turns the reference image off, at no cost.
   */
  readonly referenceLineWidthSchedule = new NumberScheduleInfo(
    "Reference Line Width",
    0.05,
  );
  constructor(
    initialValues: {
      description?: string;
      circuit?: string | readonly Keyframe<string>[];
      fourierRect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      referenceRect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      termGroups?: string | readonly Keyframe<string>[];
      step?: number | readonly Keyframe<number>[];
      circleColor?: string | readonly Keyframe<string>[];
      thinStarColor?: string | readonly Keyframe<string>[];
      fatStarColor?: string | readonly Keyframe<string>[];
      fillColor?: string | readonly Keyframe<string>[];
      fourierLineWidth?: number | readonly Keyframe<number>[];
      referenceLineWidth?: number | readonly Keyframe<number>[];
      /** How long to ask the parent for.  The default covers the default Step schedule. */
      minDuration?: number;
    } = {},
  ) {
    super(initialValues.description ?? "Star Circuit");
    this.circuitSchedule.choices = [...NAMED_CIRCUITS_7.keys()];
    if (initialValues.circuit !== undefined)
      this.circuitSchedule.set(initialValues.circuit);
    if (initialValues.fourierRect !== undefined)
      this.fourierRectSchedule.set(initialValues.fourierRect);
    if (initialValues.referenceRect !== undefined)
      this.referenceRectSchedule.set(initialValues.referenceRect);
    if (initialValues.termGroups !== undefined)
      this.termGroupsSchedule.set(initialValues.termGroups);
    if (initialValues.step !== undefined)
      this.stepSchedule.set(initialValues.step);
    if (initialValues.circleColor !== undefined)
      this.circleColorSchedule.set(initialValues.circleColor);
    if (initialValues.thinStarColor !== undefined)
      this.thinStarColorSchedule.set(initialValues.thinStarColor);
    if (initialValues.fatStarColor !== undefined)
      this.fatStarColorSchedule.set(initialValues.fatStarColor);
    if (initialValues.fillColor !== undefined)
      this.fillColorSchedule.set(initialValues.fillColor);
    if (initialValues.fourierLineWidth !== undefined)
      this.fourierLineWidthSchedule.set(initialValues.fourierLineWidth);
    if (initialValues.referenceLineWidth !== undefined)
      this.referenceLineWidthSchedule.set(initialValues.referenceLineWidth);
    this.minDurationScalar.value = initialValues.minDuration ?? 22_000;
    this.schedules.push(
      this.circuitSchedule,
      this.fourierRectSchedule,
      this.referenceRectSchedule,
      this.termGroupsSchedule,
      this.stepSchedule,
      this.cornerSizeSchedule,
      this.roundingSchedule,
      this.roundingStepSchedule,
      this.circleColorSchedule,
      this.thinStarColorSchedule,
      this.fatStarColorSchedule,
      this.fillColorSchedule,
      this.fourierLineWidthSchedule,
      this.referenceLineWidthSchedule,
    );
    // With a duration, it's also in the Edit list, on its own.  This shows its messages there too.
    addEditorMessages(this);
  }

  /** The last Circuit text read, and what it meant.  Never more than one entry. */
  #parsed:
    { readonly text: string; readonly result: Circuit | string } | undefined;
  /** The circuit at this time, or why there isn't one. */
  circuitAt(timeInMs: number): Circuit | string {
    const text = this.circuitSchedule.at(timeInMs);
    if (this.#parsed?.text !== text) {
      this.#parsed = { text, result: parseCircuit7(text) };
    }
    return this.#parsed.result;
  }

  /**
   * For the Visual Editor:  is the circuit valid, and do Term Groups and Step make sense together?
   * The Term Groups and Step checks are the library's, the same ones its Fourier panel shows.
   * See `editor-messages.ts`.
   */
  editorMessages(): EditorMessage[] {
    const messages: EditorMessage[] = [];
    /** Says which keyframe, when a field has more than one. */
    const at = (keyframes: readonly Keyframe<unknown>[], time: number) =>
      keyframes.length > 1 ? `At ${time} ms:  ` : "";
    const plural = (count: number, noun: string) =>
      `${count} ${noun}${count == 1 ? "" : "s"}`;

    // MARK: Circuit
    const circuitKeyframes = this.circuitSchedule.schedule;
    for (const { time, value } of circuitKeyframes) {
      const circuit = parseCircuit7(value);
      messages.push(
        typeof circuit == "string"
          ? // The message already starts with "Circuit:".
            { level: "error", text: `${at(circuitKeyframes, time)}${circuit}` }
          : {
              level: "ok",
              text: `${at(circuitKeyframes, time)}Circuit:  every edge exactly once`,
            },
      );
    }

    // MARK: Term Groups
    const termKeyframes = this.termGroupsSchedule.schedule;
    const groupCounts = new Set<number>();
    for (const { time, value } of termKeyframes) {
      const parsed = parseTermGroups(value);
      groupCounts.add(parsed.groups.length);
      const termCount = parsed.groups.reduce(
        (sum, group) => sum + group.length,
        0,
      );
      const problems = [...parsed.warnings];
      // Checked against the circuit in effect at the same time.
      // Without a valid circuit there are no terms to check against, so no ✓.
      const circuit = parseCircuit7(this.circuitSchedule.at(time));
      const checked = typeof circuit != "string";
      if (checked) {
        problems.push(
          ...checkTermGroups(parsed.groups, coloredSource(circuit).terms),
        );
      }
      const clean =
        checked && parsed.errors.length == 0 && problems.length == 0;
      messages.push({
        level: clean ? "ok" : "note",
        text: `${at(termKeyframes, time)}Term Groups:  ${plural(parsed.groups.length, "group")}, ${plural(termCount, "term")}`,
      });
      for (const error of parsed.errors) {
        messages.push({ level: "error", text: error });
      }
      for (const problem of problems) {
        messages.push({ level: "warning", text: problem });
      }
    }

    // MARK: Step
    if (groupCounts.size == 1) {
      const [groupCount] = groupCounts;
      const problems = checkStepRange(this.stepSchedule.schedule, groupCount);
      if (problems.length == 0) {
        messages.push({
          level: "ok",
          text: `Step runs from 0 to ${groupCount}`,
        });
      }
      for (const problem of problems) {
        messages.push({ level: "warning", text: problem });
      }
    } else {
      messages.push({
        level: "note",
        text: "Term Groups changes over time, so Step can't be checked against one number of groups.",
      });
    }
    return messages;
  }

  override show(options: ShowOptions): void {
    // Any children first, under the star, as in FourierComponent.
    super.show(options);
    const { context, timeInMs } = options;
    const circuit = this.circuitAt(timeInMs);
    if (typeof circuit == "string") {
      // In the Fourier's rectangle, so a mistake in one of several is easy to place.
      const rect = this.fourierRectSchedule.at(timeInMs);
      context.save();
      context.translate(rect.x, rect.y);
      context.scale(rect.width / 16, rect.width / 16);
      showError(context, circuit);
      context.restore();
      return;
    }
    const colors: StarColors = [
      this.circleColorSchedule.at(timeInMs),
      this.fatStarColorSchedule.at(timeInMs),
      this.thinStarColorSchedule.at(timeInMs),
    ];
    const fillColor = this.fillColorSchedule.at(timeInMs);
    this.drawReference(options, circuit, colors, fillColor);
    this.drawFourier(options, circuit, colors, fillColor);
  }

  readonly #animations = new ColoredAnimations();
  /** The Fourier animation, each part the color of the edges it becomes. */
  protected drawFourier(
    { context, timeInMs }: ShowOptions,
    circuit: Circuit,
    colors: StarColors,
    fillColor: string,
  ) {
    const lines = setLineWidth(
      context,
      this.fourierLineWidthSchedule.at(timeInMs),
      colors,
      fillColor,
    );
    if (!lines) {
      return;
    }
    const frame = this.#animations.frameAt(
      circuit,
      this.termGroupsSchedule.at(timeInMs),
      this.stepSchedule.at(timeInMs),
    );
    if (frame) {
      const fit = panAndZoom(
        STAR_BOUNDS,
        this.fourierRectSchedule.at(timeInMs),
        "meet",
      );
      drawColoredFrame(
        context,
        frame,
        coloredSource(circuit).runs,
        fit,
        lines,
        fillColor,
      );
    }
  }

  /** The reference image:  the whole circuit, with rounded corners.  Never mixed with the Fourier animation. */
  protected drawReference(
    { context, timeInMs }: ShowOptions,
    circuit: Circuit,
    colors: StarColors,
    fillColor: string,
  ) {
    const lines = setLineWidth(
      context,
      this.referenceLineWidthSchedule.at(timeInMs),
      colors,
      fillColor,
    );
    if (!lines) {
      return;
    }
    const settings: RoundingSettings = {
      cornerSize: this.cornerSizeSchedule.at(timeInMs),
      rounding: this.roundingSchedule.at(timeInMs),
      roundingStep: this.roundingStepSchedule.at(timeInMs),
    };
    const fit = panAndZoom(
      STAR_BOUNDS,
      this.referenceRectSchedule.at(timeInMs),
      "meet",
    );
    drawRoundedCircuit(context, circuit, fit, settings, lines, fillColor);
  }
}

/** Lines that don't show. */
const NO_LINES: StarColors = ["transparent", "transparent", "transparent"];

/**
 * Set the line width, where 0 means no lines.
 *
 * The canvas ignores a line width of 0 or less, and keeps the last one set.  So a width of 0 has to be handled here.
 * @returns The colors to draw the lines with.  All transparent when there are no lines, but a fill.
 * `undefined` when there's nothing to draw at all:  no lines and a transparent fill.  That's the quick way to turn a part off.
 */
function setLineWidth(
  context: CanvasRenderingContext2D,
  lineWidth: number,
  colors: StarColors,
  fillColor: string,
): StarColors | undefined {
  if (lineWidth > 0) {
    context.lineWidth = lineWidth;
    return colors;
  } else if (fillColor == "transparent") {
    return undefined;
  } else {
    return NO_LINES;
  }
}

// MARK: Registry

componentRegistry.set("Star Circuit", {
  create() {
    return new StarCircuit();
  },
  description:
    "One Euler circuit of the 7 pointed star, as a Fourier animation and as a reference image, " +
    "each in its own rectangle, in matching colors.  " +
    "Circuit takes a name from the list, or the vertices in order, like 0 1 2 0 3 ….",
  howToGenerate: { type: "class", class: StarCircuit },
});
