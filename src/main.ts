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
 * 4. Circuit Grid:  four circuits at once, each a Fourier animation next to its reference image.  A layout test.
 *
 * Everything is editable in the Visual Editor.  These are just the starting values.
 */

import {
  canvasRecorder,
  DurationAgnosticComponent,
  ease,
  InSeriesComponent,
  RectangleComponent,
} from "canvas-recorder-lib";
import { FourierComponent } from "canvas-recorder-lib/src/slide-components/fourier";
// Must come before any FourierComponent is constructed.
import { GROUPED_SOURCE } from "./star-sources.ts";
import { ColorfulStar } from "./colorful-star.ts";
import { VertexPairings } from "./vertex-pairings.ts";
import { RoundedStar } from "./rounded-star.ts";
import { CircuitGrid } from "./circuit-grid.ts";

// The scenes are fixed children, so the Visual Editor saves their contents by description.
// Each scene has its own background, so each one can stand alone.
const root = new InSeriesComponent({ description: "7 Pointed Star Video" });

// MARK: 7 Pointed Star

const starScene = new DurationAgnosticComponent("7 Pointed Star");

starScene.replaceableComponents!.push(
  new RectangleComponent({
    description: "Background",
    color: "black",
    rect: { x: 0, y: 0, width: 16, height: 9 },
  }),
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

root.add(starScene);

// MARK: Vertex Pairings

const pairingsScene = new DurationAgnosticComponent("Vertex Pairings");
pairingsScene.minDurationScalar.value = 8_000;

pairingsScene.replaceableComponents!.push(
  new RectangleComponent({
    description: "Background",
    color: "black",
    rect: { x: 0, y: 0, width: 16, height: 9 },
  }),
);

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

root.add(pairingsScene);

// MARK: Every Kind of Vertex

const everyKindScene = new DurationAgnosticComponent("Every Kind of Vertex");
everyKindScene.minDurationScalar.value = 5_000;

everyKindScene.replaceableComponents!.push(
  new RectangleComponent({
    description: "Background",
    color: "black",
    rect: { x: 0, y: 0, width: 16, height: 9 },
  }),
);

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

root.add(everyKindScene);

// MARK: Circuit Grid

const gridScene = new DurationAgnosticComponent("Circuit Grid");
gridScene.minDurationScalar.value = 24_000;

gridScene.replaceableComponents!.push(
  new RectangleComponent({
    description: "Background",
    color: "black",
    rect: { x: 0, y: 0, width: 16, height: 9 },
  }),
);

// 4 columns and 2 rows:  4 circuits.  Change the Lattice's cell size to try other layouts.
gridScene.add(new CircuitGrid({ description: "Grid" }));

root.add(gridScene);

// Don't await this.  See canvasRecorder.start().
canvasRecorder.start(root, { name: "7-pointed-star" });
