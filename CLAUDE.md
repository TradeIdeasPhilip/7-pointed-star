# CLAUDE.md

A video of Fourier decompositions of Euler circuits on a 7 pointed star, built on canvas-recorder-lib.
The author makes math videos for a 3b1b / SoME audience.

## The star

7 vertices on the unit circle, every pair connected:  21 edges, 6 at each vertex.

- Step 1 (neighbors):  arcs of the circle.  Default color `myRainbow.red`.
- Step 2:  the fat star {7/2}, short chords.  Default `myRainbow.myBlue`.
- Step 3:  the thin star {7/3}, long chords.  Default `"white"`.

Vertices are only where the lines meet the circle, never where chords cross.
A path is an Euler circuit:  every edge exactly once.
Canonical form:  start at 0, go to 1 first, end at 0.  That names each loop once, whatever its start or direction.

How many there are (`npm run count-circuits`, about 50 seconds):
64,988,160 circuits; 9,284,028 after removing rotations; 4,642,014 after also removing mirror images.
Too many to keep in memory or in a `Set` (V8 caps a Set at 2^24 entries).  Generate them, and filter with `makeCanonicalTest()`.

The idea came from random-svg-tests/src/fourier-smackdown.ts:  `Edge`, `Progress` (DFS, `getUnique()`), `ShapeMaker5`, `ShapeMaker6`.
That code did the pentagram (132 circuits, 28 unique) and the hexagram (372, 66), and the count script reproduces those numbers.

## Commands

```bash
npm run dev             # Vite dev server on http://localhost:5178 (fixed port; the editor's saved state is per origin)
npm run build           # tsc + vite build → dist/ (gitignored)
npm run count-circuits  # Count the Euler circuits for 5, 6 and 7 points.  Plain Node, no browser.
```

No test runner, no linter.  TypeScript errors surface in the IDE and on `npm run build`.

## Layout

- `src/main.ts`:  the root, an InSeriesComponent of scenes.  Each scene is a fixed child with its own black background.  Starts the editor with `name: "7-pointed-star"`.
  1. "7 Pointed Star":  the Fourier star and the colorful star.
  2. "Vertex Pairings":  closeups of the top vertex.
  The editor matches saved state by description, starting at the root.  Renaming or wrapping the root drops the saved state.
- `src/euler-circuits.ts`:  graph math only, no imports, so Node can run it.  Hand picked circuits (`GROUPED_7`, `INTERLEAVED_7`), the search, the duplicate filter.
  Node only strips types, so this file (and `scripts/`) can't use enums or constructor parameter properties.  `erasableSyntaxOnly` in tsconfig enforces that.
- `src/star-path.ts`:  circuit → `PathShape`, plus a record of which commands came from which edge.  Those records say where each color starts and stops.
- `src/star-sources.ts`:  registers the circuits as `FourierComponent.sources`.  Import it before constructing any FourierComponent.
- `src/colorful-star.ts`:  the finished picture in three colors, not animated.  A fixed child, not in the component registry.
- `src/vertex-pairings.ts`:  all 15 ways to pair off the 6 edges at the top vertex, in a 5 × 3 grid.  Rounded corners show which edge continues into which.
  "Rounding" and "Rounding Step" are schedules.  For reference images only, never mixed with a Fourier animation.
- `scripts/count-circuits.ts`:  the counts above.
- `properties/`:  the editor's saved state, written there so it's in git.  See `properties/README.md`.
- `library-issues.md`:  problems found in canvas-recorder-lib.  Add to it; don't stop to fix the library unless it's urgent.

## Next:  a multi-color Fourier

Each frame of the Fourier animation drawn in pieces, by parameter range, each piece the color of the edges it becomes.
The plan:

1. A copy of the library's `samplesFromPath()` that also returns each command's first sample index.
   Sample i is at t = i / N, so each edge starts at a known t.  Merge neighboring edges of the same color into runs.
2. A copy of `getAnimationRules()` that returns the parametric function for each frame, instead of a finished PathShape.
   Draw each run [t₀, t₁] with `PathShape.glitchFreeParametric()`, butt line caps.
3. Watch for:  in the last steps the corners are nearly sharp, so a color change at a corner with butt caps may leave a notch.

The same idea would let a Fourier of several open pieces skip, or fade, the connecting lines that close it.

## The library

`package.json` depends on the published `canvas-recorder-lib` from npm.  Never `file:../canvas-recorder-lib`:  GitHub's build machine has no `../`.
The source is at `../canvas-recorder-lib`, the master copy of the tooling.  Its CLAUDE.md and README explain the library.
To try a library change here, `npm link ../canvas-recorder-lib`, and keep `npm run watch` running in the library.
Any `npm install` or `npm ci` puts the published copy back.  `npm ls canvas-recorder-lib` shows which one is in use.

Import the main object and common components from `canvas-recorder-lib`; anything else by path,
e.g. `canvas-recorder-lib/src/glib/path-shape` or `canvas-recorder-lib/src/slide-components/fourier`.

## Comments

The user likes JSDoc style comments and VS Code's "MARK:" style comments.
