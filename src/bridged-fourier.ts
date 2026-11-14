/**
 * A prototype:  a multi-color Fourier for any path, not just the star's circuits.
 *
 * A path with gaps, like cursive text, has to be one closed loop before it can be a Fourier series.
 * The library closes each gap with a straight line, drawn like the rest.  Here those lines are **bridges**,
 * drawn in their own color, usually transparent, so only the real path shows.
 *
 * The path is the Text field, in the cursive font.  The default is "Like / share / and / subscribe", as in "Will it Fourier?".
 * Lines 2 and 4 run backwards, so the jumps between lines are short.
 *
 * Quick and dirty, on purpose.  Two functions here are copies of the ones in `colored-fourier.ts`, changed:
 * `samplesWithBridges()` from `samplesWithStarts()`, and `drawBridgedFrame()` from `drawColoredFrame()`.
 * If this works out, the copies become one general version, colored by ranges of `t`.
 *
 * Only the landscape video loads this file.  In the component registry as "Bridged Fourier".
 * @module
 */

import { assertNonNullable, ReadOnlyRect, sum } from "phil-lib/misc";
import {
  ColorScheduleInfo,
  componentRegistry,
  DurationAgnosticComponent,
  type EditorPanel,
  Keyframe,
  NumberScheduleInfo,
  orderTerms,
  parseTermGroups,
  RectangleScheduleInfo,
  ShowOptions,
  StringScheduleInfo,
} from "canvas-recorder-lib";
import { Font } from "canvas-recorder-lib/src/glib/letters-base";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import { ParagraphLayout } from "canvas-recorder-lib/src/glib/paragraph-layout";
import {
  Command,
  LCommand,
  PathBuilder,
  PathShape,
} from "canvas-recorder-lib/src/glib/path-shape";
import { panAndZoom } from "canvas-recorder-lib/src/glib/transforms";
import {
  Complex,
  FourierTerm,
  numberOfFourierSamples,
  samplesToFourier,
} from "canvas-recorder-lib/src/peano-fourier/fourier-shared";
import { Frame, getFrameRules } from "./colored-fourier.ts";
import {
  EditorMessage,
  HasEditorMessages,
  showMessagesWithProperties,
} from "./editor-messages.ts";
import {
  fourierMessages,
  fourierStepPanel,
  SteppedFourier,
} from "./fourier-panel.ts";

// MARK: The path

/** The Text field's default. */
const LIKE_SHARE_SUBSCRIBE = "Like\nshare\nand\nsubscribe";

/**
 * Some text in the cursive font, each line centered under the one before.
 * Every other line runs right to left, so each line ends near where the next one starts.
 * In the font's own coordinates.  {@link bridgedSource} moves it to the origin.
 */
function cursivePath(text: string): PathShape {
  const layout = new ParagraphLayout(Font.cursive(1));
  layout.addText(text);
  const laidOut = layout.align(Infinity, "center");
  /** Each line's commands, in order. */
  const lines: Command[][] = [];
  for (const letter of laidOut.getAllLetters()) {
    (lines[letter.word.hardLineIndex] ??= []).push(
      ...letter.translatedShape.commands,
    );
  }
  const commands = lines.flatMap((line, index) => {
    const shape = new PathShape(line);
    return (index % 2 == 0 ? shape : shape.reverse()).commands;
  });
  return new PathShape(commands);
}

// MARK: Samples and runs

/** Part of the original path, or a line added to close a gap. */
export type RunKind = "content" | "bridge";

/** Some of the loop, all one kind, and the range of `t` it becomes. */
export type BridgedRun = {
  readonly kind: RunKind;
  /** 0 to 1. */
  readonly start: number;
  readonly end: number;
};

/**
 * A gap shorter than this isn't a gap.
 *
 * Letters that touch can still be a rounding error apart:  the "i" and "k" of "Like" are 4.4 × 10⁻¹⁶ apart.
 * `PathShape.needAnM()` checks for exact equality, so it would add a bridge there.
 * A bridge gets at least one sample, about 1/1024 of `t`, which would leave a hole in the line.
 */
const WELD = 1e-6;

/**
 * A copy of `samplesWithStarts()` in `colored-fourier.ts`, which copies the library's `samplesFromPath()`.
 * The same samples, in the same order, except a gap under {@link WELD} doesn't get a line.
 * @returns The samples, and which ranges of `t` are the path and which are the lines that close its gaps.
 * The runs are in order, from 0 to 1.  The last one is the bridge that closes the loop, unless the path was closed already.
 */
export function samplesWithBridges(
  pathShape: PathShape,
  numberOfSamples = numberOfFourierSamples,
): { samples: Complex[]; runs: BridgedRun[] } {
  const commands = pathShape.commands;
  if (commands.length == 0) {
    throw new Error("wtf");
  }
  /** The path's commands, plus a straight line to fill each gap. */
  const connected: {
    readonly command: Command;
    readonly kind: RunKind;
    readonly length: number;
    numberOfVertices: number;
  }[] = [];
  commands.forEach((command, index) => {
    connected.push({
      command,
      kind: "content",
      length: command.getLength(),
      numberOfVertices: 0,
    });
    const nextCommand = commands[(index + 1) % commands.length];
    const gap = Math.hypot(
      nextCommand.x0 - command.x,
      nextCommand.y0 - command.y,
    );
    if (gap > WELD) {
      const line = new LCommand(
        command.x,
        command.y,
        nextCommand.x0,
        nextCommand.y0,
      );
      connected.push({
        command: line,
        kind: "bridge",
        length: line.getLength(),
        numberOfVertices: 0,
      });
    }
  });
  {
    // Share out the samples by length, shortest first, at least one each.
    const working = connected.toSorted((a, b) => b.length - a.length);
    let verticesAvailable = numberOfSamples;
    let lengthAvailable = sum(working.map(({ length }) => length));
    while (verticesAvailable != 0) {
      const segmentInfo = assertNonNullable(working.pop());
      if (segmentInfo.length > 0) {
        const idealNumberOfVertices =
          (verticesAvailable / lengthAvailable) * segmentInfo.length;
        const numberOfVertices = Math.max(1, Math.round(idealNumberOfVertices));
        segmentInfo.numberOfVertices = numberOfVertices;
        verticesAvailable -= numberOfVertices;
        lengthAvailable -= segmentInfo.length;
      }
    }
  }
  const samples: Complex[] = [];
  /** Where each run starts, in samples.  Neighbors of the same kind are merged. */
  const runStarts: { kind: RunKind; start: number }[] = [];
  for (const { command, kind, numberOfVertices } of connected) {
    if (runStarts.at(-1)?.kind !== kind) {
      runStarts.push({ kind, start: samples.length });
    }
    if (numberOfVertices == 1) {
      samples.push([command.x0, command.y0]);
    } else if (numberOfVertices > 1) {
      const splitter = command.makeSplitter();
      for (let i = 0; i < numberOfVertices; i++) {
        const { x, y } = splitter.at((splitter.length * i) / numberOfVertices);
        samples.push([x, y]);
      }
    }
  }
  const count = samples.length;
  const runs = runStarts.map(({ kind, start }, index) => ({
    kind,
    start: start / count,
    end: (runStarts[index + 1]?.start ?? count) / count,
  }));
  return { samples, runs };
}

/** What the animation needs to know about the path. */
type BridgedSource = {
  /** Largest first, straight from `samplesToFourier()`. */
  readonly terms: readonly FourierTerm[];
  readonly runs: readonly BridgedRun[];
  /** The path's own bounding box, which Dest Rect shows. */
  readonly bounds: ReadOnlyRect;
};

/**
 * Some text, ready to animate.  Slow:  each component caches the last one.
 *
 * `samplesToFourier()` leaves out the frequency 0 term (library 0.8.0), so the terms add up to the path
 * moved so the average of its samples is at (0, 0).  Step 0's dot starts there, in the middle of the text.
 * `bounds` is moved the same way, as the library's Fourier component does.
 * @returns Or why there's nothing to animate.  A user error, for the editor's Checks.
 */
function bridgedSource(text: string): BridgedSource | string {
  const path = cursivePath(text);
  if (path.commands.length == 0) {
    return "Text has nothing the font can draw.";
  }
  let sampled: ReturnType<typeof samplesWithBridges>;
  try {
    sampled = samplesWithBridges(path);
  } catch (reason) {
    return `Couldn't sample the text:  ${reason instanceof Error ? reason.message : reason}`;
  }
  const { samples, runs } = sampled;
  const averageX = sum(samples.map(([x]) => x)) / samples.length;
  const averageY = sum(samples.map(([, y]) => y)) / samples.length;
  return {
    terms: samplesToFourier(samples),
    runs,
    bounds: path.translate(-averageX, -averageY).getBBoxRect(),
  };
}

// MARK: Drawing

/** Even a short run gets this many segments, so a tiny loop like an i's dot doesn't turn into a jagged shape. */
const MIN_SEGMENTS = 8;

/**
 * A cut-down copy of `drawColoredFrame()` in `colored-fourier.ts`:  two colors, no fill.
 *
 * The bridges first, then the content on top, so the content wins where they cross.
 * A bridge color of exactly "transparent" skips the bridges.
 * Round caps, so the ends of the content look like the ends of a pen stroke.
 * Uses the context's current line width.
 *
 * Step 0 is a dot, drawn as a filled circle.  The library draws it as a line of length 0 with round caps,
 * and the canvas skips a line that short, so the dot never shows (`library-issues.md`, item 33).
 * @param fit From the path's own coordinates to the canvas.
 */
export function drawBridgedFrame(
  context: CanvasRenderingContext2D,
  frame: Frame,
  runs: readonly BridgedRun[],
  fit: DOMMatrix,
  contentColor: string,
  bridgeColor: string,
) {
  const { f, end, segments } = frame;
  const layers: Record<RunKind, Command[]> = { bridge: [], content: [] };
  /** Pieces of length 0, in the path's own coordinates. */
  const dots: Record<RunKind, { x: number; y: number }[]> = {
    bridge: [],
    content: [],
  };
  for (const run of runs) {
    if (run.start >= end) {
      break;
    }
    if (run.kind == "bridge" && bridgeColor == "transparent") {
      continue;
    }
    const runEnd = Math.min(run.end, end);
    const width = runEnd - run.start;
    if (!(width > 0)) {
      continue;
    }
    let piece: PathShape;
    if (segments == 0) {
      const from = f(run.start);
      const to = f(runEnd);
      if (from.x == to.x && from.y == to.y) {
        dots[run.kind].push(from);
        continue;
      }
      piece = PathBuilder.M(from.x, from.y).L(to.x, to.y).pathShape;
    } else {
      piece = PathShape.glitchFreeParametric(
        (s) => f(run.start + s * width),
        Math.max(MIN_SEGMENTS, Math.ceil(segments * width)),
      );
    }
    layers[run.kind].push(...piece.commands);
  }
  context.lineCap = "round";
  context.lineJoin = "round";
  const order: [RunKind, string][] = [
    ["bridge", bridgeColor],
    ["content", contentColor],
  ];
  for (const [kind, color] of order) {
    if (layers[kind].length > 0) {
      context.strokeStyle = color;
      context.stroke(new PathShape(layers[kind]).transform(fit).canvasPath);
    }
    if (dots[kind].length > 0) {
      const radius = context.lineWidth / 2;
      const circles = new Path2D();
      for (const dot of dots[kind]) {
        const { x, y } = fit.transformPoint(dot);
        circles.moveTo(x + radius, y);
        circles.arc(x, y, radius, 0, 2 * Math.PI);
      }
      context.fillStyle = color;
      context.fill(circles);
    }
  }
}

// MARK: The component

/**
 * A Fourier animation of some cursive text, with the lines that close its gaps in their own color.
 * The fields are like the library's Fourier component, with Text in place of Source, and Content Color and Bridge Color in place of Stroke Color.
 *
 * Bridge Color is usually transparent.  Fading to transparent keeps the first few circles looking closed.
 * Any visible color shows where the bridges are, for debugging.
 *
 * A DurationAgnosticComponent, like Star Circuit:  Min Duration is 0 by default, so the scene sets the length.
 *
 * In the Visual Editor, with its properties:  what Step means at the playhead, and the checks that Term Groups and Step agree.
 * See `fourier-panel.ts`.  The first component on the library's new panel hooks, for both.
 */
export class BridgedFourier
  extends DurationAgnosticComponent
  implements SteppedFourier, HasEditorMessages
{
  readonly registryKey = "Bridged Fourier";
  /** In the cursive font.  One line or several:  every other line runs backwards. */
  readonly textSchedule = new StringScheduleInfo("Text", LIKE_SHARE_SUBSCRIBE);
  /**
   * The same as the Fourier component's Term Groups.
   * Ends at 1022, not 1023:  1024 samples give 1024 terms, and `samplesToFourier()` leaves out the frequency 0 term.
   */
  readonly termGroupsSchedule = new StringScheduleInfo(
    "Term Groups",
    "0, 1, 2, 3, 4, 5-9, 10-19, 20-39, 40-99, 100-299, 300-1022",
  );
  /** The same as the Fourier component's Step:  negative hides it, 0 is a dot, the number of groups is the finished curve. */
  readonly stepSchedule = new NumberScheduleInfo("Step", [
    { time: 0, value: 0 },
    { time: 22_000, value: 11 },
  ]);
  /** The finished curve fits inside this, centered, keeping its shape.  Earlier steps can wander outside it. */
  readonly destRectSchedule = new RectangleScheduleInfo("Dest Rect", {
    x: 8.5,
    y: 0.5,
    width: 7,
    height: 8,
  });
  /** The path itself. */
  readonly contentColorSchedule = new ColorScheduleInfo(
    "Content Color",
    myRainbow.yellow,
  );
  /** The lines that close the gaps.  Exactly "transparent" skips them. */
  readonly bridgeColorSchedule = new ColorScheduleInfo(
    "Bridge Color",
    "transparent",
  );
  /** In units, so it doesn't grow or shrink with Dest Rect.  0 draws nothing. */
  readonly lineWidthSchedule = new NumberScheduleInfo("Line Width", 0.05);
  /** Its own panel in the Visual Editor:  Step at the playhead, the terms that means, and a fix when Step and Term Groups disagree. */
  readonly editorPanel: EditorPanel = fourierStepPanel(this);
  constructor(
    initialValues: {
      description?: string;
      text?: string | readonly Keyframe<string>[];
      termGroups?: string | readonly Keyframe<string>[];
      step?: number | readonly Keyframe<number>[];
      destRect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      contentColor?: string | readonly Keyframe<string>[];
      bridgeColor?: string | readonly Keyframe<string>[];
      lineWidth?: number | readonly Keyframe<number>[];
      /** How long to ask the parent for.  0 by default:  nothing on the timeline, and the parent sets the length. */
      minDuration?: number;
    } = {},
  ) {
    super(initialValues.description ?? "Bridged Fourier");
    if (initialValues.text !== undefined)
      this.textSchedule.set(initialValues.text);
    if (initialValues.termGroups !== undefined)
      this.termGroupsSchedule.set(initialValues.termGroups);
    if (initialValues.step !== undefined)
      this.stepSchedule.set(initialValues.step);
    if (initialValues.destRect !== undefined)
      this.destRectSchedule.set(initialValues.destRect);
    if (initialValues.contentColor !== undefined)
      this.contentColorSchedule.set(initialValues.contentColor);
    if (initialValues.bridgeColor !== undefined)
      this.bridgeColorSchedule.set(initialValues.bridgeColor);
    if (initialValues.lineWidth !== undefined)
      this.lineWidthSchedule.set(initialValues.lineWidth);
    this.minDurationScalar.value = initialValues.minDuration ?? 0;
    this.schedules.push(
      this.textSchedule,
      this.termGroupsSchedule,
      this.stepSchedule,
      this.destRectSchedule,
      this.contentColorSchedule,
      this.bridgeColorSchedule,
      this.lineWidthSchedule,
    );
    showMessagesWithProperties(this);
  }

  /** The source for the last Text.  Never more than one entry. */
  #source:
    | { readonly text: string; readonly value: BridgedSource | string }
    | undefined;
  #sourceAt(timeInMs: number) {
    const text = this.textSchedule.at(timeInMs);
    if (this.#source?.text !== text) {
      this.#source = { text, value: bridgedSource(text) };
    }
    return this.#source.value;
  }

  /** The terms of the text at this time, or why there aren't any. */
  fourierTermsAt(timeInMs: number) {
    const source = this.#sourceAt(timeInMs);
    return typeof source == "string" ? source : source.terms;
  }

  /** For the Visual Editor:  is there any text, and do Term Groups and Step agree?  See `editor-messages.ts`. */
  editorMessages(): EditorMessage[] {
    return fourierMessages(this);
  }

  /** The animation for the last source and Term Groups text.  Never more than one entry. */
  #animation:
    | {
        readonly source: BridgedSource;
        readonly termGroups: string;
        readonly rules: readonly ((progress: number) => Frame)[];
      }
    | undefined;
  #rulesFor(source: BridgedSource, termGroups: string) {
    if (
      this.#animation?.source !== source ||
      this.#animation.termGroups !== termGroups
    ) {
      const ordered = orderTerms(
        source.terms,
        parseTermGroups(termGroups).groups,
      );
      const rules =
        ordered.keyframes.length < 2
          ? []
          : getFrameRules(ordered.terms, ordered.keyframes);
      this.#animation = { source, termGroups, rules };
    }
    return this.#animation.rules;
  }

  override show(options: ShowOptions): void {
    // Any children first, under the curve, as in FourierComponent.
    super.show(options);
    const { context, timeInMs } = options;
    const lineWidth = this.lineWidthSchedule.at(timeInMs);
    const step = this.stepSchedule.at(timeInMs);
    // The canvas ignores a line width of 0 or less, and keeps the last one.
    if (!(lineWidth > 0) || !(step >= 0)) {
      return;
    }
    const source = this.#sourceAt(timeInMs);
    if (typeof source == "string") {
      // Said in the editor's Checks.
      return;
    }
    const rules = this.#rulesFor(source, this.termGroupsSchedule.at(timeInMs));
    if (rules.length == 0) {
      return;
    }
    // The same arithmetic as the Fourier component and ColoredAnimations.frameAt().
    const index = Math.min(Math.floor(step), rules.length - 1);
    const frame = rules[index](Math.min(1, step - index));
    const { runs, bounds } = source;
    const fit = panAndZoom(bounds, this.destRectSchedule.at(timeInMs), "meet");
    context.lineWidth = lineWidth;
    drawBridgedFrame(
      context,
      frame,
      runs,
      fit,
      this.contentColorSchedule.at(timeInMs),
      this.bridgeColorSchedule.at(timeInMs),
    );
  }
}

// MARK: Registry

componentRegistry.set("Bridged Fourier", {
  create() {
    return new BridgedFourier();
  },
  description:
    "A prototype:  a Fourier animation of cursive text, “Like share and subscribe” to start.  " +
    "The lines that close the gaps between strokes get their own color, usually transparent.",
  howToGenerate: { type: "class", class: BridgedFourier },
});
