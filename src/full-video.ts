/**
 * Fourier decompositions of Euler circuits on a 7 pointed star, every pair
 * of points connected:  the circle, the fat star {7/2} and the thin star {7/3}.
 *
 * So far, one scene after another:
 * 1. 7 Pointed Star
 *    * Star Fourier:  the library's Fourier component, drawing one hand picked circuit.
 *    * Colorful Star:  the finished picture, in three colors, not animated.
 * 2. Vertex Pairings:  closeups of the top vertex, every way a circuit can pass through it.
 * 3. Every Kind of Vertex:  two whole circuits, corners rounded, that between them show every kind of vertex.
 * 4. Circuit Grid:  a Circuit Grid component, for trying layouts.
 * 5. Three Circuits:  three Star Circuit components, each in its own colors, with labels.
 *    Laid out like Peano vs Fourier:  the Fourier animations as big as possible, the reference images a little smaller.
 * 6. Like Share Subscribe:  a prototype.  A Fourier of cursive text, where the lines that close the gaps fade away.
 * 7. Love Reason Balance:  a prototype.  A Fourier morph from one cursive word to the next, twice.
 * 8. Something Lead Gold:  a short demo for a voiceover.  A dot grows into "Something", then slides away for a morph from Lead to Gold.
 * 9. Warped Paths:  a prototype.  Three Warped Path components, a circle and two stars, each growing from the center, one after another.
 * 10. Twisted Paths:  a prototype.  The same three, but Twisted Path components:  the turn depends on the distance from the center, so the stars curl.
 * 11. Text Warps:  a prototype.  Three columns of text, each a Multi Text with its own text effect:  Zoom Into Circle, Waves: Fixed Amplitude, Waves: Fixed Frequency.
 * 12. Eased Circle:  a prototype.  Zoom Into Circle beside Eased Circle, the same lens on the same text, one round for each of Eased Circle's curves.
 * 13. Ripples:  a prototype.  A page of text, and ripples spreading out from the middle, like a pebble dropped in a pond.
 * 14. Scratch 1 to 13:  just a background, to add anything to.
 *
 * Everything is editable in the Visual Editor.  These are just the starting values.
 * @module
 */

import {
  DurationAgnosticComponent,
  ease,
  FourierComponent,
  InSeriesComponent,
  type Keyframe,
  MultiTextComponent,
  type Showable,
  TextFormatComponent,
  TextSpanComponent,
} from "canvas-recorder-lib";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import { SlideLeftTransition } from "canvas-recorder-lib/src/slide-components/slide-left";
import "./setup.ts";
import { BridgedFourier } from "./bridged-fourier.ts";
import { BridgedMorph } from "./bridged-morph.ts";
import { CircuitGrid } from "./circuit-grid.ts";
import { ColorfulStar } from "./colorful-star.ts";
import { RoundedStar } from "./rounded-star.ts";
import { addScene, named } from "./scenes.ts";
import { StarCircuit } from "./star-circuit.ts";
import { GROUPED_SOURCE } from "./star-sources.ts";
import { TessellatingTriangles } from "./tessellating-triangles.ts";
import { VertexPairings } from "./vertex-pairings.ts";
import { TwistedPath } from "./twisted-path.ts";
import { EasedCircle, Ripples } from "./radial-warps.ts";
import {
  WavesFixedAmplitude,
  WavesFixedFrequency,
  ZoomIntoCircle,
} from "./text-warps.ts";
import { CIRCLE_PATH, starPath, WarpedPath } from "./warped-path.ts";

const root = new InSeriesComponent({ description: "7 Pointed Star Video" });

// MARK: 7 Pointed Star

addScene(root, "7 Pointed Star").replaceableComponents!.push(
  named(
    "Star Fourier",
    new FourierComponent({
      source: GROUPED_SOURCE,
      destRect: { x: 0.5, y: 1, width: 7, height: 7 },
      // 1023 terms, 0 to 1022:  the library's Fourier component leaves out the frequency 0 term (library 0.8.0).
      termGroups: "0, 1, 2, 3, 4, 5-9, 10-19, 20-39, 40-99, 100-299, 300-1022",
      step: [
        { time: 0, value: 0 },
        { time: 22_000, value: 11 },
      ],
      minDuration: 24_000,
    }),
  ),
  named(
    "Colorful Star",
    new ColorfulStar({ destRect: { x: 8.5, y: 1, width: 7, height: 7 } }),
  ),
);

// MARK: Vertex Pairings

// Starts with sharp corners, where every pairing looks the same, then rounds them.
addScene(root, "Vertex Pairings", 8_000).replaceableComponents!.push(
  named(
    "Pairings",
    new VertexPairings({
      rounding: [
        { time: 1_000, value: 0, easeAfter: ease },
        { time: 4_000, value: 0.6 },
      ],
      roundingStep: [
        { time: 1_000, value: 0, easeAfter: ease },
        { time: 4_000, value: 0.25 },
      ],
    }),
  ),
);

// MARK: Every Kind of Vertex

// The same places as Star Fourier and Colorful Star on the first slide.
addScene(root, "Every Kind of Vertex", 5_000).replaceableComponents!.push(
  named(
    "Left Star",
    new RoundedStar({
      circuit: "Every kind A",
      destRect: { x: 0.5, y: 1, width: 7, height: 7 },
    }),
  ),
  named(
    "Right Star",
    new RoundedStar({
      circuit: "Every kind B",
      destRect: { x: 8.5, y: 1, width: 7, height: 7 },
    }),
  ),
);

// MARK: Circuit Grid

// 4 columns and 2 rows:  4 circuits.  Change the Lattice's cell size to try other layouts.
addScene(root, "Circuit Grid", 24_000).replaceableComponents!.push(
  new CircuitGrid(),
);

// MARK: Three Circuits

const threeScene = addScene(root, "Three Circuits", 24_000);

/**
 * A straw man:  each circuit gets its own colors, a family of three, used for its Fourier, its reference image and its label.
 * Each family follows the red, white and blue pattern:  the circle is the deepest color, the fat star the brightest,
 * and the thin star the palest, the way white is.
 */
const threeCircuits = [
  {
    circuit: "Every kind A",
    circleColor: "#f05a28",
    fatStarColor: "#fbbf24",
    thinStarColor: "#fef3c7",
  },
  {
    circuit: "Every kind B",
    circleColor: "#16a34a",
    fatStarColor: "#22d3ee",
    thinStarColor: "#ccfbf1",
  },
  {
    circuit: "Interleaved",
    circleColor: "#8b5cf6",
    fatStarColor: "#f472b6",
    thinStarColor: "#ede9fe",
  },
];

// Three columns.  In each:  the Fourier animation at the bottom, as big as it can be,
// and the reference image above it, smaller and lined up with its right edge.
// The label runs up the room that leaves, beside the reference image.
threeCircuits.forEach((colors, index) => {
  const left = (16 / 3) * index;
  const number = index + 1;
  threeScene.replaceableComponents!.push(
    named(
      `Circuit ${number}`,
      new StarCircuit({
        ...colors,
        referenceRect: { x: left + 1.65, y: 0.4, width: 3.6, height: 3.6 },
        fourierRect: { x: left + 0.8, y: 4.35, width: 4.45, height: 4.45 },
      }),
    ),
  );
});

// The labels are separate components:  they change more than anything else.
// Position, Width and Height came from dragging the first label's frame in the Visual Editor.
// Width and Height only size that frame:  with Width Mode "unbounded", the text ignores them.
threeCircuits.forEach(({ fatStarColor }, index) => {
  const left = (16 / 3) * index;
  const number = index + 1;
  const label = new MultiTextComponent({
    position: { x: left + 1.156787834, y: 2.264549333 },
    width: 3.590597181008901,
    height: 0.7869065281899106,
    anchorX: "center",
    textBaseline: "middle",
    widthMode: "unbounded",
    rotation: "90° counterclockwise",
  });
  label.replaceableComponents!.push(
    new TextFormatComponent({ color: fatStarColor, size: 0.5 }),
    new TextSpanComponent({ content: `Circuit ${number}` }),
  );
  threeScene.replaceableComponents!.push(named(`Label ${number}`, label));
});

// MARK: Like Share Subscribe

// A remake of "Will it Fourier?", with the lines between strokes fading away.
// They start the same color as the text, so the first circles look closed.  2 s per step, so they fade during steps 2 to 5.
// Give Bridge Color a visible color to see every bridge.
addScene(root, "Like Share Subscribe", 24_000).replaceableComponents!.push(
  named(
    "Like Share Subscribe",
    new BridgedFourier({
      bridgeColor: [
        { time: 4_000, value: myRainbow.yellow },
        { time: 10_000, value: "transparent" },
      ],
    }),
  ),
);

// MARK: Love Reason Balance

// Love to Reason, a pause, then Reason to Balance.  An homage to Rush's Hemispheres.
// Two morphs, in the same Dest Rect, so Reason is in the same place in both.
// They take turns:  at 12 s the first one hides (Step -1) and the second one starts, both showing Reason.
// The 1 ms between keyframes is never a frame.
const LEG_GROUPS = 10;
addScene(root, "Love Reason Balance", 23_000).replaceableComponents!.push(
  named(
    "Love to Reason",
    new BridgedMorph({
      before: "Love",
      after: "Reason",
      step: [
        { time: 1_000, value: 0 },
        { time: 9_000, value: LEG_GROUPS },
        { time: 11_999, value: LEG_GROUPS },
        { time: 12_000, value: -1 },
      ],
    }),
  ),
  named(
    "Reason to Balance",
    new BridgedMorph({
      before: "Reason",
      after: "Balance",
      step: [
        { time: 11_999, value: -1 },
        { time: 12_000, value: 0 },
        { time: 20_000, value: LEG_GROUPS },
      ],
    }),
  ),
);

// MARK: Something Lead Gold

// A short demo of the progress so far, for a voiceover.
// "You can't make something out of nothing":  the usual Fourier, a dot that grows into "Something".
// "The real magic is about morphing one thing into another":  a Fourier morph from Lead to Gold.
// Two halves in an In Series, the second sliding in from the right.  The background stays still.
// Fixed children, all of them, at the author's request.
// To stretch a half, raise its Min Duration, then move its Step keyframes.  Their times start at the start of that half.
{
  const scene = addScene(root, "Something Lead Gold");
  // As in Scratch 2 of the Shorts.
  scene.add(
    new TessellatingTriangles({
      description: "Triangles",
      upColor: "rgb(0% 0% 0%)",
      downColor: "#1c1c1c",
      sideLength: 1.5,
    }),
  );
  const halves = new InSeriesComponent({ description: "Halves" });
  scene.add(halves);

  const nothingToSomething = new DurationAgnosticComponent(
    "Nothing to Something",
  );
  nothingToSomething.minDurationScalar.value = 19_000;
  // The dot sits still for a second, then grows into the word.  11 groups, the default Term Groups.
  const somethingColor = "#c084fc";
  nothingToSomething.add(
    new BridgedFourier({
      description: "Something",
      text: "Something",
      step: [
        { time: 1_000, value: 0 },
        { time: 17_000, value: 11 },
      ],
      // The word is 4 times as wide as it is tall, so this is 14 wide.
      destRect: { x: 1, y: 2.75, width: 14, height: 3.5 },
      contentColor: somethingColor,
      // As in Like Share Subscribe:  the first circles look closed, and the bridges fade during steps 2 to 5.
      bridgeColor: [
        { time: 4_000, value: somethingColor },
        { time: 8_500, value: "transparent" },
      ],
      // The font's own weight at this size.
      lineWidth: 0.11,
    }),
  );
  halves.add(nothingToSomething);

  // Neither half moves while it slides:  the last frame of the first, the first frame of the second.
  halves.add(new SlideLeftTransition());

  const leadToGold = new DurationAgnosticComponent("Lead to Gold");
  leadToGold.minDurationScalar.value = 12_000;
  // Lead to Gold, in color too:  lead gray to gold, at the same pace as Step.
  leadToGold.add(
    new BridgedMorph({
      description: "Morph",
      before: "Lead",
      after: "Gold",
      // The difference between Lead and Gold has 1023 terms, not 1024.
      termGroups: "0, 1, 2, 3, 4, 5-9, 10-19, 20-39, 40-99, 100-1022",
      step: [
        { time: 1_500, value: 0 },
        { time: 9_500, value: 10 },
      ],
      // Dest Rect's height is one line of the font, descenders included.  Lead and Gold have none,
      // so their ink is in the top 2/3, a little above the middle of the screen.  Each word is 12.8 wide.
      destRect: { x: 0.5, y: 1.25, width: 15, height: 7.75 },
      contentColor: [
        { time: 1_500, value: "#94a3b8" },
        { time: 9_500, value: "#fbbf24" },
      ],
      // The font's own weight at this size.
      lineWidth: 0.2,
    }),
  );
  halves.add(leadToGold);
}

// MARK: Warped Paths

// A prototype.  Three paths, each pulled into a dot at the center, then let go, one after another.
// When they're done the picture is the finished Star Circuit:  the circle, the fat star and the thin star.
// All three share Source Rect and Dest Rect, so they line up.
// Radius Offset starts at 1 unit, the radius of the circle, and ends at 0.  Angle ends at 0 too.
// Each Radius Offset and Angle pair has the same times, so the turn and the growth finish together.
addScene(root, "Warped Paths", 14_000).replaceableComponents!.push(
  named(
    "Circle",
    new WarpedPath({
      path: CIRCLE_PATH,
      radiusOffset: [
        { time: 1_000, value: 1 },
        { time: 8_000, value: 0 },
      ],
      destRect: { x: 4, y: 0.5, width: 8, height: 8 },
      color: myRainbow.red,
    }),
  ),
  named(
    "Fat Star",
    new WarpedPath({
      path: starPath(2),
      radiusOffset: [
        { time: 2_500, value: 1 },
        { time: 9_500, value: 0 },
      ],
      angle: [
        { time: 2_500, value: 180 },
        { time: 9_500, value: 0 },
      ],
      destRect: { x: 4, y: 0.5, width: 8, height: 8 },
      color: myRainbow.myBlue,
    }),
  ),
  named(
    "Thin Star",
    new WarpedPath({
      path: starPath(3),
      radiusOffset: [
        { time: 4_000, value: 1 },
        { time: 11_000, value: 0 },
      ],
      angle: [
        { time: 4_000, value: -180 },
        { time: 11_000, value: 0 },
      ],
      destRect: { x: 4, y: 0.5, width: 8, height: 8 },
      color: "white",
    }),
  ),
);

// MARK: Twisted Paths

// A prototype, the second version of Warped Paths.  Same shapes, same timing, but the turn depends on the distance from the center.
// The circle can't show it:  every point on it is the same distance out, so it just grows.
// Fat Star:  the center leads.  Twist alone, 540° at the center and nothing at Effect Radius, unwinding as the star grows.
// Thin Star:  the rim leads.  Angle 360° with Twist -360°, so a point turns in proportion to its distance, and the inside lags.
// Both end at 0, the identity, so the last frame is the finished Star Circuit.
// 4096 samples:  a swirl needs more than the 1024 of a plain path.
addScene(root, "Twisted Paths", 14_000).replaceableComponents!.push(
  named(
    "Circle",
    new TwistedPath({
      path: CIRCLE_PATH,
      radiusOffset: [
        { time: 1_000, value: 1 },
        { time: 8_000, value: 0 },
      ],
      twist: 0,
      samples: 4096,
      destRect: { x: 4, y: 0.5, width: 8, height: 8 },
      color: myRainbow.red,
    }),
  ),
  named(
    "Fat Star",
    new TwistedPath({
      path: starPath(2),
      radiusOffset: [
        { time: 2_500, value: 1 },
        { time: 9_500, value: 0 },
      ],
      twist: [
        { time: 2_500, value: 540 },
        { time: 9_500, value: 0 },
      ],
      effectRadius: 1,
      samples: 4096,
      destRect: { x: 4, y: 0.5, width: 8, height: 8 },
      color: myRainbow.myBlue,
    }),
  ),
  named(
    "Thin Star",
    new TwistedPath({
      path: starPath(3),
      radiusOffset: [
        { time: 4_000, value: 1 },
        { time: 11_000, value: 0 },
      ],
      angle: [
        { time: 4_000, value: 360 },
        { time: 11_000, value: 0 },
      ],
      twist: [
        { time: 4_000, value: -360 },
        { time: 11_000, value: 0 },
      ],
      effectRadius: 1,
      samples: 4096,
      destRect: { x: 4, y: 0.5, width: 8, height: 8 },
      color: "white",
    }),
  ),
);

// MARK: Text Warps

// Prototypes:  Multi Text effects that move every point of the text by a function, like Handwriting Effect but from this project.
// Three columns of the same kind of text, each with its own effect as a direct child of its Multi Text.
// The effects work in the slide's coordinates, so a Center or a Center Y here is where it looks on the slide.
{
  const paragraph =
    "Every circuit is a sum of circles. Each circle spins at its own steady speed. " +
    "Add them up, biggest first, and a picture appears.";
  /** One column of text, with an effect inside it. */
  const column = (
    name: string,
    centerX: number,
    color: string,
    effect: Showable,
  ) => {
    const text = new MultiTextComponent({
      position: { x: centerX, y: 0.6 },
      width: 4.8,
      height: 7.8,
      anchorX: "center",
      textBaseline: "top",
    });
    text.replaceableComponents!.push(
      new TextFormatComponent({ color, size: 0.45 }),
      new TextSpanComponent({ content: paragraph }),
      effect,
    );
    return named(name, text);
  };
  addScene(root, "Text Warps", 8_000).replaceableComponents!.push(
    // A magnifying glass that slides down the column, and grows as it goes.
    column(
      "Zoom Into Circle",
      2.7,
      "white",
      new ZoomIntoCircle({
        center: [
          { time: 0, value: { x: 2.7, y: 1.5 } },
          { time: 8_000, value: { x: 2.7, y: 7.5 } },
        ],
        zoomInputRadius: 0.6,
        zoomOutputRadius: [
          { time: 0, value: 0.6 },
          { time: 1_500, value: 1.6 },
          { time: 6_500, value: 1.6 },
          { time: 8_000, value: 0.6 },
        ],
        copyVerbatimRadius: 2.4,
      }),
    ),
    // The phase goes around twice, so the last frame matches the first.
    column(
      "Waves: Fixed Amplitude",
      8,
      myRainbow.myBlue,
      new WavesFixedAmplitude({
        centerY: 4.5,
        standardDeviation: 1.5,
        amplitude: 0.3,
        cycles: 3,
        phase: [
          { time: 0, value: 0 },
          { time: 8_000, value: 720 },
        ],
      }),
    ),
    column(
      "Waves: Fixed Frequency",
      13.3,
      myRainbow.red,
      new WavesFixedFrequency({
        centerY: 4.5,
        standardDeviation: 1.5,
        amplitude: 0.35,
        frequency: 0.8,
        phase: [
          { time: 0, value: 0 },
          { time: 8_000, value: -720 },
        ],
      }),
    ),
  );
}

// MARK: Effect Text

/**
 * A Multi Text with one text effect inside it, for the scenes below.
 * Position is the middle of the top edge.  One format and one span, so the text is easy to replace in the Visual Editor.
 */
function effectText(options: {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  size: number;
  content: string | readonly Keyframe<string>[];
  alignment?: "left" | "center" | "right" | "justify";
  /** "shrink font" makes the text smaller to fit Height, if it's too long, and wraps it again.  The default, "unbounded", lets it run off the bottom. */
  heightMode?: "unbounded" | "shrink font";
  effect?: Showable;
}) {
  const text = new MultiTextComponent({
    position: { x: options.x, y: options.y },
    width: options.width,
    height: options.height,
    anchorX: "center",
    textBaseline: "top",
    alignment: options.alignment ?? "center",
    heightMode: options.heightMode ?? "unbounded",
  });
  text.replaceableComponents!.push(
    new TextFormatComponent({ color: options.color, size: options.size }),
    new TextSpanComponent({ content: options.content }),
  );
  if (options.effect) {
    text.replaceableComponents!.push(options.effect);
  }
  return named(options.name, text);
}

// MARK: Eased Circle

// Prototype:  Zoom Into Circle beside Eased Circle, the same text and the same lens, so the two can be compared.
// Three rounds of 4 s, one for each of Eased Circle's curves:  the lens grows for 1.5 s, holds for 1 s, and shrinks for 1.5 s.
// Strength is 0 at each change of curve, so the change doesn't show.  The label under each column says what's happening.
{
  const paragraph =
    "Every circuit is a sum of circles. Each circle spins at its own steady speed. " +
    "Add them up, biggest first, and a picture appears. " +
    "The first few circles give a rough sketch.";
  /** The same timing each round:  `from`, then `to` 1.5 s later, held 1 s, then `from` again 1.5 s later. */
  const rounds = (from: number, to: number) =>
    [0, 4_000, 8_000].flatMap((start) => [
      ...(start == 0 ? [{ time: 0, value: from }] : []),
      { time: start + 1_500, value: to },
      { time: start + 2_500, value: to },
      { time: start + 4_000, value: from },
    ]);
  const lensY = 3.7;
  const effectRadius = 2.2;
  const curves = ["smooth", "ease out", "ease in out"] as const;
  addScene(root, "Eased Circle", 12_000).replaceableComponents!.push(
    effectText({
      name: "Zoom Into Circle",
      x: 4,
      y: 0.8,
      width: 7,
      height: 6,
      color: "white",
      size: 0.45,
      content: paragraph,
      // 2× in the middle, like "smooth" at Strength 1.
      effect: new ZoomIntoCircle({
        center: { x: 4, y: lensY },
        zoomInputRadius: 0.6,
        zoomOutputRadius: rounds(0.6, 1.2),
        copyVerbatimRadius: effectRadius,
      }),
    }),
    effectText({
      name: "Eased Circle",
      x: 12,
      y: 0.8,
      width: 7,
      height: 6,
      color: myRainbow.myBlue,
      size: 0.45,
      content: paragraph,
      effect: new EasedCircle({
        center: { x: 12, y: lensY },
        effectRadius,
        curve: curves.map((curve, index) => ({
          time: index * 4_000,
          value: curve,
        })),
        strength: rounds(0, 1),
      }),
    }),
    effectText({
      name: "Zoom Into Circle Label",
      x: 4,
      y: 7.7,
      width: 7,
      height: 1,
      color: "#999",
      size: 0.35,
      content: "Zoom Into Circle:  straight lines",
    }),
    effectText({
      name: "Eased Circle Label",
      x: 12,
      y: 7.7,
      width: 7,
      height: 1,
      color: "#999",
      size: 0.35,
      // Changes with the curve.
      content: curves.map((curve, index) => ({
        time: index * 4_000,
        value: `Eased Circle:  ${curve}`,
      })),
    }),
  );
}

// MARK: Ripples

// Prototype:  a page of text, and a pebble dropped in the middle.
// Reach, the leading edge, grows from nothing to past the corners in 9 s.  The crests move out 1 Wavelength a second (360° of Phase).
// Then the ripples die down over the last 3 s, so the scene ends with still text, as it began.
// Wavelength 0.9 puts 5 ripples between the center and the top and bottom edges.
// The text is the start of Emerson's essay "Circles" (1841), a stand-in.  Replace the Text Span with anything.
// At Font Size 0.45 the page holds about 11 lines of 55 characters.  Height Mode is "shrink font", so longer text gets a smaller font to fit.
{
  const emerson =
    "The eye is the first circle; the horizon which it forms is the second; and throughout nature this primary figure is repeated without end. " +
    "It is the highest emblem in the cipher of the world. " +
    "St. Augustine described the nature of God as a circle whose centre was everywhere, and its circumference nowhere. " +
    "We are all our lifetime reading the copious sense of this first of forms. " +
    "One moral we have already deduced, in considering the circular or compensatory character of every human action. " +
    "Another analogy we shall now trace; that every action admits of being outdone. " +
    "Our life is an apprenticeship to the truth, that around every circle another can be drawn; " +
    "that there is no end in nature, but every end is a beginning; " +
    "that there is always another dawn risen on mid-noon, and under every deep a lower deep opens.";
  addScene(root, "Ripples", 12_000).replaceableComponents!.push(
    effectText({
      name: "Pond",
      x: 8,
      y: 0.35,
      width: 15.2,
      height: 8.3,
      color: "white",
      size: 0.45,
      content: emerson,
      alignment: "left",
      // Text that fits stays at Font Size 0.45.  Longer text, like a whole song, gets a smaller font and still fills the page.
      // The ripples stay the same size, since they're in the slide's units.
      heightMode: "shrink font",
      effect: new Ripples({
        center: { x: 8, y: 4.5 },
        wavelength: 0.9,
        amplitude: [
          { time: 0, value: 0.1 },
          { time: 9_000, value: 0.1 },
          { time: 12_000, value: 0 },
        ],
        phase: [
          { time: 0, value: 0 },
          { time: 12_000, value: 12 * 360 },
        ],
        peakRadius: 1,
        falloffPower: 0.5,
        reach: [
          { time: 0, value: 0 },
          { time: 9_000, value: 10 },
        ],
      }),
    }),
  );
}

// MARK: Scratch

// Blank pages, to add anything to from the Visual Editor.
// The editor finds saved work by name, so add more at the end, and never renumber.
for (let number = 1; number <= 13; number++) {
  addScene(root, `Scratch ${number}`, 5_000);
}

export const fullVideo = root;
