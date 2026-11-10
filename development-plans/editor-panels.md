# Editor panels

Our own tools in the Visual Editor, for Star Circuit and any later component.

## Start here (2026-11-08)

### What exists

- **Built:  the messages panel,** `src/editor-messages.ts`.  No library change.
  - Select a Star Circuit and it says whether the circuit is valid, and whether Term Groups and Step match.
  - The Term Groups and Step checks are the library's own (`checkTermGroups()`, `checkStepRange()`), the same ones the library's Fourier panel shows for a Fourier component.
  - It updates on every keystroke, and hides itself when the selected component has nothing to say.
  - Any component can join:  give it an `editorMessages()` method.
- **How it works:**  the library's one general hook, `Showable.rootComponentEditor`, a panel for whatever is chosen in the Edit list.
  `addScene()` attaches one to the video's root and to every scene.  It's a stopgap, with limits:
  - It sits above the component list, top right, not with the component's properties, bottom right.
  - Only what we attach it to has it.  Something else chosen in the Edit list, like a pasted Slide with its own length, shows no panel.  Neither does another project.
  - After choosing a scene, it stays hidden until you click a component.
- **The library has no way to add a new kind of field,** like its rectangle or point editors.  The kinds are a fixed list.  We don't need one (below).

### What we want, in order

1. **Library:  a panel's changes must be saved.**  `library-issues.md`, item 23.  Small, about one line.
   *Why first:*  the vertex editor changes the Circuit field from a panel.  Today that change either isn't saved, or saving it throws away the selection.  Nothing else blocks the vertex editor.
2. **This project:  the vertex editor.**  `circuit-editor.md`.  Big.
   It goes in the messages panel, as a second section under the messages.
   Its first step (the pairings spelling, the drawing table, the X) needs no library change and can start any time.
3. **Library:  `editorPanel` on any component.**  `library-issues.md`, item 15.  Medium.  Wanted, not needed.
   *Why:*  the panel would sit next to the component's own properties, work wherever the component is, in any project, and know the component's own time.
   *Why it can wait:*  the stopgap does the job for this project.  Moving to it changes only the wiring in `editor-messages.ts`.  The components' `editorMessages()` and the vertex editor's code stay as they are.
4. **Not wanted:  a new kind of field for the circuit.**
   *Why:*  Circuit is a string, and the library already edits strings, with a list of suggestions.  The vertex editor needs more room than one field anyway:  the star to click, 15 choices, and what each one would do.
   And it would be a big library change:  saving, loading and the diff file all depend on that fixed list of kinds.

### Why the warnings aren't on the canvas

Some of them are on purpose, like a Step that starts after 0 to skip the first steps.  On the canvas, they'd end up in the recorded video.
Real errors, like a circuit that won't parse, still draw a message on the canvas too, because then there's nothing to draw.

## Background

The rest of this file is the original brainstorm, from 2026-10-31:  the library's side of item 15.
The first user would be Star Circuit's vertex editor (`circuit-editor.md`).

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
