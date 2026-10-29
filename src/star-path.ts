import { positiveModulo } from "phil-lib/misc";
import {
  PathBuilder,
  PathShape,
  Point,
} from "canvas-recorder-lib/src/glib/path-shape";
import { Circuit, stepDistance } from "./euler-circuits.ts";

/**
 * Where vertex `k` of an `n` pointed star goes.
 *
 * The star is inscribed in the unit circle, centered on (0, 0).  The center
 * matters:  a Fourier animation starts with a dot at the origin.
 * Vertex 0 is at the top, and the numbers go clockwise.
 */
export function starVertex(n: number, k: number): Point {
  const angle = -Math.PI / 2 + (2 * Math.PI * k) / n;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/** One step of a circuit, and where it is in the PathShape. */
export type StarEdge = {
  readonly from: number;
  readonly to: number;
  /** 1 for the circle.  For n = 7:  2 for the fat star, 3 for the thin star. */
  readonly distance: number;
  /** This edge is `pathShape.commands.slice(firstCommand, endCommand)`. */
  readonly firstCommand: number;
  readonly endCommand: number;
};

export type StarPath = {
  readonly pathShape: PathShape;
  /** In the order they are drawn. */
  readonly edges: readonly StarEdge[];
};

/**
 * Turn a circuit into a path:  arcs between neighbors, straight lines everywhere else.
 * This is `ShapeMaker6.makePathShape()` from fourier-smackdown.ts, for any n,
 * plus a record of which commands came from which edge.
 *
 * Those records say where each color starts and stops.
 * @param n The number of vertices.
 * @param circuit Usually an Euler circuit, but anything works.
 */
export function circuitToPath(n: number, circuit: Circuit): StarPath {
  const start = starVertex(n, circuit[0]);
  const builder = PathBuilder.M(start.x, start.y);
  const edges: StarEdge[] = [];
  for (let i = 1; i < circuit.length; i++) {
    const from = circuit[i - 1];
    const to = circuit[i];
    const { x, y } = starVertex(n, to);
    const firstCommand = builder.commands.length;
    switch (positiveModulo(to - from, n)) {
      case 1: {
        builder.arc(0, 0, x, y, "cw");
        break;
      }
      case n - 1: {
        builder.arc(0, 0, x, y, "ccw");
        break;
      }
      default: {
        builder.L(x, y);
        break;
      }
    }
    edges.push({
      from,
      to,
      distance: stepDistance(n, from, to),
      firstCommand,
      endCommand: builder.commands.length,
    });
  }
  return { pathShape: builder.pathShape, edges };
}

/**
 * Just some of the edges of a star.
 * @param starPath From {@link circuitToPath}.
 * @param keep Which edges to include.
 * @returns A new PathShape with the selected edges, in their original order.
 * It may have gaps.
 */
export function selectEdges(
  starPath: StarPath,
  keep: (edge: StarEdge) => boolean,
): PathShape {
  const commands = starPath.pathShape.commands;
  return new PathShape(
    starPath.edges
      .filter(keep)
      .flatMap(({ firstCommand, endCommand }) =>
        commands.slice(firstCommand, endCommand),
      ),
  );
}
