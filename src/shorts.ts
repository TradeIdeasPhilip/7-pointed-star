/**
 * Previews of the main video, for YouTube Shorts.  Every portrait video goes here, one or more
 * scenes each.  The Save dialog can save one scene at a time.
 *
 * So far, one scene after another:
 * 1. Portrait Template:  one circuit, laid out for a phone.
 * 2. Pan and Scan Template:  an empty Slide that slowly moves across a wider picture.
 *    Copy a whole slide from the main video, and paste it into the Slide.
 * 3. Scratch 1 to 13:  just a background, to add anything to.
 *    Except Scratch 4, which starts as eight copies of one circuit, like ✶37.  See `eight-pack.ts`.
 *
 * Everything is editable in the Visual Editor.  These are just the starting values.
 * @module
 */

import {
  canvasRecorder,
  InSeriesComponent,
  MultiTextComponent,
  SlideComponent,
  TextFormatComponent,
  TextSpanComponent,
} from "canvas-recorder-lib";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import "./all-components.ts";
import { fillEightPack } from "./eight-pack.ts";
import { addScene, named } from "./scenes.ts";
import { StarCircuit } from "./star-circuit.ts";

// The standard size for a Short.
// 9 × 16 units keeps the main video's scale:  anything pasted from there is the same size, in units.
// A 7 × 7 star still fits, 1 unit from each side.
canvasRecorder.size = {
  pixelWidth: 1080,
  pixelHeight: 1920,
  width: 9,
  height: 16,
};
// These scenes are laid out by hand for this one shape.
canvasRecorder.lockSize();

const root = new InSeriesComponent({ description: "7 Pointed Star Shorts" });

// MARK: Portrait Template

const portraitScene = addScene(root, "Portrait Template", 24_000);

// The same arrangement as Three Circuits:  the Fourier animation as big as it can be,
// and the reference image above it, smaller and lined up with its right edge, with the label beside that.
// This stays out of the top 2.4 units and the bottom 3.2 units, where YouTube draws over a Short.
portraitScene.replaceableComponents!.push(
  named(
    "Circuit",
    new StarCircuit({
      referenceRect: { x: 4.5, y: 2.4, width: 3.4, height: 3.4 },
      fourierRect: { x: 1.1, y: 6, width: 6.8, height: 6.8 },
    }),
  ),
);

const label = new MultiTextComponent({
  position: { x: 2.8, y: 4.1 },
  anchorX: "center",
  textBaseline: "middle",
  widthMode: "unbounded",
});
label.replaceableComponents!.push(
  new TextFormatComponent({ color: myRainbow.myBlue, size: 0.5 }),
  new TextSpanComponent({ content: "Circuit 1" }),
);
portraitScene.replaceableComponents!.push(named("Label", label));

// MARK: Pan and Scan Template

// 𝓐 and 𝓑 move the picture, and 𝓒 zooms it.  They're in units.
// A 16 × 9 picture is 7 units wider than this canvas, so 𝓐 goes from 0 to -7 to show all of it.
// It's 7 units shorter, so 𝓑 = 3.5 centers it.
addScene(root, "Pan and Scan Template", 24_000).replaceableComponents!.push(
  named(
    "Pan and Scan",
    new SlideComponent({
      transformTemplate: "translate(𝓐px, 𝓑px) scale(𝓒)",
      placeA: [
        { time: 0, value: 0 },
        { time: 24_000, value: -7 },
      ],
      placeB: 3.5,
      placeC: 1,
    }),
  ),
);

// MARK: Scratch

// Blank pages, to add anything to from the Visual Editor.
// The editor finds saved work by name, so add more at the end, and never renumber.
const scratch = Array.from({ length: 13 }, (_, index) =>
  addScene(root, `Scratch ${index + 1}`, 5_000),
);

// Eight copies of Random 5:  its first three terms are almost the same size, so each choice matters about as much.
const eightPack = scratch[3];
eightPack.minDurationScalar.value = 30_000;
fillEightPack(eightPack, "Random 5");

export const shorts = root;
