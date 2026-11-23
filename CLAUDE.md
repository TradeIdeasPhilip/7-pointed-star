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
npm run dev             # Vite dev server on http://localhost:5178 (fixed port; the editor's saved state is per origin).  Opens a menu of the videos.
npm run build           # tsc + vite build → dist/ (gitignored)
npm run count-circuits  # Count the Euler circuits for 5, 6 and 7 points.  Plain Node, no browser.
npm run find-vertex-types  # How common each vertex pairing is, and pairs of circuits that show every kind.  About 25 seconds.
npm run pick-circuits   # Some circuits picked at random, the same ones each time.  About 25 seconds.
npm run fourier-analysis  # Research:  symmetries of the named circuits, then groups of 3 or 4 sampled circuits that start with the same frequencies.  About 1.5 minutes.
npm run sample-circuits  # 10,000 random circuits and their top 40 terms → data/circuit-sample.json (gitignored).  About 35 seconds.
```

No test runner, no linter.  TypeScript errors surface in the IDE and on `npm run build`.

## Publishing

Every push to `master` builds the site and publishes it to GitHub Pages:  https://tradeideasphilip.github.io/7-pointed-star/
That's the menu.  Add `?toShow=7-pointed-star` or `?toShow=7-pointed-star-shorts` to go straight to a video.
The workflow is `.github/workflows/deploy.yml`, copied from riemann-surfaces-3d.
`dist/` is never committed.  To redeploy without a new commit:  Actions → Deploy to GitHub Pages → Run workflow.

One-time setup, in the GitHub repo:  Settings → Pages → Build and deployment → Source:  GitHub Actions.

`npm run build` runs `tsc` first, so a type error fails the deploy, and the live site keeps the last good version.
Each deploy also writes https://tradeideasphilip.github.io/7-pointed-star/build-info.txt:  the live commit's URL, date and title, one per line.
If its first line isn't the newest commit on `master`, the last deploy failed.  git-all-status checks this.
`npm ci` on GitHub uses the published library, so don't deploy code that needs an unpublished library change.

## Layout

- `src/main.ts`:  chooses the video.  `?toShow=` names one; without it, the page shows a menu.  Each video's code loads only when it's chosen.
  A video's key is also the `name` given to `canvasRecorder.start()`, so it names the saved work and the files in `properties/`.  Don't change one.
  Menu links open new tabs, because the player's sessionStorage isn't kept per video.  See `library-issues.md`, item 21.
- `src/full-video.ts`:  the main video, `?toShow=7-pointed-star`.  16 × 9 units, 3840 × 2160 pixels.  The root is an InSeriesComponent of scenes.  Each scene is a fixed child with its own black background.
  1. "7 Pointed Star":  the Fourier star and the colorful star.
  2. "Vertex Pairings":  closeups of the top vertex.
  3. "Every Kind of Vertex":  two whole circuits with rounded corners, that between them show every kind of vertex.
  4. "Circuit Grid":  a Circuit Grid component, for trying layouts.
  5. "Three Circuits":  three Star Circuits, laid out like Peano vs Fourier, each in its own colors, plus a Multi Text label for each.
  6. "Like Share Subscribe":  a prototype Bridged Fourier, cursive text where the lines between strokes fade away.  Only in this video.
  7. "Love Reason Balance":  two prototype Bridged Morphs, Love to Reason, a pause, then Reason to Balance.  Only in this video.
     They take turns:  at 12 s the first one's Step goes to -1, hiding it, as the second one's goes from -1 to 0.  The 1 ms between those keyframes is never a frame.
  8. "Something Lead Gold":  a short demo of the progress so far, for a voiceover.  Fixed children only, at the author's request.
     Tessellating Triangles that stay still, under an In Series of two halves with a Slide Left between them.
     "Nothing to Something":  a Bridged Fourier of "Something" from a dot.  "Lead to Gold":  a Bridged Morph, gray to gold.
     Each half is a Duration Agnostic with a Min Duration, and its children's keyframes start at the start of that half.
  9. "Warped Paths":  three Warped Path components, a red circle, a blue fat star and a white thin star, each growing out of the center, one after another.  Ends as the finished Star Circuit.
  10. "Scratch 1" to "Scratch 13":  only a background.  The author fills these from the Visual Editor.
  The editor matches saved state by description, starting at the root.  Renaming or wrapping the root drops the saved state.
  The author prefers components added as replaceable children, so the Visual Editor can change, copy or delete them, and labels separate from what they label.
  The author's plan:  a few template slides that always match the TypeScript defaults, so the diff file says nothing about them.  Copy a template, or part of one, from the GUI to a blank slide, in either video.
  A replaceable child's constructor `description` is lost when the editor reloads it from the registry.  `named()` sets `userEditableDescription`, which is saved.
- `src/shorts.ts`:  every portrait video, `?toShow=7-pointed-star-shorts`, for YouTube Shorts.  9 × 16 units, 1080 × 1920 pixels, size locked.  Previews of the main video, one or more scenes each.
  1. "Portrait Template":  one Star Circuit and a label, laid out for a phone.
  2. "Pan and Scan Template":  an empty Slide that moves slowly across a 16 × 9 picture.  Paste a whole slide from the main video into it.
  3. "Scratch 1" to "Scratch 13":  only a background.  Except Scratch 4:  eight copies of one circuit, from `fillEightPack()`.
     Scratch 4 and 5 have buttons for their scripts, with the scene's properties:  choose the scene in the Edit list.
- `src/scenes.ts`:  `addScene()` and `named()`, shared by the videos.  Set `canvasRecorder.size` before `addScene()`, because the background fills the canvas.
  `addScene()` also lets console commands save while the root or the scene is chosen in the Edit list.  See `console-support.ts`.
  It imports `editor-messages.ts` for its side effect.
- `src/editor-messages.ts`:  the selected component's warnings, in a box called "Checks", bottom right with its properties (`canvasRecorder.addEditorPanel()`).
  Any component with an `editorMessages()` method gets one.  After the component's own panel, if it has one.
  The components only import its types, and the build leaves out a module imported only for types.  So `scenes.ts` imports it for its side effect.
  Our panels, their priorities and the reasons:  the top of `development-plans/editor-panels.md`.
- `src/setup.ts`:  everything the videos set up when they load, only imports:  components, Fourier sources and console commands.  Like `main.C` in a C++ project.
  Both videos import it, so any video can insert or paste any component, and the console commands work in both.  Add each new component, source or command here.  It was `all-components.ts`.
- `src/euler-circuits.ts`:  graph math only, no imports, so Node can run it.  Hand picked circuits (`GROUPED_7`, `INTERLEAVED_7`), the search, the duplicate filter.
  Node only strips types, so this file (and `scripts/`) can't use enums or constructor parameter properties.  `erasableSyntaxOnly` in tsconfig enforces that.
- `src/star-path.ts`:  circuit → `PathShape`, plus a record of which commands came from which edge.  Those records say where each color starts and stops.
- `src/star-sources.ts`:  registers the circuits as `FourierComponent.sources`.  Import it before constructing any FourierComponent.
- `src/svg-sources.ts`:  Fourier sources converted by hand from SVG.  "Blank Stare" is `face.html`, one piece per SVG element, in order.
  `makeEllipse()` turns a `<circle>` or `<ellipse>` into a PathShape, until the library has one (`library-issues.md`, item 34).
- `src/colorful-star.ts`:  the finished picture in three colors, not animated.  Registered as "Colorful Star".
- `src/vertex-corners.ts`:  the rounded corners at one vertex.  Shared by the next two.
  Each pair of edges gets a level:  how many pairs in its way (surrounding it, or crossing it and wider) stay closer to the vertex.
  The cut back along each edge is Corner Size × (Rounding + level × Rounding Step).  For reference images only, never mixed with a Fourier animation.
- `src/vertex-pairings.ts`:  all 15 ways to pair off the 6 edges at the top vertex, in a 5 × 3 grid, numbered 1 to 15 by rows.  Registered as "Vertex Pairings".
  The numbers are `VERTEX_PAIRINGS_7` in `euler-circuits.ts`.  Mirror images:  2 and 6, 3 and 11, 4 and 12, 9 and 13.  So 11 kinds.
- `src/rounded-star.ts`:  one whole circuit with every corner rounded, and each vertex's pairing number.  The Circuit field picks from a short list.  Registered as "Rounded Star".
  `drawRoundedCircuit()` draws a reference image into any rectangle.
- `src/colored-fourier.ts`:  the multi-color Fourier.  Each frame is drawn in pieces, by `t`, each piece the color of the edges it becomes.
  Sample i is at t = i / N, and each edge starts with a sample at its first vertex, so each run of same colored edges covers a known range of `t`.
  `samplesWithStarts()` and `getFrameRules()` are copies of the library's `samplesFromPath()` and `getAnimationRules()`, changed to expose that.
  Circle, then fat star, then thin star, with round caps, like the reference images.  Round caps leave no notch at the sharp corners of the last steps.
  `ColoredAnimations` is the animation cache each component keeps:  by circuit, thrown away when Term Groups changes.
  `coloredSource()` passes `{ keepCenter: true }` to `samplesToFourier()`, so the stars keep their frequency 0 term and the numbering from before library 0.8.0:  up to 1024 terms.
  That term is only sampling error, under a pixel, but it ranks between 98 and 502.  Leaving it out changes nothing you'd see, only the numbers after it, and many saved Term Groups in the Shorts end at 1023.
  The library's own Fourier component (slide 1's Star Fourier) leaves it out:  1023 terms.
- `src/bridged-fourier.ts`:  a prototype, quick and dirty on purpose.  The multi-color Fourier for any path:  the lines that close the gaps are **bridges**, in their own color.  Registered as "Bridged Fourier".
  The path is the Text field, in the cursive font.  The default is "Like / share / and / subscribe", every other line backwards so the jumps between lines are short.
  Step 0's dot is a filled circle.  The library draws it as a line of length 0, which the canvas skips (`library-issues.md`, item 33).
  Fields like the library's Fourier, with Content Color (`myRainbow.yellow`) and Bridge Color (`"transparent"`) in place of Stroke Color.  A visible Bridge Color shows every bridge.
  `samplesWithBridges()` and `drawBridgedFrame()` are copies of `samplesWithStarts()` and `drawColoredFrame()`; `getFrameRules()` is shared.
  A gap under 1e-6 is welded:  touching letters can be a rounding error apart, and a bridge there would leave a hole.
  `samplesToFourier()` leaves out the frequency 0 term (library 0.8.0):  1023 terms, 0 to 1022, and the curve is centered on the average of the samples.  Bounds are moved the same way, as in the library's Fourier component.
  In the Visual Editor, the step panel from `fourier-panel.ts`, then Checks.
  `pathToBridgedSource()` turns any PathShape into terms, runs and bounds.  `bridgedSource()` is the cursive text on top of it.
  It was kept out of the Shorts at first.  Since Bridged Path imports it, it's registered in both videos.
- `src/bridged-path.ts`:  a prototype, quick and dirty on purpose.  Bridged Fourier for any path, picked by name.  Registered as "Bridged Path".
  Source is a name from `FourierComponent.sources`, the library Fourier's registry, so one registration serves both.  Its suggestions are the sources with a `path`.
  The default is "Blank Stare", a face registered in `svg-sources.ts`.  A parametric or `terms` source has no gaps, so Checks says to use the Fourier component.
  The class is a copy of `BridgedFourier`, with Source in place of Text.  The sampling and drawing come from `bridged-fourier.ts`.
  The default Dest Rect, 8 × 8 at (0.5, 0.5), fits on both videos.
- `src/bridged-morph.ts`:  a prototype, quick and dirty on purpose.  A Fourier morph from one word to another, in the cursive font, typed into Before and After.  Registered as "Bridged Morph".
  Each word is sampled by `samplesWithBridges()`, 1024 samples, so sample i of one goes to sample i of the other:  matched by length, bridges included.
  The morph is Before plus the terms of After − Before (`keepCenter`, so it ends exactly at After), with the Fourier component's sweep.  The showcase's Fourier Morph does the same with closed shapes.
  Each piece between two samples is one of four kinds:  content, bridge, fade out (content in Before only), fade in (content in After only).  Corners are samples, so the kind only changes at a sample.
  The fades follow the RMS distance still to go (Parseval, from the terms' amplitudes), not Step, so most of the fading happens in the first steps, with the big terms.
  It draws straight lines between samples, not a smooth curve:  the ends are then exactly the words.
  Dest Rect's height is one line of the font, and the words are centered side to side, so two morphs with the same Dest Rect put a word in the same place.
  Only `full-video.ts` imports it, like Bridged Fourier.
- `src/warped-path.ts`:  a prototype, a strawman.  Any path with every point moved by a function, to make interesting animations.  Registered as "Warped Path".
  Path is an SVG path string, read by `PathShape.fromRawString()`, so arcs work since library 0.8.3.  `CIRCLE_PATH` is two half circle arcs, and `starPath(2 | 3)` is `makePolygon()` as in `star-sources.ts`, as a string.
  Sampled by the library's `samplesFromPath()`, as the Fourier components do, so every corner is a sample.  `samplesToPathShape()` joins the moved samples with straight lines, closed.  `Samples` is 1024.
  `polarWarp(offset, angle)`:  radius becomes `Math.max(0, radius - offset)`, angle gets the angle added.  Offset 0 and angle 0 return the point itself, so the finished state is exactly the path.
  Fields:  Path, Radius Offset (path units, 1 → 0), Angle in degrees (not clamped), Samples, Source Rect, Dest Rect, Color, Line Width.
  Source Rect is the part of the path's own coordinates that fits in Dest Rect, the unit circle's square by default.  So the circle and both stars, with different bounds, line up.
  The path should be one closed piece.  More pieces, or an open path, is a warning in Checks:  the gaps are joined with straight lines, as in the Fourier component.  Each piece should get its own component, someday.
  Override `makeWarp()` to try another function.  Before the start of Radius Offset's first keyframe the circle shows a dot:  its cubics are 0.03% outside the unit circle, so some radius is left, and a round cap fills in.  The stars don't.
  A DurationAgnosticComponent, like Star Circuit.  Only `full-video.ts` uses it, but it's registered in both videos.
- `src/twisted-path.ts`:  a prototype, the second version of Warped Path, a subclass so the first (used in Scratch 15 of the Shorts) is untouched.  Registered as "Twisted Path".
  After Radius Offset and Angle, the point turns by Twist × `(1 - r / Effect Radius) ** Falloff Power`, where `r` is the distance after the offset.  The center gets all of Twist, and Effect Radius and beyond get none.  So lines become spirals.
  "The rim leads, the inside lags" is Angle = A and Twist = -A;  "the center leads" is Twist alone.  They differ by one rigid turn.  Twist 0 is the identity.
  Effect Radius is in the path's units, 1 by default.  It isn't taken from Source Rect, which is only the window.  Checks notes how far the path reaches.
  `WarpedPath.registryKey` is typed `string`, not the literal, so a subclass can have its own.  The scene is "Twisted Paths" in the landscape video, at 4096 samples.
- `src/fourier-panel.ts`:  Visual Editor tools for anything with Term Groups and Step, a `SteppedFourier`.  Star Circuit, Bridged Fourier, Bridged Path and Bridged Morph are.
  `fourierStepPanel()`, a component's own `editorPanel`:  at the playhead, Step, the terms in and coming in, and a table of how many terms and how much of the amplitude are in, adding and left, like "Will it Fourier?".
  When Step's last keyframe isn't the number of groups, a button fixes it, with `propertyChanged()`, so it saves and undoes like any edit.
  Under it, Rebuild Term Groups, with a minimum, 3% to start:  `termGroupsBySize()` replaces the Term Groups keyframe at the playhead.
  From the largest term down, a term that big gets its own group, and smaller ones are gathered until the group is that big.  The last group gets what's left.
  A starting point to edit by hand.  It doesn't touch Step:  the Make Step end button appears when the count changes.  Meant for the library's Fourier panel too, once it settles.
  `fourierMessages()`:  the library's `checkTermGroups()` and `checkStepRange()`, for `editorMessages()`.
  `{ sourceErrors: false }` when the component already says why there are no terms, as Star Circuit's Circuit line does.
  `analyzeStep()`, `describeStep()`, `formatTerms()` and `stepFix()` are pure.
- `src/circuit-grid.ts`:  a Lattice of circles:  Fourier, reference, Fourier, reference, in reading order.  Registered as "Circuit Grid".
  A quick tool for trying layouts.  New work goes into Star Circuit instead.
- `src/star-circuit.ts`:  one circuit, as a Fourier animation and a reference image, each in its own rectangle, in one set of colors.  Registered as "Star Circuit".
  It extends `DurationAgnosticComponent`, like the library's FourierComponent.  That gives it Min Duration, 0 by default.
  So by default it takes no room on the timeline, and the scene sets the length.  The default Step ends at 22 s, so the scene needs at least that.
  Above 0, it gets a block on the timeline.  The timeline only shows children that are a `DurationAgnosticComponent`, a `PaddingComponent`, or have `setDuration()`.  A plain `implements Showable` gets no block.
  With a duration, it's also in the Edit list on its own.
  In the Visual Editor, the step panel from `fourier-panel.ts`, then Checks:  whether each Circuit keyframe parses, then `fourierMessages()`.
  A class meant to be extended:  override `drawFourier()` or `drawReference()` for variations, like the 3D reference image in `development-plans/3d-euler-circuits.md`.
  The Circuit field takes a name from `NAMED_CIRCUITS_7` (offered as suggestions) or the vertices in order, read by `parseCircuit7()`.
  A line width of 0 turns that part off, at no cost, unless Fill Color is set.  (The canvas ignores a `lineWidth` of 0, so it's handled in `setLineWidth()`.)
- `src/script-panel.ts`:  quick and dirty panels:  plain buttons that run a script on one scene, HyperCard style.  `addScriptPanel(scene, { title, status, buttons })`.
  Shown with that scene's properties, and only that scene's:  a pasted copy doesn't get the panel.  A button may throw; the message goes on the result line.
  After a button, `refreshGUI("properties")`:  it saves, redraws, keeps the selection, and makes one undo step.  So buttons change values only, never add or remove components.
  That rebuild restarts the panel, so the result line and the text boxes' values live in the panel object.
- `src/eight-pack.ts`:  eight copies of one circuit, like ✶37.  Each holds its first, second and third term groups for the end, or not:  2 × 2 × 2.
  Bright or dark circle, fat star and thin star show the three choices.  Empty term groups keep them in step, so all eight share one plain Step.
  `fillEightPack()` builds one in a scene (Scratch 4 in the Shorts), and `addEightPackPanel()` gives it buttons:  Set Term Groups, Set Steps, Set Circuit.
  The console commands are the same functions, on whatever is chosen in the Edit list:  `philDebug.eightPack`:  `find()`, `setTermGroups()`, `setSteps()`, `setCircuit()`.
  The author copies and pastes this layout, so the commands find the eight by position among the scene's Star Circuits, not by name.
- `src/four-plus-four.ts`:  scripts for Scratch 5 in the Shorts, four Star Circuits.  Buttons from `addFourPlusFourPanel()`, and `philDebug.fourPlusFour` on the console.
  Set End Time (`setEndTime()`) moves the last Step keyframe of the four, and a two-keyframe Night Sky's Bottom Color, to the end of the scene.
  Show Intro (`showIntro()`) rounds the corners from 2 s to 13 s and starts every Step at 15 s.
  This file and `eight-pack.ts` are quick, rough scripts for one template each.
- `src/delayed-start-each.ts`:  console commands for any chapter, no panel yet.
  `dump()` (`philDebug.ve_dump`) searches the chosen chapter by level, Name and class.  With no arguments it prints ready-to-paste searches.
  The author's pattern for scripts aimed at one layout:  search with `assertMin` and `assertMax`, so the wrong chapter fails loudly.
  A prototype for the library (`library-issues.md`, item 35).
  In code, pass the class, `dump({ className: StarCircuit })`, and the result is typed.  On the console, its name as a string.
  `staggeredWithin(numberOfSteps, staggerInSteps = 0.1)` (`philDebug.staggeredWithin`) rewrites every Star Circuit's Step.
  Each of the first `numberOfSteps` steps is staggered:  the circuits start it one after another, and all finish it, plus one more delay, before any starts the next.
  Then the rest run together to the end of the chapter.  Every step takes the same time.  The delay is a fraction of a step.
- `src/console-support.ts`:  for console commands.  `root()`, what's chosen in the Edit list, and `saveOutsideChanges()`, which saves what a command changed.
  The console has no way to save (`library-issues.md`, item 28), so `addScene()` gives each scene, and the root, an invisible root panel, only to hold the `VisualEditorAPI`.
  It saves with `refreshGUI("properties")`, which keeps the selection.  Buttons don't need this:  they save through their own panel.
- `src/tessellating-triangles.ts`:  a background of equilateral triangles in two colors.  Registered as "Tessellating Triangles".
  The fields say "▲ Color" and "▼ Color"; the code says `upColor` and `downColor`.
- `src/night-sky.ts`:  a background, a gradient from Top Color to Bottom Color with glowing stars.  Registered as "Night Sky".
  Copied from the hexagram videos (random-svg-tests 0707534, ✶39); the defaults are the old values, except Seed (it was "Good Night 🌛").  The default Rect is the whole canvas.
  Star i is the same whatever Number of Stars is, and a fraction fades in the next one.  `Random.fromString()` logs, so it keeps one generator per seed.
  Like Tessellating Triangles, a plain Showable with duration 0:  not on the timeline, and the same at any time.
- `src/freaky-dots.ts`:  a background, three copies of one sheet of random dots, each turned a little around Center, so the dots swirl around it.  Registered as "Freaky Dots".
  From the hexagram videos (random-svg-tests bf4e80a, ✶36), where SVG turbulence filters made 4K slow and hot.  Here each dot is an ellipse in a Path2D, turned by the canvas transform.
  The circles (a Glass pattern) only appear because the three sheets are the same dots.  The library's abandoned try, `test-project/src/showcase/freaky-dots.ts`, used three different sets, and no `moveTo()` before each `ellipse()`.
  A duration of 0, but not the same at any time:  the wiggle and any keyframes use the scene's time.
  Each 1 × 1 cell's dots come from the Seed and the cell, so they never move, and Rect is only a window.  The paths are rebuilt only when a dot setting changes, or a sheet needs dots it doesn't have.
  About 1.5 ms a frame at 4K on the author's M1, about what Night Sky costs.
  To time canvas drawing headless:  a `getImageData()` every frame moves the canvas off the GPU (31 ms here), and a full-canvas `clearRect()` lets Chrome skip the frame before it.
- `scripts/count-circuits.ts`:  the counts above.
- `scripts/find-vertex-types.ts`:  every pairing is equally common (K7 minus a vertex is K6, so the graph can't tell the pairings apart).
  At most 7 kinds fit in one circuit.  `EVERY_KIND_A_7` and `EVERY_KIND_B_7` are the first pair it found that shows all 11.
- `scripts/pick-circuits.ts`:  random circuits, with a fixed seed.  `RANDOM_7` came from here.
- `scripts/fourier-analysis.ts`:  the author's research script, in plain Node, no tsx.  Its terms come from `circuit-terms.ts`, so each term's `rank` is the number Term Groups takes.
  Term Groups only picks terms by rank, biggest amplitude first.  This research is about choosing them by frequency too.
  "Shared frequencies" reads `data/circuit-sample.json` and prints the best few groups from three searches, each circuit with its Circuit and Term Groups, ready to type in.
  Constants at the top turn each part off.
- `scripts/circuit-terms.ts`:  `decompose()`, a circuit's terms as Star Circuit animates them (the library's `samplesFromPath()` and `samplesToFourier()`, with `keepCenter`).
  Each amplitude is its share of the circuit's total, like the step panel, not a radius.  `decomposeWithTotal()` also returns the total.  It imports `node-dom.ts`.
- `scripts/sample-circuits.ts`:  10,000 circuits picked at random (reservoir sampling, like `pick-circuits.ts`, fixed seed), as one JSON file, one circuit per line.
  Each has its `index` in search order (a stable ID), its vertices (they paste into the Circuit field), its pairing numbers, its total amplitude, and its top 40 terms as `[frequency, share]`.
  JSON goes to stdout and progress to stderr:  `scripts/` has no Node types, so no `node:fs`.  The npm script writes to a temporary file first, so a crash keeps the last good one.
  A first step toward `enumerate-all-circuits.md`.  Read it with a dynamic `import()`, never a static one:  `data/` isn't in git, so `tsc` would fail on GitHub.
- `scripts/node-dom.ts`:  import it first, and the library loads in Node.  `glib/transforms` needs `DOMMatrix` when it loads (`library-issues.md`, item 24).
  `src/star-path.ts` runs in Node too, so it imports types with `type`.  Node only strips types, so a plain import of a type fails there.
- `properties/`:  the editor's saved state, written there so it's in git.  See `properties/README.md`.
- `development-plans/`:  plans and notes, written for the author and for future sessions.
  - `library-issues.md`:  problems found in canvas-recorder-lib.  Add to it; don't stop to fix the library unless it's urgent.
  - `enumerate-all-circuits.md`:  options for computing every circuit's Fourier terms and storing them to search.  Not started.
  - `3d-euler-circuits.md`:  the author's idea for a 3D reference image.  Far in the future.
  - `3d-projection.md`:  projecting paths and wireframes as vectors, never a rendered texture.  Camera, clipping, hidden parts, surfaces, and a flat earth that rolls up into a globe.  Discussion only, no code yet.
  - `circuit-editor.md`:  choosing a circuit one vertex at a time, and what to draw when the result is several loops.  Not started.  Nothing blocks it since library 0.7.3.
  - `editor-panels.md`:  our own tools in the Visual Editor.  Starts with what exists, what we want in priority order, and why.  Then the library brainstorm.
  - `term-ordering.md`:  the author's tricks for ordering Fourier terms, from the hexagram videos in random-svg-tests, with commits and videos.
    Which ones Term Groups can already say, and what the others need.

## User errors

The author's rule, for every component:  a mistake in the Visual Editor is a state, not an error.
- Show a warning, in the editor or on the canvas.  Never throw, and never a dialog box.
- Save it like any other state.  Editing between two good states often passes through bad ones.
- Draw as much as still makes sense.  Values in worse shape can come back from IndexedDB or a file, so fail gracefully and make them easy to fix.
- The library's "throw when saving a file" is only for external failures, like an image or video that doesn't load.
- Assertions are still fine for the programmer's own mistakes, like the hand picked circuits checked at load time.
- `showError()` (the library's red text on the canvas) lays its text out as wide as the canvas, since library 0.8.3, and centers it.  It used to assume 16 units.
  So a component that draws it inside a rectangle scales by `rect.width / canvasRecorder.width`, never `/ 16`.  Star Circuit and Tessellating Triangles do.  Night Sky and Freaky Dots draw it across the whole canvas, with no scaling.
  Test it in the Shorts (9 wide):  a bad circuit in a Star Circuit should show centered text, as wide as the Fourier rectangle.

## The multi-color Fourier

Working in Circuit Grid and Star Circuit (`src/colored-fourier.ts`).  Slide 1's Star Fourier is still the library's one color FourierComponent.

- Where the curve crosses itself, the layer drawn last wins.  In the first steps the biggest circle is traced several times over, so it looks mostly white.
- The same idea lets a Fourier of several open pieces skip, or fade, the connecting lines that close it.
  The author wants this for things like Peano vs Fourier's long diagonal:  thinner or less opaque, starting normal and fading as the animation goes on.
  The first try is `src/bridged-fourier.ts`, on cursive text.  Bridge Color starts the same as the text, so the first circles look closed, then fades to transparent.
  So keep `colored-fourier.ts` general enough to reuse.  If the prototype holds up, its copies and `colored-fourier.ts` become one version, colored by ranges of `t`.
- The second try is `src/bridged-morph.ts`, a morph between two paths.  Each has its own bridges, so a piece can be content in one and a bridge in the other, and fade.
  Matching the pieces by length is the simple start.  Ideas for later, from the author:  nudge the samples so nearby bridges line up exactly, and avoid a fade when a small change would match the content.
  Careful with big changes to the spacing:  bridges of only two samples once made a horrible (and fun) ringing.

## The library

`package.json` depends on the published `canvas-recorder-lib` from npm.  Never `file:../canvas-recorder-lib`:  GitHub's build machine has no `../`.
The source is at `../canvas-recorder-lib`, the master copy of the tooling.  Its CLAUDE.md and README explain the library.
To try a library change here, `npm link ../canvas-recorder-lib`, and keep `npm run watch` running in the library.
Any `npm install` or `npm ci` puts the published copy back.  `npm ls canvas-recorder-lib` shows which one is in use.

Import the main object and common components from `canvas-recorder-lib`; anything else by path,
e.g. `canvas-recorder-lib/src/glib/path-shape` or `canvas-recorder-lib/src/glib/transforms`.

## Comments

The user likes JSDoc style comments and VS Code's "MARK:" style comments.
