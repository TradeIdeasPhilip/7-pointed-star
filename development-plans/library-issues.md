# canvas-recorder-lib issues

Things this project ran into with canvas-recorder-lib.  It's on 0.7.2 now.
None of them block this project.  We'll go through them together when the video is done.

Fixed in 0.6.0, and removed from this list:  1, 2, 4, 5, 6, 9, 12, 14, 16, 17, 18 and 19.
Fixed in 0.7.2, and removed:  10, `samplesFromParametric()` repeating the first point.  The "circle" source is now exactly one term.
The numbers aren't reused, so `circuit-editor.md`'s "item 15" still means the same thing.

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
15. **A project's own component can't add a Visual Editor panel.**  Wanted, not needed.  Second priority, after item 23.
   The library's own panels are a hand-written list in `updateScheduleEditor()` in `dev/canvas-recorder.ts`, one `instanceof` each:  `FourierComponent`, `MultiTextComponent`, and so on.  Star Circuit isn't on it.
   The only general hook is `Showable.rootComponentEditor`:  a panel for whatever is chosen in the Edit list.
   Since 2026-11-08, this project uses that as a stopgap.  `src/editor-messages.ts` shows Star Circuit's warnings, and the vertex editor will go there too.  The limits:
   * It sits above the component list, top right, not next to the component's properties, bottom right.
   * It only exists where we attach it:  `addScene()` does the root and each scene.  Anything else chosen in the Edit list, or another project, has none.
   * Its times are the chapter's, not the component's.  The same thing for a Star Circuit sitting directly in a scene.
   Plan:  the same interface on any Showable, as an optional `editorPanel` field.  See `editor-panels.md`, which starts with the priorities and reasons.
   Moving to it changes only the wiring in `editor-messages.ts`.
23. **A panel can't save a property it changes.**  Needed for the vertex editor (`circuit-editor.md`).  First priority, and small.
   After changing a property, a `rootComponentEditor` panel tells the editor with `VisualEditorAPI.refreshGUI()`.  In `dev/canvas-recorder.ts` (`const visualEditorAPI`, about line 1842):
   * `"properties"` rebuilds the property tables, but never calls `markDirty()`.  So the change isn't saved, to IndexedDB or to `properties/`, unless some later edit saves it.  A reload loses it.
   * `"structure"` saves, but also sets `selectedSlideChild = null`.  So after every click in the panel, the selection jumps back to the scene.
   Fix:  make `"properties"` call `markDirty()`, as the library's own panels do after a change (Handwriting's `progressChanged()`, Image File's `urlChanged()`).
   Check that it records an undo step too.  Or add the `propertyChanged(property)` call that `editor-panels.md` proposes.
20. **A project with more than one video has to write its own menu.**
   canvas-recorder had `?toShow=` and a list of links built in.  In this library, `canvasRecorder.start()` takes one Showable, so this project's `src/main.ts` does it, in about 30 lines.
   That part is fine, and it's a good pattern to copy.  Maybe something like `canvasRecorder.startMenu()`, and a section in the README.
   The player has no link back to the menu.  This project's menu opens each video in a new tab instead.

## Bugs

21. **The player's sessionStorage isn't kept per video.**
   The keys in `dev/canvas-recorder.ts` are plain names:  `"index"`, `"timeInSeconds"`, `"zoomSelect"`, `"panX"` and so on.
   Open one video, then another in the same tab, and the second opens at the first one's chapter number and time.
   In this project, choosing Three Circuits in the main video made the Shorts video open on Scratch 3, with the play range of that chapter.
   `"pendingScheduleSave"` is shared too.  Its backup carries the video's key, so the wrong video won't apply it, but the next load clears it, so a backup for the first video is lost.
   The IndexedDB write usually covers that.  The comments say a dirty preview's content lives only in the backup.
   Fix:  add `startRequest.name` to every sessionStorage key, the way `videoSizeStorageKey` does for localStorage.
25. **Clicking a block on the timeline doesn't tell the root panel.**  Found 2026-11-10, in 0.7.2.
   `timelineDisplay.onBlockClick` in `dev/canvas-recorder.ts` (about line 2456) sets `selectedSlideChild` and rebuilds the property tables,
   but never calls `activeRootComponentEditor?.selectionChanged(child)`.  Every other way of selecting does:
   the ✎ button in the component list, and `selectInChapter()`, which the same handler already uses for sound clips.
   Seen here:  choose Three Circuits, click Circuit 2's block, and the property editor shows Circuit 2, but `editor-messages.ts` stays hidden.
   It catches up at the next `update()`, which any input event sends.  So typing in Min Duration makes it appear.
   Fix:  one line in `findIn()`, after `updateScheduleEditor(child)`:  `activeRootComponentEditor?.selectionChanged(child);`.
   Smaller, maybe:  dragging a block's edge changes Min Duration (or the start, for a Padding) without calling `update()`.
   It is saved:  those are notifying scalars, so `scheduleHasChanged()` reaches the root, which calls `markDirty()`.
   Nothing in this project's panel depends on duration, so the missing `update()` doesn't show here.
22. **The Paste button's tooltip uses the wrong name.**
   A child row's button says `Paste into "Slide"`, from `child.description`, while the row itself says "Pan and Scan", from `userEditableDescription`.

24. **Two modules need the browser when they load,** so the library's pure math can't run in plain Node.
   * `glib/transforms` calls its own `runTests()` at the bottom of the module, and that calls `panAndZoom()`, which calls `new DOMMatrix()`.
     `glib/path-shape` imports it, so anything that uses PathShape fails with "DOMMatrix is not defined",
     including the Fourier math in `peano-fourier/fourier-shared`, which is otherwise pure.
   * `glib/line-font` builds a font when it loads, and that calls `new DOMMatrixReadOnly()` (about line 746 of the built file).
     The library's main entry loads it, so `import … from "canvas-recorder-lib"` fails in Node even with the shim below.
   This project's `scripts/node-dom.ts` supplies a small 2D DOMMatrix, which covers the first one.  Don't grow it to cover the second:  fix the library instead.
   Fix:  move the self-test into a test file, and build the font the first time it's used.
   Then a short Node script in the library's build that imports `path-shape` and `fourier-shared` would keep it that way.
   Then delete `node-dom.ts`.
   The rule in `editor-panels.md`, "a module never touches the DOM while it loads", is the same idea.
   A tsconfig with no DOM types for `scripts/` would be the stricter check, but phil-lib's `misc.ts` mixes DOM helpers with math like `positiveModulo()`,
   and it ships as TypeScript source, so `skipLibCheck` doesn't skip it.  That config fails until phil-lib splits that file.

## Build

11. **A warning in every production build:**  `"use restrict"` in `node_modules/bit-twiddle`, a MODULE_LEVEL_DIRECTIVE warning.
   It comes from `fft-js`, which the library uses for the Fourier transforms.
   Harmless, but it shows up in every project's `npm run build`.
