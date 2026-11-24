/**
 * A prototype, a strawman:  the base class for Multi Text effects that move every point of the text by a function.
 * Warped Path does that to one path.  These do it to a Multi Text's letters, through the library's text effect hook.
 *
 * Handwriting Effect is the library's one text effect.  A Multi Text with one of these as a **direct child** strokes
 * what the effect returns instead of its own letters.  See `text-effect.ts` in the library.
 * This is the first one made outside the library, to see how that goes.  Each subclass registers itself with `registerPathWarp()`.
 *
 * What one frame does:
 * 1. **Letters → pieces.**  Every letter is split into connected pieces (`splitOnMove()`), and each piece is cut into short straight
 *    segments, at most Max Segment long.  Each piece is warped on its own, so N pieces in give N pieces out, and nothing is
 *    joined across a gap.  A piece that ends where it began, ends where it began.
 *    The cut points depend only on the letter and Max Segment, so they're cached.
 * 2. **A function moves each point.**  Subclasses write `makeWarp()`.
 * 3. **Pieces → PathShape**, one for each tag, in the order the Multi Text draws them.
 *
 * **Coordinates.**  The hook hands over letters in the paragraph's own coordinates, before the text is scaled, moved and turned.
 * The function works in the **Multi Text's own coordinates** instead:  the ones Position uses, and where the Visual Editor draws a
 * point property's marker.  So a Center is where you see it, and a radius is in the same units as everything else on the slide.
 * The library passes `placed` to the hook, and the points are converted there and back.
 * Library 0.8.3 and earlier don't pass it.  Then the two systems are the same, which is the right answer for a Multi Text with Position
 * (0, 0), no scaling and no turn, and nothing else.
 *
 * Any mistake in a field is a state, not an error.  Checks says what's wrong and the effect draws what it can.
 * @module
 */

import {
  componentRegistry,
  type Keyframe,
  NumberScheduleInfo,
  PointScheduleInfo,
  type ShowOptions,
} from "canvas-recorder-lib";
import {
  type Command,
  LCommand,
  PathShape,
  type Point,
} from "canvas-recorder-lib/src/glib/path-shape";
import type { PlacedText } from "canvas-recorder-lib/src/slide-components/multi-text";
import { showError } from "canvas-recorder-lib/src/slide-components/show-error";
import {
  type EffectLetter,
  TEXT_EFFECT,
  type TextEffect,
} from "canvas-recorder-lib/src/slide-components/text-effect";
import { EditorMessage, HasEditorMessages } from "./editor-messages.ts";
import type { PointFunction } from "./warped-path.ts";

// MARK: Coordinates

/** Converts between the paragraph's coordinates, where the letters are, and the Multi Text's, where the function works. */
export type Placement = {
  /** A point of the paragraph, where it ends up on the slide, in the Multi Text's coordinates. */
  toLocal(point: Point): Point;
  /** The inverse of `toLocal()`. */
  toParagraph(point: Point): Point;
  /** How many of the Multi Text's units one paragraph unit becomes.  Always above 0. */
  readonly scale: number;
};

const IDENTITY: Placement = {
  toLocal: (point) => point,
  toParagraph: (point) => point,
  scale: 1,
};

/**
 * Turn the point `quarterTurns` times clockwise on the screen, about the origin.  The canvas has y down, so (1, 0) goes to (0, 1).
 */
function turnQuarters({ x, y }: Point, quarterTurns: number): Point {
  switch (((quarterTurns % 4) + 4) % 4) {
    case 1:
      return { x: -y, y: x };
    case 2:
      return { x: -x, y: -y };
    case 3:
      return { x: y, y: -x };
    default:
      return { x, y };
  }
}

/**
 * What `MultiTextComponent.show()` does to a paragraph point, as functions:  scale, then offset, then turn about the pivot.
 * @param placed What the hook was given.  `undefined` from a library that doesn't give it, which means no change.
 */
export function makePlacement(placed: PlacedText | undefined): Placement {
  if (!placed) {
    return IDENTITY;
  }
  const { offset, pivot, quarterTurns } = placed;
  const scale = placed.scale > 0 ? placed.scale : 1;
  return {
    scale,
    toLocal({ x, y }) {
      const turned = turnQuarters(
        {
          x: offset.x + scale * x - pivot.x,
          y: offset.y + scale * y - pivot.y,
        },
        quarterTurns,
      );
      return { x: pivot.x + turned.x, y: pivot.y + turned.y };
    },
    toParagraph({ x, y }) {
      const back = turnQuarters(
        { x: x - pivot.x, y: y - pivot.y },
        -quarterTurns,
      );
      return {
        x: (pivot.x + back.x - offset.x) / scale,
        y: (pivot.y + back.y - offset.y) / scale,
      };
    },
  };
}

// MARK: Sampling

/** The most segments one command gets, so a tiny Max Segment can't hang the editor. */
const MAX_SEGMENTS_PER_COMMAND = 200;
/** Max Segment is clamped to at least this, in the Multi Text's units.  0.001 is a quarter of a pixel at 4K. */
const MIN_MAX_SEGMENT = 0.001;

/** How many segment lengths to remember for each letter. */
const MAX_CACHED_LENGTHS = 8;

/** Connected pieces of a letter, each a list of points, in the letter's own coordinates.  One list per `splitOnMove()` piece. */
type Pieces = readonly (readonly Point[])[];

/**
 * Letters are cached by their untranslated shape, which the font reuses from frame to frame, then by segment length.
 * The key is a WeakMap, so a font that goes away takes its entries with it.
 * Each shape has only a few lengths:  the one in use, and any the author is dragging through.
 */
const piecesCache = new WeakMap<PathShape, Map<number, Pieces>>();

/**
 * Cut a letter into straight segments.  A line gets as many as it needs to be at most `maxSegment` long, and a curve at least two.
 * The points include every command's end, exactly, so pieces that meet still meet, and a closed piece is still closed.
 * @param maxSegment In the shape's own units.
 */
export function piecesOf(shape: PathShape, maxSegment: number): Pieces {
  const forShape = piecesCache.getOrInsertComputed(shape, () => new Map());
  if (forShape.size >= MAX_CACHED_LENGTHS) {
    // Animating Max Segment or the scale makes a new key every frame.
    forShape.clear();
  }
  return forShape.getOrInsertComputed(maxSegment, () =>
    shape.splitOnMove().map((piece) => {
      const points: Point[] = [];
      piece.commands.forEach((command: Command, index) => {
        if (index == 0) {
          points.push({ x: command.x0, y: command.y0 });
        }
        const length = command.getLength();
        const count = Math.min(
          MAX_SEGMENTS_PER_COMMAND,
          Math.max(
            command instanceof LCommand ? 1 : 2,
            Math.ceil(length / maxSegment),
          ),
        );
        if (count > 1 && length > 0) {
          const splitter = command.makeSplitter();
          for (let k = 1; k < count; k++) {
            points.push(splitter.at((length * k) / count));
          }
        }
        points.push({ x: command.x, y: command.y });
      });
      return points;
    }),
  );
}

// MARK: Effect

/** The most schedules a subclass adds, for the type below. */
type EffectSchedule = NumberScheduleInfo | PointScheduleInfo;

/**
 * A Multi Text effect that moves every point of the text by a function of its position and the time.
 * Put one directly inside a Multi Text.  Subclasses write `makeWarp()`, `parameterMessages()` and a constructor that adds their fields.
 *
 * The fields of the subclass come first in the Visual Editor, then Max Segment.
 */
export abstract class PathWarpEffect implements TextEffect, HasEditorMessages {
  abstract readonly registryKey: string;
  readonly duration = 0;
  /**
   * The longest straight segment, in the Multi Text's units, as the author sees them on the slide.
   * Smaller is smoother and slower.  A 16 unit wide slide is 3840 pixels wide at 4K, so 0.04 is about 10 pixels.
   */
  readonly maxSegmentSchedule = new NumberScheduleInfo("Max Segment", 0.04);
  /** The subclass puts its own in front of Max Segment. */
  readonly schedules: EffectSchedule[] = [this.maxSegmentSchedule];

  readonly description: string;

  constructor(
    description: string,
    initialValues: { maxSegment?: number | readonly Keyframe<number>[] } = {},
  ) {
    // Not a parameter property:  `erasableSyntaxOnly`.
    this.description = description;
    if (initialValues.maxSegment !== undefined)
      this.maxSegmentSchedule.set(initialValues.maxSegment);
  }

  /**
   * The function that moves each point.  `timeInMs` is the Multi Text's local time.
   * Both the input and the output are in the Multi Text's coordinates.  It's called once a frame, then once for each point.
   */
  protected abstract makeWarp(timeInMs: number): PointFunction;

  /** The subclass's own warnings, for Checks.  Called after every keystroke, so keep it quick. */
  protected abstract parameterMessages(): EditorMessage[];

  /** What the Visual Editor's Checks box shows. */
  editorMessages(): EditorMessage[] {
    const messages = this.parameterMessages();
    for (const { time, value } of this.maxSegmentSchedule.schedule) {
      if (!(value > 0)) {
        messages.push({
          level: "warning",
          text: `At ${time} ms:  Max Segment ${value} won't work.  Drawing ${MIN_MAX_SEGMENT}, which is slow.  Try 0.04.`,
        });
      }
    }
    return messages;
  }

  /** A Multi Text calls `[TEXT_EFFECT]()` instead.  This is for the effect in the wrong place. */
  show(options: ShowOptions): void {
    showError(
      options.context,
      `${this.description}\nshould be a child of\nMulti Text`,
    );
  }

  [TEXT_EFFECT](
    letters: readonly EffectLetter[],
    options: ShowOptions,
    placed?: PlacedText,
  ): Map<unknown, PathShape> {
    const { timeInMs } = options;
    const placement = makePlacement(placed);
    const warp = this.makeWarp(timeInMs);
    // Segments are cut in paragraph units, but Max Segment is in the Multi Text's.
    const maxSegment =
      Math.max(
        MIN_MAX_SEGMENT,
        this.maxSegmentSchedule.at(timeInMs) || MIN_MAX_SEGMENT,
      ) / placement.scale;
    // Reading order, so each tag is first added in the order pathShapeByTag() would.  The formats stack the same way.
    const commandsByTag = new Map<unknown, Command[]>();
    for (const letter of letters) {
      if (letter.untranslatedShape.isEmpty) {
        continue;
      }
      const commands = commandsByTag.getOrInsertComputed(letter.tag, () => []);
      for (const piece of piecesOf(letter.untranslatedShape, maxSegment)) {
        let previous: Point | undefined;
        for (const point of piece) {
          const moved = placement.toParagraph(
            warp(
              placement.toLocal({
                x: point.x + letter.x,
                y: point.y + letter.baseline,
              }),
            ),
          );
          if (!(Number.isFinite(moved.x) && Number.isFinite(moved.y))) {
            // A bad number in a field.  Said in Checks.  Leave a gap rather than draw a spike to infinity.
            previous = undefined;
            continue;
          }
          if (previous) {
            commands.push(
              new LCommand(previous.x, previous.y, moved.x, moved.y),
            );
          }
          previous = moved;
        }
      }
    }
    const result = new Map<unknown, PathShape>();
    commandsByTag.forEach((commands, tag) => {
      result.set(tag, new PathShape(commands));
    });
    return result;
  }
}

// MARK: Registry

/**
 * Add an effect to the Visual Editor's lists, the same way the library's Handwriting Effect does.
 * `isTextEffect` makes a Multi Text offer it, and `hiddenByDefault` keeps it out of every other component's list.
 */
export function registerPathWarp(
  key: string,
  description: string,
  effectClass: new () => PathWarpEffect,
): void {
  componentRegistry.set(key, {
    create() {
      return new effectClass();
    },
    description: `${description}  This must be a direct child of a Multi Text.`,
    isGoodForWrapping: false,
    isTextEffect: true,
    hiddenByDefault: true,
    howToGenerate: { type: "class", class: effectClass },
  });
}
