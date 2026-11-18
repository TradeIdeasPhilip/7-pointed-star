/**
 * Fourier sources converted by hand from SVG drawings.
 *
 * "Blank Stare" is `face.html`, as one PathShape.  Each SVG element is one piece, in the order they're listed.
 * The library's Fourier component closes the gaps between the pieces with straight lines.  Bridged Path hides them.
 *
 * Import this before constructing a FourierComponent or a Bridged Path:  their Source fields read the choices then.
 * @module
 */

import { FourierComponent } from "canvas-recorder-lib";
import {
  LCommand,
  PathBuilder,
  PathShape,
} from "canvas-recorder-lib/src/glib/path-shape";

// MARK: Shapes

const UNIT_CIRCLE = PathBuilder.M(0, 1).circle(0, 0).pathShape;

// TODO makeEllipse() should move into the library as PathShape.ellipse().  library-issues.md, item 34.
/**
 * An SVG `<circle>` or `<ellipse>`, as a PathShape.
 * It starts at the bottom, (cx, cy + ry), and goes clockwise on the screen.
 * @throws If given both `r` and `rx` or `ry`.
 */
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

// MARK: Blank Stare

{
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
