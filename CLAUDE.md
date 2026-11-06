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
npm run find-vertex-types  # How common each vertex pairing is, and pairs of circuits that show every kind.  About 25 seconds.
npm run pick-circuits   # Some circuits picked at random, the same ones each time.  About 25 seconds.
```

No test runner, no linter.  TypeScript errors surface in the IDE and on `npm run build`.

## Publishing

Every push to `master` builds the site and publishes it to GitHub Pages:  https://tradeideasphilip.github.io/7-pointed-star/
The workflow is `.github/workflows/deploy.yml`, copied from riemann-surfaces-3d.
`dist/` is never committed.  To redeploy without a new commit:  Actions → Deploy to GitHub Pages → Run workflow.

One-time setup, in the GitHub repo:  Settings → Pages → Build and deployment → Source:  GitHub Actions.

`npm run build` runs `tsc` first, so a type error fails the deploy, and the live site keeps the last good version.
`npm ci` on GitHub uses the published library, so don't deploy code that needs an unpublished library change.

## Layout

- `src/main.ts`:  the root, an InSeriesComponent of scenes.  Each scene is a fixed child with its own black background.  Starts the editor with `name: "7-pointed-star"`.
  1. "7 Pointed Star":  the Fourier star and the colorful star.
  2. "Vertex Pairings":  closeups of the top vertex.
  3. "Every Kind of Vertex":  two whole circuits with rounded corners, that between them show every kind of vertex.
  4. "Circuit Grid":  a Circuit Grid component, for trying layouts.
  5. "Three Circuits":  three Star Circuits, laid out like Peano vs Fourier, each in its own colors, plus a Multi Text label for each.
  6. "Scratch 1", "Scratch 2", "Scratch 3":  only a background.  The author fills these from the Visual Editor.
  The editor matches saved state by description, starting at the root.  Renaming or wrapping the root drops the saved state.
  The author prefers components added as replaceable children, so the Visual Editor can change or delete them, and labels separate from what they label.
  A replaceable child's constructor `description` is lost when the editor reloads it from the registry.  `named()` sets `userEditableDescription`, which is saved.
- `src/euler-circuits.ts`:  graph math only, no imports, so Node can run it.  Hand picked circuits (`GROUPED_7`, `INTERLEAVED_7`), the search, the duplicate filter.
  Node only strips types, so this file (and `scripts/`) can't use enums or constructor parameter properties.  `erasableSyntaxOnly` in tsconfig enforces that.
- `src/star-path.ts`:  circuit → `PathShape`, plus a record of which commands came from which edge.  Those records say where each color starts and stops.
- `src/star-sources.ts`:  registers the circuits as `FourierComponent.sources`.  Import it before constructing any FourierComponent.
- `src/colorful-star.ts`:  the finished picture in three colors, not animated.  A fixed child, not in the component registry.
- `src/vertex-corners.ts`:  the rounded corners at one vertex.  Shared by the next two.
  Each pair of edges gets a level:  how many pairs in its way (surrounding it, or crossing it and wider) stay closer to the vertex.
  The cut back along each edge is Corner Size × (Rounding + level × Rounding Step).  For reference images only, never mixed with a Fourier animation.
- `src/vertex-pairings.ts`:  all 15 ways to pair off the 6 edges at the top vertex, in a 5 × 3 grid, numbered 1 to 15 by rows.
  The numbers are `VERTEX_PAIRINGS_7` in `euler-circuits.ts`.  Mirror images:  2 and 6, 3 and 11, 4 and 12, 9 and 13.  So 11 kinds.
- `src/rounded-star.ts`:  one whole circuit with every corner rounded, and each vertex's pairing number.  The Circuit field picks from a short list.
  `drawRoundedCircuit()` draws a reference image into any rectangle.
- `src/colored-fourier.ts`:  the multi-color Fourier.  Each frame is drawn in pieces, by `t`, each piece the color of the edges it becomes.
  Sample i is at t = i / N, and each edge starts with a sample at its first vertex, so each run of same colored edges covers a known range of `t`.
  `samplesWithStarts()` and `getFrameRules()` are copies of the library's `samplesFromPath()` and `getAnimationRules()`, changed to expose that.
  Circle, then fat star, then thin star, with round caps, like the reference images.  Round caps leave no notch at the sharp corners of the last steps.
  `ColoredAnimations` is the animation cache each component keeps:  by circuit, thrown away when Term Groups changes.
- `src/circuit-grid.ts`:  a Lattice of circles:  Fourier, reference, Fourier, reference, in reading order.  Registered as "Circuit Grid".
  A quick tool for trying layouts.  New work goes into Star Circuit instead.
- `src/star-circuit.ts`:  one circuit, as a Fourier animation and a reference image, each in its own rectangle, in one set of colors.  Registered as "Star Circuit".
  A class meant to be extended:  override `drawFourier()` or `drawReference()` for variations, like the 3D reference image in `development-plans/3d-euler-circuits.md`.
  The Circuit field takes a name from `NAMED_CIRCUITS_7` (offered as suggestions) or the vertices in order, read by `parseCircuit7()`.
- `scripts/count-circuits.ts`:  the counts above.
- `scripts/find-vertex-types.ts`:  every pairing is equally common (K7 minus a vertex is K6, so the graph can't tell the pairings apart).
  At most 7 kinds fit in one circuit.  `EVERY_KIND_A_7` and `EVERY_KIND_B_7` are the first pair it found that shows all 11.
- `scripts/pick-circuits.ts`:  random circuits, with a fixed seed.  `RANDOM_7` came from here.
- `properties/`:  the editor's saved state, written there so it's in git.  See `properties/README.md`.
- `development-plans/`:  plans and notes, written for the author and for future sessions.
  - `library-issues.md`:  problems found in canvas-recorder-lib.  Add to it; don't stop to fix the library unless it's urgent.
  - `enumerate-all-circuits.md`:  options for computing every circuit's Fourier terms and storing them to search.  Not started.
  - `3d-euler-circuits.md`:  the author's idea for a 3D reference image.  Far in the future.
  - `circuit-editor.md`:  choosing a circuit one vertex at a time, and what to draw when the result is several loops.  Ideas only.
  - `editor-panels.md`:  a Visual Editor panel for any component, like the old `rootComponentEditor`.  A library change.  Ideas only.

## User errors

The author's rule, for every component:  a mistake in the Visual Editor is a state, not an error.
- Show a warning, in the editor or on the canvas.  Never throw, and never a dialog box.
- Save it like any other state.  Editing between two good states often passes through bad ones.
- Draw as much as still makes sense.  Values in worse shape can come back from IndexedDB or a file, so fail gracefully and make them easy to fix.
- The library's "throw when saving a file" is only for external failures, like an image or video that doesn't load.
- Assertions are still fine for the programmer's own mistakes, like the hand picked circuits checked at load time.

## The multi-color Fourier

Working in Circuit Grid and Star Circuit (`src/colored-fourier.ts`).  Slide 1's Star Fourier is still the library's one color FourierComponent.

- Where the curve crosses itself, the layer drawn last wins.  In the first steps the biggest circle is traced several times over, so it looks mostly white.
- The same idea would let a Fourier of several open pieces skip, or fade, the connecting lines that close it.
  The author wants this eventually, e.g. Peano vs Fourier's long diagonal:  thinner or less opaque, starting normal and fading as the animation goes on.
  So keep `colored-fourier.ts` general enough to reuse.

## The library

`package.json` depends on the published `canvas-recorder-lib` from npm.  Never `file:../canvas-recorder-lib`:  GitHub's build machine has no `../`.
The source is at `../canvas-recorder-lib`, the master copy of the tooling.  Its CLAUDE.md and README explain the library.
To try a library change here, `npm link ../canvas-recorder-lib`, and keep `npm run watch` running in the library.
Any `npm install` or `npm ci` puts the published copy back.  `npm ls canvas-recorder-lib` shows which one is in use.

Import the main object and common components from `canvas-recorder-lib`; anything else by path,
e.g. `canvas-recorder-lib/src/glib/path-shape` or `canvas-recorder-lib/src/glib/transforms`.

## Comments

The user likes JSDoc style comments and VS Code's "MARK:" style comments.
