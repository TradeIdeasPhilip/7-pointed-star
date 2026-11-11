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
 * 6. Scratch 1 to 13:  just a background, to add anything to.
 *
 * Everything is editable in the Visual Editor.  These are just the starting values.
 * @module
 */

import {
  ease,
  FourierComponent,
  InSeriesComponent,
  MultiTextComponent,
  TextFormatComponent,
  TextSpanComponent,
} from "canvas-recorder-lib";
import "./all-components.ts";
import { CircuitGrid } from "./circuit-grid.ts";
import { ColorfulStar } from "./colorful-star.ts";
import { RoundedStar } from "./rounded-star.ts";
import { addScene, named } from "./scenes.ts";
import { StarCircuit } from "./star-circuit.ts";
import { GROUPED_SOURCE } from "./star-sources.ts";
import { VertexPairings } from "./vertex-pairings.ts";

const root = new InSeriesComponent({ description: "7 Pointed Star Video" });

// MARK: 7 Pointed Star

addScene(root, "7 Pointed Star").replaceableComponents!.push(
  named(
    "Star Fourier",
    new FourierComponent({
      source: GROUPED_SOURCE,
      destRect: { x: 0.5, y: 1, width: 7, height: 7 },
      termGroups: "0, 1, 2, 3, 4, 5-9, 10-19, 20-39, 40-99, 100-299, 300-1023",
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

// MARK: Scratch

// Blank pages, to add anything to from the Visual Editor.
// The editor finds saved work by name, so add more at the end, and never renumber.
for (let number = 1; number <= 13; number++) {
  addScene(root, `Scratch ${number}`, 5_000);
}

export const fullVideo = root;
