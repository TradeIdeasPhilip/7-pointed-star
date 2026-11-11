import { FULL_CIRCLE, Random, ReadOnlyRect } from "phil-lib/misc";
import {
  canvasRecorder,
  ColorScheduleInfo,
  componentRegistry,
  Keyframe,
  NumberScheduleInfo,
  PointScheduleInfo,
  RectangleScheduleInfo,
  Showable,
  ShowOptions,
  StringScheduleInfo,
} from "canvas-recorder-lib";
import type { Point } from "canvas-recorder-lib/src/glib/path-shape";
import { showError } from "canvas-recorder-lib/src/slide-components/show-error";

// MARK: Settings

/** More than this in one sheet, and it's surely a typo in Density or Rect. */
const MAX_DOTS_PER_SHEET = 250_000;

/** More than this, and it's surely a typo in Shades. */
const MAX_SHADES = 32;

/** The smallest dot is this many times Dot Size across, and the biggest is {@link LARGEST_DOT} times. */
const SMALLEST_DOT = 0.5;
/** The biggest dot is this many times Dot Size across. */
const LARGEST_DOT = 1.5;

/**
 * Units to add on every side when a sheet's dots are built.
 * So a wiggle, or a slow Center, doesn't rebuild them every frame.
 * The dots in it are drawn too, outside Rect, so not much more.
 */
const SLACK = 0.5;

const RADIANS_PER_DEGREE = Math.PI / 180;

// MARK: Cells

/**
 * The random numbers for one cell:  the 1 × 1 square with its top left corner at (i, j).
 *
 * The same Seed and cell always give the same numbers, whatever else is drawn.
 * So the pattern never changes when Rect, Center or an angle does, and the three sheets always match.
 *
 * This is sfc32, phil-lib's `Random` generator, seeded from the Seed and the cell.
 * `Random.create()` would log every cell's seed to the console.
 * @param seed Four 32-bit integers, from `Random.anyStringToSeed()`.
 */
function cellRandom(
  seed: readonly number[],
  i: number,
  j: number,
): () => number {
  let a = seed[0] ^ Math.imul(i, 0x9e3779b1);
  let b = seed[1] ^ Math.imul(j, 0x85ebca77);
  let c = seed[2] | 0;
  let d = seed[3] | 0;
  function random() {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
  // Neighboring cells start almost the same.  This mixes the difference into everything.
  for (let k = 0; k < 15; k++) {
    random();
  }
  return random;
}

/** Part of a sheet, in units, before the sheet is turned. */
type Box = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

function contains(outer: Box, inner: Box): boolean {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.right >= inner.right &&
    outer.bottom >= inner.bottom
  );
}

function area(box: Box): number {
  return (box.right - box.left) * (box.bottom - box.top);
}

function grow(box: Box, by: number): Box {
  return {
    left: box.left - by,
    top: box.top - by,
    right: box.right + by,
    bottom: box.bottom + by,
  };
}

/**
 * Where a dot's center has to be, for the dot to show in `rect` after the sheet is turned by `angle` around `center`.
 * @param angle In radians.
 * @param reach How far a dot can reach from its center.
 */
function boxToCover(
  rect: ReadOnlyRect,
  center: Point,
  angle: number,
  reach: number,
): Box {
  // Undo the turn:  where on the sheet each corner of rect comes from.
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const x of [rect.x, rect.x + rect.width]) {
    for (const y of [rect.y, rect.y + rect.height]) {
      const dx = x - center.x;
      const dy = y - center.y;
      const sheetX = center.x + dx * cos - dy * sin;
      const sheetY = center.y + dx * sin + dy * cos;
      minX = Math.min(minX, sheetX);
      minY = Math.min(minY, sheetY);
      maxX = Math.max(maxX, sheetX);
      maxY = Math.max(maxY, sheetY);
    }
  }
  return grow({ left: minX, top: minY, right: maxX, bottom: maxY }, reach);
}

// MARK: Dots

/** Everything that changes the dots themselves.  The same settings and box always give the same paths. */
type DotSettings = {
  readonly seed: string;
  /** Dots per square unit, in each sheet. */
  readonly density: number;
  /** In units. */
  readonly dotSize: number;
  /** From 0 to 1. */
  readonly roundness: number;
  /** A whole number from 1 to {@link MAX_SHADES}. */
  readonly shades: number;
};

/**
 * Every dot with its center in `box`, as one path per shade.
 *
 * Each dot is an ellipse:  a curve, not a polygon, so it stays sharp at any size and any angle.
 * The canvas turns it into pixels only when it's filled.
 */
function buildPaths(settings: DotSettings, box: Box): Path2D[] {
  const seed: number[] = JSON.parse(Random.anyStringToSeed(settings.seed));
  const paths = Array.from({ length: settings.shades }, () => new Path2D());
  const whole = Math.floor(settings.density);
  const fraction = settings.density - whole;
  for (let i = Math.floor(box.left); i <= Math.floor(box.right); i++) {
    for (let j = Math.floor(box.top); j <= Math.floor(box.bottom); j++) {
      const random = cellRandom(seed, i, j);
      // The fraction of a dot:  that fraction of the cells get one more.
      const count = whole + (random() < fraction ? 1 : 0);
      for (let k = 0; k < count; k++) {
        // Always six numbers per dot, in this order.
        // So dot k is the same dot whatever the settings are, and more dots only add to the end.
        const x = i + random();
        const y = j + random();
        const across =
          settings.dotSize *
          (SMALLEST_DOT + (LARGEST_DOT - SMALLEST_DOT) * random());
        const aspect = settings.roundness + (1 - settings.roundness) * random();
        const rotation = random() * Math.PI;
        const shade = Math.floor(random() * settings.shades);
        if (x < box.left || x > box.right || y < box.top || y > box.bottom) {
          // Off screen.  The cells on the edge are mostly outside the box.
          continue;
        }
        const radiusX = across / 2;
        const path = paths[shade];
        // Without this, ellipse() draws a line from the last dot to this one,
        // and the fill becomes one huge polygon.
        path.moveTo(
          x + radiusX * Math.cos(rotation),
          y + radiusX * Math.sin(rotation),
        );
        path.ellipse(x, y, radiusX, radiusX * aspect, rotation, 0, FULL_CIRCLE);
      }
    }
  }
  return paths;
}

/**
 * The color of each shade, from Dim Dot Color to Bright Dot Color.
 * The canvas mixes them, so any CSS color works.
 */
function shadeColors(dim: string, bright: string, shades: number): string[] {
  if (shades == 1) {
    return [bright];
  }
  return Array.from(
    { length: shades },
    (_, k) =>
      `color-mix(in srgb, ${bright} ${(100 * k) / (shades - 1)}%, ${dim})`,
  );
}

// MARK: Component

/** One sheet's schedules.  Its angle is Angle + Wiggle × sin(2π × time / Period). */
type SheetSchedules = {
  /** "Sheet 1", for messages. */
  readonly name: string;
  readonly angle: NumberScheduleInfo;
  readonly wiggle: NumberScheduleInfo;
  readonly period: NumberScheduleInfo;
};

/**
 * Freaky dot patterns:  three copies of one sheet of random dots, each turned a little around Center.
 * Meant for a background.
 *
 * Near Center the copies line up, and the dots seem to flow in circles around it.  (This is a Glass pattern.)
 * Far from Center the copies drift apart, and it looks like plain noise.
 * The circles only appear because the three sheets are the same dots.
 *
 * Each sheet's angle, in degrees, is Angle + Wiggle × sin(2π × time / Period), with Period in milliseconds.
 * The wiggle helps a lot:  the circles shimmer and breathe instead of sitting still.
 * Sheet 1 is drawn first, under the others.
 *
 * Center is a schedule, so the swirl can move.  The ✶36 voiceover warns that it can't move quickly:
 * a small move of the dots is a big move of the circles, and too fast looks like noise.
 *
 * Copied from random-svg-tests, the hexagram videos, as of commit bf4e80a (video ✶36, 2025-08-28):
 * the `#starfield` rectangles, the `#dalmatian` filter, and the oscillators in `fourier-smackdown.ts`.
 * There each sheet was the same rectangle with the same SVG turbulence filter, made into pixels before it was turned.
 * Here the dots are ellipses, kept as vectors until they're filled.
 * The defaults are the old ones, as near as ellipses can match the turbulence blobs.
 *
 * The dots are in canvas units, in 1 × 1 cells, each cell's dots from the Seed and its place.
 * So Rect is only a window onto an endless sheet:  the dots don't stretch or move with it.
 * Changing Density, Dot Size, Roundness or Shades changes the dots without moving them.
 *
 * Its duration is 0, so it isn't on the timeline.  It uses its parent's time, for the wiggle and for any keyframes.
 *
 * In the component registry as "Freaky Dots".
 */
export class FreakyDots implements Showable {
  readonly registryKey = "Freaky Dots";
  readonly description: string;
  readonly duration = 0;
  /** The whole canvas, by default.  Set `canvasRecorder.size` before creating one, as for `addScene()`. */
  readonly rectSchedule = new RectangleScheduleInfo("Rect", {
    x: 0,
    y: 0,
    width: canvasRecorder.width,
    height: canvasRecorder.height,
  });
  /** Every sheet turns around this point.  In canvas units, like Rect.  It can be outside Rect. */
  readonly centerSchedule = new PointScheduleInfo("Center", {
    x: canvasRecorder.width / 2,
    y: canvasRecorder.height / 2,
  });
  /** Fills Rect first.  "transparent" shows what's behind, like a Night Sky. */
  readonly backgroundColorSchedule = new ColorScheduleInfo(
    "Background Color",
    "black",
  );
  /** The first shade.  The old filter's darkest gray. */
  readonly dimDotColorSchedule = new ColorScheduleInfo(
    "Dim Dot Color",
    "#303030",
  );
  /** The last shade, drawn on top.  The old filter's brightest gray. */
  readonly brightDotColorSchedule = new ColorScheduleInfo(
    "Bright Dot Color",
    "#595959",
  );
  /** How many colors, evenly spaced from Dim Dot Color to Bright Dot Color.  Each dot gets one at random. */
  readonly shadesSchedule = new NumberScheduleInfo("Shades", 5);
  /** Dots per square unit, in each sheet.  A fraction adds a dot to that fraction of the 1 × 1 cells. */
  readonly densitySchedule = new NumberScheduleInfo("Density", 20);
  /** The average width of a dot, in units.  Each one is from half to one and a half times this. */
  readonly dotSizeSchedule = new NumberScheduleInfo("Dot Size", 0.05);
  /** 1 makes every dot a circle.  Less lets them stretch:  0.5 means each one's height is from half its width to all of it. */
  readonly roundnessSchedule = new NumberScheduleInfo("Roundness", 0.5);
  /** Any string.  The same seed always gives the same dots. */
  readonly seedSchedule = new StringScheduleInfo("Seed", "Freaky Dot Patterns");
  /** Degrees, clockwise.  Sheet 1 was the one that held still. */
  readonly sheet1AngleSchedule = new NumberScheduleInfo("Sheet 1 Angle", 0);
  /** Degrees.  How far it swings each way from Angle.  Negative starts the other way. */
  readonly sheet1WiggleSchedule = new NumberScheduleInfo("Sheet 1 Wiggle", 0);
  /** Milliseconds, for one whole swing.  Only matters when Wiggle isn't 0. */
  readonly sheet1PeriodSchedule = new NumberScheduleInfo(
    "Sheet 1 Period",
    15_000,
  );
  /** From 0.5° to 1.5°. */
  readonly sheet2AngleSchedule = new NumberScheduleInfo("Sheet 2 Angle", 1);
  readonly sheet2WiggleSchedule = new NumberScheduleInfo(
    "Sheet 2 Wiggle",
    -0.5,
  );
  readonly sheet2PeriodSchedule = new NumberScheduleInfo(
    "Sheet 2 Period",
    15_000,
  );
  /** From -0.5° to -1.5°, a little faster than sheet 2, so the two drift in and out of step. */
  readonly sheet3AngleSchedule = new NumberScheduleInfo("Sheet 3 Angle", -1);
  readonly sheet3WiggleSchedule = new NumberScheduleInfo("Sheet 3 Wiggle", 0.5);
  readonly sheet3PeriodSchedule = new NumberScheduleInfo(
    "Sheet 3 Period",
    13_081,
  );
  readonly schedules = [
    this.rectSchedule,
    this.centerSchedule,
    this.backgroundColorSchedule,
    this.dimDotColorSchedule,
    this.brightDotColorSchedule,
    this.shadesSchedule,
    this.densitySchedule,
    this.dotSizeSchedule,
    this.roundnessSchedule,
    this.seedSchedule,
    this.sheet1AngleSchedule,
    this.sheet1WiggleSchedule,
    this.sheet1PeriodSchedule,
    this.sheet2AngleSchedule,
    this.sheet2WiggleSchedule,
    this.sheet2PeriodSchedule,
    this.sheet3AngleSchedule,
    this.sheet3WiggleSchedule,
    this.sheet3PeriodSchedule,
  ] as const;
  /** Bottom to top.  Each schedule is also its own field, so the Visual Editor's generated code can name it. */
  readonly #sheets: readonly SheetSchedules[] = [
    {
      name: "Sheet 1",
      angle: this.sheet1AngleSchedule,
      wiggle: this.sheet1WiggleSchedule,
      period: this.sheet1PeriodSchedule,
    },
    {
      name: "Sheet 2",
      angle: this.sheet2AngleSchedule,
      wiggle: this.sheet2WiggleSchedule,
      period: this.sheet2PeriodSchedule,
    },
    {
      name: "Sheet 3",
      angle: this.sheet3AngleSchedule,
      wiggle: this.sheet3WiggleSchedule,
      period: this.sheet3PeriodSchedule,
    },
  ];
  /**
   * The schedules not listed here start at the old values.  Each one is also a field, like `densitySchedule`, to `set()`.
   */
  constructor(
    initialValues: {
      description?: string;
      rect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      center?: Point | readonly Keyframe<Point>[];
      backgroundColor?: string | readonly Keyframe<string>[];
      seed?: string | readonly Keyframe<string>[];
    } = {},
  ) {
    this.description = initialValues.description ?? "Freaky Dots";
    if (initialValues.rect !== undefined)
      this.rectSchedule.set(initialValues.rect);
    if (initialValues.center !== undefined)
      this.centerSchedule.set(initialValues.center);
    if (initialValues.backgroundColor !== undefined)
      this.backgroundColorSchedule.set(initialValues.backgroundColor);
    if (initialValues.seed !== undefined)
      this.seedSchedule.set(initialValues.seed);
  }

  // MARK: Reading the schedules

  /**
   * A sheet's angle at this time.
   * @returns Radians, clockwise.
   */
  #angle(
    sheet: SheetSchedules,
    timeInMs: number,
    problems: Set<string>,
  ): number {
    let angle = sheet.angle.at(timeInMs);
    if (!Number.isFinite(angle)) {
      problems.add(`${sheet.name} Angle ${angle} won't work.  Try 0.`);
      angle = 0;
    }
    const wiggle = sheet.wiggle.at(timeInMs);
    const period = sheet.period.at(timeInMs);
    if (!Number.isFinite(wiggle)) {
      problems.add(`${sheet.name} Wiggle ${wiggle} won't work.  Try 0.5.`);
    } else if (wiggle != 0) {
      if (!(period > 0 && Number.isFinite(period))) {
        problems.add(
          `${sheet.name} Period ${period} won't work.  Try 15000, for 15 seconds.`,
        );
      } else {
        angle += wiggle * Math.sin((FULL_CIRCLE * timeInMs) / period);
      }
    }
    return angle * RADIANS_PER_DEGREE;
  }

  /**
   * Checks every setting, so every problem gets a message.
   * @returns The dot settings at this time, or undefined if a problem means no dots.
   */
  #dotSettings(
    timeInMs: number,
    problems: Set<string>,
  ): DotSettings | undefined {
    const density = this.densitySchedule.at(timeInMs);
    const dotSize = this.dotSizeSchedule.at(timeInMs);
    let roundness = this.roundnessSchedule.at(timeInMs);
    let shades = Math.round(this.shadesSchedule.at(timeInMs));
    let usable = true;
    if (!(density >= 0 && Number.isFinite(density))) {
      problems.add(`Density ${density} won't work.  Try 20.`);
      usable = false;
    }
    if (!(dotSize >= 0 && Number.isFinite(dotSize))) {
      problems.add(`Dot Size ${dotSize} won't work.  Try 0.05.`);
      usable = false;
    }
    if (!(roundness >= 0 && roundness <= 1)) {
      problems.add(`Roundness ${roundness} won't work.  Try 0 to 1.`);
      roundness = Math.min(1, Math.max(0, roundness || 0));
    }
    if (!(shades >= 1 && shades <= MAX_SHADES)) {
      problems.add(
        `Shades ${this.shadesSchedule.at(timeInMs)} won't work.  Try 1 to ${MAX_SHADES}.`,
      );
      shades = 5;
    }
    if (!usable) {
      return undefined;
    }
    return {
      seed: this.seedSchedule.at(timeInMs),
      density,
      dotSize,
      roundness,
      shades,
    };
  }

  // MARK: Cache

  /**
   * The dots each sheet drew last, and the settings and box they were built for.
   * Built again only when the settings change, or the sheet needs a cell it doesn't have.
   */
  readonly #built: (
    | {
        readonly key: string;
        readonly box: Box;
        readonly paths: readonly Path2D[];
      }
    | undefined
  )[] = [];

  /**
   * @returns One path per shade, covering at least `needed`.
   */
  #getPaths(
    sheetIndex: number,
    settings: DotSettings,
    needed: Box,
  ): readonly Path2D[] {
    const key = JSON.stringify(settings);
    // Often another sheet already has these.  They're the same dots.
    const found = this.#built.find(
      (built) => built?.key === key && contains(built.box, needed),
    );
    if (found) {
      this.#built[sheetIndex] = found;
      return found.paths;
    }
    const box = grow(needed, SLACK);
    const paths = buildPaths(settings, box);
    this.#built[sheetIndex] = { key, box, paths };
    return paths;
  }

  // MARK: Drawing

  show({ context, timeInMs }: ShowOptions) {
    /** User errors, to show on the canvas.  A Set, so the three sheets don't repeat one. */
    const problems = new Set<string>();
    const rect = this.rectSchedule.at(timeInMs);
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) {
      problems.add(
        `Rect won't work.  Try 0, 0, ${canvasRecorder.width}, ${canvasRecorder.height}.`,
      );
    } else {
      context.save();
      const clip = new Path2D();
      clip.rect(rect.x, rect.y, rect.width, rect.height);
      context.clip(clip);
      context.fillStyle = readColor(
        "Background Color",
        this.backgroundColorSchedule.at(timeInMs),
        "black",
        problems,
      );
      context.fill(clip);
      // Read everything first, so every problem gets a message.
      const settings = this.#dotSettings(timeInMs, problems);
      let center = this.centerSchedule.at(timeInMs);
      if (!(Number.isFinite(center.x) && Number.isFinite(center.y))) {
        problems.add(
          `Center won't work.  Try ${canvasRecorder.width / 2}, ${canvasRecorder.height / 2}.`,
        );
        center = {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        };
      }
      const dimDotColor = readColor(
        "Dim Dot Color",
        this.dimDotColorSchedule.at(timeInMs),
        "#303030",
        problems,
      );
      const brightDotColor = readColor(
        "Bright Dot Color",
        this.brightDotColorSchedule.at(timeInMs),
        "#595959",
        problems,
      );
      const angles = this.#sheets.map((sheet) =>
        this.#angle(sheet, timeInMs, problems),
      );
      if (settings) {
        const colors = shadeColors(
          dimDotColor,
          brightDotColor,
          settings.shades,
        );
        const reach = (settings.dotSize * LARGEST_DOT) / 2;
        angles.forEach((angle, index) => {
          const needed = boxToCover(rect, center, angle, reach);
          const dots = area(grow(needed, SLACK)) * settings.density;
          if (!(dots <= MAX_DOTS_PER_SHEET)) {
            problems.add(
              `That's about ${Math.round(dots).toLocaleString()} dots per sheet.  The most is ${MAX_DOTS_PER_SHEET.toLocaleString()}.  Try a smaller Density or Rect.`,
            );
            return;
          }
          const paths = this.#getPaths(index, settings, needed);
          context.save();
          context.translate(center.x, center.y);
          context.rotate(angle);
          context.translate(-center.x, -center.y);
          paths.forEach((path, shade) => {
            context.fillStyle = colors[shade];
            context.fill(path);
          });
          context.restore();
        });
      }
      context.restore();
    }
    if (problems.size > 0) {
      // Across the whole canvas, not clipped to Rect, so it can always be read.
      context.save();
      const scale = canvasRecorder.width / 16;
      context.scale(scale, scale);
      showError(context, [...problems].join("\n"));
      context.restore();
    }
  }
}

/**
 * @returns `color`, if the canvas can read it.  Otherwise `fallback`, and a note in `problems`.
 * Setting `fillStyle` to a color it can't read does nothing at all, so check first.
 */
function readColor(
  name: string,
  color: string,
  fallback: string,
  problems: Set<string>,
): string {
  if (CSS.supports("color", color)) {
    return color;
  }
  problems.add(`Can't read ${name} "${color}".`);
  return fallback;
}

// MARK: Registry

componentRegistry.set("Freaky Dots", {
  create() {
    return new FreakyDots();
  },
  description:
    "A background:  three copies of one sheet of random dots, each turned a little around Center, so the dots swirl around it.  The default Rect covers the canvas.",
  howToGenerate: { type: "class", class: FreakyDots },
});
