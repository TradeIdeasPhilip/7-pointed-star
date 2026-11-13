/**
 * A prototype:  a Fourier morph from one path to another, where each path's bridges stay invisible.
 *
 * Before and After are each sampled the usual way, by `samplesWithBridges()` from `bridged-fourier.ts`:
 * 1024 samples, spread out by length, with every corner and every end of a bridge on a sample.
 * Sample i of Before goes to sample i of After, so the first third of one becomes the first third of the other.
 *
 * The morph is Before, plus the Fourier terms of the difference, After − Before, added a group at a time
 * with the same sweep the Fourier component uses.  Step 0 is exactly Before, and the last step is exactly After.
 * The showcase's Fourier Morph does the same with closed shapes:  canvas-recorder-lib, `test-project/src/showcase/fourier-morph.ts`.
 *
 * Each piece of the loop, from one sample to the next, is one of four kinds, from what it is in Before and in After:
 * content in both, a bridge in both, content that becomes a bridge (it fades out), and a bridge that becomes content (it fades in).
 * Corners are always samples, so the kind only changes at a sample, and no piece is shorter than one sample.
 *
 * The paths are words in the cursive font, typed into Before and After.
 *
 * Quick and dirty, on purpose.  Only the landscape video loads this file.  In the component registry as "Bridged Morph".
 * @module
 */

import {
  initializedArray,
  makeBoundedLinear,
  ReadOnlyRect,
} from "phil-lib/misc";
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
import { PathShape } from "canvas-recorder-lib/src/glib/path-shape";
import {
  Complex,
  FourierTerm,
  numberOfFourierSamples,
  samplesToFourier,
} from "canvas-recorder-lib/src/peano-fourier/fourier-shared";
import { RunKind, samplesWithBridges } from "./bridged-fourier.ts";
import { makeEasing } from "./colored-fourier.ts";
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

/** Every path gets this many samples, so sample i of one lines up with sample i of the other. */
const SAMPLE_COUNT = numberOfFourierSamples;

// MARK: The words

let font: Font | undefined;
/** Built the first time it's needed, not when this module loads. */
function cursive() {
  return (font ??= Font.cursive(1));
}

/** One line of the font, top to bottom.  Dest Rect's height is this tall. */
function lineHeight() {
  return cursive().bottom - cursive().top;
}

/**
 * Some text in the cursive font, one line, centered side to side on x = 0.
 * The top of the line is at y = 0, and the bottom is at {@link lineHeight}.
 * Every word sits on the same baseline, so a morph from one word to another doesn't move up or down.
 */
function textPath(text: string): PathShape {
  const shape = ParagraphLayout.singlePathShape({ font: cursive(), text });
  if (shape.commands.length == 0) {
    return shape;
  }
  const box = shape.getBBoxRect();
  return shape.translate(-(box.x + box.width / 2), 0);
}

// MARK: Samples

/** One path, ready to morph. */
type SampledPath = {
  readonly samples: readonly Complex[];
  /** What each piece is.  Piece i goes from sample i to sample i + 1.  The last one closes the loop. */
  readonly kinds: readonly RunKind[];
};

/**
 * Text with nothing to draw is a dot in the middle of the line, all bridge.
 * So a morph from nothing grows out of a dot and fades in.
 */
function emptyPath(): SampledPath {
  const y = -cursive().top - cursive().mHeight / 2;
  return {
    samples: initializedArray(SAMPLE_COUNT, (): Complex => [0, y]),
    kinds: new Array<RunKind>(SAMPLE_COUNT).fill("bridge"),
  };
}

/**
 * The samples of some text, and what each piece between two samples is.
 * @returns Or why it can't be sampled.
 */
function sampleText(text: string): SampledPath | string {
  const path = textPath(text);
  if (path.commands.length == 0) {
    return emptyPath();
  }
  let sampled: ReturnType<typeof samplesWithBridges>;
  try {
    sampled = samplesWithBridges(path, SAMPLE_COUNT);
  } catch (reason) {
    return `Couldn't sample “${text}”:  ${reason instanceof Error ? reason.message : reason}`;
  }
  const { samples, runs } = sampled;
  if (samples.length != SAMPLE_COUNT) {
    return `“${text}” has too many pieces for ${SAMPLE_COUNT} samples.`;
  }
  const kinds: RunKind[] = [];
  for (const run of runs) {
    const start = Math.round(run.start * SAMPLE_COUNT);
    const end = Math.round(run.end * SAMPLE_COUNT);
    for (let i = start; i < end; i++) {
      kinds[i] = run.kind;
    }
  }
  return { samples, kinds };
}

// MARK: The morph

/** What a piece is in Before and After, and so how it's drawn. */
export type MorphKind = "content" | "bridge" | "fade out" | "fade in";

function morphKind(before: RunKind, after: RunKind): MorphKind {
  if (before == after) {
    return before;
  }
  return before == "content" ? "fade out" : "fade in";
}

/** Some of the loop, all one kind. */
type MorphRun = {
  readonly kind: MorphKind;
  /** The first sample. */
  readonly start: number;
  /** The last sample, after `start`.  {@link SAMPLE_COUNT} means sample 0 again. */
  readonly end: number;
};

/** What the animation needs to know about one Before and After. */
type MorphSource = {
  readonly before: readonly Complex[];
  /**
   * The Fourier terms of After − Before, sample by sample, largest first.
   * The frequency 0 term is kept, so Before plus every term is exactly After.
   */
  readonly terms: readonly FourierTerm[];
  readonly runs: readonly MorphRun[];
  /**
   * The sum of every term's amplitude squared.
   * That's the mean squared distance from Before to After, sample by sample (Parseval).
   */
  readonly energy: number;
};

/**
 * @returns Or why there isn't one.
 */
function morphSource(
  beforeText: string,
  afterText: string,
): MorphSource | string {
  const before = sampleText(beforeText);
  if (typeof before == "string") {
    return before;
  }
  const after = sampleText(afterText);
  if (typeof after == "string") {
    return after;
  }
  const difference = before.samples.map(([x, y], i): Complex => [
    after.samples[i][0] - x,
    after.samples[i][1] - y,
  ]);
  const terms = samplesToFourier(difference, { keepCenter: true });
  const runs: MorphRun[] = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const kind = morphKind(before.kinds[i], after.kinds[i]);
    const last = runs.at(-1);
    if (last?.kind == kind) {
      runs[runs.length - 1] = { ...last, end: i + 1 };
    } else {
      runs.push({ kind, start: i, end: i + 1 });
    }
  }
  return {
    before: before.samples,
    terms,
    runs,
    energy: terms.reduce((total, { amplitude }) => total + amplitude ** 2, 0),
  };
}

/** A curve at every sample. */
type State = { readonly x: Float64Array; readonly y: Float64Array };

/** The morph for one Term Groups. */
type MorphAnimation = {
  /** The curve at each whole Step.  `states[0]` is Before. */
  readonly states: readonly State[];
  /**
   * For each step, how wide the sweep's soft edge is, in `t`, on each side of its center.
   * Undefined when the step adds no terms, so nothing moves.
   */
  readonly r: readonly (number | undefined)[];
  /** How much of {@link MorphSource.energy} is still to come at each whole Step. */
  readonly energyLeft: readonly number[];
};

function morphAnimation(
  source: MorphSource,
  termGroups: string,
): MorphAnimation {
  const ordered = orderTerms(source.terms, parseTermGroups(termGroups).groups);
  const x = Float64Array.from(source.before, ([x]) => x);
  const y = Float64Array.from(source.before, ([, y]) => y);
  const states: State[] = [];
  const energyLeft: number[] = [];
  let left = source.energy;
  let added = 0;
  for (const keyframe of ordered.keyframes) {
    for (; added < keyframe; added++) {
      const { frequency, amplitude, phase } = ordered.terms[added];
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const angle = (2 * Math.PI * frequency * i) / SAMPLE_COUNT + phase;
        x[i] += amplitude * Math.cos(angle);
        y[i] += amplitude * Math.sin(angle);
      }
      left -= amplitude ** 2;
    }
    states.push({ x: x.slice(), y: y.slice() });
    energyLeft.push(Math.max(0, left));
  }
  const r = initializedArray(ordered.keyframes.length - 1, (index) => {
    const start = ordered.keyframes[index];
    const end = ordered.keyframes[index + 1];
    if (start == end) {
      return undefined;
    }
    // The same timing as the Fourier component:  by the first term's frequency.  orderTerms() puts frequency 0 last.
    return 0.2 / (Math.abs(ordered.terms[start].frequency) || 1);
  });
  return { states, r, energyLeft };
}

/**
 * The curve at this Step, and how far along the fades are, 0 to 1.
 *
 * Between two whole Steps, the change sweeps along the curve, from `t` = 0 to 1, the way the Fourier component adds terms.
 *
 * The fades follow how close the curve is to its last step, not Step itself:  1 − the RMS distance still to go,
 * as a fraction of the whole trip.  The first groups have the big terms, so most of the fading is early, while the shape changes most.
 */
function morphAt(
  animation: MorphAnimation,
  step: number,
): { readonly points: State; readonly fade: number } {
  const { states, r, energyLeft } = animation;
  const stepCount = states.length - 1;
  if (stepCount <= 0 || step <= 0) {
    return { points: states[0], fade: 0 };
  }
  if (step >= stepCount) {
    return { points: states[stepCount], fade: 1 };
  }
  const index = Math.floor(step);
  const progress = step - index;
  const from = states[index];
  const to = states[index + 1];
  /** The RMS distance still to go, by Parseval, from what's left of the energy. */
  const distance = (left: number) => Math.sqrt(left);
  const trip = distance(energyLeft[0]) - distance(energyLeft[stepCount]);
  const left =
    energyLeft[index] + progress * (energyLeft[index + 1] - energyLeft[index]);
  // Measured against the last step, not After, so it ends at 1 even when Term Groups leaves some terms out.
  const fade =
    trip > 0
      ? Math.min(
          1,
          Math.max(0, (distance(energyLeft[0]) - distance(left)) / trip),
        )
      : step / stepCount;
  const width = r[index];
  if (progress == 0 || width === undefined) {
    return { points: from, fade };
  }
  const center = makeBoundedLinear(0, -width, 1, 1 + width)(progress);
  const getFraction = makeEasing(center - width, center + width);
  const x = new Float64Array(SAMPLE_COUNT);
  const y = new Float64Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    // The new terms are all the way in behind the sweep, and not at all ahead of it.
    const fraction = 1 - getFraction(i / SAMPLE_COUNT);
    x[i] = from.x[i] + fraction * (to.x[i] - from.x[i]);
    y[i] = from.y[i] + fraction * (to.y[i] - from.y[i]);
  }
  return { points: { x, y }, fade };
}

// MARK: Drawing

/** `from` at 0, `to` at 1, like the library's color schedules. */
function mixColors(from: string, to: string, progress: number) {
  if (progress <= 0) {
    return from;
  }
  if (progress >= 1) {
    return to;
  }
  return `color-mix(in srgb, ${to} ${progress * 100}%, ${from})`;
}

/** Bottom to top.  The content last, so it wins where pieces cross. */
const LAYERS: readonly MorphKind[] = [
  "bridge",
  "fade out",
  "fade in",
  "content",
];

/**
 * Each kind of piece in its own color, as straight lines from sample to sample.
 * A color of exactly "transparent" isn't drawn.  Round caps and joins, like a pen.
 * Uses the context's current line width.
 * @param transform From the text's own coordinates to the canvas.
 */
function drawMorphFrame(
  context: CanvasRenderingContext2D,
  points: State,
  runs: readonly MorphRun[],
  transform: (x: number, y: number) => readonly [number, number],
  colors: Readonly<Record<MorphKind, string>>,
) {
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const kind of LAYERS) {
    const color = colors[kind];
    if (color == "transparent") {
      continue;
    }
    const path = new Path2D();
    let empty = true;
    for (const run of runs) {
      if (run.kind != kind) {
        continue;
      }
      for (let i = run.start; i <= run.end; i++) {
        const j = i % SAMPLE_COUNT;
        const [x, y] = transform(points.x[j], points.y[j]);
        if (i == run.start) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
      }
      empty = false;
    }
    if (!empty) {
      context.strokeStyle = color;
      context.stroke(path);
    }
  }
}

// MARK: The component

/**
 * A Fourier morph from one word to another, in the cursive font.
 * The fields are like the library's Fourier component, with Before and After for the words.
 *
 * Step 0 is exactly Before, and Step equal to the number of groups is exactly After.  Negative hides it.
 * So two of these can take turns:  hide the first one at the moment the second one starts.
 *
 * Each word's bridges, the lines that close its gaps, are Bridge Color, usually transparent.
 * Content in one word and a bridge in the other fades between Content Color and Bridge Color, as the curve gets closer to After.
 * Give Bridge Color a visible color to see all four kinds.
 *
 * The words fill Dest Rect's height:  one line of the font, top to bottom.  They're centered side to side, and a long word can spill out.
 * So two of these with the same Dest Rect draw a word in exactly the same place.
 *
 * In the Visual Editor, with its properties:  what Step means at the playhead, and the checks that Term Groups and Step agree.
 * Term Groups numbers the terms of the difference, After − Before.
 */
export class BridgedMorph
  extends DurationAgnosticComponent
  implements SteppedFourier, HasEditorMessages
{
  readonly registryKey = "Bridged Morph";
  /** The text to start from. */
  readonly beforeSchedule = new StringScheduleInfo("Before", "Love");
  /** The text to end with. */
  readonly afterSchedule = new StringScheduleInfo("After", "Reason");
  /**
   * The same as the Fourier component's Term Groups, for the terms of After − Before.
   * Up to 1024 terms, 0 to 1023:  the frequency 0 term is kept, because it's how far the two words' centers are apart.
   */
  readonly termGroupsSchedule = new StringScheduleInfo(
    "Term Groups",
    "0, 1, 2, 3, 4, 5-9, 10-19, 20-39, 40-99, 100-1023",
  );
  /** 0 is Before, the number of groups is After, and negative hides it. */
  readonly stepSchedule = new NumberScheduleInfo("Step", [
    { time: 1_000, value: 0 },
    { time: 9_000, value: 10 },
  ]);
  /** The words are as tall as this, centered in it. */
  readonly destRectSchedule = new RectangleScheduleInfo("Dest Rect", {
    x: 0.5,
    y: 2.75,
    width: 15,
    height: 4.5,
  });
  /** The words themselves. */
  readonly contentColorSchedule = new ColorScheduleInfo(
    "Content Color",
    myRainbow.yellow,
  );
  /** The lines that close each word's gaps.  Exactly "transparent" skips them. */
  readonly bridgeColorSchedule = new ColorScheduleInfo(
    "Bridge Color",
    "transparent",
  );
  /** In units, so it doesn't grow or shrink with Dest Rect.  0 draws nothing. */
  readonly lineWidthSchedule = new NumberScheduleInfo("Line Width", 0.12);
  /** Its own panel in the Visual Editor:  Step at the playhead, the terms that means, and a fix when Step and Term Groups disagree. */
  readonly editorPanel: EditorPanel = fourierStepPanel(this);
  constructor(
    initialValues: {
      description?: string;
      before?: string | readonly Keyframe<string>[];
      after?: string | readonly Keyframe<string>[];
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
    super(initialValues.description ?? "Bridged Morph");
    if (initialValues.before !== undefined)
      this.beforeSchedule.set(initialValues.before);
    if (initialValues.after !== undefined)
      this.afterSchedule.set(initialValues.after);
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
      this.beforeSchedule,
      this.afterSchedule,
      this.termGroupsSchedule,
      this.stepSchedule,
      this.destRectSchedule,
      this.contentColorSchedule,
      this.bridgeColorSchedule,
      this.lineWidthSchedule,
    );
    showMessagesWithProperties(this);
  }

  /** The source for the last Before and After.  Never more than one entry. */
  #source:
    | {
        readonly before: string;
        readonly after: string;
        readonly value: MorphSource | string;
      }
    | undefined;
  #sourceAt(timeInMs: number) {
    const before = this.beforeSchedule.at(timeInMs);
    const after = this.afterSchedule.at(timeInMs);
    if (this.#source?.before !== before || this.#source.after !== after) {
      this.#source = { before, after, value: morphSource(before, after) };
    }
    return this.#source.value;
  }

  /** The animation for the last source and Term Groups.  Never more than one entry. */
  #animation:
    | {
        readonly source: MorphSource;
        readonly termGroups: string;
        readonly value: MorphAnimation;
      }
    | undefined;
  #animationFor(source: MorphSource, termGroups: string) {
    if (
      this.#animation?.source !== source ||
      this.#animation.termGroups !== termGroups
    ) {
      this.#animation = {
        source,
        termGroups,
        value: morphAnimation(source, termGroups),
      };
    }
    return this.#animation.value;
  }

  /** The terms of After − Before at this time. */
  fourierTermsAt(timeInMs: number) {
    const source = this.#sourceAt(timeInMs);
    return typeof source == "string" ? source : source.terms;
  }

  /** For the Visual Editor:  do Term Groups and Step agree, and can the font draw the words?  See `editor-messages.ts`. */
  editorMessages(): EditorMessage[] {
    const messages = fourierMessages(this);
    for (const schedule of [this.beforeSchedule, this.afterSchedule]) {
      for (const { value } of schedule.schedule) {
        if (textPath(value).commands.length == 0) {
          messages.push({
            level: "note",
            text: `${schedule.description} “${value}” has nothing the font can draw, so it's a dot.`,
          });
        }
      }
    }
    return messages;
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
      return;
    }
    const animation = this.#animationFor(
      source,
      this.termGroupsSchedule.at(timeInMs),
    );
    const { points, fade } = morphAt(animation, step);
    const destRect = this.destRectSchedule.at(timeInMs);
    const scale = destRect.height / lineHeight();
    const centerX = destRect.x + destRect.width / 2;
    const content = this.contentColorSchedule.at(timeInMs);
    const bridge = this.bridgeColorSchedule.at(timeInMs);
    context.lineWidth = lineWidth;
    drawMorphFrame(
      context,
      points,
      source.runs,
      (x, y) => [centerX + scale * x, destRect.y + scale * y],
      {
        content,
        bridge,
        "fade out": mixColors(content, bridge, fade),
        "fade in": mixColors(bridge, content, fade),
      },
    );
  }
}

// MARK: Registry

componentRegistry.set("Bridged Morph", {
  create() {
    return new BridgedMorph();
  },
  description:
    "A prototype:  a Fourier morph from one word to another, in cursive.  " +
    "The lines that close each word's gaps stay invisible, and fade in or out where the two words differ.",
  howToGenerate: { type: "class", class: BridgedMorph },
});
