# Editor panels

Our own tools in the Visual Editor, for Star Circuit and any later component.

## Start here (updated 2026-11-11, for library 0.7.4)

### What exists

- **Built:  the messages panel,** `src/editor-messages.ts`.
  - Select a Star Circuit and it says whether the circuit is valid, and whether Term Groups and Step match.
  - The Term Groups and Step checks are the library's own (`checkTermGroups()`, `checkStepRange()`), the same ones the library's Fourier panel shows for a Fourier component.
  - It updates on every keystroke, and hides itself when the selected component has nothing to say.
  - Any component can join:  give it an `editorMessages()` method.
  - It still uses the old hook, `Showable.rootComponentEditor`, a panel for whatever is chosen in the Edit list.
    `addScene()` attaches one to the video's root and to every scene.  So it sits top right, above the component list, and only where we attached it.
- **Built:  Star Circuit's own panel,** `src/star-circuit-panel.ts`, on the new hook (2026-11-10).
  At the playhead:  Step to 2 places, the terms all the way in, and the ones coming in, in the Term Groups format.  It warns about terms the circuit doesn't have.
- **Built:  `saveOutsideChanges()`,** in `editor-messages.ts`.  It saves what the console commands in `eight-pack.ts` and `four-plus-four.ts` change.
  It borrows a root panel's `VisualEditorAPI`, and uses `refreshGUI("structure")`, which sends the selection back to the root.
- **New in the library, 0.7.3** (installed here 2026-11-10):
  - `Showable.editorPanel`:  a component's own panel, bottom right, with its properties.  It shows whenever the component is selected, in any way.  That was item 15.
  - `canvasRecorder.addEditorPanel(factory)`:  the same panel, for any component the factory picks, including the library's own, like FourierComponent.
  - What a panel can ask for (`EditorPanelAPI`):  `getTimeMs()` in the component's own time, `seek()`, `refreshGUI()`, and `propertyChanged(property)`.
    `propertyChanged()` saves the change, redraws, and rebuilds the tables.
    The panel itself gets `start()`, `suspend()`, `update()` on every keystroke, and `timeChanged()` when the playhead moves.
  - `refreshGUI("properties")` saves now, on the old hook too.  That was item 23.
  - Clicking a block on the timeline now tells the old hook what was selected.  That was item 25.
  - A panel's change becomes an undo step, like any other edit.  `markDirty()` starts the 5 second autosave, which adds the change to the history.
  - The library's showcase has one example of each hook, in the library's `test-project/src/showcase/editor-panel.ts`.  Its panel listing a Fourier's terms is a good start for ours.
- **The library has no way to add a new kind of field,** like its rectangle or point editors.  The kinds are a fixed list.  We don't need one (below).

### What we want, in order

1. **Quick and dirty panels for the scripts.**  Small.  The author wants this soon (2026-11-11).
   Buttons on a fixed scene that run the code in `eight-pack.ts` (Shorts, Scratch 4) and `four-plus-four.ts` (Shorts, Scratch 5).
   See "Quick and dirty panels", below.
2. **Use 0.7.3's saving in `saveOutsideChanges()`.**  Trivial.  Do it in the same sitting as 1:  the buttons save the same way, so it's the same check.
   `refreshGUI("properties")` saves now, and keeps the selection.
   The console commands only change values, so `"structure"` was only for its saving.  Check that the canvas redraws.
3. **Move the messages to the new hook.**  Small:  only the wiring in `editor-messages.ts` changes.
   One `canvasRecorder.addEditorPanel()` call covers every component with `editorMessages()`.  Star Circuit doesn't change.
   *Why next:*  the vertex editor goes beside the messages, so it should start out on the new API, in the component's own time.
   It also lifts the stopgap's limits.  The messages show next to the component's properties, as soon as it's selected, wherever it is:  a pasted Slide, either video, any chapter.
   Keep the root panels only for `saveOutsideChanges()`, until the console can save without one (`library-issues.md`, item 28).
4. **The vertex editor.**  `circuit-editor.md`.  Big.  Nothing blocks it now.
   It goes in Star Circuit's own `editorPanel`, which exists now (`star-circuit-panel.ts`), as a second section.  It changes Circuit with `propertyChanged()`, edits the keyframe in effect at `getTimeMs()`, and follows the playhead with `timeChanged()`.
   A panel object lasts as long as its component, so it can remember which vertex was picked.
   Its first step (the pairings spelling, the drawing table, the X) needs no panel and can start any time.
5. **New, optional:  a terms panel.**  Small:  copy the showcase's.
   For the selected Star Circuit or Fourier, list each term's rank (the number Term Groups uses), frequency and amplitude.
   *Why:*  Term Groups are ranks, so picking terms by frequency or symmetry means looking up ranks.
   This is `scripts/fourier-analysis.ts` inside the editor.  See `term-ordering.md`.
6. **Not wanted:  a new kind of field for the circuit.**
   *Why:*  Circuit is a string, and the library already edits strings, with a list of suggestions.  The vertex editor needs more room than one field anyway:  the star to click, 15 choices, and what each one would do.
   And it would be a big library change:  saving, loading and the diff file all depend on that fixed list of kinds.

### Quick and dirty panels

*The idea, from the author (2026-11-11):*  HyperCard, where you could attach a script to a card or a button.
The best HyperCard stacks were Frankensteins:  Apple's standard parts for the pretty things, mixed with plain text buttons for everything custom.
Here the library's Visual Editor is the standard part, and these panels are the text buttons.
The goal is the ultimate mix of GUI and code, where it's easy to switch to whichever is handier.

*What they're for:*  scripts written for one slide or template, which the author then copies and reuses.
`eight-pack.ts` and `four-plus-four.ts` are the first two.
They're a little too complicated to type into the console, and nicer to write with TypeScript's types.
`philDebug` was a start, but they belong in the Visual Editor.

*How nice:*  not very.  These are for limited use, or prototypes.  Plain buttons, no polish.
They don't need to be as nice as the library's panels, or Star Circuit's own panel.

The plan:
- **One shared helper,** `scriptPanel(title, buttons)` in a new `src/script-panel.ts`.  It returns an `EditorPanel`:  a fieldset with the title as its legend, a row of buttons, and a line for the result.
  - Each button is `{ label, run(component) }`, and `run()` may return a string to show on the result line.
  - A button that needs an argument gets a text box next to it, e.g. Set Circuit.
  - Like any panel module, it builds nothing until `start()`.
- **Attach the panel to one fixed scene,** by identity, in the video's file where the scene is made:
  ```ts
  canvasRecorder.addEditorPanel((component) => (component === scene ? panel : undefined));
  ```
  - `DurationAgnosticComponent` doesn't declare `editorPanel`, so TypeScript won't let us set it on a scene.  The factory is the typed way to give one object a panel.
  - The library keeps the factory's answer for as long as the component exists.
  - Maybe `addScene()` takes the panel as an option.
  - Choosing the scene in the Edit list selects it, so the panel should show bottom right with the scene's properties.  Check that.
- **Each script's own file builds its panel,** next to the functions it calls, e.g. `eightPackPanel()` in `eight-pack.ts`.  `shorts.ts` attaches it.
- **The scripts work on the panel's own component,** not on `root()`.
  `find()` and `setEndTime()` take the scene as an argument, defaulting to `root()`, so the console commands still work.
- **Save with the panel's own API:**  `api.refreshGUI("properties")` after `run()`.
  - It saves (since 0.7.3), keeps the selection, and makes the click one undo step.
  - No `saveOutsideChanges()`, so these don't need the root panels (`library-issues.md`, item 28).
  - Check that the canvas redraws and that the property tables show the new values.
  - That rebuilds the properties, which restarts the panel.  So keep the result line's text and the text boxes' values in the panel object, not only in the DOM.
- **Errors go on the result line.**  Not a dialog, and not only the console.
  `run()` may throw, the way the console commands do.  The helper catches it:  the library only catches throws from the panel's own methods, and a button's click handler isn't one.
- **Keep the `philDebug` commands.**  The buttons and the console call the same functions.  The console is still handy for one-off variations.

The first two panels:
- **"Four plus four",** on the Shorts' Scratch 5.  One button:  Set End Time.  The file has one interesting function, and it takes no arguments.
- **"Eight pack",** on the Shorts' Scratch 4.  Set Term Groups, Set Steps, and Set Circuit with a text box.
  Maybe the result line says what `find()` found, or that the scene doesn't have exactly 8 Star Circuits.

*A known limit:*  a copy of the template in another scene doesn't get the panel.
The scripts find their Star Circuits by position, so they'd work on a copy; only the panel stays behind.  The console commands still work there.
If that starts to matter:  a factory that offers the panel to every scene, where the panel decides in `start()` whether it applies, e.g. exactly 8 Star Circuits.
Decide in `start()`, not in the factory:  the library caches the factory's answer for the component's whole life, and the scene's contents change.

### Why the warnings aren't on the canvas

Some of them are on purpose, like a Step that starts after 0 to skip the first steps.  On the canvas, they'd end up in the recorded video.
Real errors, like a circuit that won't parse, still draw a message on the canvas too, because then there's nothing to draw.

## Background

The rest of this file is the original brainstorm, from 2026-10-31:  the library's side of item 15.
The first user would be Star Circuit's vertex editor (`circuit-editor.md`).

0.7.3 built it almost exactly as proposed below, and added `canvasRecorder.addEditorPanel()`.
Both open questions at the end were settled:  `timeChanged()` is in, and the new panels go after the library's own.
`rootComponentEditor` isn't marked `@deprecated` yet.

## What's there now

**`RootComponentEditor` made it into the library,** unchanged from canvas-recorder apart from the import paths.
- The types `VisualEditorAPI` and `RootComponentEditor`, and `Showable.rootComponentEditor`, are at the top of `src/showable.ts`.
- `dev/canvas-recorder.ts` still calls it:  `start()` when a new root is chosen, and `update()`, `selectionChanged()` and `resetAll()` from about 20 places.
- I found nothing marking it obsolete, in the code or the markdown of either repo.
- Nothing in the library, or in the projects built on it, sets it.  Its one user was the some5 timeline prototype in canvas-recorder.
  (See canvas-recorder's `development-plans/historical/main-timeline-prototype.md`:  "a good place for prototypes".)

The interface:
- `start(visualEditor) → HTMLElement`, shown at the top of the component list, top right.
- `suspend()`, `update(component, property)`, `selectionChanged(selected)`, `resetAll()`.
- `VisualEditorAPI`:  `getCurrentlySelected()`, `refreshGUI("sound" | "properties" | "structure")`, `seek(ms)`, `getCurrentTimeMs()`, `getDecodedBuffer?(url)`.

**The specialty panels** are a hand-written list in `updateScheduleEditor()`, one `instanceof` each.
Between them, here's what they ask the editor for:
- **Refresh** on every keystroke, and when any duration changes (`scheduleEditorRefreshers`).  Fourier, Image File, Video File, Handwriting.
- **The playhead in the component's own time.**  Handwriting's `localTimeMs()` subtracts where the component starts.
  `VisualEditorAPI.getCurrentTimeMs()` is the root's time, which is only the same thing for a root.
- **"I changed a property":**  tell the root editor, `markDirty()`, and rebuild the tables so they show the new keyframes.
  Handwriting's `progressChanged()`, and Image File's `urlChanged()`.
- **Which rectangle keyframe is being edited,** and an aspect lock for drags on the canvas.  Image File and Video File.
- **Sound clips changed.**  Video File.  That's `refreshGUI("sound")`.
- **Rebuild the panel** when one of the fields changes.  Font Info and Transform Info.

## The proposal

The same small interface, on any Showable.
Its panel appears at the top of the component's properties, bottom right, whenever the component is selected, where the specialty panels appear now.

```ts
/**
 * Lets a component add its own panel to the Visual Editor.
 * Only the Visual Editor calls these, and only after it has loaded.
 */
export type EditorPanel = {
  /**
   * Build the panel.  Called each time the editor shows this component's properties,
   * which is often:  every time it's selected, and after many edits.
   * @returns Shown at the top of the properties, bottom right.
   */
  start(editor: EditorPanelAPI): HTMLElement;
  /** The panel is going away.  Cancel any timers, animation frames and listeners.  Don't use `editor` after this. */
  suspend?(): void;
  /** Something may have changed:  a property, a duration, a drag on the canvas.  Re-read and redraw. */
  update?(): void;
  /** The playhead moved. */
  timeChanged?(): void;
};

/** What a panel can ask of the Visual Editor.  Times are the component's own, what `show()` gets as `timeInMs`. */
export type EditorPanelAPI = {
  /** Where the playhead is.  Can be before 0 or past the end, when the component isn't showing. */
  getTimeMs(): number;
  /** Move the playhead. */
  seek(ms: number): void;
  /** This panel changed a property:  save it, redraw the canvas, and rebuild the property tables. */
  propertyChanged(property: ScalarInfo | ScheduleInfo): void;
  /** Bigger changes, the same as {@link VisualEditorAPI.refreshGUI}. */
  refreshGUI(howMuch: "sound" | "properties" | "structure"): void;
};

// On Showable:
readonly editorPanel?: EditorPanel;
```

A component supplies one like this:

```ts
// star-circuit.ts.  No DOM here:  star-circuit-panel.ts only touches the DOM inside start() and later.
readonly editorPanel: EditorPanel = starCircuitPanel(this);
```

- **One object per component, closing over it,** like some5's.
  It outlives the editor's frequent rebuilds, so it can remember things that aren't properties, like which vertex the user picked.
- **A subclass can replace it, or wrap it:**  build the parent's element and add to it.
- **Anything worth saving goes in a property.**  The panel object is forgotten on reload.

## Rules

- **A module never touches the DOM while it loads,** not even a panel module.  Only `start()` and the calls after it do.
  That replaces the old rule that everything had to run under tsx, which is gone.
- **A panel module may import small helpers from the library's `dev/`,** which is published.
  But never `dev/canvas-recorder.ts` itself:  that would load the whole editor at startup, instead of with `start()`'s dynamic `import()`.
- **A broken panel mustn't break the editor.**  Wrap `start()` and `update()` in try/catch, and on a throw, show the message where the panel would be.

## The editor's side

- **In `updateScheduleEditor()`,** after the name section:  if `selectable.editorPanel` is set, call `start()` and append the result.
  Push `update` onto `scheduleEditorRefreshers`.
- **Call the old panel's `suspend()` first.**  Today a rebuild only empties the arrays.  A panel with its own timer needs to be told.
- **`propertyChanged()`** does what the specialty panels' callbacks do now:
  `activeRootComponentEditor?.update()`, `markDirty()`, sync any handles on the canvas, then `updateScheduleEditor(selectable)`.
- **`getTimeMs()`** is Handwriting's `localTimeMs()`:  `playheadInRootMs()` minus `startWithin(root, component)`.
- **`timeChanged()`** comes from wherever the playhead display updates, at most once per frame.

The hook itself looks small:  the two types, and a few dozen lines in `updateScheduleEditor()`.
Most of the work is in the shared pieces and in moving the existing panels over, and both can wait.

## Shared pieces worth exporting

From the existing panels:
- **The fieldset with a legend,** in the same style as the Fourier panel and the rest.
- **Status lines:**  ✓ in green, ✗ in red, ⚠ in orange, like the Fourier panel's `line()`.
  With this API, that's the warnings hook from `circuit-editor.md`.  No separate API needed.
- **Editing the keyframe in effect at the playhead,** for a discrete schedule.  Image File's and Video File's `editingRectKeyframe` are close to this.

## Moving the existing panels over

Later, one at a time, each one a test of the API:

1. **Fourier:**  it only refreshes.  The simplest test.
2. **Handwriting:**  local time, and changing a property.
3. **Image File and Video File:**  the keyframe being edited, and the aspect lock.  These may need more than this API.  Leave them hand-wired until they don't.

Each panel moved shortens the hand-written list in `updateScheduleEditor()`.

A component in `src/` pointing at its panel in `dev/` is the same pattern as a project's component pointing at its own panel module.
Watch for cycles:  `dev/fourier-panel.ts` imports `src/slide-components/fourier.ts`.
That's fine if the panel uses `import type` for the class, and only calls the rest inside its functions.

## RootComponentEditor

Once the new interface exists, `rootComponentEditor` is a special case of it:  a panel that lives as long as its root is chosen, shows up top right, and is told about every selection.
The timeline replaced the only thing that used it.
Mark it `@deprecated` when `editorPanel` lands, and delete it later.  canvas-recorder's some5 has its own copy, so nothing there breaks.

## What Star Circuit's panel would use

- **`start()`:**  the star with 7 vertices to click, the 15 choices for the picked vertex, the status lines, and the list of names.
- **`update()`:**  re-read the Circuit field.
- **`timeChanged()`:**  the circuit can change at a keyframe.
- **`propertyChanged(circuitSchedule)`:**  after a click.
- **The panel object:**  remembers which vertex is picked.

## Open questions

- **`timeChanged()`, or have panels poll with `requestAnimationFrame()`** the way some5 did?
  I'd add it:  the circuit editor, Image File and Video File would all use it.
- **Top of the properties, or below the built-in panels?**  Top, like the specialty panels.
- **The name.**  `editorPanel` doesn't collide with anything in the editor.  `componentEditor` would read too much like `updateComponentEditor()`, the tree at the top right.
