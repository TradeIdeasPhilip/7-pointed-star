/**
 * Rounded corners at a vertex of the 7 pointed star, so you can see which
 * edge a circuit continues into.  Used by the closeups (`vertex-pairings.ts`)
 * and by the full stars (`rounded-star.ts`).
 *
 * Everything here is at the top vertex, in the star's own coordinates:  the
 * unit circle.  Rotate the results to use them at another vertex.
 * @module
 */

import {
  PathBuilder,
  PathShape,
  Point,
} from "canvas-recorder-lib/src/glib/path-shape";
import { SpokePair, stepDistance, VertexPairing } from "./euler-circuits.ts";
import { starVertex } from "./star-path.ts";

// MARK: Spokes

/** The top vertex. */
const TOP = starVertex(7, 0);

/** One of the 6 edges at the top vertex, as seen from that vertex. */
export type Spoke = {
  /** The vertex at the far end. */
  readonly to: number;
  /** 1 for the circle, 2 for the fat star, 3 for the thin star. */
  readonly distance: number;
  /** The length of the whole edge, measured along the edge. */
  readonly length: number;
  /**
   * Which way it leaves the top vertex, in units of π/7 below the tangent line:
   * 7 for the arc going left, 0 for the arc going right,
   * and k for the chord to vertex k, half the arc it cuts off.
   * Integers, so ties compare exactly.
   */
  readonly angle: number;
  /** The point `s` along the edge, measured from the top vertex. */
  at(s: number): Point;
  /** The direction of travel at `s`, away from the top vertex.  A unit vector. */
  direction(s: number): Point;
  /** The part of this edge from `s0` to `s1`, drawn away from the top vertex. */
  piece(s0: number, s1: number): PathShape;
};

function makeSpoke(to: number): Spoke {
  const distance = stepDistance(7, 0, to);
  if (distance == 1) {
    /** +1 to go clockwise (vertex 1), -1 to go counterclockwise (vertex 6). */
    const sign = to == 1 ? 1 : -1;
    const angle = (s: number) => -Math.PI / 2 + sign * s;
    const at = (s: number): Point => ({
      x: Math.cos(angle(s)),
      y: Math.sin(angle(s)),
    });
    return {
      to,
      distance,
      length: (2 * Math.PI) / 7,
      angle: sign > 0 ? 0 : 7,
      at,
      direction(s) {
        return { x: -sign * Math.sin(angle(s)), y: sign * Math.cos(angle(s)) };
      },
      piece(s0, s1) {
        const start = at(s0);
        const end = at(s1);
        return PathBuilder.M(start.x, start.y).arc(
          0,
          0,
          end.x,
          end.y,
          sign > 0 ? "cw" : "ccw",
        ).pathShape;
      },
    };
  } else {
    const far = starVertex(7, to);
    const length = Math.hypot(far.x - TOP.x, far.y - TOP.y);
    const unit: Point = {
      x: (far.x - TOP.x) / length,
      y: (far.y - TOP.y) / length,
    };
    const at = (s: number): Point => ({
      x: TOP.x + s * unit.x,
      y: TOP.y + s * unit.y,
    });
    return {
      to,
      distance,
      length,
      angle: to,
      at,
      direction() {
        return unit;
      },
      piece(s0, s1) {
        const start = at(s0);
        const end = at(s1);
        return PathBuilder.M(start.x, start.y).L(end.x, end.y).pathShape;
      },
    };
  }
}

/**
 * The 6 edges at the top vertex, numbered as in {@link SpokePair}:  left to right on the screen.
 * The arc to vertex 6 heads left, then the chords to 5, 4, 3 and 2, then the arc to 1 heads right.
 * All of them head into the lower half, so this order never wraps around.
 */
export const SPOKES: readonly Spoke[] = [6, 5, 4, 3, 2, 1].map(makeSpoke);

/**
 * Where the tangent lines at two points cross.
 * That's the control point for a quadratic that leaves `p0` and arrives at `p2` without a kink.
 * For two straight edges, this is the vertex itself.
 */
function tangentIntersection(
  p0: Point,
  t0: Point,
  p2: Point,
  t2: Point,
): Point {
  const cross = t0.x * t2.y - t0.y * t2.x;
  if (Math.abs(cross) < 1e-9) {
    return TOP;
  }
  const dx = p2.x - p0.x;
  const dy = p2.y - p0.y;
  const along = (dx * t2.y - dy * t2.x) / cross;
  return { x: p0.x + along * t0.x, y: p0.y + along * t0.y };
}

// MARK: Levels

/** The angle between the two spokes. */
function span([a, b]: SpokePair) {
  return SPOKES[a].angle - SPOKES[b].angle;
}

/** How far the pair is from the middle.  The same for a pair and its mirror image. */
function offCenter([a, b]: SpokePair) {
  return Math.abs(a + b - 5);
}

/**
 * Does `p` stay closer to the vertex than `q`?
 * The wider pair stays closer.  Between pairs of the same width, the one nearer the middle stays closer.
 *
 * That leaves a pair and its mirror image tied.  If they cross, they cross on the center line.
 * Pairs wider than 90° cross there steeply, so they stay tied, and the picture stays symmetric (pairings 8 and 14).
 * Narrower pairs would cross at a shallow angle, near the tops of both curves,
 * so the left one stays closer and they cross lower down (pairing 10).
 */
function staysCloser(p: SpokePair, q: SpokePair) {
  if (span(p) != span(q)) {
    return span(p) > span(q);
  }
  if (offCenter(p) != offCenter(q)) {
    return offCenter(p) < offCenter(q);
  }
  return 2 * span(p) < 7 && p[0] < q[0];
}

/** True if one pair surrounds the other, or they cross.  Then they can't both stay at the vertex. */
function inTheWay(p: SpokePair, q: SpokePair) {
  return !(p[1] < q[0] || q[1] < p[0]);
}

/**
 * How many steps each pair moves away from the vertex:
 * one for each pair in its way that stays closer.
 *
 * A surrounding pair is always wider than the pair inside it, so the inside pair always moves further.
 * Of two crossing pairs, the wider one usually stays closer, so they cross away from the vertex.
 * Pairs side by side don't affect each other.
 * @returns One level per pair, in the same order as `pairing`.
 */
export function levels(pairing: VertexPairing): number[] {
  return pairing.map(
    (pair) =>
      pairing.filter((other) => inTheWay(pair, other) && staysCloser(other, pair))
        .length,
  );
}

// MARK: Corners

export type RoundingSettings = {
  /** How much of an edge a curve can replace at most, in the star's units. */
  readonly cornerSize: number;
  /**
   * For pairs that don't move out of the way, the fraction of the Corner Size to replace with a curve.
   * 0 for sharp corners.
   */
  readonly rounding: number;
  /** Added to the Rounding for each step a pair moves out of the way.  See {@link levels}. */
  readonly roundingStep: number;
};

/** How to draw one pair of edges near the top vertex. */
export type RoundedPair = {
  readonly spokes: readonly [Spoke, Spoke];
  /** Where the curve meets each spoke, measured along the spoke from the vertex.  0 for a sharp corner. */
  readonly cuts: readonly [number, number];
  /**
   * Each spoke's half of the turn, from the middle of the turn to where the turn meets the spoke.
   * Empty for a sharp corner.
   */
  readonly halfTurns: readonly [PathShape, PathShape];
};

/**
 * Round the corners at the top vertex.
 * @param maxCut The most of each spoke a curve can replace.
 * In a closeup, the visible part.  In a full star, half the edge, so the curves from the two ends never overlap.
 * @returns One entry for each pair, in the same order as `pairing`.
 */
export function roundCorners(
  pairing: VertexPairing,
  settings: RoundingSettings,
  maxCut: (spoke: Spoke) => number,
): RoundedPair[] {
  const pairLevels = levels(pairing);
  return pairing.map((pair, index): RoundedPair => {
    const spokes = [SPOKES[pair[0]], SPOKES[pair[1]]] as const;
    const wanted =
      settings.cornerSize *
      Math.min(
        1,
        Math.max(0, settings.rounding + pairLevels[index] * settings.roundingStep),
      );
    if (!(wanted > 0)) {
      const empty = new PathShape([]);
      return { spokes, cuts: [0, 0], halfTurns: [empty, empty] };
    }
    const cuts = [
      Math.min(wanted, maxCut(spokes[0])),
      Math.min(wanted, maxCut(spokes[1])),
    ] as const;
    const ends = [spokes[0].at(cuts[0]), spokes[1].at(cuts[1])] as const;
    const control = tangentIntersection(
      ends[0],
      spokes[0].direction(cuts[0]),
      ends[1],
      spokes[1].direction(cuts[1]),
    );
    // Split the quadratic in half, so each edge can keep its color up to the middle of the turn.
    const middle: Point = {
      x: (ends[0].x + 2 * control.x + ends[1].x) / 4,
      y: (ends[0].y + 2 * control.y + ends[1].y) / 4,
    };
    const halfTurn = (end: Point) =>
      PathBuilder.M(middle.x, middle.y).Q(
        (control.x + end.x) / 2,
        (control.y + end.y) / 2,
        end.x,
        end.y,
      ).pathShape;
    return {
      spokes,
      cuts,
      halfTurns: [halfTurn(ends[0]), halfTurn(ends[1])],
    };
  });
}
