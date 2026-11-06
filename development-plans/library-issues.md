# canvas-recorder-lib issues

Things this project ran into with canvas-recorder-lib.  It's on 0.6.0 now.
None of them block this project.  We'll go through them together when the video is done.

Fixed in 0.6.0, and removed from this list:  1, 2, 4, 5, 6, 9, 12, 14, 16, 17, 18 and 19.
The numbers aren't reused, so `circuit-editor.md`'s "item 15" still means the same thing.

## Setup and docs

3. **There's no list of the files a new project needs.**
   This project copied them from affine-transforms and simple-video-editor:  `package.json`, `tsconfig.json`, `vite.config.js`, `index.html`, `public/icon.png`, `.gitignore` and `properties/README.md`.
   And `.github/workflows/deploy.yml` from riemann-surfaces-3d, for GitHub Pages.  The README mentions a GitHub Pages deploy, but doesn't show one.

## API

7. **Saved editor state disappears when the root changes.**
   The editor matches saved state to the live tree by `description`, starting at the root (`applyTree()` in `src/snapshot.ts`).
   This project wrapped its old root in a new `InSeriesComponent`, with a new description, so the saved state no longer matches anything.
   The editor ignores it without a warning, and the next save replaces it.
   Decided:  no code change.  It's a rare case, and saved state that matters should be saved to `properties/`, where the JSON can be fixed by hand.
   Maybe a sentence in the README.

8. **FourierComponent can only draw into its own Dest Rect.**
   The Circuit Grid draws 4 Fourier animations into the cells of a Lattice, so it repeats about 30 lines of FourierComponent:
   `samplesToFourier()`, `parseTermGroups()`, `orderTerms()`, and the Step arithmetic.
   A function that takes a source, Term Groups, Step and a rectangle, and returns the path, would let any component do this.
13. **A multi-color Fourier needs copies of two library functions.**
   `src/colored-fourier.ts` draws each frame in pieces by `t`, each piece in its own color.  That needs two things the library computes but doesn't return:
   * Where each command's samples start.  `samplesFromPath()` knows, but only returns the samples.  The copy is `samplesWithStarts()`.
   * Each frame as a function of `t`, not a finished PathShape.  `getAnimationRules()` builds that function and turns it into a path right away.  The copy is `getFrameRules()`.
   Both copies are faithful, so the curves, timing and segment counts match the library's.
   `makeEasing()` is private in fourier-shared.ts, so it's copied too.
   If the library returned these, `FourierComponent.drawPath()` could offer a hook for coloring by `t`.
15. **A project's own component can't add a Visual Editor panel, or a warning.**
   The custom panels are a hand-written list in `dev/canvas-recorder.ts`, by class:  `instanceof FourierComponent`, `MultiTextComponent`, and so on.
   Star Circuit wants to show its own messages, and eventually a panel for choosing a circuit one vertex at a time.  See `circuit-editor.md`.
   The only general hook is `Showable.rootComponentEditor`, and only for a root.
   Plan:  the same interface on any Showable, as an optional `editorPanel` field.  See `editor-panels.md`.

## Bugs

10. **`samplesFromParametric()` repeats the first point on closed curves.**
   It uses `t = i / (N - 1)`, so sample N-1 is at t = 1, the same point as sample 0.
   For a closed curve, `i / N` would space the samples evenly.
   This project doesn't use it.
   Planned for the library's 1.0.0:  see its `development-plans/release-1.0.md`.

## Build

11. **A warning in every production build:**  `"use restrict"` in `node_modules/bit-twiddle`, a MODULE_LEVEL_DIRECTIVE warning.
   It comes from `fft-js`, which the library uses for the Fourier transforms.
   Harmless, but it shows up in every project's `npm run build`.
