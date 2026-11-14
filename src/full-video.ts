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
 * 9. Scratch 1 to 13:  just a background, to add anything to.
 *
 * Everything is editable in the Visual Editor.  These are just the starting values.
 * @module
 */

import {
  DurationAgnosticComponent,
  ease,
  FourierComponent,
  InSeriesComponent,
  MultiTextComponent,
  TextFormatComponent,
  TextSpanComponent,
} from "canvas-recorder-lib";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import { SlideLeftTransition } from "canvas-recorder-lib/src/slide-components/slide-left";
import "./all-components.ts";
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

// MARK: Scratch

// Blank pages, to add anything to from the Visual Editor.
// The editor finds saved work by name, so add more at the end, and never renumber.
for (let number = 1; number <= 13; number++) {
  addScene(root, `Scratch ${number}`, 5_000);
}

export const fullVideo = root;
