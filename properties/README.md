# Properties

Saved Visual Editor state, so it's in git.
The editor always saves your work inside the browser (IndexedDB), but that isn't visible to git.

Three file types, all named after the `name` passed to `canvasRecorder.start()`, `7-pointed-star`:

| File | What it is |
| --- | --- |
| `<name>.json` | The saved state — the same thing 💾 [Save](https://github.com/TradeIdeasPhilip/canvas-recorder/blob/master/development-plans/saving-and-undoing.md#save) writes. |
| `<name>-ts-defaults.json` | The **TypeScript defaults**: the state as defined in code, before any Visual Editor changes. Same content as the "Save defaults" checkbox writes. See [Smarter Save Status](https://github.com/TradeIdeasPhilip/canvas-recorder/blob/master/development-plans/smarter-save-status.md#saving-the-status). |
| `<name>.txt` | A **diff**, not a log — a human-readable comparison of the live tree against the TypeScript defaults. Produced by the "Save Diffs" button. The `.txt` extension hides this, hence this table. |

To fill this folder, use **💾 Save As**, the **Save defaults** checkbox, and **Save Diffs**, pointing each at this folder.
The browser remembers each choice, so after the first time they keep saving here.
