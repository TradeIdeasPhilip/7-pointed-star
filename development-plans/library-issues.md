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
16. **The rule for user errors isn't written down.**
   Not in the library's CLAUDE.md or README.  The author has explained it in several conversations.
   This project's CLAUDE.md now has it, under "User errors".  The library's CLAUDE.md, and the README's "Register your own components", should say the same.

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

8. **FourierComponent can only draw into its own Dest Rect.**
   The Circuit Grid draws 4 Fourier animations into the cells of a Lattice, so it repeats about 30 lines of FourierComponent:
   `samplesToFourier()`, `parseTermGroups()`, `orderTerms()`, and the Step arithmetic.
   A function that takes a source, Term Groups, Step and a rectangle, and returns the path, would let any component do this.
9. **`LatticeValue` isn't exported from the package root,** although `LatticeScheduleInfo` is.
   A component that takes a lattice in its constructor needs `canvas-recorder-lib/src/lattice` for the type.
13. **A multi-color Fourier needs copies of two library functions.**
   `src/colored-fourier.ts` draws each frame in pieces by `t`, each piece in its own color.  That needs two things the library computes but doesn't return:
   * Where each command's samples start.  `samplesFromPath()` knows, but only returns the samples.  The copy is `samplesWithStarts()`.
   * Each frame as a function of `t`, not a finished PathShape.  `getAnimationRules()` builds that function and turns it into a path right away.  The copy is `getFrameRules()`.
   Both copies are faithful, so the curves, timing and segment counts match the library's.
   `makeEasing()` is private in fourier-shared.ts, so it's copied too.
   If the library returned these, `FourierComponent.drawPath()` could offer a hook for coloring by `t`.
14. **A replaceable child's `description` doesn't survive a reload.**
   When the editor loads saved state, it rebuilds replaceable children from the registry (`buildComponents()` in serialize.ts), so whatever `description` the TypeScript gave the constructor is replaced by the registry's default.
   Slide 1's "Star Fourier" probably shows as "Fourier" after a reload.
   `userEditableDescription` is saved, so this project sets that instead (`named()` in main.ts).
   Maybe a sentence in the README, next to "Register your own components".
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
17. **`SlowImage.showError()` throws on an empty rectangle.**
   `if (width <= 0 || height <= 0) throw new Error("wtf")`, in `src/slow-image-sources.ts`.
   It's what an image or video draws while it can't show itself, so a Dest Rect with no width, while the file is loading or missing, probably throws from `show()`.
   Not tried in the GUI.  Drawing nothing would fit the rule for user errors.
19. **The diff file (`<name>.txt`) prints every replaceable child, changed or not.**
   In `buildDiffText()` in `dev/canvas-recorder.ts`, `diffNode()` compares fixed children property by property, but for replaceable children it just prints them all (`if (currentComponents.length > 0)`), as code.
   It never looks at the TypeScript defaults' `components`.  That made sense when every replaceable child had been added in the GUI.
   This project starts every scene with a replaceable Background, so all 8 scenes show up, plus Star Fourier, Circuit Grid, the Star Circuits and the labels:
   120 lines, when the real change was 2 properties.  The saved `.json` is fine:  it only has the one scene that changed.
   Fix:  print nothing when the list matches the defaults.  When the list has the same components in the same order, print property differences, like a fixed child.  Otherwise print the whole list, as now.

## Build

11. **A warning in every production build:**  `"use restrict"` in `node_modules/bit-twiddle`, a MODULE_LEVEL_DIRECTIVE warning.
   It comes from `fft-js`, which the library uses for the Fourier transforms.
   Harmless, but it shows up in every project's `npm run build`.

## Comments

12. **`cacheHealth` needs a comment.**
   `const cacheHealth = { miss: 0, hit: 0 }` in `src/peano-fourier/fourier-shared.ts`, shown as `philDebug.cacheHealth`, comes up in every search for how the Fourier code caches.
   It only counts hits and misses in the small cache inside `termsToParametricFunction()`:  one `Map` from `t` to a point, for each function it returns.
   That cache helps because `addParametricPath()` estimates each sample's direction from `f(t ± ε)`, and the same `t` values come back every frame.
   The comment should say so, and that it's probably not what you're looking for.  The real caches are `#termsCache` and `#animationCache` in `FourierComponent`.
   Related:  that `Map` never removes anything.  While the dot grows into the first curve, `t` is scaled by `safePartEnds`, which changes every frame, so each frame adds a few hundred new entries.
   They're freed when the animation cache is replaced.  Not a problem yet.
18. **Two comments still describe the old run-in-Node rule.**
   `src/slow-image-sources.ts`:  "All code in /src should (ideally) be able to run in node.js or in a browser thread."
   `src/utility.ts` mentions tsx too.  The rule now:  no module touches the DOM while it loads.  See `editor-panels.md`.
