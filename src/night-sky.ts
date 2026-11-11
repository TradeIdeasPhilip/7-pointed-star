import {
  FULL_CIRCLE,
  makeLinear,
  Random,
  RandomFunction,
  ReadOnlyRect,
} from "phil-lib/misc";
import {
  canvasRecorder,
  ColorScheduleInfo,
  componentRegistry,
  Keyframe,
  NumberScheduleInfo,
  RectangleScheduleInfo,
  Showable,
  ShowOptions,
  StringScheduleInfo,
} from "canvas-recorder-lib";
import { showError } from "canvas-recorder-lib/src/slide-components/show-error";

/**
 * More than this, and it's surely a typo in Number of Stars.
 * Each star is its own radial gradient, every frame.
 */
const MAX_STARS = 10_000;

/**
 * A star's radius, in units, from the sum of two random numbers.
 * So from 0.025 to 0.15, mostly near the middle.
 */
const getRadius = makeLinear(0, 0.025, 2, 0.15);

type Star = {
  /** From 0 at the left edge of Rect to 1 at the right edge. */
  readonly x: number;
  /** From 0 at the top of Rect to 1 at the bottom. */
  readonly y: number;
  /** In units, before Star Size. */
  readonly radius: number;
};

/**
 * A night sky:  a gradient from Top Color to Bottom Color, and stars that glow.  Meant for a background.
 *
 * Copied from random-svg-tests, the hexagram videos, as of commit 0707534 (video ✶39, 2025-08-31):
 * the `#night-sky` gradient, `#stellarGradient`, and the "Background full of stars" block in `fourier-smackdown.ts`.
 * The defaults are the old values, except Seed.  The old seed was "Good Night 🌛".
 * With that seed and Rect 0, 0, 16, 9, the stars land exactly where they were.
 * (That one also had the template star at (2, 7), which isn't here.)
 *
 * Each star takes the next four numbers from the Seed's random number generator.
 * So star 7 is the same star, whatever Number of Stars is:  more stars only add to the end.
 * The fractional part of Number of Stars fades in the next star, so a keyframed count changes smoothly.
 *
 * Star positions are fractions of Rect, so the stars stretch with it.  Their sizes are in units, times Star Size.
 *
 * Its duration is 0, so it isn't on the timeline, and it draws the same way at any time.
 *
 * In the component registry as "Night Sky".
 */
export class NightSky implements Showable {
  readonly registryKey = "Night Sky";
  readonly description: string;
  readonly duration = 0;
  /** The whole canvas, by default.  Set `canvasRecorder.size` before creating one, as for `addScene()`. */
  readonly rectSchedule = new RectangleScheduleInfo("Rect", {
    x: 0,
    y: 0,
    width: canvasRecorder.width,
    height: canvasRecorder.height,
  });
  /** The top of Rect. */
  readonly topColorSchedule = new ColorScheduleInfo("Top Color", "black");
  /** The bottom of Rect. */
  readonly bottomColorSchedule = new ColorScheduleInfo(
    "Bottom Color",
    "midnightblue",
  );
  /** A fraction fades in the next star. */
  readonly starCountSchedule = new NumberScheduleInfo("Number of Stars", 150);
  /** Multiplies each star's radius.  1 is the old size. */
  readonly starSizeSchedule = new NumberScheduleInfo("Star Size", 1);
  /** Any string.  The same seed always gives the same stars. */
  readonly seedSchedule = new StringScheduleInfo(
    "Seed",
    "Second star to the right, and straight on till morning",
  );
  readonly schedules = [
    this.rectSchedule,
    this.topColorSchedule,
    this.bottomColorSchedule,
    this.starCountSchedule,
    this.starSizeSchedule,
    this.seedSchedule,
  ] as const;
  constructor(
    initialValues: {
      description?: string;
      rect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      topColor?: string | readonly Keyframe<string>[];
      bottomColor?: string | readonly Keyframe<string>[];
      starCount?: number | readonly Keyframe<number>[];
      starSize?: number | readonly Keyframe<number>[];
      seed?: string | readonly Keyframe<string>[];
    } = {},
  ) {
    this.description = initialValues.description ?? "Night Sky";
    if (initialValues.rect !== undefined)
      this.rectSchedule.set(initialValues.rect);
    if (initialValues.topColor !== undefined)
      this.topColorSchedule.set(initialValues.topColor);
    if (initialValues.bottomColor !== undefined)
      this.bottomColorSchedule.set(initialValues.bottomColor);
    if (initialValues.starCount !== undefined)
      this.starCountSchedule.set(initialValues.starCount);
    if (initialValues.starSize !== undefined)
      this.starSizeSchedule.set(initialValues.starSize);
    if (initialValues.seed !== undefined)
      this.seedSchedule.set(initialValues.seed);
  }

  // MARK: Stars

  /**
   * The stars made so far from one seed.
   *
   * `Random.fromString()` logs the seed to the console every time it's called, so the generator is made once per seed, not once per frame.
   * Keeping the generator means more stars just continue the same sequence.
   */
  #generator:
    | {
        readonly seed: string;
        readonly random: RandomFunction;
        readonly stars: Star[];
      }
    | undefined;

  /**
   * @returns At least `count` stars, the same ones every time for the same seed.
   */
  #getStars(seed: string, count: number): readonly Star[] {
    if (this.#generator?.seed !== seed) {
      this.#generator = { seed, random: Random.fromString(seed), stars: [] };
    }
    const { random, stars } = this.#generator;
    while (stars.length < count) {
      // The same order as the old code:  x, y, then two for the radius.
      const x = random();
      const y = random();
      const radius = getRadius(random() + random());
      stars.push({ x, y, radius });
    }
    return stars;
  }

  // MARK: Drawing

  show({ context, timeInMs }: ShowOptions) {
    const rect = this.rectSchedule.at(timeInMs);
    const topColor = this.topColorSchedule.at(timeInMs);
    const bottomColor = this.bottomColorSchedule.at(timeInMs);
    const starCount = this.starCountSchedule.at(timeInMs);
    const starSize = this.starSizeSchedule.at(timeInMs);
    /** User errors, to show on the canvas. */
    const problems: string[] = [];
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) {
      problems.push(
        `Rect won't work.  Try 0, 0, ${canvasRecorder.width}, ${canvasRecorder.height}.`,
      );
    } else {
      context.save();
      const clip = new Path2D();
      clip.rect(rect.x, rect.y, rect.width, rect.height);
      context.clip(clip);

      const sky = context.createLinearGradient(
        0,
        rect.y,
        0,
        rect.y + rect.height,
      );
      let skyIsGood = true;
      for (const [offset, name, color] of [
        [0, "Top Color", topColor],
        [1, "Bottom Color", bottomColor],
      ] as const) {
        try {
          sky.addColorStop(offset, color);
        } catch {
          // addColorStop() throws on a color it can't read.
          problems.push(`Can't read ${name} "${color}".`);
          skyIsGood = false;
        }
      }
      context.fillStyle = skyIsGood ? sky : "black";
      context.fill(clip);

      if (!(starCount >= 0 && starCount <= MAX_STARS)) {
        problems.push(
          `Number of Stars ${starCount} won't work.  Try a number from 0 to ${MAX_STARS}.`,
        );
      } else if (!(starSize >= 0 && Number.isFinite(starSize))) {
        problems.push(`Star Size ${starSize} won't work.  Try 1.`);
      } else {
        const whole = Math.floor(starCount);
        const toDraw = Math.ceil(starCount);
        const stars = this.#getStars(this.seedSchedule.at(timeInMs), toDraw);
        for (let index = 0; index < toDraw; index++) {
          const star = stars[index];
          const x = rect.x + star.x * rect.width;
          const y = rect.y + star.y * rect.height;
          const radius = star.radius * starSize;
          // The last one is partway there when Number of Stars has a fraction.
          context.globalAlpha = index < whole ? 1 : starCount - whole;
          // Solid white in the middle, then a dim glow that fades out.
          const glow = context.createRadialGradient(x, y, 0, x, y, radius);
          glow.addColorStop(0.1, "white");
          glow.addColorStop(0.25, "#FFFFFF20");
          glow.addColorStop(1, "#FFFFFF00");
          context.fillStyle = glow;
          context.beginPath();
          context.arc(x, y, radius, 0, FULL_CIRCLE);
          context.fill();
        }
      }
      context.restore();
    }
    if (problems.length > 0) {
      // Across the whole canvas, not clipped to Rect, so it can always be read.
      context.save();
      const scale = canvasRecorder.width / 16;
      context.scale(scale, scale);
      showError(context, problems.join("\n"));
      context.restore();
    }
  }
}

// MARK: Registry

componentRegistry.set("Night Sky", {
  create() {
    return new NightSky();
  },
  description:
    "A background:  a gradient from Top Color to Bottom Color, with glowing stars.  The default Rect covers the canvas.",
  howToGenerate: { type: "class", class: NightSky },
});
