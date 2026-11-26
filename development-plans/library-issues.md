# canvas-recorder-lib issues

Things this project ran into with canvas-recorder-lib.  It's on 0.8.1 now.
0.8.1 (installed 2026-11-14) was fonts and Multi Text, and fixed none of these.
None of them block this project.  We'll go through them together when the video is done.

Fixed in 0.6.0, and removed from this list:  1, 2, 4, 5, 6, 9, 12, 14, 16, 17, 18 and 19.
Fixed in 0.7.2, and removed:  10, `samplesFromParametric()` repeating the first point.  The "circle" source is now exactly one term.
Fixed in 0.7.3, and removed:
* 15, a project's own Visual Editor panel.  Now `Showable.editorPanel`, and `canvasRecorder.addEditorPanel()` for any component, the library's included.
* 23, a panel's change wasn't saved.  Now `refreshGUI("properties")` saves, and so does the new `EditorPanelAPI.propertyChanged()`.
* 25, a click on a timeline block didn't call `selectionChanged()`.
Fixed in 0.7.4, and removed:  30, a reload during startup saved the TypeScript defaults over your work.
The page now saves nothing until it has finished loading, and keeps the last session's backup until then.
Fixed in 0.8.0, and removed:  31, a group that's only the frequency 0 term threw on every frame.
`samplesToFourier()` now leaves that term out unless asked with `{ keepCenter: true }`, and a step with only that term slides the curve over.
Here:  Bridged Fourier dropped its own centering, and Star Circuit keeps the term (`coloredSource()`), so its numbering and saved Term Groups don't change.
`getFrameRules()` got the same one-line fix as `getAnimationRules()`, so a Star Circuit can't throw there either.
Fixed in the library after 0.8.1 (commit 2edfe99, 2026-11-14), not published yet, and removed:  27, a warning for every empty term group.
Empty groups are still a warning, but one line now covers them all:  "Groups 2, 3, 4, 5, 6, 7 and 4 more are empty, so those steps add nothing."
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
   Keep them that way when the library changes:  0.8.0's fix for a step with only the frequency 0 term (`|| 1`) is in `getFrameRules()` too.
   `src/bridged-fourier.ts` has two more copies, of these and of `drawColoredFrame()`, on purpose for now.
   `makeEasing()` is private in fourier-shared.ts, so it's copied too.
   If the library returned these, `FourierComponent.drawPath()` could offer a hook for coloring by `t`.
20. **A project with more than one video has to write its own menu.**
   canvas-recorder had `?toShow=` and a list of links built in.  In this library, `canvasRecorder.start()` takes one Showable, so this project's `src/main.ts` does it, in about 30 lines.
   That part is fine, and it's a good pattern to copy.  Maybe something like `canvasRecorder.startMenu()`, and a section in the README.
   The player has no link back to the menu.  This project's menu opens each video in a new tab instead.
28. **A console command can't save without a panel.**  Wanted, small.  Found 2026-11-10, in 0.7.3.
   `philDebug.VisualEditor` has the root, the selection and the time, but no way to save.
   So `saveOutsideChanges()` in `console-support.ts` borrows a root panel's `VisualEditorAPI`, and only works in a chapter where `addScene()` attached one.
   Since 2026-11-14 that's the only reason for the root panels:  they show nothing.  The messages moved to `addEditorPanel()`.
   The button panels for these scripts don't need it:  they save through their own `EditorPanelAPI`.  Only typing on the console does.
   Fix:  add `refreshGUI()` to `philDebug.VisualEditor`.
32. **Term Groups can't say "the rest."**  Low priority.  Found 2026-11-12, in 0.8.0.
   A range like `300-1023` means "to the end", but where the end is depends on the source.
   1024 samples give at most 1024 terms.  `keepNonZeroTerms()` drops a few (3 of this project's 16 named circuits have 1022 or 1023), and 0.8.0 drops the center by default.
   So one Term Groups reused across circuits, as the author does all the time, warns about terms that aren't there:  `checkTermGroups()`, and "Not in this source" in our step panel.
   The author's idea:  an open-ended range, like `0, 1, 2-3, 4-7, 8-`, where the last group is every term from 8 on.
   `term-ordering.md`'s tricks would read better too:  `25-1023`, `16-1023`, `6-1023`.
   Saved values that end at 1023 would still need editing to use it.
34. **PathShape has no ellipse.**  Wanted, small.  Found 2026-11-15, in 0.8.1.
   Converting an SVG drawing by hand (`face.html`, now the "Blank Stare" source) needed its `<circle>` and `<ellipse>` elements as PathShapes.
   `makeEllipse()` in `src/svg-sources.ts` does it:  PathBuilder's unit circle, scaled, then moved.  Its TODO says it belongs in the library as `PathShape.ellipse()`.
   It takes an options object, `{ cx, cy, r }` or `{ cx, cy, rx, ry }`, because the author expects the list to grow:
   a starting angle, the direction of travel, a rotation, and cubics for a closer fit.
   Mind the order:  DOMMatrix applies the last call first, so it's `translateSelf(cx, cy).scaleSelf(rx, ry)`.  The first draft had them reversed.
   The bigger goal:  converting SVG to a PathShape will be common, so this is the first piece of an importer for `<circle>`, `<ellipse>`, `<line>` and `<path>`.
35. **A search for quick scripts.**  Wanted.  A prototype since 2026-11-16:  `dump()` in `src/delayed-start-each.ts`, `philDebug.ve_dump`.
   Its TODO:  move it into the library as `philDebug.VisualEditor.dump`.
   Before this, quick and dirty scripts were hard to write:  each one walked the tree by hand.  `dump()` searches by level, Name and class, and asserts how many it found.
   The author likes `assertMin` and `assertMax` as a pattern:  a script aimed at one layout fails loudly on the wrong chapter.
   Not ready yet.  Use it in a few more scripts first.  The test:  can it replace `find()` in `eight-pack.ts` and `four-plus-four.ts`?  What's left:
   * **Where to start.**  It always starts at what's chosen in the Edit list.  A button's script gets its scene as an argument, so it needs an optional starting node.
     Until then, "works on the console and in code" doesn't cover panels.
   * **Where each match is.**  It returns the components, but not their parents or their time.
     `staggeredWithin()` sets keyframes in the chapter's time, and can't check that a Star Circuit isn't inside something that shifts time.
   * **The names you see.**  The console matches the JavaScript class name, `"StarCircuit"`.  The Insert menu says "Star Circuit", the `registryKey`.  Maybe match either.
   * **The error says why.**  "Not enough results." goes on a button's result line without the counts, which only went to `console.error()`.
   * **Two jobs.**  With no arguments it prints a summary; with any, it searches.  Maybe two functions in the library.
   * It uses `Map.getOrInsertComputed()`, which is very new.  Check that every browser the library supports has it.
36. **The text effect hook didn't say where the paragraph went.**  Found 2026-11-23, in 0.8.3.  **Changed in `../canvas-recorder-lib`, not committed, not published.**
   `[TEXT_EFFECT](letters, options)` gets the letters in the paragraph's own coordinates, before the Multi Text scales, moves and turns them.
   An effect that wants a point the author can see on the slide, or a radius in the slide's units, can't convert.  The Visual Editor draws a point property's marker in the Multi Text's own coordinates.
   The change:  a third argument, `placed: PlacedText` (`scale`, `offset`, `quarterTurns`, `pivot`), the same object `layoutAt()` returns.  Two lines in `multi-text.ts`, one parameter and its docs in `text-effect.ts`.
   Additive:  an effect that takes two parameters still works.  `src/path-warp-effect.ts` declares `placed?` optional, so it also compiles and runs on 0.8.3.
   Since 2026-11-25 it works right on 0.8.3 too:  without `placed`, the effect asks its `parent`, the Multi Text, with `layoutAt()`.  So 0.8.4 only saves that one extra layout a frame, and isn't urgent.
   To finish:  commit, publish 0.8.4, raise `package.json` here to `^0.8.4`.
   To try it here:  `npm link ../canvas-recorder-lib` to try it, and run `npm run build` there first, since the link serves its `dist/`.
   Also:  `TEXT_EFFECT`, `TextEffect` and `EffectLetter` aren't exported from the main entry, so this project imports them by path (`canvas-recorder-lib/src/slide-components/text-effect`).  `PlacedText` is exported.
   The author's longer plan:  one interface for this kind of hook, shared by a path component and Multi Text.  `PathWarpEffect` is the experiment for it.
   **The point editor, found 2026-11-25 in the Shorts' Scratch 19:**  Center's marker isn't where the lens is.  Two causes.
   * With 0.8.3 the effect got no `placed`, so it read Center in the paragraph's own units:  unscaled, from the top left of the text.  The marker is in the slide's units.
     So Scratch 19's Centers were tuned by eye in paragraph units (y up to 18 on a 16 tall canvas).  **Fixed in this project 2026-11-25**, by asking the parent (above).
     That moved Scratch 19's lens, so `philDebug.textWarpsToSlideUnits(true)`, with Scratch 19 chosen, converts its fields once.  Tested on a copy of Scratch 19:  frames identical to before.
   * The editor puts a selected component's markers in its frame through `registerTransform()`, which a parent calls for each child it draws.  Multi Text never calls it for its text effect, which it doesn't draw with `show()`.
     So the marker is drawn in the root's coordinates.  That's right for Scratch 19 (no moved or scaled parent), and wrong inside a Slide, like Pan and Scan.
     Fix:  in `MultiTextComponent.show()`, for the effect child, `options.registerTransform?.(effect, context.getTransform())`, before Multi Text's own translate and scale.
     The effect works in the Multi Text's coordinates, which are its parent's, so that's the right frame.
   **Save Diffs writes code that doesn't compile,** found the same day:  `new TextSpanComponent({ description: "Text Span" })`, and Text Span's constructor takes no `description`.
   Vite builds it anyway, but `tsc` fails.  Either Text Span takes a `description`, or the diff leaves it out.  The Text Format line above it is fine.

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
29. **The showcase's Freaky Dots never worked, for two reasons.**  Found 2026-11-11.
   `test-project/src/showcase/freaky-dots.ts`, commented out as "NOT READY FOR PRIME TIME".
   * Its three layers are three different sets of random dots.  The circles only appear when they're the same dots, turned a little against each other, as the SVG version's three copies of one filter were.
   * It calls `path.ellipse()` with no `moveTo()` first, so each ellipse joins the last one with a straight line.  Each layer is filled as one huge self-crossing polygon.  That's the CPU cost, too.
   This project's `src/freaky-dots.ts` works, at about 1.5 ms a frame in 4K.  The showcase could copy it, or drop the slide.
33. **Step 0's dot never shows.**  Found 2026-11-12, in 0.8.0.
   The comments say Step 0 is a single dot.  `getAnimationRules()` (`fourier-shared.ts`, about line 599) draws it as `M p L p`, a line of length 0, with round caps.
   Chrome skips a line that short, round caps or not.  Tested:  nothing at length 0 or 1e-9 pixels, a whole dot at 1e-4.
   So the screen is empty at Step 0, and the dot appears on the first frame after.  The author's workaround:  start Step at 0.001.
   Fix:  draw the dot as a filled circle, Line Width across, in the stroke color.
   Bridged Fourier does that now (`drawBridgedFrame()`).  Star Circuit still has the bug (`drawColoredFrame()`, the same `M p L p`), left alone because the Shorts use it.
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
