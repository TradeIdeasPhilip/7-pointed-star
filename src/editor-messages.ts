/**
 * Messages from this project's components, shown in the Visual Editor:  what's wrong, and what's fine.
 *
 * A stopgap.  The library has no way yet for a component to add a panel next to its own properties
 * (`development-plans/library-issues.md`, item 15).
 * The hook it does have is `Showable.rootComponentEditor`, for whatever is chosen in the Edit list:
 * the whole video, one scene, or anything else with a duration.  `addScene()` gives the video and each scene one of these panels,
 * and each Star Circuit gives itself one.
 * It sits at the top of the component list, top right, and shows the messages of the selected component.
 * When the library has a panel hook for any component, the messages move there, unchanged.
 *
 * A component opts in with an `editorMessages()` method.  See {@link HasEditorMessages}.
 *
 * Nothing here touches the DOM until the Visual Editor calls `start()`.
 * @module
 */

import type {
  RootComponentEditor,
  Showable,
  VisualEditorAPI,
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
    if (!hasEditorMessages(selected)) {
      panel.hidden = true;
      return;
    }
    let messages: readonly EditorMessage[];
    try {
      messages = selected.editorMessages();
    } catch (reason) {
      // A bug in a component mustn't break the editor.
      messages = [
        { level: "error", text: `editorMessages() threw:  ${String(reason)}` },
      ];
    }
    panel.hidden = false;
    legend.textContent =
      selected.userEditableDescription ?? selected.description;
    lines.replaceChildren(
      ...messages.map(({ level, text }) => {
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
      }),
    );
  }
  function refresh() {
    if (editor) {
      show(editor.getCurrentlySelected());
    }
  }
  return {
    start(visualEditor) {
      editor = visualEditor;
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
