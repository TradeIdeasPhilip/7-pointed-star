# canvas-recorder-lib issues

Things this project ran into with canvas-recorder-lib 0.5.0.
None of them block this project.  We'll go through them together when the video is done.

## Pending change in the library

- `canvas-recorder-lib/README.md`:  the Ports table has a new row, `| 5178 | 7-pointed-star |`.
  Not committed yet.

## Setup and docs

1. **The fsevents approval fails the first time.**
   The README's Installing section says to run `npm install-scripts approve fsevents --no-allow-scripts-pin`.
   After the first `npm install`, that fails with `ENOMATCH`, because `fsevents` isn't in `node_modules` yet, although it's in `package-lock.json`.
   A second `npm install` adds it, with a warning that it's unapproved, and then the approval works.
   `development-plans/new-project-lessons.md` mentions this for the simple-video-editor, but the README doesn't.
2. **The README's Vite snippet is missing settings.**
   It has no `base: "./"` (needed for GitHub Pages) and no `resolve.dedupe: ["phil-lib"]`.
   Already listed in `development-plans/new-project-lessons.md`.
3. **There's no list of the files a new project needs.**
   This project copied them from affine-transforms and simple-video-editor:  `package.json`, `tsconfig.json`, `vite.config.js`, `index.html`, `public/icon.png`, `.gitignore` and `properties/README.md`.
   And `.github/workflows/deploy.yml` from riemann-surfaces-3d, for GitHub Pages.  The README mentions a GitHub Pages deploy, but doesn't show one.
4. **`myRainbow.blue` doesn't exist.**
   The blue is `myRainbow.myBlue`.  There's also `cssBlue`.
   Easy to get wrong when describing colors in words.

## API

5. **`FourierComponent` isn't exported from the package root.**
   It needs `import { FourierComponent } from "canvas-recorder-lib/src/slide-components/fourier"`.
   The other common components come from `"canvas-recorder-lib"`.
6. **The corner rounding code isn't in the library.**
   `makeCornerRounder()` is in canvas-recorder's `src/corner-rounder.ts`, and the simpler `cornerRounder()` is inside the "Rounding Corners" scene in canvas-recorder's `src/showcase.ts`.
   Neither was brought into the library.
   This project's `src/vertex-corners.ts` rounds its own corners, with a quadratic whose control point is where the two tangent lines meet.  That handles arcs as well as straight lines.
   A general version would be a good fit for `src/glib/`.
7. **Saved editor state disappears when the root changes.**
   The editor matches saved state to the live tree by `description`, starting at the root (`applyTree()` in `src/snapshot.ts`).
   This project wrapped its old root in a new `InSeriesComponent`, with a new description, so the saved state no longer matches anything.
   The editor ignores it without a warning, and the next save replaces it.
   Decided:  no code change.  It's a rare case, and saved state that matters should be saved to `properties/`, where the JSON can be fixed by hand.
   Maybe a sentence in the README.

## Bugs

8. **`samplesFromParametric()` repeats the first point on closed curves.**
   It uses `t = i / (N - 1)`, so sample N-1 is at t = 1, the same point as sample 0.
   For a closed curve, `i / N` would space the samples evenly.
   This project doesn't use it.

## Build

9. **A warning in every production build:**  `"use restrict"` in `node_modules/bit-twiddle`, a MODULE_LEVEL_DIRECTIVE warning.
   It comes from `fft-js`, which the library uses for the Fourier transforms.
   Harmless, but it shows up in every project's `npm run build`.
