/**
 * Help for commands typed on the console, like `philDebug.eightPack.setSteps()`:
 * what's chosen in the Edit list, and a way to save what they change.
 *
 * Buttons don't need this.  A panel saves through its own `EditorPanelAPI`.  See `script-panel.ts`.
 * @module
 */

import {
  type RootComponentEditor,
  type Showable,
  type VisualEditorAPI,
} from "canvas-recorder-lib";
import { philDebug } from "canvas-recorder-lib/src/utility";

/**
 * The Visual Editor's root:  what's chosen in the Edit list.
 * @throws If the Visual Editor isn't open.
 */
export function root(): Showable {
  const result: Showable | undefined = philDebug.VisualEditor?.rootComponent;
  if (!result) {
    throw new Error("Open the Visual Editor first.");
  }
  return result;
}

// MARK: Saving

/**
 * What the Visual Editor gave the panel of the root chosen now.
 * `undefined` when that root has no panel, or the editor isn't open.
 */
let activeEditor: VisualEditorAPI | undefined;

/**
 * Tell the Visual Editor that something outside it, like a console command, changed some fields.
 * It saves them, to IndexedDB and to the synced files in `properties/`, redraws, and rebuilds its tables.
 * The selection stays where it was.
 *
 * Only values:  a command that adds or removes components needs `refreshGUI("structure")`.
 * @returns false when the root chosen in the Edit list has no panel, so nothing was saved yet.
 * The next edit in the Visual Editor saves everything.
 */
export function saveOutsideChanges(): boolean {
  if (!activeEditor) {
    return false;
  }
  activeEditor.refreshGUI("properties");
  return true;
}

/**
 * The console has no way to save (`library-issues.md`, item 28), so this borrows the one a root's panel gets.
 * The panel shows nothing.  It's only there to hold on to the `VisualEditorAPI`.
 *
 * Each root needs its own, because the editor only restarts the panel when the root's panel is a different object.
 */
function savingPanel(): RootComponentEditor {
  let editor: VisualEditorAPI | undefined;
  return {
    start(visualEditor) {
      editor = activeEditor = visualEditor;
      const nothing = document.createElement("div");
      nothing.hidden = true;
      return nothing;
    },
    suspend() {
      // Another root's panel may have started already.
      if (activeEditor === editor) {
        activeEditor = undefined;
      }
      editor = undefined;
    },
    update() {},
    selectionChanged() {},
    resetAll() {},
  };
}

/**
 * Let console commands save while `root` is chosen in the Edit list.  See {@link saveOutsideChanges}.
 * Does nothing the second time.
 */
export function allowConsoleSaving(root: Showable) {
  // Showable says readonly, but none of the library's components set it, so it's free to fill in.
  const writable = root as { rootComponentEditor?: RootComponentEditor };
  writable.rootComponentEditor ??= savingPanel();
}
