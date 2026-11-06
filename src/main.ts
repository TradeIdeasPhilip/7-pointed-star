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
 * 6. Scratch 1, 2 and 3:  just a background, to add anything to.
 *
 * Everything is editable in the Visual Editor.  These are just the starting values.
 */

import {
  canvasRecorder,
  DurationAgnosticComponent,
  ease,
  InSeriesComponent,
  MultiTextComponent,
  RectangleComponent,
  Showable,
  TextFormatComponent,
  TextSpanComponent,
} from "canvas-recorder-lib";
import { FourierComponent } from "canvas-recorder-lib/src/slide-components/fourier";
// Must come before any FourierComponent is constructed.
import { GROUPED_SOURCE } from "./star-sources.ts";
import { ColorfulStar } from "./colorful-star.ts";
import { VertexPairings } from "./vertex-pairings.ts";
import { RoundedStar } from "./rounded-star.ts";
import { CircuitGrid } from "./circuit-grid.ts";
import { StarCircuit } from "./star-circuit.ts";

// The scenes are fixed children, so the Visual Editor saves their contents by description.
// Each scene has its own background, so each one can stand alone.
const root = new InSeriesComponent({ description: "7 Pointed Star Video" });

/**
 * A new scene with a black background, added to the end of the video.
 * @param minDuration How long the scene lasts, unless something in it asks for longer.
 */
function addScene(description: string, minDuration = 0) {
  const scene = new DurationAgnosticComponent(description);
  scene.minDurationScalar.value = minDuration;
  scene.replaceableComponents!.push(
    new RectangleComponent({
      description: "Background",
      color: "black",
      rect: { x: 0, y: 0, width: 16, height: 9 },
    }),
  );
  root.add(scene);
  return scene;
}

/**
 * Give a replaceable child a name that lasts.
 * The editor rebuilds replaceable children from the registry when it loads saved state,
 * so a `description` given to the constructor is lost.  This name is saved with the rest.
 */
function named<T extends Showable>(name: string, component: T): T {
  component.userEditableDescription = name;
  return component;
}

// MARK: 7 Pointed Star

const starScene = addScene("7 Pointed Star");

starScene.replaceableComponents!.push(
  new FourierComponent({
    description: "Star Fourier",
    source: GROUPED_SOURCE,
    destRect: { x: 0.5, y: 1, width: 7, height: 7 },
    termGroups: "0, 1, 2, 3, 4, 5-9, 10-19, 20-39, 40-99, 100-299, 300-1023",
    step: [
      { time: 0, value: 0 },
      { time: 22_000, value: 11 },
    ],
    minDuration: 24_000,
  }),
);

// A fixed child:  the Visual Editor can edit it, but not delete it.
starScene.add(
  new ColorfulStar({
    description: "Colorful Star",
    destRect: { x: 8.5, y: 1, width: 7, height: 7 },
  }),
);

// MARK: Vertex Pairings

const pairingsScene = addScene("Vertex Pairings", 8_000);

// Starts with sharp corners, where every pairing looks the same, then rounds them.
pairingsScene.add(
  new VertexPairings({
    description: "Pairings",
    rounding: [
      { time: 1_000, value: 0, easeAfter: ease },
      { time: 4_000, value: 0.6 },
    ],
    roundingStep: [
      { time: 1_000, value: 0, easeAfter: ease },
      { time: 4_000, value: 0.25 },
    ],
  }),
);

// MARK: Every Kind of Vertex

const everyKindScene = addScene("Every Kind of Vertex", 5_000);

// The same places as Star Fourier and Colorful Star on the first slide.
everyKindScene.add(
  new RoundedStar({
    description: "Left Star",
    circuit: "Every kind A",
    destRect: { x: 0.5, y: 1, width: 7, height: 7 },
  }),
);
everyKindScene.add(
  new RoundedStar({
    description: "Right Star",
    circuit: "Every kind B",
    destRect: { x: 8.5, y: 1, width: 7, height: 7 },
  }),
);

// MARK: Circuit Grid

// 4 columns and 2 rows:  4 circuits.  Change the Lattice's cell size to try other layouts.
addScene("Circuit Grid", 24_000).replaceableComponents!.push(new CircuitGrid());

// MARK: Three Circuits

const threeScene = addScene("Three Circuits", 24_000);

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
addScene("Scratch 1", 5_000);
addScene("Scratch 2", 5_000);
addScene("Scratch 3", 5_000);

// Don't await this.  See canvasRecorder.start().
canvasRecorder.start(root, { name: "7-pointed-star" });
