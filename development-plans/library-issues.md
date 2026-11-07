# canvas-recorder-lib issues

Things this project ran into with canvas-recorder-lib.  It's on 0.6.0 now.
None of them block this project.  We'll go through them together when the video is done.

Fixed in 0.6.0, and removed from this list:  1, 2, 4, 5, 6, 9, 12, 14, 16, 17, 18 and 19.
The numbers aren't reused, so `circuit-editor.md`'s "item 15" still means the same thing.

## Setup and docs

3. **There's no list of the files a new project needs.**
   Note:  The samples in the same repository as the library are not suitable for copying as is for multiple reasons.
   Currently the best place to get started is to [degit](https://github.com/Rich-Harris/degit) this project.
   There are some other sample projects in work, but this one is currently in the best shape.
   The readme should point to one or more good examples.

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
20. **A project with more than one video has to write its own menu.**
   canvas-recorder had `?toShow=` and a list of links built in.  In this library, `canvasRecorder.start()` takes one Showable, so this project's `src/main.ts` does it, in about 30 lines.
   That part is fine, and it's a good pattern to copy.  Maybe something like `canvasRecorder.startMenu()`, and a section in the README.
   The player has no link back to the menu.  This project's menu opens each video in a new tab instead.

## Bugs

10. **`samplesFromParametric()` repeats the first point on closed curves.**
   It uses `t = i / (N - 1)`, so sample N-1 is at t = 1, the same point as sample 0.
   For a closed curve, `i / N` would space the samples evenly.
   This project doesn't use it.
   Planned for the library's 1.0.0:  see its `development-plans/release-1.0.md`.
21. **The player's sessionStorage isn't kept per video.**
   The keys in `dev/canvas-recorder.ts` are plain names:  `"index"`, `"timeInSeconds"`, `"zoomSelect"`, `"panX"` and so on.
   Open one video, then another in the same tab, and the second opens at the first one's chapter number and time.
   In this project, choosing Three Circuits in the main video made the Shorts video open on Scratch 3, with the play range of that chapter.
   `"pendingScheduleSave"` is shared too.  Its backup carries the video's key, so the wrong video won't apply it, but the next load clears it, so a backup for the first video is lost.
   The IndexedDB write usually covers that.  The comments say a dirty preview's content lives only in the backup.
   Fix:  add `startRequest.name` to every sessionStorage key, the way `videoSizeStorageKey` does for localStorage.
22. **The Paste button's tooltip uses the wrong name.**
   A child row's button says `Paste into "Slide"`, from `child.description`, while the row itself says "Pan and Scan", from `userEditableDescription`.

## Build

11. **A warning in every production build:**  `"use restrict"` in `node_modules/bit-twiddle`, a MODULE_LEVEL_DIRECTIVE warning.
   It comes from `fft-js`, which the library uses for the Fourier transforms.
   Harmless, but it shows up in every project's `npm run build`.
