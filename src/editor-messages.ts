/**
 * Messages from this project's components, shown in the Visual Editor:  what's wrong, and what's fine.
 * A component opts in with an `editorMessages()` method.  See {@link HasEditorMessages}.
 *
 * Moving from the old hook to the new one, one component at a time:
 * * **The new hook,** library 0.7.3's `canvasRecorder.addEditorPanel()`:  bottom right, with the selected component's properties.
 *   A component moves here by calling {@link showMessagesWithProperties} from its constructor.  Bridged Fourier does.
 * * **The old hook,** `Showable.rootComponentEditor`, for whatever is chosen in the Edit list.
 *   `addScene()` gives the video and each scene one of these panels, and each Star Circuit gives itself one.
 *   It sits at the top of the component list, top right, and shows the messages of the selected component,
 *   unless that component has moved to the new hook.
 *
 * When every component has moved, the old panel only has {@link saveOutsideChanges} left to do,
 * and that needs it until the console can save without a panel (`library-issues.md`, item 28).
 *
 * Nothing here touches the DOM until the Visual Editor calls `start()`.
 * @module
 */

import {
  canvasRecorder,
  type EditorPanel,
  type RootComponentEditor,
  type Showable,
  type VisualEditorAPI,
} from "canvas-recorder-lib";

/** One line in the panel. */
export type EditorMessage = {
  /** Styled like the library's Fourier panel:  ✓ green, ✗ red, ⚠ orange, and plain gray. */
  readonly level: "ok" | "error" | "warning" | "note";
  readonly text: string;
};

/** A component with messages for the Visual Editor. */
export type HasEditorMessages = {
  /**
   * What's wrong, or fine, with the current settings.
   * Called after every keystroke in any of the component's fields, so keep it quick.
   * Only the Visual Editor calls this.
   */
  editorMessages(): readonly EditorMessage[];
};

function hasEditorMessages(
  showable: Showable,
): showable is Showable & HasEditorMessages {
  return (
    typeof (showable as Partial<HasEditorMessages>).editorMessages ===
    "function"
  );
}

/** The component's messages.  A bug in a component mustn't break the editor, so a throw becomes one more message. */
function readMessages(component: HasEditorMessages): readonly EditorMessage[] {
  try {
    return component.editorMessages();
  } catch (reason) {
    return [
      { level: "error", text: `editorMessages() threw:  ${String(reason)}` },
    ];
  }
}

/** One line for each message, styled like the library's Fourier panel. */
function messageLines(messages: readonly EditorMessage[]): HTMLDivElement[] {
  return messages.map(({ level, text }) => {
    const line = document.createElement("div");
    switch (level) {
      case "ok":
        line.textContent = `${text}  ✓`;
        line.style.color = "#070";
        break;
      case "error":
        line.textContent = `✗ ${text}`;
        line.style.color = "#b00";
        break;
      case "warning":
        line.textContent = `⚠ ${text}`;
        line.style.color = "#a06000";
        break;
      case "note":
        line.textContent = text;
        line.style.color = "#555";
        break;
    }
    return line;
  });
}

// MARK: The new hook

/** Components whose messages are on the new hook.  The old panel leaves them alone. */
const withProperties = new WeakSet<Showable>();

/**
 * Show this component's messages bottom right, with its properties, on the library's new hook, instead of top right.
 * Call it from the constructor, so it's set before the Visual Editor first asks.
 */
export function showMessagesWithProperties(
  component: Showable & HasEditorMessages,
) {
  withProperties.add(component);
}

/** One panel object for the life of `component`.  No DOM until `start()`. */
function propertiesMessagesPanel(
  component: Showable & HasEditorMessages,
): EditorPanel {
  let lines: HTMLDivElement | undefined;
  /** What the panel shows now, so an update that changes nothing doesn't touch it. */
  let shown = "";
  function refresh() {
    if (!lines) {
      return;
    }
    const messages = readMessages(component);
    const key = JSON.stringify(messages);
    if (key == shown) {
      return;
    }
    shown = key;
    lines.replaceChildren(...messageLines(messages));
  }
  return {
    start() {
      shown = "";
      const panel = document.createElement("fieldset");
      panel.style.cssText = "border-color:#6a7fae;margin-bottom:0.4em";
      const legend = document.createElement("legend");
      legend.textContent = "Checks";
      lines = document.createElement("div");
      lines.style.cssText = "font-size:0.9em;line-height:1.4";
      panel.append(legend, lines);
      refresh();
      return panel;
    },
    suspend() {
      lines = undefined;
    },
    // After every keystroke.  The messages don't depend on the playhead.
    update: refresh,
  };
}

// The library asks once for each component, the first time it shows that component's properties.
canvasRecorder.addEditorPanel((component) =>
  withProperties.has(component) && hasEditorMessages(component)
    ? propertiesMessagesPanel(component)
    : undefined,
);

// MARK: The old hook

/** What the Visual Editor gave the panel showing now.  `undefined` when the root has no panel, or the editor isn't open. */
let activeEditor: VisualEditorAPI | undefined;

/**
 * Tell the Visual Editor that something outside it, like a console command, changed some fields.
 * It saves them, to IndexedDB and to the synced files in `properties/`, and rebuilds its tables.
 *
 * The selection goes back to the root.  That's the only kind of refresh that saves (library item 23).
 * @returns false when no panel is showing, so nothing was saved yet.  The next edit in the Visual Editor saves everything.
 */
export function saveOutsideChanges(): boolean {
  if (!activeEditor) {
    return false;
  }
  activeEditor.refreshGUI("structure");
  return true;
}

/**
 * The panel for one root:  the whole video or one scene.
 * Each root needs its own, because the editor only restarts the panel when the root's panel is a different object.
 * @param owner What's selected right after a new root is chosen.  The editor doesn't say so at that moment.
 */
function messagesPanel(owner: Showable): RootComponentEditor {
  let editor: VisualEditorAPI | undefined;
  let panel: HTMLFieldSetElement | undefined;
  let legend: HTMLLegendElement | undefined;
  let lines: HTMLDivElement | undefined;
  function show(selected: Showable) {
    if (!panel || !legend || !lines) {
      return;
    }
    // A component on the new hook shows its messages with its properties instead.
    if (!hasEditorMessages(selected) || withProperties.has(selected)) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    legend.textContent =
      selected.userEditableDescription ?? selected.description;
    lines.replaceChildren(...messageLines(readMessages(selected)));
  }
  function refresh() {
    if (editor) {
      show(editor.getCurrentlySelected());
    }
  }
  return {
    start(visualEditor) {
      editor = visualEditor;
      activeEditor = visualEditor;
      panel = document.createElement("fieldset");
      panel.style.cssText = "border-color:#6a7fae;margin-bottom:0.4em";
      legend = document.createElement("legend");
      lines = document.createElement("div");
      lines.style.cssText = "font-size:0.9em;line-height:1.4";
      panel.append(legend, lines);
      show(owner);
      return panel;
    },
    suspend() {
      // Another root's panel may have started already.
      if (activeEditor === editor) {
        activeEditor = undefined;
      }
      editor = undefined;
      panel = legend = lines = undefined;
    },
    update: refresh,
    selectionChanged: show,
    resetAll: refresh,
  };
}

/** Show the selected component's messages whenever `root` is chosen in the Edit list.  Does nothing the second time. */
export function addEditorMessages(root: Showable) {
  // Showable says readonly, but none of the library's components set it, so it's free to fill in.
  const writable = root as { rootComponentEditor?: RootComponentEditor };
  writable.rootComponentEditor ??= messagesPanel(root);
}
