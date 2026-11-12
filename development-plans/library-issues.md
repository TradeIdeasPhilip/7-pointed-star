# canvas-recorder-lib issues

Things this project ran into with canvas-recorder-lib.  It's on 0.7.4 now.
None of them block this project.  We'll go through them together when the video is done.

Fixed in 0.6.0, and removed from this list:  1, 2, 4, 5, 6, 9, 12, 14, 16, 17, 18 and 19.
Fixed in 0.7.2, and removed:  10, `samplesFromParametric()` repeating the first point.  The "circle" source is now exactly one term.
Fixed in 0.7.3, and removed:
* 15, a project's own Visual Editor panel.  Now `Showable.editorPanel`, and `canvasRecorder.addEditorPanel()` for any component, the library's included.
* 23, a panel's change wasn't saved.  Now `refreshGUI("properties")` saves, and so does the new `EditorPanelAPI.propertyChanged()`.
* 25, a click on a timeline block didn't call `selectionChanged()`.
Fixed in 0.7.4, and removed:  30, a reload during startup saved the TypeScript defaults over your work.
The page now saves nothing until it has finished loading, and keeps the last session's backup until then.
What's next for our panels:  the top of `editor-panels.md`.
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
20. **A project with more than one video has to write its own menu.**
   canvas-recorder had `?toShow=` and a list of links built in.  In this library, `canvasRecorder.start()` takes one Showable, so this project's `src/main.ts` does it, in about 30 lines.
   That part is fine, and it's a good pattern to copy.  Maybe something like `canvasRecorder.startMenu()`, and a section in the README.
   The player has no link back to the menu.  This project's menu opens each video in a new tab instead.
28. **A console command can't save without a panel.**  Wanted, small.  Found 2026-11-10, in 0.7.3.
   `philDebug.VisualEditor` has the root, the selection and the time, but no way to save.
   So `saveOutsideChanges()` in `editor-messages.ts` borrows a root panel's `VisualEditorAPI`, and only works in a chapter where `addScene()` attached one.
   Once the messages move to `addEditorPanel()` (`editor-panels.md`), that's the only reason left for the root panels.
   The planned button panels for these scripts won't need it:  they save through their own `EditorPanelAPI`.  Only typing on the console will.
   Fix:  add `refreshGUI()` to `philDebug.VisualEditor`.

## Bugs

21. **The player's sessionStorage isn't kept per video.**
   The keys in `dev/canvas-recorder.ts` are plain names:  `"index"`, `"timeInSeconds"`, `"zoomSelect"`, `"panX"` and so on.
   Open one video, then another in the same tab, and the second opens at the first one's chapter number and time.
   In this project, choosing Three Circuits in the main video made the Shorts video open on Scratch 3, with the play range of that chapter.
   `"pendingScheduleSave"` is shared too.  Its backup carries the video's key, so the wrong video won't apply it, but the next load clears it, so a backup for the first video is lost.
   The IndexedDB write usually covers that.  The comments say a dirty preview's content lives only in the backup.
   Fix:  add `startRequest.name` to every sessionStorage key, the way `videoSizeStorageKey` does for localStorage.
   Changed in 0.7.3, not tested here:  the chapter is now saved as a path of names (`"place"`), not a number.
   So the other video opens on the chapter with the same name, if it has one, or else on the whole video.
   Both of this project's videos have Scratch 1 to 13, so those still carry over.  The keys are still shared, so the time, the zoom and the backup do too.
26. **Line Width 0 doesn't hide the line.**  Found 2026-11-10, in 0.7.2.
   The canvas ignores a `lineWidth` of 0 or less, and keeps the last one set.
   `FourierComponent.drawPath()` (`src/slide-components/fourier.ts`, about line 506) sets it from Line Width and always strokes, so 0 draws at whatever width came before.
   Fix:  skip the stroke when Line Width isn't above 0, and skip everything when the fill is also `"transparent"`.  Then 0 is a free way to turn one off.
   Star Circuit does this now (`setLineWidth()` in `star-circuit.ts`).
27. **An empty term group is a warning, but it's a technique.**  Found 2026-11-10.
   `parseTermGroups()` warns "Group N is empty, so that step adds nothing."
   Empty groups are how several Fourier animations stay in step while one waits (`term-ordering.md`, Hold back three).
   Each of Scratch 4's eight Star Circuits shows two or three of these warnings.
   Fix:  make it a note, or say nothing.  An empty *first* group might still deserve a note.
29. **The showcase's Freaky Dots never worked, for two reasons.**  Found 2026-11-11.
   `test-project/src/showcase/freaky-dots.ts`, commented out as "NOT READY FOR PRIME TIME".
   * Its three layers are three different sets of random dots.  The circles only appear when they're the same dots, turned a little against each other, as the SVG version's three copies of one filter were.
   * It calls `path.ellipse()` with no `moveTo()` first, so each ellipse joins the last one with a straight line.  Each layer is filled as one huge self-crossing polygon.  That's the CPU cost, too.
   This project's `src/freaky-dots.ts` works, at about 1.5 ms a frame in 4K.  The showcase could copy it, or drop the slide.
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
