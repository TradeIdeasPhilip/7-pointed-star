/**
 * Messages from this project's components, shown in the Visual Editor:  what's wrong, and what's fine.
 * A component opts in with an `editorMessages()` method.  See {@link HasEditorMessages}.
 *
 * They show bottom right, in a box called "Checks", with the selected component's properties.
 * That's library 0.7.3's `canvasRecorder.addEditorPanel()`, so it works however the component was selected:
 * in the component list, on the timeline, or as the root in the Edit list.
 *
 * Nothing here touches the DOM until the Visual Editor calls `start()`.
 * @module
 */

import {
  canvasRecorder,
  type EditorPanel,
  type Showable,
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

/** One panel object for the life of `component`.  No DOM until `start()`. */
function messagesPanel(component: HasEditorMessages): EditorPanel {
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
// After the component's own panel, if it has one, like the Fourier step panel.
canvasRecorder.addEditorPanel((component) =>
  hasEditorMessages(component) ? messagesPanel(component) : undefined,
);
