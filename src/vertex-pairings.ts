import { ReadOnlyRect } from "phil-lib/misc";
import {
  ColorScheduleInfo,
  Keyframe,
  NumberScheduleInfo,
  RectangleScheduleInfo,
  SelectScheduleInfo,
  Showable,
  ShowOptions,
} from "canvas-recorder-lib";
import { myRainbow } from "canvas-recorder-lib/src/glib/my-rainbow";
import {
  PathBuilder,
  PathShape,
  Point,
} from "canvas-recorder-lib/src/glib/path-shape";
import { panAndZoom } from "canvas-recorder-lib/src/glib/transforms";
import { stepDistance } from "./euler-circuits.ts";
import { starVertex } from "./star-path.ts";

// MARK: Spokes

/**
 * How much of each edge the closeup shows, measured along the edge from the top vertex.
 * In the star's units:  the circle has radius 1.
 * The nearest other vertex is about 0.87 away.
 */
const VISIBLE_LENGTH = 0.6;

/** The top vertex, where all of the closeups are centered. */
const TOP = starVertex(7, 0);

/** One of the 6 edges at the top vertex, as seen from that vertex. */
type Spoke = {
  /** The vertex at the far end. */
  readonly to: number;
  /** 1 for the circle, 2 for the fat star, 3 for the thin star. */
  readonly distance: number;
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
 * The 6 edges at the top vertex, from left to right on the screen.
 * The arc to vertex 6 heads left, then the chords to 5, 4, 3 and 2, then the arc to 1 heads right.
 * All of them head into the lower half, so this order never wraps around.
 */
const SPOKES = [6, 5, 4, 3, 2, 1].map(makeSpoke);

/**
 * Where the closeup is in the star's coordinates.
 * The arcs and the chords all stay inside this box, with room for the line width.
 */
const CLOSEUP_BOUNDS: ReadOnlyRect = {
  x: TOP.x - VISIBLE_LENGTH,
  y: TOP.y - 0.1 * VISIBLE_LENGTH,
  width: 2 * VISIBLE_LENGTH,
  height: 1.1 * VISIBLE_LENGTH,
};

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

// MARK: Pairings

/** Two spokes, as indices into {@link SPOKES}, smaller first. */
type Pair = readonly [number, number];

/** A way to pair off all 6 spokes:  the 3 ways a circuit passes through the vertex. */
type Pairing = readonly [Pair, Pair, Pair];

/**
 * All 15 ways to pair off the 6 spokes, in the order they appear on the screen.
 *
 * The leftmost spoke has 5 possible partners, one per column.
 * The remaining 4 spokes have 3 ways to pair off, one per row:
 * neighbors, crossed, nested.
 * 5 × 3 = 15.
 */
const PAIRINGS = [1, 2, 3, 4, 5].flatMap((partner): Pairing[] => {
  const [a, b, c, d] = [1, 2, 3, 4, 5].filter((index) => index != partner);
  const first: Pair = [0, partner];
  return [
    [first, [a, b], [c, d]],
    [first, [a, c], [b, d]],
    [first, [a, d], [b, c]],
  ];
});

const COLUMNS = 5;
const ROWS = 3;

/**
 * The direction each spoke leaves the top vertex, in units of π/7 below the tangent:
 * 7, 5, 4, 3, 2, 0.
 * A chord to vertex k leaves at kπ/7, half the arc it cuts off.
 * Integers, so ties compare exactly.
 */
const SPOKE_ANGLES = SPOKES.map((spoke) => {
  const { x, y } = spoke.direction(0);
  return Math.round((Math.atan2(y, x) * 7) / Math.PI);
});

/** The angle between the two spokes. */
function span([a, b]: Pair) {
  return SPOKE_ANGLES[a] - SPOKE_ANGLES[b];
}

/** True if one pair surrounds the other, or they cross.  Then they can't both stay at the vertex. */
function inTheWay(p: Pair, q: Pair) {
  return !(p[1] < q[0] || q[1] < p[0]);
}

/**
 * How many steps each pair moves away from the vertex.
 *
 * The widest pair stays closest.  A surrounding pair is always wider than the pair inside it,
 * so the inside pair always moves further.  Of two crossing pairs, the wider one stays closer,
 * so they cross away from the vertex.  Pairs side by side don't affect each other.
 * @returns One level per pair, in the same order as `pairing`.
 */
function levels(pairing: Pairing): number[] {
  const widestFirst = [0, 1, 2].sort(
    (i, j) =>
      span(pairing[j]) - span(pairing[i]) || pairing[i][0] - pairing[j][0],
  );
  const result = [0, 0, 0];
  widestFirst.forEach((i, position) => {
    for (const j of widestFirst.slice(0, position)) {
      if (inTheWay(pairing[i], pairing[j])) {
        result[i] = Math.max(result[i], result[j] + 1);
      }
    }
  });
  return result;
}

/** For the "Pair" choice of the Colors schedule. */
const PAIR_COLORS = [myRainbow.yellow, myRainbow.cyan, myRainbow.magenta];

// MARK: Component

/**
 * Closeups of the top vertex of the star, one for each way an Euler circuit can pass through it.
 *
 * Six edges meet at each vertex, and a circuit visits each vertex three times.
 * Each visit comes in on one edge and leaves on another, so a circuit pairs off the six edges.
 * There are 15 ways to do that, all shown at once in a 5 × 3 grid.
 *
 * Each pair's corner is rounded, so you can see which edge continues into which.
 * Pairs inside other pairs, or crossing wider pairs, get rounded more, to get out of the way.
 * Each edge keeps its own color up to the middle of the turn.
 * With nothing rounded, every pairing looks the same:  six lines meeting at a point.
 *
 * Not in the component registry.  Add it to a parent with `add()`, as a fixed child.
 */
export class VertexPairings implements Showable {
  readonly description: string;
  readonly duration = 0;
  /** All 15 closeups fit inside this, in 5 columns and 3 rows. */
  readonly destRectSchedule = new RectangleScheduleInfo("Dest Rect", {
    x: 0.5,
    y: 1.5,
    width: 15,
    height: 6,
  });
  /**
   * How much of each visible edge to replace with a curve, for pairs that don't have to get out of anyone's way.
   * 0 for sharp corners.  1 to replace the entire visible part of each edge.
   */
  readonly roundingSchedule = new NumberScheduleInfo("Rounding", 0.3);
  /**
   * Added to the Rounding for each step a pair moves out of the way.
   * See {@link levels}.
   */
  readonly roundingStepSchedule = new NumberScheduleInfo(
    "Rounding Step",
    0.25,
  );
  /** "Edge type" uses the star's colors.  "Pair" gives each pair its own color. */
  readonly colorsSchedule = new SelectScheduleInfo("Colors", "Edge type", [
    "Edge type",
    "Pair",
  ]);
  readonly circleColorSchedule = new ColorScheduleInfo(
    "Circle Color",
    myRainbow.red,
  );
  /** The long chords, {7/3}. */
  readonly thinStarColorSchedule = new ColorScheduleInfo(
    "Thin Star Color",
    "white",
  );
  /** The short chords, {7/2}. */
  readonly fatStarColorSchedule = new ColorScheduleInfo(
    "Fat Star Color",
    myRainbow.myBlue,
  );
  readonly lineWidthSchedule = new NumberScheduleInfo("Line Width", 0.05);
  readonly schedules = [
    this.destRectSchedule,
    this.roundingSchedule,
    this.roundingStepSchedule,
    this.colorsSchedule,
    this.circleColorSchedule,
    this.thinStarColorSchedule,
    this.fatStarColorSchedule,
    this.lineWidthSchedule,
  ] as const;
  constructor(
    initialValues: {
      description?: string;
      destRect?: ReadOnlyRect | readonly Keyframe<ReadOnlyRect>[];
      rounding?: number | readonly Keyframe<number>[];
      roundingStep?: number | readonly Keyframe<number>[];
      lineWidth?: number | readonly Keyframe<number>[];
    } = {},
  ) {
    this.description = initialValues.description ?? "Vertex Pairings";
    if (initialValues.destRect !== undefined)
      this.destRectSchedule.set(initialValues.destRect);
    if (initialValues.rounding !== undefined)
      this.roundingSchedule.set(initialValues.rounding);
    if (initialValues.roundingStep !== undefined)
      this.roundingStepSchedule.set(initialValues.roundingStep);
    if (initialValues.lineWidth !== undefined)
      this.lineWidthSchedule.set(initialValues.lineWidth);
  }
  show({ context, timeInMs }: ShowOptions) {
    const destRect = this.destRectSchedule.at(timeInMs);
    const rounding = this.roundingSchedule.at(timeInMs);
    const roundingStep = this.roundingStepSchedule.at(timeInMs);
    const byPair = this.colorsSchedule.at(timeInMs) == "Pair";
    const colorByDistance = [
      undefined,
      this.circleColorSchedule.at(timeInMs),
      this.fatStarColorSchedule.at(timeInMs),
      this.thinStarColorSchedule.at(timeInMs),
    ];
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = this.lineWidthSchedule.at(timeInMs);
    const cellWidth = destRect.width / COLUMNS;
    const cellHeight = destRect.height / ROWS;
    /** Space around each closeup, as a fraction of its cell. */
    const margin = 0.1;
    PAIRINGS.forEach((pairing, index) => {
      const column = Math.floor(index / ROWS);
      const row = index % ROWS;
      const fit = panAndZoom(
        CLOSEUP_BOUNDS,
        {
          x: destRect.x + (column + margin) * cellWidth,
          y: destRect.y + (row + margin) * cellHeight,
          width: (1 - 2 * margin) * cellWidth,
          height: (1 - 2 * margin) * cellHeight,
        },
        "meet",
      );
      const pairLevels = levels(pairing);
      pairing.forEach((pair, pairIndex) => {
        const spokes = pair.map((spokeIndex) => SPOKES[spokeIndex]);
        /** Where the curve meets each edge, measured along the edge. */
        const cut =
          VISIBLE_LENGTH *
          Math.min(
            1,
            Math.max(0, rounding + pairLevels[pairIndex] * roundingStep),
          );
        const ends = spokes.map((spoke) => spoke.at(cut));
        const control = tangentIntersection(
          ends[0],
          spokes[0].direction(cut),
          ends[1],
          spokes[1].direction(cut),
        );
        // Split the quadratic in half, so each edge keeps its color up to the middle of the turn.
        const middle: Point = {
          x: (ends[0].x + 2 * control.x + ends[1].x) / 4,
          y: (ends[0].y + 2 * control.y + ends[1].y) / 4,
        };
        spokes.forEach((spoke, side) => {
          const end = ends[side];
          const halfCurve = PathBuilder.M(middle.x, middle.y).Q(
            (control.x + end.x) / 2,
            (control.y + end.y) / 2,
            end.x,
            end.y,
          ).pathShape;
          const straight = spoke.piece(cut, VISIBLE_LENGTH);
          const path = new PathShape([
            ...(cut > 0 ? halfCurve.commands : []),
            ...(cut < VISIBLE_LENGTH ? straight.commands : []),
          ]);
          context.strokeStyle = byPair
            ? PAIR_COLORS[pairIndex]
            : colorByDistance[spoke.distance]!;
          // Transform the path, not the context, so the line width isn't scaled.
          context.stroke(path.transform(fit).canvasPath);
        });
      });
    });
  }
}
