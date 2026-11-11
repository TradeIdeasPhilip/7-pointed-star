# Circuit editor

Choosing a Star Circuit's circuit one vertex at a time, and what to draw when the result isn't one circuit.
Brainstorming from 2026-10-31.  Nothing built yet.

## The idea

The author's plan:

- Point at a vertex, then pick one of its 15 pairings from a list.  Easier than typing 22 vertex numbers.
- It lives beside the other two ways to choose:  the list of names, and pasting the vertices.
- A new component always starts with a valid circuit.
  Each change leaves it valid, or almost valid:  every vertex still paired off, but maybe in more than one loop.
- Almost valid is allowed, like any user error.  The quickest way between two circuits often goes through a few of these.
  Warnings, never exceptions or dialog boxes, and it's saved like any other state.  (See "User errors" in CLAUDE.md.)
- Several loops:  draw the reference image as it is.  No Fourier.
  Instead, an X where the Fourier would be, in one of the component's colors, at its line width.
- A specific message in the Visual Editor, not on the console.
- Worse values can still arrive, from IndexedDB or a file, even if no editor offers a way to type them.
  Fail gracefully, and make them easy to fix.

## What the numbers say

Choosing a pairing at each vertex gives 15⁷ = 170,859,375 states.  Counted by brute force, tracing each state's loops (35 seconds):

| Loops | States | Share |
| ----: | -----: | ----: |
| 1 | 64,988,160 | 38% |
| 2 | 72,118,080 | 42% |
| 3 | 28,319,040 | 17% |
| 4 | 5,016,060 | 3% |
| 5 | 405,720 | |
| 6 | 12,285 | |
| 7 | 30 | |

- **The 1-loop count is exactly the number of circuits** from `npm run count-circuits`.
  So each circuit is one choice of pairings, and each choice that makes one loop is a circuit.
  7 pairing numbers are a complete name for a circuit, with no start or direction.
- **The 30 with 7 loops** split K7 into 7 triangles.  Those are the 30 ways to label the Fano plane's points.  Maybe a fun aside for the video.
- **From any circuit, change one vertex:**  8 of the 15 pairings keep it one circuit (the current one and 7 others), 6 split it into 2 loops, and 1 splits it into 3.
  Checked at every vertex of all 9 named circuits.  It has to be that way:  the circuit passes through the vertex 3 times, and the count depends only on how those 3 visits get reconnected.
  So the list of 15 always has 7 safe choices, and the panel can say which.
- **Kotzig's theorem** (from memory; check a reference before it goes on screen):  any circuit can be turned into any other one vertex at a time, never leaving one loop.
  So the almost valid states are never required.  They're still worth allowing:  they're often the shorter path, and the natural one.

## What gets saved

Keep one Circuit field:  a string, with a discrete schedule.  Keyframes and saving keep working, and all three editors read and write the same thing.

Add a third spelling:  the 7 pairing numbers, vertex 0 first, like `Pairings 1 9 4 15 2 7 3`.
The numbers are the ones on the Vertex Pairings slide.  The word in front tells it apart from a list of vertices, since 10 to 15 need spaces between them.
Every string of that form is at least almost valid, so it can hold anything the vertex editor makes.

When the vertex editor changes something, it writes the most readable spelling that holds the result:

1. A name, if the result is one of the named circuits.  Matching pairings is exact, because of the count above.
2. Otherwise the vertices, if it's one loop.
3. Otherwise the pairings.

Keep the start and the direction.  A list of vertices says where the Fourier's dot starts, and which way it goes.  Pairings don't.
After a change, start the new list on the same first edge, going the same way.  Every state uses every edge, so that edge is always there.
Each step's curve is almost exactly the same shape either way, but the dot starts somewhere else, and so do the color runs.

The alternative is to always save pairings.  The rule is simpler, but you lose the readable list, and the start and direction.
My pick is the most readable spelling.

## What to draw

| The Circuit field holds | Fourier Rect | Reference Rect |
| --- | --- | --- |
| One circuit | the Fourier | rounded corners |
| Several loops | X | rounded corners, as is |
| Pairings, some of them unreadable (0, 16, the wrong count) | X | rounded where readable, sharp at the bad vertices |
| Vertices that aren't a circuit (an edge twice, one missing, too short, not closed) | X | the walk as typed, sharp corners |
| Nothing readable | X | X |

- **Drawing from pairings already works.**  `drawRoundedCircuit()` rounds each vertex from its pairing number, and the middle of each edge doesn't depend on the order.
  It would take 7 pairing numbers instead of a circuit, and the circuit version would call it.
- **A sharp vertex:**  every edge runs to the point, like the Vertex Pairings slide before it rounds the corners.  It shows exactly where to click to fix it.
- **Any list of vertices 0 to 6, with no vertex twice in a row, is a walk,** since every pair is joined.  So `circuitToPath()` can draw anything that gets past the first checks.
- **The X:**  corner to corner of the square the finished star would fill, so it lines up with what's missing.
  Circle Color, at Line Width.  The circle is the deepest color in each family, and red by default, like the library's old "missing image" X.
- **Nothing throws.**  An X is enough of a warning in a rendered video.
  The library's "throw when saving a file" is for external failures, like an image or a video that doesn't load while nobody's watching.  Overkill here.

## Messages

In the Visual Editor.  Specific, short, and saying what to do:

- `2 loops.  Vertices 1, 4 and 6 are on both.  Change one of those.`
- `3 loops, of 12, 6 and 3 edges.`  Then which vertices join which loops.
- `Vertex 3:  16 isn't a pairing number.  They're 1 to 15.`
- The parser's messages, as today:  `it uses the edge from 2 to 5 twice`.

In the vertex editor's list, each of the 15 choices says what it would do:  `✓ one circuit`, `2 loops`, `3 loops`.
That's 15 × 21 steps, nothing.

`assertEulerCircuit()` stays as it is.  It only checks the hand-picked circuits, when the module loads.
That's a programmer's mistake, so throwing is right.
User input already goes through `parseCircuit7()`, which returns a message instead of throwing.
Today that message is drawn in the Fourier Rect with `showError()`.  The change is where it goes:  to the panel, with the X on the canvas.

## The panel

Updated 2026-11-10, for library 0.7.3.  The priorities and reasons are at the top of `editor-panels.md`.

- **The messages are built:**  `src/editor-messages.ts`.  Star Circuit's `editorMessages()` says whether the circuit parses, and checks Term Groups and Step.  The messages above go there too, as more lines.
  They still use the old `rootComponentEditor` hook, top right.  Next, they move to `canvasRecorder.addEditorPanel()`, next to Star Circuit's properties.
- **The vertex editor is Star Circuit's own `editorPanel`,** also next to its properties.  A subclass can replace it, or wrap it.
  The library's own panels come first, then the component's own, then the `addEditorPanel()` ones.  So it would sit above the messages.
- **No library change needed now.**  0.7.3 fixed item 23 (a panel's change is saved, and is an undo step) and item 15 (a panel for any component).

The vertex editor itself:

- A small star in the panel, with 7 vertices to click.  Clicking the canvas itself would need a hit-test hook as well.  Later, if ever.
- Then the 15 pairings as a 5 × 3 grid of closeups:  the same layout and numbers as the Vertex Pairings slide, each marked with what it would do.
- Also in the panel:  the current value in every spelling that fits, to copy; the list of names; and "Start over", which puts back the default circuit.
  The names and "Start over" are the way out of anything unreadable.
- With several Circuit keyframes, it edits the one in effect at the playhead.

## Order

1. **No library change:**  the pairings spelling, the drawing table above, the X.
   The messages go to the panel, which exists now.  Keep a short one on the canvas, under the X, since there's nothing else to draw.
2. ~~The library's panel hook, with a Star Circuit panel that only shows the messages.~~  Done another way, 2026-11-08:  `src/editor-messages.ts`.
3. ~~Library item 23,~~ so the panel's changes are saved.  Fixed in 0.7.3.
4. **Move the messages to `addEditorPanel()`.**  Small.  Step 2 at the top of `editor-panels.md`.
5. **The vertex editor,** as Star Circuit's `editorPanel`.

## Questions for later

- Most readable spelling, or always pairings?
- Does the start vertex matter on screen?
- A reference image with several loops:  show which edge belongs to which loop?
  Colors already mean edge type, so maybe dashes, or fade the smaller loops.  "As is" for now.
- Someday, a Fourier of several loops:  one animation each, or one joined by connecting lines that fade out.
  The same idea as Peano vs Fourier's long diagonal, in CLAUDE.md.
