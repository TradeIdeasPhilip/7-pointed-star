/**
 * A prototype:  Bridged Fourier for any path, picked by name.
 *
 * Source names a path in `FourierComponent.sources`, the registry the library's Fourier component reads.
 * So the saved value is just the name, and one registration serves both components.
 * Register a path with `FourierComponent.sources.set(name, { path })`, as `svg-sources.ts` does for "Blank Stare".
 *
 * Like Bridged Fourier, the lines that close the gaps between the path's pieces are **bridges**, in their own color.
 * Only sources with a `path` work:  a parametric curve or a list of terms has no gaps to bridge.
 *
 * Quick and dirty, on purpose:  the class is a copy of `BridgedFourier`, with Source in place of Text.
 * The sampling and drawing are shared, from `bridged-fourier.ts`.
 * If both hold up, they become one component.  In the component registry as "Bridged Path".
 * @module
 */

import { ReadOnlyRect } from "phil-lib/misc";
import {
  ColorScheduleInfo,
  componentRegistry,
  DurationAgnosticComponent,
  type EditorPanel,
  FourierComponent,
  Keyframe,
  NumberScheduleInfo,
  orderTerms,
  parseTermGroups,
  RectangleScheduleInfo,
  ShowOptions,
  StringScheduleInfo,
} from "canvas-recorder-lib";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import { PathShape } from "canvas-recorder-lib/src/glib/path-shape";
import { panAndZoom } from "canvas-recorder-lib/src/glib/transforms";
import {
  BridgedSource,
  drawBridgedFrame,
  pathToBridgedSource,
} from "./bridged-fourier.ts";
import { Frame, getFrameRules } from "./colored-fourier.ts";
import { EditorMessage, HasEditorMessages } from "./editor-messages.ts";
import {
  fourierMessages,
  fourierStepPanel,
  SteppedFourier,
} from "./fourier-panel.ts";

// MARK: The source

/** The Source field's default.  Registered in `svg-sources.ts`. */
const BLANK_STARE = "Blank Stare";

/** The names in `FourierComponent.sources` that are paths, for the Source field's suggestions. */
function pathSourceNames(): string[] {
  return [...FourierComponent.sources]
    .filter(([, source]) => "path" in source)
    .map(([name]) => name);
}

/**
 * The source called `name`, ready to animate.  Slow:  each component caches the last one.
 * @returns Or why there's nothing to animate.  A user error, for the editor's Checks.
 */
function namedSource(name: string): BridgedSource | string {
  const source = FourierComponent.sources.get(name);
  if (!source) {
    return `There's no source called "${name}".`;
  }
  if (!("path" in source)) {
    return `"${name}" isn't a path, so it has no gaps to bridge.  The Fourier component can draw it.`;
  }
  let path: PathShape;
  try {
    path =
      typeof source.path == "string"
        ? PathShape.fromRawString(source.path)
        : source.path;
  } catch (reason) {
    return `Couldn't read "${name}" as a path:  ${reason instanceof Error ? reason.message : reason}`;
  }
  return pathToBridgedSource(path, source.sampleCount);
}

// MARK: The component

/**
 * A Fourier animation of a named path, with the lines that close its gaps in their own color.
 * The fields are like Bridged Fourier's, with Source in place of Text.
 *
 * Bridge Color is usually transparent.  Fading to transparent keeps the first few circles looking closed.
 * Any visible color shows where the bridges are, for debugging.
 *
 * A DurationAgnosticComponent, like Star Circuit:  Min Duration is 0 by default, so the scene sets the length.
 *
 * In the Visual Editor, with its properties:  the step panel from `fourier-panel.ts`, then Checks.
 */
export class BridgedPath
  extends DurationAgnosticComponent
  implements SteppedFourier, HasEditorMessages
{
  readonly registryKey = "Bridged Path";
  /** A name from `FourierComponent.sources`.  The path sources are offered as suggestions. */
  readonly sourceSchedule = new StringScheduleInfo("Source", BLANK_STARE);
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
  /**
   * The finished curve fits inside this, centered, keeping its shape.  Earlier steps can wander outside it.
   * The default fits on both videos:  the left half of the landscape one, the top of the portrait one.
   */
  readonly destRectSchedule = new RectangleScheduleInfo("Dest Rect", {
    x: 0.5,
    y: 0.5,
    width: 8,
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
      source?: string | readonly Keyframe<string>[];
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
    super(initialValues.description ?? "Bridged Path");
    // Read when the component is made, like the Fourier component's Source.  Anything registered later can still be typed in.
    this.sourceSchedule.choices = pathSourceNames();
    if (initialValues.source !== undefined)
      this.sourceSchedule.set(initialValues.source);
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
      this.sourceSchedule,
      this.termGroupsSchedule,
      this.stepSchedule,
      this.destRectSchedule,
      this.contentColorSchedule,
      this.bridgeColorSchedule,
      this.lineWidthSchedule,
    );
  }

  /**
   * The source for the last name.  Never more than one entry.
   * Also keyed by the registry's entry, so registering a new path under the same name takes effect.
   */
  #source:
    | {
        readonly name: string;
        readonly entry: unknown;
        readonly value: BridgedSource | string;
      }
    | undefined;
  #sourceAt(timeInMs: number) {
    const name = this.sourceSchedule.at(timeInMs);
    const entry = FourierComponent.sources.get(name);
    if (this.#source?.name !== name || this.#source.entry !== entry) {
      this.#source = { name, entry, value: namedSource(name) };
    }
    return this.#source.value;
  }

  /** The terms of the source at this time, or why there aren't any. */
  fourierTermsAt(timeInMs: number) {
    const source = this.#sourceAt(timeInMs);
    return typeof source == "string" ? source : source.terms;
  }

  /** For the Visual Editor:  is the source a path, and do Term Groups and Step agree?  See `editor-messages.ts`. */
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

componentRegistry.set("Bridged Path", {
  create() {
    return new BridgedPath();
  },
  description:
    "A prototype:  a Fourier animation of a path from the Fourier sources, “Blank Stare” to start.  " +
    "The lines that close the gaps between its pieces get their own color, usually transparent.",
  howToGenerate: { type: "class", class: BridgedPath },
});
