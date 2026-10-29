/**
 * Fourier decompositions of Euler circuits on a 7 pointed star, every pair
 * of points connected:  the circle, the fat star {7/2} and the thin star {7/3}.
 *
 * So far:
 * * Star Fourier:  the library's Fourier component, drawing one hand picked circuit.
 * * Colorful Star:  the finished picture, in three colors, not animated.
 *
 * Everything is editable in the Visual Editor.  These are just the starting values.
 */

import {
  canvasRecorder,
  DurationAgnosticComponent,
  RectangleComponent,
} from "canvas-recorder-lib";
import { FourierComponent } from "canvas-recorder-lib/src/slide-components/fourier";
// Must come before any FourierComponent is constructed.
import { GROUPED_SOURCE } from "./star-sources.ts";
import { ColorfulStar } from "./colorful-star.ts";

const root = new DurationAgnosticComponent("7 Pointed Star");

root.replaceableComponents!.push(
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
root.add(
  new ColorfulStar({
    description: "Colorful Star",
    destRect: { x: 8.5, y: 1, width: 7, height: 7 },
  }),
);

// Don't await this.  See canvasRecorder.start().
canvasRecorder.start(root, { name: "7-pointed-star" });
