/**
 * Every custom component in this project, plus the Fourier component's sources.
 *
 * Each video imports this, so the Visual Editor can insert or paste any of them into any video.
 * Importing a component's file is what registers it.
 * @module
 */

// TODO update file name and comments above.
// This is just a list of stuff that needed to register itself.
// Local components are a subset of that.

import "./bridged-path.ts";
import "./circuit-grid.ts";
import "./colorful-star.ts";
import "./freaky-dots.ts";
import "./night-sky.ts";
import "./rounded-star.ts";
import "./star-circuit.ts";
import "./star-sources.ts";
import "./tessellating-triangles.ts";
import "./vertex-pairings.ts";

// Not component, but console commands, philDebug.*, work with any video.
import "./eight-pack.ts";
import "./four-plus-four.ts";
import "./delayed-start-each.ts";
import { FourierComponent } from "canvas-recorder-lib";
import {
  LCommand,
  PathBuilder,
  PathShape,
} from "canvas-recorder-lib/src/glib/path-shape";
import { philDebug } from "canvas-recorder-lib/src/utility";

//
{
  const UNIT_CIRCLE = PathBuilder.M(0, 1).circle(0, 0).pathShape;
  // TODO makeEllipse() should move into the library as PathShape.ellipse()
  function makeEllipse(options: {
    cx?: number;
    cy?: number;
    r?: number;
    rx?: number;
    ry?: number;
  }): PathShape {
    // Possibly improvements:
    // Initial angle.
    // Direction of travel.
    // Rotate.
    // Use cubics for higher fidelity but less compatibility.
    // I'm not in a hurry to do any of those, but I'd be surprised if
    // I didn't have to implement one of them soon.
    // I chose to use an options object instead of a list of individual
    // arguments because I think that list is going to get longer.
    const cx = options.cx ?? 0;
    const cy = options.cy ?? 0;
    let rx: number;
    let ry: number;
    if (options.r !== undefined) {
      if (options.rx !== undefined || options.ry !== undefined) {
        console.error(options);
        throw new Error("ambiguous inputs");
      }
      rx = options.r;
      ry = options.r;
    } else {
      rx = options.rx ?? 1;
      ry = options.ry ?? 1;
    }
    // Intention:  Scale the image while the center is still at the origin,
    // *then* translate so the requested coordinates do *not* get scaled.
    return UNIT_CIRCLE.transform(
      new DOMMatrix().translateSelf(cx, cy).scaleSelf(rx, ry),
    );
  }
  const pieces = new Array<PathShape>();
  // Head Outline
  pieces.push(makeEllipse({ cx: 100, cy: 100, rx: 60, ry: 75 }));
  // Left Eye (Wide blank circle)
  pieces.push(makeEllipse({ cx: 80, cy: 85, r: 6 }));
  pieces.push(makeEllipse({ cx: 80, cy: 85, r: 1 }));
  // Right Eye (Wide blank circle)
  pieces.push(makeEllipse({ cx: 120, cy: 85, r: 6 }));
  pieces.push(makeEllipse({ cx: 120, cy: 85, r: 1 }));
  // Flat Nose Line
  pieces.push(PathShape.fromRawString("M 100 95 L 98 115 L 102 115"));
  // Flat Neutral Mouth
  pieces.push(new PathShape([new LCommand(88, 135, 112, 135)]));
  // Blank stare
  const blankStare = new PathShape(
    pieces.flatMap((pathShape) => pathShape.commands),
  );
  FourierComponent.sources.set("Blank Stare", { path: blankStare });
}
